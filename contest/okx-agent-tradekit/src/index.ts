import { config } from 'dotenv';
import { runOkxCliCommand } from './cli-utils.js';
import { analyzeMarketSentiment, MarketSentimentInput } from './market-sentiment.js';
import { calculateTechnicalIndicators, OkxIndicatorCandle, TechnicalIndicatorSnapshot } from './technical-indicators.js';

config();

interface Candle {
  ts: string;
  o: string;
  h: string;
  l: string;
  c: string;
  vol: string;
  volCcy: string;
}

interface FundingRate {
  instId: string;
  instType: string;
  fundingRate: string;
  nextFundingRate: string;
  fundingTime: string;
}

interface OpenInterest {
  instId: string;
  instType: string;
  oi: string;
  oiCcy: string;
  ts: string;
}

interface InstrumentMeta {
  instId: string;
  ctVal: string;
  lotSz: string;
  minSz: string;
  tickSz: string;
  lever: string;
}

interface AccountBalanceRow {
  currency?: string;
  ccy?: string;
  equity?: string | number;
  eq?: string | number;
  available?: string | number;
  availBal?: string | number;
  frozen?: string | number;
}

interface Position {
  instId: string;
  posId?: string;
  posSide?: 'long' | 'short' | 'net';
  mgnMode?: 'cross' | 'isolated';
  pos?: string;
  avgPx?: string;
  upl?: string;
  uplRatio?: string;
  liqPx?: string;
  lever?: string;
  margin?: string;
  cTime?: string;
}

interface MarketBundle {
  instId: string;
  candles: Candle[];
  fundingRate: FundingRate | null;
  openInterest: OpenInterest | null;
  technicalIndicators: TechnicalIndicatorSnapshot;
  sentiment: ReturnType<typeof analyzeMarketSentiment>;
  instrumentMeta: InstrumentMeta;
  lastPrice: number;
  atrRatio: number | null;
}

interface TradingDecision {
  action: 'BUY' | 'SELL' | 'HOLD' | 'SKIP';
  instId: string;
  side?: 'buy' | 'sell';
  size?: number;
  leverage?: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  maxNotional?: number;
  confidence: number;
  reason: string;
}

interface OrderVerification {
  ordId?: string;
  tagVerified: boolean;
  stopLossVerified: boolean;
  takeProfitVerified: boolean;
  raw: any;
}

const SYMBOLS = ['BTC-USDT-SWAP', 'ETH-USDT-SWAP', 'SOL-USDT-SWAP'];
const INTERVAL = '4H';
const ANALYZE_INTERVAL_MS = 4 * 60 * 60 * 1000;
const POSITION_CHECK_MS = 60 * 1000;
const TEST_LEVERAGE = 2;
const TEST_MAX_CAPITAL_RATIO = 0.2;
const TEST_MAX_NOTIONAL_CAP = 40;
const TEST_MONITOR_ROUNDS = 3;
const TEST_MONITOR_INTERVAL_MS = 5000;

let hadOpenPosition = false;
let testEventTriggered = false;

function parseNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function roundTo(value: number, digits = 4) {
  return Number(value.toFixed(digits));
}

function floorToStep(value: number, step: number) {
  if (step <= 0) return value;
  return Math.floor(value / step) * step;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findKeyDeep(target: any, matcher: (key: string, value: any) => boolean): any[] {
  const matches: any[] = [];
  const visit = (node: any) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node && typeof node === 'object') {
      Object.entries(node).forEach(([key, value]) => {
        if (matcher(key, value)) {
          matches.push(value);
        }
        visit(value);
      });
    }
  };
  visit(target);
  return matches;
}

function extractOrdId(raw: any): string | undefined {
  const ordIds = findKeyDeep(raw, (key, value) => key === 'ordId' && typeof value === 'string');
  return ordIds[0];
}

function extractRows<T>(raw: any): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && Array.isArray(raw.data)) return raw.data as T[];
  if (raw && Array.isArray(raw.rows)) return raw.rows as T[];
  return [];
}

async function getUsdtBalance(): Promise<{ equity: number; available: number }> {
  const result = await runOkxCliCommand('account balance --ccy USDT');
  if (!result.success || !result.data) {
    throw new Error(`获取账户余额失败: ${result.error}`);
  }
  const rows = extractRows<any>(result.data);
  const topLevel = rows[0] ?? {};
  const details = Array.isArray(topLevel.details) ? topLevel.details : [];
  const detailRow = details.find((item: any) => (item.currency ?? item.ccy) === 'USDT') ?? details[0] ?? {};
  return {
    equity: parseNumber(detailRow.eq ?? detailRow.equity ?? topLevel.totalEq),
    available: parseNumber(detailRow.availBal ?? detailRow.available ?? detailRow.availEq),
  };
}

