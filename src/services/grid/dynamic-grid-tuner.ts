import { analyzeMarketSentiment, optimizeGridParameters } from "../ai";
import { buildTechnicalSnapshot } from "../indicators";
import { OkxGridAiParam, OkxGridAlgoSummary, OkxGridBotService, OkxGridDirection, okxMarketDataService } from "../okx";

export type GridRiskLevel = "保守" | "均衡" | "进取";

export type DynamicGridTuningInput = {
  algoId: string;
  instId: string;
  accountBudget: number;
  riskLevel: GridRiskLevel;
  direction?: OkxGridDirection;
  maxDrawdownRatio?: number;
  abnormalFundingRateThreshold?: number;
};

export type DynamicGridDecision = {
  action: "hold" | "amend" | "pause";
  shouldAdjust: boolean;
  shouldPause: boolean;
  reason: string;
  confidence: number;
  market: {
    sentiment: ReturnType<typeof analyzeMarketSentiment>;
    technical: ReturnType<typeof buildTechnicalSnapshot>;
    realizedVolatility: number;
    priceChangeRatio: number;
  };
  current: {
    order?: OkxGridAlgoSummary;
    baseline?: OkxGridAiParam;
    drawdownRatio: number;
    fundingRate: number;
  };
  optimized?: ReturnType<typeof optimizeGridParameters>;
  amendPayload?: {
    algoId: string;
    instId: string;
    algoOrdType: "contract_grid";
    maxPx: string;
    minPx: string;
    gridNum: string;
    topupAmount?: string;
  };
  riskAlerts: string[];
};

const okxGridBotService = new OkxGridBotService();

