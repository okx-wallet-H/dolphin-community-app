import { analyzeMarketSentiment, optimizeGridParameters } from "../../src/services/ai/index";
import { buildTechnicalSnapshot } from "../../src/services/indicators/index";
import { OkxGridBotService, okxMarketDataService } from "../../src/services/okx/index";
import type { OkxGridAlgoSummary, OkxGridDirection } from "../../src/services/okx/grid-bot-types";
import { ENV } from "./env";
import { monitorGridStrategy } from "./grid-strategy-monitor";
import {
  appendGridStrategyLog,
  createGridStrategyRecord,
  findLatestGridStrategy,
  getGridStrategyLogs,
  markGridStrategyStopped,
  updateGridStrategy,
} from "./grid-strategy-store";
import {
  assertGridCreateAllowed,
  assertGridStopAllowed,
  buildGridControlSummary,
  hasOkxPrivateCredentials,
} from "./grid-runtime-config";

const okxGridBotService = new OkxGridBotService();

type GridAction = "create" | "status" | "stop" | "unknown";
type RiskLevel = "保守" | "均衡" | "进取";

type ParsedGridIntent = {
  action: GridAction;
  instId?: string;
  budget?: number;
  riskLevel: RiskLevel;
  direction?: OkxGridDirection;
  rawMessage: string;
};

type GridControlSummary = ReturnType<typeof buildGridControlSummary>;

type GridCardKind = "grid-create" | "grid-status" | "grid-explanation" | "grid-log";

export type GridStructuredCard = {
  kind: GridCardKind;
  title: string;
  data: Record<string, unknown>;
};

type CreateGridStrategyResult = {
  success: true;
  action: "create";
  mockMode: boolean;
  strategyId: string;
  algoId?: string;
  message: string;
  execution: GridControlSummary;
  cards: GridStructuredCard[];
  analysis: {
    instId: string;
    sentiment: ReturnType<typeof analyzeMarketSentiment>;
    technical: ReturnType<typeof buildTechnicalSnapshot>;
    baseline: Awaited<ReturnType<typeof okxGridBotService.getAiParam>>[number];
    optimized: ReturnType<typeof optimizeGridParameters>;
    minInvestment: number;
  };
  order?: unknown;
};

type GridStatusResult = {
  success: true;
  action: "status";
  strategyId?: string;
  algoId?: string;
  message: string;
  execution: GridControlSummary;
  cards: GridStructuredCard[];
  pendingOrders?: unknown[];
};

type GridStopResult = {
  success: true;
  action: "stop";
  strategyId?: string;
  algoId?: string;
  message: string;
  execution: GridControlSummary;
  cards: GridStructuredCard[];
  stopResult?: unknown;
};

export type GridIntentResult = CreateGridStrategyResult | GridStatusResult | GridStopResult;

function parseBudget(message: string) {
  const matched = message.match(/(\d+(?:\.\d+)?)\s*(U|USDT|u|刀)/i);
  return matched ? Number(matched[1]) : undefined;
}

function parseInstId(message: string) {
  const upper = message.toUpperCase();
  if (upper.includes("ETH")) return "ETH-USDT-SWAP";
  if (upper.includes("BTC")) return "BTC-USDT-SWAP";
  return undefined;
}

function parseRiskLevel(message: string): RiskLevel {
  if (/(保守|低风险)/.test(message)) return "保守";
  if (/(激进|进取|高风险)/.test(message)) return "进取";
  return "均衡";
}