async function getCandles(instId: string, limit = 100): Promise<Candle[]> {
  const result = await runOkxCliCommand(`market candles ${instId} --bar ${INTERVAL} --limit ${limit}`);
  if (!result.success || !result.data) {
    throw new Error(`获取K线失败 ${instId}: ${result.error}`);
  }
  return extractRows<string[]>(result.data).map((row) => ({
    ts: row[0],
    o: row[1],
    h: row[2],
    l: row[3],
    c: row[4],
    vol: row[5],
    volCcy: row[6],
  }));
}

async function getFundingRate(instId: string, history = false, limit = 1): Promise<FundingRate[]> {
  const result = await runOkxCliCommand(`market funding-rate ${instId} ${history ? '--history' : ''} --limit ${limit}`);
  if (!result.success || !result.data) {
    return [];
  }
  return extractRows<FundingRate>(result.data);
}

async function getOpenInterest(instId: string): Promise<OpenInterest | null> {
  const result = await runOkxCliCommand(`market open-interest --instType SWAP --instId ${instId}`);
  if (!result.success || !result.data) {
    return null;
  }
  return extractRows<OpenInterest>(result.data)[0] ?? null;
}

async function getInstrumentMeta(instId: string): Promise<InstrumentMeta> {
  const result = await runOkxCliCommand(`market instruments --instType SWAP --instId ${instId}`);
  if (!result.success || !result.data) {
    throw new Error(`获取合约元数据失败 ${instId}: ${result.error}`);
  }
  const meta = extractRows<InstrumentMeta>(result.data)[0];
  if (!meta) {
    throw new Error(`未找到合约元数据 ${instId}`);
  }
  return meta;
}

async function setLeverage(instId: string, leverage: number) {
  const result = await runOkxCliCommand(`swap leverage --instId ${instId} --lever ${leverage} --mgnMode cross`);
  if (!result.success) {
    throw new Error(`设置杠杆失败 ${instId}: ${result.error}`);
  }
  return result.data;
}

async function getOpenPositions(instId?: string): Promise<Position[]> {
  const result = await runOkxCliCommand(instId ? `swap positions ${instId}` : 'swap positions');
  if (!result.success || !result.data) {
    return [];
  }
  const rows = extractRows<Position>(result.data);
  return rows.filter((item) => parseNumber(item.pos) !== 0);
}

async function getOrderHistory(instId: string) {
  const result = await runOkxCliCommand(`swap orders --instId ${instId} --history`);
  if (!result.success || !result.data) {
    return [];
  }
  return extractRows<any>(result.data);
}

async function getOrderDetail(instId: string, ordId: string) {
  const result = await runOkxCliCommand(`swap get --instId ${instId} --ordId ${ordId}`);
  if (!result.success) {
    return null;
  }
  return result.data;
}

async function closePosition(instId: string, posSide: 'net' | 'long' | 'short' = 'net') {
  const result = await runOkxCliCommand(`swap close --instId ${instId} --mgnMode cross --posSide ${posSide}`);
  if (!result.success) {
    throw new Error(`平仓失败 ${instId}: ${result.error}`);
  }
  return result.data;
}

async function collectMarketData(instId: string): Promise<MarketBundle> {
  const [candles, currentFunding, historyFunding, openInterest, meta] = await Promise.all([
    getCandles(instId, 120),
    getFundingRate(instId, false, 1),
    getFundingRate(instId, true, 2),
    getOpenInterest(instId),
    getInstrumentMeta(instId),
  ]);

  const formattedCandles: OkxIndicatorCandle[] = candles.map((item) => ({
    ts: parseNumber(item.ts),
    open: parseNumber(item.o),
    high: parseNumber(item.h),
    low: parseNumber(item.l),
    close: parseNumber(item.c),
    volume: parseNumber(item.vol),
  }));

  const technicalIndicators = calculateTechnicalIndicators(formattedCandles);
  const fundingRateChange = historyFunding.length >= 2 ? parseNumber(historyFunding[0].fundingRate) - parseNumber(historyFunding[1].fundingRate) : null;
  const lastPrice = formattedCandles[formattedCandles.length - 1]?.close ?? 0;
  const atrRatio = technicalIndicators.atr14 && lastPrice > 0 ? technicalIndicators.atr14 / lastPrice : null;

  const sentimentInput: MarketSentimentInput = {
    fundingRate: currentFunding[0] ? parseNumber(currentFunding[0].fundingRate) : null,
    fundingRateChange,
    openInterest: openInterest ? parseNumber(openInterest.oi) : null,
    openInterestChangeRatio: null,
    realizedVolatility: atrRatio,
    priceChangeRatio: formattedCandles.length >= 2 ? (formattedCandles[formattedCandles.length - 1].close - formattedCandles[0].close) / formattedCandles[0].close : null,
    technical: technicalIndicators,
  };

  return {
    instId,
    candles,
    fundingRate: currentFunding[0] ?? null,
    openInterest,
    technicalIndicators,
    sentiment: analyzeMarketSentiment(sentimentInput),
    instrumentMeta: meta,
    lastPrice,
    atrRatio,
  };
}

