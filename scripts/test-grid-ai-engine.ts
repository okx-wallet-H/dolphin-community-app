import { analyzeMarketSentiment, optimizeGridParameters } from "../src/services/ai";
import { buildTechnicalSnapshot, OkxIndicatorCandle } from "../src/services/indicators";
import { OkxGridAiParam } from "../src/services/okx";

const candles: OkxIndicatorCandle[] = Array.from({ length: 120 }).map((_, index) => {
  const base = 68000 + index * 18 + Math.sin(index / 4) * 120;
  return {
    ts: 1_700_000_000_000 + index * 60_000,
    open: base - 20,
    high: base + 85,
    low: base - 95,
    close: base + Math.sin(index / 3) * 35,
    volume: 100 + index,
  };
});

const baseline: OkxGridAiParam = {
  instId: "BTC-USDT-SWAP",
  algoOrdType: "contract_grid",
  direction: "neutral",
  duration: "14D",
  gridNum: 180,
  maxPx: 73000,
  minPx: 65000,
  lever: 5,
  runType: "1",
  annualizedRate: 0.55,
  minInvestment: 450,
  perGridProfitRatio: 0.003,
  perMaxProfitRate: 0.012,
  perMinProfitRate: 0.006,
  ccy: "USDT",
  sourceCcy: "USDT",
};

const technical = buildTechnicalSnapshot(candles);
const sentiment = analyzeMarketSentiment({
  fundingRate: 0.0012,
  fundingRateChange: 0.0006,
  openInterest: 1_500_000,
  openInterestChangeRatio: 0.041,
  realizedVolatility: 0.028,
  priceChangeRatio: 0.016,
  technical,
});
const optimized = optimizeGridParameters({
  baseline,
  sentiment,
  technical,
  accountBudget: 1000,
  riskLevel: "均衡",
});

console.log("[technical]", JSON.stringify(technical));
console.log("[sentiment]", JSON.stringify(sentiment));
console.log("[optimized]", JSON.stringify(optimized));

if (!optimized.minPx || !optimized.maxPx || optimized.maxPx <= optimized.minPx) {
  throw new Error("优化后的价格区间无效");
}

if (optimized.gridNum < 20) {
  throw new Error("优化后的网格数量异常");
}

console.log("AI 参数优化模块烟雾测试通过");