function parseDirection(message: string): OkxGridDirection {
  if (/(做多|看涨|多头)/.test(message)) return "long";
  if (/(做空|看跌|空头)/.test(message)) return "short";
  return "neutral";
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function percent(value?: number) {
  return `${((value ?? 0) * 100).toFixed(2)}%`;
}

function buildCreateCards(params: {
  instId: string;
  budget: number;
  riskLevel: RiskLevel;
  direction: OkxGridDirection;
  analysis: CreateGridStrategyResult["analysis"];
  execution: GridControlSummary;
  strategyId: string;
  algoId?: string;
  mockMode: boolean;
}) {
  const { instId, budget, riskLevel, direction, analysis, execution, strategyId, algoId, mockMode } = params;
  return [
    {
      kind: "grid-create" as const,
      title: `${instId} 智能网格创建卡片`,
      data: {
        strategyId,
        algoId,
        instId,
        budget,
        riskLevel,
        direction,
        mode: mockMode ? "preview" : "live",
        range: `${analysis.optimized.minPx} - ${analysis.optimized.maxPx}`,
        gridNum: analysis.optimized.gridNum,
        lever: analysis.optimized.lever,
        expectedInvestment: analysis.optimized.expectedInvestment,
        minInvestment: analysis.minInvestment,
        annualizedRate: analysis.baseline.annualizedRate,
        confidence: analysis.optimized.confidence,
        execution,
      },
    },
    {
      kind: "grid-explanation" as const,
      title: `${instId} AI解释卡片`,
      data: {
        regime: analysis.sentiment.regime,
        sentimentScore: analysis.sentiment.score,
        sentimentConfidence: analysis.sentiment.confidence,
        reasoning: analysis.optimized.reasons,
        rsi14: analysis.technical.rsi14,
        macdHistogram: analysis.technical.macdHistogram,
        atr14: analysis.technical.atr14,
        bollingerWidth: analysis.technical.bollBandwidth,
      },
    },
  ];
}

function buildStatusCards(record: Awaited<ReturnType<typeof findLatestGridStrategy>> | undefined, logs: Awaited<ReturnType<typeof getGridStrategyLogs>>) {
  if (!record) {
    return [] as GridStructuredCard[];
  }

  return [
    {
      kind: "grid-status" as const,
      title: `${record.instId} 收益卡片`,
      data: {
        strategyId: record.strategyId,
        algoId: record.algoId,
        status: record.status,
        executionMode: record.executionMode,
        totalPnl: record.metrics?.totalPnl ?? 0,
        pnlRatio: record.metrics?.pnlRatio ?? 0,
        runtimeMinutes: record.metrics?.runtimeMinutes ?? 0,
        positionCount: record.metrics?.positionCount ?? 0,
        totalUnrealizedPnl: record.metrics?.totalUnrealizedPnl ?? 0,
        averageMarginRatio: record.metrics?.averageMarginRatio ?? 0,
        maxDrawdownRatio: record.metrics?.maxDrawdownRatio ?? 0,
        lastDecision: record.lastDecision,
        lastDecisionReason: record.lastDecisionReason,
        circuitBreaker: record.circuitBreaker,
      },
    },
    {
      kind: "grid-log" as const,
      title: `${record.instId} 策略日志卡片`,
      data: {
        latest: logs.slice(0, 5).map((item) => ({
          eventType: item.eventType,
          level: item.level,
          message: item.message,
          createdAt: item.createdAt,
        })),
      },
    },
    {
      kind: "grid-explanation" as const,
      title: `${record.instId} 当前市场分析卡片`,
      data: {
        lastMessage: record.lastMessage,
        optimized: record.optimized,
        baseline: record.baseline,
      },
    },
  ];
}

export function parseGridIntent(message: string): ParsedGridIntent {
  const normalized = message.trim();

  if (/(停掉|停止|关闭|平掉).*(网格|策略)/.test(normalized)) {
    return { action: "stop", riskLevel: parseRiskLevel(normalized), rawMessage: normalized };
  }

  if (/(怎么样了|状态|盈亏|收益|持仓)/.test(normalized) && /(网格|策略)/.test(normalized)) {
    return {
      action: "status",
      instId: parseInstId(normalized),
      riskLevel: parseRiskLevel(normalized),
      rawMessage: normalized,
    };
  }

  if (/(网格|策略)/.test(normalized) && /(跑|开|创建|启动|帮我用)/.test(normalized)) {
    return {
      action: "create",
      instId: parseInstId(normalized),
      budget: parseBudget(normalized),
      riskLevel: parseRiskLevel(normalized),
      direction: parseDirection(normalized),
      rawMessage: normalized,
    };
  }

  return {
    action: "unknown",
    instId: parseInstId(normalized),
    budget: parseBudget(normalized),
    riskLevel: parseRiskLevel(normalized),
    direction: parseDirection(normalized),
    rawMessage: normalized,
  };
}

async function buildMarketAnalysis(instId: string) {
  const bundle = await okxMarketDataService.getMarketBundle(instId, {
    candleBar: "1m",
    candleLimit: 120,
    tradeLimit: 50,
    bookDepth: 20,
  });

  const candles = [...bundle.candles].sort((a, b) => a.timestamp - b.timestamp).map((item) => ({
    ts: item.timestamp,
    open: item.open,
    high: item.high,
    low: item.low,
    close: item.close,
    volume: item.volume,
  }));

  const technical = buildTechnicalSnapshot(candles);
  const latestClose = candles[candles.length - 1]?.close ?? 0;
  const prevClose = candles[candles.length - 15]?.close ?? latestClose;
  const priceChangeRatio = prevClose === 0 ? 0 : (latestClose - prevClose) / prevClose;
  const realizedVolatility = technical.lastClose && technical.atr14 ? technical.atr14 / technical.lastClose : 0;

  const sentiment = analyzeMarketSentiment({
    fundingRate: bundle.fundingRate?.fundingRate,
    fundingRateChange:
      bundle.fundingRate?.nextFundingRate && bundle.fundingRate?.fundingRate
        ? bundle.fundingRate.nextFundingRate - bundle.fundingRate.fundingRate
        : 0,
    openInterest: bundle.openInterest?.openInterest,
    openInterestChangeRatio: 0,
    realizedVolatility,
    priceChangeRatio,
    technical,
  });

  return {
    bundle,
    technical,
    sentiment,
  };
}

export async function createSmartGridStrategy(message: string): Promise<GridIntentResult> {
  const intent = parseGridIntent(message);

  if (intent.action !== "create") {
    throw new Error("当前消息不是创建网格策略指令");
  }

  const instId = intent.instId ?? "BTC-USDT-SWAP";
  const budget = intent.budget ?? 1000;
  const direction = intent.direction ?? "neutral";
  const execution = buildGridControlSummary();
  const analysis = await buildMarketAnalysis(instId);
  const aiParams = await okxGridBotService.getAiParam({
    algoOrdType: "contract_grid",
    instId,
    direction,
  });

  const baseline = aiParams[0];
  if (!baseline) {
    throw new Error("未获取到 OKX AI 网格基准参数");
  }

  const optimized = optimizeGridParameters({
    baseline,
    sentiment: analysis.sentiment,
    technical: analysis.technical,
    accountBudget: budget,
    riskLevel: intent.riskLevel,
  });

  const minInvestment = await okxGridBotService.getMinInvestment({
    algoOrdType: "contract_grid",
    instId,
    maxPx: String(optimized.maxPx),
    minPx: String(optimized.minPx),
    gridNum: String(optimized.gridNum),
    runType: baseline.runType,
    lever: String(optimized.lever),
    direction,
  });

  const finalMinInvestment = minInvestment[0]?.minInvestment ?? baseline.minInvestment ?? 0;
  const investment = Math.max(optimized.expectedInvestment, finalMinInvestment);

  const previewRecord = await createGridStrategyRecord({
    instId,
    direction,
    budget,
    expectedInvestment: investment,
    riskLevel: intent.riskLevel,
    status: execution.liveTradingEnabled && hasOkxPrivateCredentials() ? "running" : "preview",
    executionMode: execution.liveTradingEnabled && hasOkxPrivateCredentials() ? "live" : "preview",
    lastMessage: `${instId} 智能网格参数已生成`,
    circuitBreaker: {
      enabled: true,
      thresholdRatio: ENV.okxGridMaxDrawdownRatio,
    },
    baseline,
    optimized,
  });

  const analysisPayload: CreateGridStrategyResult["analysis"] = {
    instId,
    sentiment: analysis.sentiment,
    technical: analysis.technical,
    baseline,
    optimized,
    minInvestment: finalMinInvestment,
  };

  if (!hasOkxPrivateCredentials() || !execution.liveTradingEnabled) {
    await appendGridStrategyLog({
      strategyId: previewRecord.strategyId,
      instId,
      eventType: "create",
      level: "info",
      message: `${instId} 处于受控模式，仅生成参数建议`,
      context: { budget, direction, optimized, baseline, minInvestment: finalMinInvestment },
    });

    return {
      success: true,
      action: "create",
      strategyId: previewRecord.strategyId,
      mockMode: true,
      execution,
      message: `${instId} 智能网格参数已生成，当前处于受控模式，仅返回建议参数。建议投入 ${investment} USDT，区间 ${optimized.minPx}-${optimized.maxPx}，网格数 ${optimized.gridNum}，杠杆 ${optimized.lever} 倍。`,
      analysis: analysisPayload,
      cards: buildCreateCards({
        instId,
        budget,
        riskLevel: intent.riskLevel,
        direction,
        analysis: analysisPayload,
        execution,
        strategyId: previewRecord.strategyId,
        mockMode: true,
      }),
    };
  }

  assertGridCreateAllowed({ instId, budget });

  const order = await okxGridBotService.createOrder({
    instId,
    algoOrdType: "contract_grid",
    direction,
    maxPx: String(optimized.maxPx),
    minPx: String(optimized.minPx),
    gridNum: String(optimized.gridNum),
    runType: baseline.runType,
    lever: String(optimized.lever),
    quoteSz: String(investment),
    algoClOrdId: `hwallet-${Date.now()}`,
  });

  const orderInfo = Array.isArray(order) ? order[0] : undefined;
  const algoId = (orderInfo as { algoId?: string } | undefined)?.algoId;
  const algoClOrdId = (orderInfo as { algoClOrdId?: string } | undefined)?.algoClOrdId;

  await updateGridStrategy(previewRecord.strategyId, (current) => ({
    ...current,
    algoId,
    algoClOrdId,
    status: "running",
    executionMode: "live",
    lastMessage: `${instId} 智能网格已创建并进入运行监控`,
  }));

  await appendGridStrategyLog({
    strategyId: previewRecord.strategyId,
    algoId,
    instId,
    eventType: "create",
    level: "info",
    message: `${instId} 智能网格创建成功`,
    context: { budget, direction, investment, optimized, baseline, order },
  });

  return {
    success: true,
    action: "create",
    strategyId: previewRecord.strategyId,
    algoId,
    mockMode: false,
    execution,
    message: `${instId} 智能网格已创建，投入 ${investment} USDT，区间 ${optimized.minPx}-${optimized.maxPx}，网格数 ${optimized.gridNum}。`,
    analysis: analysisPayload,
    cards: buildCreateCards({
      instId,
      budget,
      riskLevel: intent.riskLevel,
      direction,
      analysis: analysisPayload,
      execution,
      strategyId: previewRecord.strategyId,
      algoId,
      mockMode: false,
    }),
    order,
  };
}

export async function getSmartGridStatus(message: string): Promise<GridIntentResult> {
  const intent = parseGridIntent(message);
  const execution = buildGridControlSummary();

  const latestRecord = await findLatestGridStrategy(intent.instId);
  if (!latestRecord) {
    return {
      success: true,
      action: "status",
      execution,
      message: "当前还没有可查询的网格策略记录。",
      cards: [],
      pendingOrders: [],
    };
  }

  if (latestRecord.algoId && hasOkxPrivateCredentials() && latestRecord.executionMode === "live") {
    await monitorGridStrategy(latestRecord);
  }

  const refreshedRecord = (await findLatestGridStrategy(intent.instId)) ?? latestRecord;
  const logs = await getGridStrategyLogs(refreshedRecord.strategyId);

  let pendingOrders: unknown[] = [];
  if (hasOkxPrivateCredentials()) {
    pendingOrders = await okxGridBotService.getPendingOrders({
      algoOrdType: "contract_grid",
      instId: refreshedRecord.instId,
      limit: "20",
    });
  }

  return {
    success: true,
    action: "status",
    strategyId: refreshedRecord.strategyId,
    algoId: refreshedRecord.algoId,
    execution,
    message: `${refreshedRecord.instId} 当前状态为 ${refreshedRecord.status}，累计收益 ${toNumber(refreshedRecord.metrics?.totalPnl).toFixed(4)} USDT，收益率 ${percent(refreshedRecord.metrics?.pnlRatio)}，运行时长 ${(refreshedRecord.metrics?.runtimeMinutes ?? 0).toFixed(1)} 分钟。`,
    cards: buildStatusCards(refreshedRecord, logs),
    pendingOrders,
  };
}

export async function stopSmartGridStrategy(message: string): Promise<GridIntentResult> {
  const intent = parseGridIntent(message);
  const execution = buildGridControlSummary();
  const latestRecord = await findLatestGridStrategy(intent.instId);

  if (!hasOkxPrivateCredentials()) {
    return {
      success: true,
      action: "stop",
      strategyId: latestRecord?.strategyId,
      algoId: latestRecord?.algoId,
      execution,
      message: "当前未配置 OKX 实盘密钥，无法执行真实停策略动作。",
      cards: latestRecord ? buildStatusCards(latestRecord, await getGridStrategyLogs(latestRecord.strategyId)) : [],
    };
  }

  assertGridStopAllowed();

  const pendingOrders = await okxGridBotService.getPendingOrders({
    algoOrdType: "contract_grid",
    instId: intent.instId,
    limit: "20",
  });

  if (pendingOrders.length === 0 && !latestRecord?.algoId) {
    return {
      success: true,
      action: "stop",
      execution,
      message: "当前没有需要停止的运行中网格策略。",
      cards: latestRecord ? buildStatusCards(latestRecord, await getGridStrategyLogs(latestRecord.strategyId)) : [],
    };
  }

  const targetOrders = pendingOrders.length > 0
    ? pendingOrders.map((item: OkxGridAlgoSummary) => ({
        algoId: item.algoId,
        instId: item.instId,
        algoOrdType: "contract_grid" as const,
        stopType: "1" as const,
      }))
    : latestRecord?.algoId
      ? [
          {
            algoId: latestRecord.algoId,
            instId: latestRecord.instId,
            algoOrdType: "contract_grid" as const,
            stopType: "1" as const,
          },
        ]
      : [];

  const stopResult = await okxGridBotService.stopOrders({
    algoOrders: targetOrders,
  });

  if (latestRecord) {
    await markGridStrategyStopped(latestRecord.strategyId, `已提交 ${targetOrders.length} 个网格策略的停止请求`);
    await appendGridStrategyLog({
      strategyId: latestRecord.strategyId,
      algoId: latestRecord.algoId,
      instId: latestRecord.instId,
      eventType: "stop",
      level: "warn",
      message: `${latestRecord.instId} 已提交停策略请求`,
      context: { stopResult, targetOrders },
    });
  }

  const refreshedRecord = latestRecord ? await findLatestGridStrategy(latestRecord.instId) : undefined;
  const logs = refreshedRecord ? await getGridStrategyLogs(refreshedRecord.strategyId) : [];

  return {
    success: true,
    action: "stop",
    strategyId: refreshedRecord?.strategyId,
    algoId: refreshedRecord?.algoId,
    execution,
    message: `已提交 ${targetOrders.length} 个网格策略的停止请求。`,
    cards: refreshedRecord ? buildStatusCards(refreshedRecord, logs) : [],
    stopResult,
  };
}