function chooseBestMarket(markets: MarketBundle[]) {
  return markets
    .map((item) => ({
      item,
      rank: item.sentiment.confidence + Math.abs(item.sentiment.score - 50) + (item.sentiment.signals.length * 1.5),
    }))
    .sort((a, b) => b.rank - a.rank)[0]?.item;
}

async function makeTradingDecision(markets: MarketBundle[], options: { forceTrade?: boolean } = {}): Promise<TradingDecision> {
  const best = chooseBestMarket(markets);
  if (!best) {
    return { action: 'SKIP', instId: 'N/A', confidence: 0, reason: '无可用行情数据。' };
  }

  const balance = await getUsdtBalance();
  const funding = best.fundingRate ? parseNumber(best.fundingRate.fundingRate) : 0;
  const atrRatio = best.atrRatio ?? 0;
  const maxNotionalBase = Math.min(balance.available * TEST_MAX_CAPITAL_RATIO, TEST_MAX_NOTIONAL_CAP);
  let positionMultiplier = 1;
  const reasons: string[] = [];

  if (Math.abs(funding) > 0.001) {
    positionMultiplier *= 0.5;
    reasons.push(`资金费率异常 ${roundTo(funding * 100, 3)}%，仓位减半`);
  }

  if (atrRatio > 0.035) {
    positionMultiplier *= 0.7;
    reasons.push(`ATR占比 ${roundTo(atrRatio * 100, 2)}% 偏高，继续降仓`);
  }

  if (atrRatio > 0 && atrRatio < 0.003) {
    return {
      action: 'SKIP',
      instId: best.instId,
      confidence: roundTo(best.sentiment.confidence * 0.5, 2),
      reason: `ATR占比 ${roundTo(atrRatio * 100, 2)}% 过低，跳过交易。`,
    };
  }

  let side: 'buy' | 'sell' | undefined;
  let action: TradingDecision['action'] = 'HOLD';
  if (best.sentiment.bias === '强多' || best.sentiment.bias === '偏多') {
    side = 'buy';
    action = 'BUY';
    reasons.unshift(`综合评分 ${best.sentiment.score}，${best.instId} 多头信号最强`);
  } else if (best.sentiment.bias === '强空' || best.sentiment.bias === '偏空') {
    side = 'sell';
    action = 'SELL';
    reasons.unshift(`综合评分 ${best.sentiment.score}，${best.instId} 空头信号最强`);
  } else if (options.forceTrade) {
    const emaBull = (best.technicalIndicators.ema7 ?? 0) >= (best.technicalIndicators.ema25 ?? 0);
    const macdBull = (best.technicalIndicators.macdHistogram ?? 0) >= 0;
    side = emaBull || macdBull ? 'buy' : 'sell';
    action = side === 'buy' ? 'BUY' : 'SELL';
    positionMultiplier = Math.min(positionMultiplier, 0.35);
    reasons.unshift(`${best.instId} 当前无强趋势，切换为受控功能测试单`);
  } else {
    return {
      action: 'HOLD',
      instId: best.instId,
      confidence: best.sentiment.confidence,
      reason: `${best.instId} 当前偏中性，保持观望。`,
    };
  }

  const ctVal = parseNumber(best.instrumentMeta.ctVal);
  const lotSz = parseNumber(best.instrumentMeta.lotSz, 0.01);
  const minSz = parseNumber(best.instrumentMeta.minSz, lotSz);
  const rawSize = (maxNotionalBase * positionMultiplier) / Math.max(best.lastPrice * ctVal, 0.0000001);
  const size = Math.max(floorToStep(rawSize, lotSz), minSz);
  const realNotional = size * ctVal * best.lastPrice;

  if (realNotional > maxNotionalBase * 1.05) {
    const adjustedSize = floorToStep(maxNotionalBase / Math.max(best.lastPrice * ctVal, 0.0000001), lotSz);
    if (adjustedSize < minSz) {
      return {
        action: 'SKIP',
        instId: best.instId,
        confidence: best.sentiment.confidence,
        reason: '最小下单张数已超过测试上限，跳过。',
      };
    }
    const adjustedNotional = adjustedSize * ctVal * best.lastPrice;
    const riskBuffer = Math.max(best.technicalIndicators.atr14 ?? 0, best.lastPrice * 0.006);
    return {
      action,
      instId: best.instId,
      side,
      size: roundTo(adjustedSize, 8),
      leverage: TEST_LEVERAGE,
      maxNotional: roundTo(adjustedNotional, 4),
      stopLossPrice: side === 'buy' ? roundTo(best.lastPrice - riskBuffer * 1.2, 4) : roundTo(best.lastPrice + riskBuffer * 1.2, 4),
      takeProfitPrice: side === 'buy' ? roundTo(best.lastPrice + riskBuffer * 2.4, 4) : roundTo(best.lastPrice - riskBuffer * 2.4, 4),
      confidence: best.sentiment.confidence,
      reason: `${reasons.join('；')}；测试仓位限制为不超过40 USDT名义价值。`,
    };
  }

  const riskBuffer = Math.max(best.technicalIndicators.atr14 ?? 0, best.lastPrice * 0.006);

  return {
    action,
    instId: best.instId,
    side,
    size: roundTo(size, 8),
    leverage: TEST_LEVERAGE,
    maxNotional: roundTo(realNotional, 4),
    stopLossPrice: side === 'buy' ? roundTo(best.lastPrice - riskBuffer * 1.2, 4) : roundTo(best.lastPrice + riskBuffer * 1.2, 4),
    takeProfitPrice: side === 'buy' ? roundTo(best.lastPrice + riskBuffer * 2.4, 4) : roundTo(best.lastPrice - riskBuffer * 2.4, 4),
    confidence: best.sentiment.confidence,
    reason: `${reasons.join('；')}；使用${TEST_LEVERAGE}倍低杠杆测试。`,
  };
}