function toRatio(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function round(value: number, digits = 4) {
  return Number(value.toFixed(digits));
}

function buildTopupAmount(accountBudget: number, currentOrder?: OkxGridAlgoSummary) {
  const availEq = currentOrder?.availEq ?? 0;
  if (availEq <= 0) {
    return undefined;
  }

  const remaining = Math.max(accountBudget - availEq, 0);
  if (remaining <= 0) {
    return undefined;
  }

  return round(Math.min(remaining, accountBudget * 0.2), 2).toString();
}

function shouldAmendByDifference(currentOrder: OkxGridAlgoSummary | undefined, optimized: ReturnType<typeof optimizeGridParameters>) {
  if (!currentOrder) {
    return false;
  }

  const currentRange = Math.max((currentOrder.maxPx ?? 0) - (currentOrder.minPx ?? 0), 0);
  const nextRange = Math.max(optimized.maxPx - optimized.minPx, 0);
  const rangeDiffRatio = currentRange > 0 ? Math.abs(nextRange - currentRange) / currentRange : 1;
  const gridDiffRatio = (currentOrder.gridNum ?? 0) > 0 ? Math.abs(optimized.gridNum - (currentOrder.gridNum ?? 0)) / (currentOrder.gridNum ?? 1) : 1;

  return rangeDiffRatio >= 0.08 || gridDiffRatio >= 0.12;
}

/**
 * 动态调参触发器。
 * 面向定时任务或策略守护进程，每次执行会重新分析市场并给出“保持 / 改参 / 暂停”结论。
 */
export async function analyzeAndTuneGridStrategy(input: DynamicGridTuningInput): Promise<DynamicGridDecision> {
  const bundle = await okxMarketDataService.getMarketBundle(input.instId, {
    candleBar: "1m",
    candleLimit: 120,
    tradeLimit: 50,
    bookDepth: 20,
  });

  const candles = [...bundle.candles]
    .sort((left, right) => left.timestamp - right.timestamp)
    .map((item) => ({
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
  const priceChangeRatio = prevClose > 0 ? (latestClose - prevClose) / prevClose : 0;
  const realizedVolatility = technical.lastClose && technical.atr14 ? technical.atr14 / technical.lastClose : 0;

  const orderDetails = await okxGridBotService.getOrderDetails({
    algoOrdType: "contract_grid",
    algoId: input.algoId,
    instId: input.instId,
  });
  const currentOrder = orderDetails[0];

  const positions = await okxGridBotService.getPositions({
    algoOrdType: "contract_grid",
    algoId: input.algoId,
    instId: input.instId,
  });
  const position = positions[0];

  const fundingRate = bundle.fundingRate?.fundingRate ?? 0;
  const currentPnLRatio = currentOrder?.pnlRatio ?? position?.uplRatio ?? 0;
  const drawdownRatio = currentPnLRatio < 0 ? Math.abs(currentPnLRatio) : 0;

  const sentiment = analyzeMarketSentiment({
    fundingRate,
    fundingRateChange:
      bundle.fundingRate?.nextFundingRate !== undefined && bundle.fundingRate?.fundingRate !== undefined
        ? bundle.fundingRate.nextFundingRate - bundle.fundingRate.fundingRate
        : 0,
    openInterest: bundle.openInterest?.openInterest,
    openInterestChangeRatio: 0,
    realizedVolatility,
    priceChangeRatio,
    technical,
  });

  const baselineList = await okxGridBotService.getAiParam({
    algoOrdType: "contract_grid",
    instId: input.instId,
    direction: input.direction ?? (currentOrder?.direction as OkxGridDirection | undefined) ?? "neutral",
  });
  const baseline = baselineList[0];

  if (!baseline) {
    throw new Error("未获取到 OKX AI 基准参数，无法执行动态调参分析");
  }

  const optimized = optimizeGridParameters({
    baseline,
    sentiment,
    technical,
    accountBudget: input.accountBudget,
    riskLevel: input.riskLevel,
  });

  const maxDrawdownRatio = input.maxDrawdownRatio ?? 0.12;
  const abnormalFundingRateThreshold = input.abnormalFundingRateThreshold ?? 0.0025;
  const riskAlerts: string[] = [];

  if (drawdownRatio >= maxDrawdownRatio) {
    riskAlerts.push(`当前策略回撤达到 ${(drawdownRatio * 100).toFixed(2)}%，超过熔断阈值 ${(maxDrawdownRatio * 100).toFixed(2)}%`);
  }

  if (Math.abs(fundingRate) >= abnormalFundingRateThreshold) {
    riskAlerts.push(`资金费率达到 ${(fundingRate * 100).toFixed(3)}%，已触发异常预警阈值 ${(abnormalFundingRateThreshold * 100).toFixed(3)}%`);
  }

  if (sentiment.regime === "突破" && sentiment.confidence >= 72) {
    riskAlerts.push("市场进入高置信突破阶段，网格策略面临单边行情挤压风险");
  }

  const shouldPause = riskAlerts.length > 0;
  if (shouldPause) {
    return {
      action: "pause",
      shouldAdjust: false,
      shouldPause: true,
      reason: riskAlerts.join("；"),
      confidence: Math.max(sentiment.confidence, 80),
      market: {
        sentiment,
        technical,
        realizedVolatility: round(realizedVolatility, 6),
        priceChangeRatio: round(priceChangeRatio, 6),
      },
      current: {
        order: currentOrder,
        baseline,
        drawdownRatio: round(drawdownRatio, 6),
        fundingRate: round(fundingRate, 6),
      },
      optimized,
      riskAlerts,
    };
  }

  const shouldAdjust = shouldAmendByDifference(currentOrder, optimized) || sentiment.regime !== "震荡";
  if (!shouldAdjust || !currentOrder) {
    return {
      action: "hold",
      shouldAdjust: false,
      shouldPause: false,
      reason: "当前市场结构与运行参数基本匹配，暂不建议改参",
      confidence: sentiment.confidence,
      market: {
        sentiment,
        technical,
        realizedVolatility: round(realizedVolatility, 6),
        priceChangeRatio: round(priceChangeRatio, 6),
      },
      current: {
        order: currentOrder,
        baseline,
        drawdownRatio: round(drawdownRatio, 6),
        fundingRate: round(fundingRate, 6),
      },
      optimized,
      riskAlerts,
    };
  }

  return {
    action: "amend",
    shouldAdjust: true,
    shouldPause: false,
    reason: `市场状态为${sentiment.regime}，建议按最新AI参数重新收敛网格区间与密度`,
    confidence: Math.max(sentiment.confidence, optimized.confidence),
    market: {
      sentiment,
      technical,
      realizedVolatility: round(realizedVolatility, 6),
      priceChangeRatio: round(priceChangeRatio, 6),
    },
    current: {
      order: currentOrder,
      baseline,
      drawdownRatio: round(drawdownRatio, 6),
      fundingRate: round(fundingRate, 6),
    },
    optimized,
    amendPayload: {
      algoId: input.algoId,
      instId: input.instId,
      algoOrdType: "contract_grid",
      maxPx: String(optimized.maxPx),
      minPx: String(optimized.minPx),
      gridNum: String(optimized.gridNum),
      topupAmount: buildTopupAmount(input.accountBudget, currentOrder),
    },
    riskAlerts,
  };
}

export async function applyDynamicGridDecision(decision: DynamicGridDecision) {
  if (decision.action === "pause" && decision.current.order) {
    return okxGridBotService.stopOrders({
      algoOrders: [
        {
          algoId: decision.current.order.algoId,
          instId: decision.current.order.instId,
          algoOrdType: "contract_grid",
          stopType: "1",
        },
      ],
    });
  }

  if (decision.action === "amend" && decision.amendPayload) {
    return okxGridBotService.amendBasicParams(decision.amendPayload);
  }

  return null;
}
