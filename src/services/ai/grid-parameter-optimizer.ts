import { TechnicalIndicatorSnapshot } from "../indicators/technical-indicators";
import { OkxGridAiParam } from "../okx/grid-bot-types";
import { MarketSentimentScore } from "./market-sentiment";

export type GridOptimizationInput = {
  baseline: OkxGridAiParam;
  sentiment: MarketSentimentScore;
  technical: TechnicalIndicatorSnapshot;
  accountBudget: number;
  riskLevel: "保守" | "均衡" | "进取";
};

export type GridOptimizationResult = {
  minPx: number;
  maxPx: number;
  gridNum: number;
  lever: number;
  expectedInvestment: number;
  confidence: number;
  reasons: string[];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, digits = 4) {
  return Number(value.toFixed(digits));
}

function getRiskProfile(level: GridOptimizationInput["riskLevel"]) {
  switch (level) {
    case "保守":
      return { leverCap: 3, gridFactor: 1.15, rangeFactor: 0.92, budgetFactor: 0.65 };
    case "进取":
      return { leverCap: 10, gridFactor: 0.9, rangeFactor: 1.12, budgetFactor: 0.9 };
    default:
      return { leverCap: 5, gridFactor: 1, rangeFactor: 1, budgetFactor: 0.8 };
  }
}

/**
 * 网格参数优化器。
 * 先继承 OKX AI 推荐，再根据市场结构、账户预算与风险偏好做 H Wallet 二次修正。
 */
export function optimizeGridParameters(input: GridOptimizationInput): GridOptimizationResult {
  const reasons: string[] = [];
  const { baseline, sentiment, technical, accountBudget } = input;
  const riskProfile = getRiskProfile(input.riskLevel);

  const baselineRange = Math.max(baseline.maxPx - baseline.minPx, 0.0001);
  let rangeMultiplier = riskProfile.rangeFactor;
  let gridMultiplier = riskProfile.gridFactor;
  let lever = Math.min(baseline.lever || 1, riskProfile.leverCap);

  if (sentiment.regime === "震荡") {
    rangeMultiplier *= 0.96;
    gridMultiplier *= 1.15;
    reasons.push("当前偏震荡，缩小区间并提高网格密度以增强来回吃波动能力");
  }

  if (sentiment.regime === "趋势") {
    rangeMultiplier *= 1.08;
    gridMultiplier *= 0.92;
    reasons.push("当前处于趋势阶段，扩大区间并适度降低网格密度，避免频繁反向成交");
  }

  if (sentiment.regime === "突破") {
    rangeMultiplier *= 1.15;
    gridMultiplier *= 0.85;
    lever = Math.max(1, Math.min(lever, riskProfile.leverCap - 1));
    reasons.push("突破行情下优先扩区间并压低杠杆，减少被高速波动反复扫单的概率");
  }

  if (sentiment.regime === "回调") {
    rangeMultiplier *= 0.98;
    gridMultiplier *= 1.05;
    reasons.push("回调阶段保持中等区间，保留足够网格密度用于承接回撤波动");
  }

  if ((technical.rsi14 ?? 50) > 70 || (technical.rsi14 ?? 50) < 30) {
    rangeMultiplier *= 1.06;
    gridMultiplier *= 0.95;
    reasons.push("RSI 进入极值区，适度放宽区间并降低挂单密度以防单边挤压");
  }

  const atrRatio = technical.lastClose && technical.atr14 ? technical.atr14 / technical.lastClose : 0;
  if (atrRatio > 0.025) {
    rangeMultiplier *= 1.08;
    gridMultiplier *= 0.9;
    reasons.push("ATR 显示波动放大，策略需要更宽的价格容忍带");
  }

  const center = technical.lastClose ?? (baseline.maxPx + baseline.minPx) / 2;
  const adjustedRange = baselineRange * rangeMultiplier;
  let minPx = Math.max(center - adjustedRange / 2, 0.0001);
  let maxPx = center + adjustedRange / 2;

  if (technical.bollLower && technical.bollUpper) {
    minPx = Math.min(minPx, technical.bollLower * 0.995);
    maxPx = Math.max(maxPx, technical.bollUpper * 1.005);
    reasons.push("引入布林带边界，确保网格区间覆盖当前主要波动通道");
  }

  const minGridNum = 20;
  const maxGridNum = 300;
  const gridNum = clamp(Math.round(baseline.gridNum * gridMultiplier), minGridNum, maxGridNum);

  const expectedInvestment = round(Math.min(accountBudget, Math.max(baseline.minInvestment ?? 0, accountBudget * riskProfile.budgetFactor)));

  if (expectedInvestment < (baseline.minInvestment ?? 0)) {
    reasons.push("账户预算低于推荐规模，后续创建前需再次校验最小投入要求");
  }

  if (sentiment.bias === "强多" || sentiment.bias === "强空") {
    lever = Math.min(lever + 1, riskProfile.leverCap);
    reasons.push("市场方向性较强，在风险上限内允许小幅提升杠杆以增强资金效率");
  }

  if (sentiment.confidence < 60) {
    lever = Math.max(1, lever - 1);
    reasons.push("当前市场信号分歧较大，主动降低杠杆以控制不确定性");
  }

  return {
    minPx: round(minPx, 2),
    maxPx: round(maxPx, 2),
    gridNum,
    lever,
    expectedInvestment,
    confidence: round((sentiment.confidence + Math.abs(sentiment.score - 50)) / 2, 2),
    reasons,
  };
}