async function placeOrder(decision: TradingDecision) {
  if (!(decision.action === 'BUY' || decision.action === 'SELL') || !decision.side || !decision.size || !decision.leverage) {
    throw new Error(`当前决策不可下单: ${JSON.stringify(decision)}`);
  }

  await setLeverage(decision.instId, decision.leverage);
  let command = `swap place --instId ${decision.instId} --side ${decision.side} --ordType market --sz ${decision.size} --tdMode cross`;
  if (decision.stopLossPrice) {
    command += ` --slTriggerPx ${decision.stopLossPrice} --slOrdPx=-1`;
  }
  if (decision.takeProfitPrice) {
    command += ` --tpTriggerPx ${decision.takeProfitPrice} --tpOrdPx=-1`;
  }

  console.log(`下单命令: ${command}`);
  const result = await runOkxCliCommand(command);
  if (!result.success) {
    throw new Error(`下单失败: ${result.error}`);
  }
  hadOpenPosition = true;
  return result.data;
}

async function verifyOrder(decision: TradingDecision, placeRaw: any): Promise<OrderVerification> {
  const ordId = extractOrdId(placeRaw);
  const orderDetail = ordId ? await getOrderDetail(decision.instId, ordId) : null;
  const orderHistory = await getOrderHistory(decision.instId);
  const combined = { placeRaw, orderDetail, orderHistory };

  const tagValues = findKeyDeep(combined, (key, value) => /tag/i.test(key) && typeof value === 'string');
  const slValues = findKeyDeep(combined, (key) => /sl/i.test(key));
  const tpValues = findKeyDeep(combined, (key) => /tp/i.test(key));

  return {
    ordId,
    tagVerified: tagValues.some((value) => String(value).includes('agentTradeKit')),
    stopLossVerified: slValues.length > 0,
    takeProfitVerified: tpValues.length > 0,
    raw: combined,
  };
}

async function monitorPosition(instId: string, rounds = TEST_MONITOR_ROUNDS) {
  const snapshots: Position[][] = [];
  for (let i = 0; i < rounds; i += 1) {
    const positions = await getOpenPositions(instId);
    snapshots.push(positions);
    console.log(`监控第 ${i + 1} 轮，持仓数: ${positions.length}`);
    positions.forEach((pos) => {
      console.log(`持仓 ${pos.instId} side=${pos.posSide ?? 'net'} size=${pos.pos} avgPx=${pos.avgPx} upl=${pos.upl}`);
    });
    if (i < rounds - 1) {
      await sleep(TEST_MONITOR_INTERVAL_MS);
    }
  }
  return snapshots;
}

async function checkAndReanalyze(options: { dryRunAfterClose?: boolean } = {}) {
  const positions = await getOpenPositions();
  if (positions.length === 0 && hadOpenPosition) {
    console.log('检测到仓位已关闭，触发事件驱动重新分析。');
    hadOpenPosition = false;
    testEventTriggered = true;
    await executeStrategy({ dryRun: Boolean(options.dryRunAfterClose), source: 'event-driven' });
  } else if (positions.length > 0) {
    hadOpenPosition = true;
    console.log(`仍有 ${positions.length} 个持仓，事件驱动暂不触发。`);
  } else {
    console.log('当前无持仓。');
  }
}

async function executeStrategy(options: { dryRun?: boolean; source?: string; forceTrade?: boolean } = {}) {
  const bundles = [] as MarketBundle[];
  for (const symbol of SYMBOLS) {
    console.log(`分析 ${symbol} ...`);
    bundles.push(await collectMarketData(symbol));
  }
  const decision = await makeTradingDecision(bundles, { forceTrade: options.forceTrade });
  console.log(`决策来源: ${options.source ?? 'scheduled'}`);
  console.log(`决策: ${decision.action} ${decision.instId} size=${decision.size ?? 'N/A'} leverage=${decision.leverage ?? 'N/A'} confidence=${decision.confidence}`);
  console.log(`原因: ${decision.reason}`);

  if (options.dryRun || !(decision.action === 'BUY' || decision.action === 'SELL')) {
    return { decision, dryRun: true };
  }

  const placeRaw = await placeOrder(decision);
  const verification = await verifyOrder(decision, placeRaw);
  return { decision, placeRaw, verification, dryRun: false };
}

async function runFullTestCycle() {
  console.log('开始实盘小仓位全流程测试。');
  const balanceBefore = await getUsdtBalance();
  console.log(`测试前余额: equity=${balanceBefore.equity} available=${balanceBefore.available}`);

  let execution = await executeStrategy({ source: 'manual-test' });
  if (execution.dryRun || !('verification' in execution)) {
    console.log('当前无明确趋势信号，改为执行受控功能测试单。');
    execution = await executeStrategy({ source: 'manual-test-force', forceTrade: true });
  }
  if (execution.dryRun || !('verification' in execution)) {
    throw new Error('即使启用功能测试单，仍未形成可执行订单。');
  }

  const verification = execution.verification!;
  console.log(`下单验证: ordId=${verification.ordId ?? 'N/A'} tag=${verification.tagVerified} sl=${verification.stopLossVerified} tp=${verification.takeProfitVerified}`);

  const monitored = await monitorPosition(execution.decision.instId);
  const latestPositions = monitored[monitored.length - 1] ?? [];
  if (latestPositions.length === 0) {
    throw new Error('下单后未监控到持仓，无法继续测试。');
  }

  console.log('为验证事件驱动，执行一次受控平仓。');
  await closePosition(execution.decision.instId, 'net');
  await sleep(4000);
  await checkAndReanalyze({ dryRunAfterClose: true });

  const balanceAfter = await getUsdtBalance();
  const positionsAfter = await getOpenPositions();

  return {
    balanceBefore,
    execution,
    monitored,
    balanceAfter,
    positionsAfter,
    eventTriggered: testEventTriggered,
  };
}

async function startBotLoop() {
  console.log('正式策略模式启动。');
  await executeStrategy({ source: 'startup' });
  setInterval(async () => {
    await executeStrategy({ source: 'timed-4h' });
  }, ANALYZE_INTERVAL_MS);
  setInterval(async () => {
    await checkAndReanalyze();
  }, POSITION_CHECK_MS);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--test-cycle')) {
    const summary = await runFullTestCycle();
    console.log('测试完成摘要:');
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  if (args.includes('--once')) {
    const result = await executeStrategy({ source: 'once' });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  await startBotLoop();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
