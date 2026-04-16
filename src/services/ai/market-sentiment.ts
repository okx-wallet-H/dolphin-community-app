import { TechnicalIndicatorSnapshot } from "../indicators/technical-indicators";


export type MarketRegime = "趋势" | "震荡" | "突破" | "回调";
export type MarketBias = "强多" | "偏多" | "中性" | "偏空" | "强空";

export type MarketSentimentInput = {
  fundingRate?: number | null;
  fundingRateChange?: number | null;
  openInterest?: number | null;
  openInterestChangeRatio?: number | null;
  realizedVolatility?: number | null;
  priceChangeRatio?: number | null;
  technical: TechnicalIndicatorSnapshot;
};

export type MarketSentimentScore = {
  score: number;
  bias: MarketBias;
  regime: MarketRegime;
  confidence: number;
  signals: string[];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function safeNumber(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function inferBias(score: number): MarketBias {
  if (score >= 70) return "强多";
  if (score >= 58) return "偏多";
  if (score <= 30) return "强空";
  if (score <= 42) return "偏空";
  return "中性";
}

function inferRegime(input: MarketSentimentInput): MarketRegime {
  const { technical } = input;
  const priceChangeRatio = safeNumber(input.priceChangeRatio);
  const openInterestChangeRatio = safeNumber(input.openInterestChangeRatio);
  const volatility = safeNumber(input.realizedVolatility);
  const emaTrendUp = (technical.ema7 ?? 0) > (technical.ema25 ?? 0) && (technical.ema25 ?? 0) > (technical.ema99 ?? 0);
  const emaTrendDown = (technical.ema7 ?? 0) < (technical.ema25 ?? 0) && (technical.ema25 ?? 0) < (technical.ema99 ?? 0);
  const close = technical.lastClose ?? 0;
  const upper = technical.bollUpper ?? 0;
  const lower = technical.bollLower ?? 0;

  if (volatility > 0.035 && Math.abs(priceChangeRatio) > 0.02 && openInterestChangeRatio > 0.03) {
    return "突破";
  }

  if (emaTrendUp || emaTrendDown) {
    if (Math.abs(priceChangeRatio) < 0.01 && volatility < 0.02) {
      return "回调";
    }
    return "趋势";
  }

  if (close > 0 && upper > 0 && lower > 0 && close < upper && close > lower && volatility < 0.02) {
    return "震荡";
  }

  return Math.abs(priceChangeRatio) >= 0.015 ? "趋势" : "震荡";
}

/**
 * 市场情绪分析器。
 * 综合资金费率、持仓变化、波动率与技术结构，输出适合网格策略二次修正的市场评分。
 */
export function analyzeMarketSentiment(input: MarketSentimentInput): MarketSentimentScore {
  const signals: string[] = [];
  let score = 50;

  const fundingRate = safeNumber(input.fundingRate);
  const fundingRateChange = safeNumber(input.fundingRateChange);
  const openInterestChangeRatio = safeNumber(input.openInterestChangeRatio);
  const volatility = safeNumber(input.realizedVolatility);
  const priceChangeRatio = safeNumber(input.priceChangeRatio);
  const technical = input.technical;

  if (fundingRate > 0.0008) {
    score += 6;
    signals.push("资金费率偏正，多头愿意支付溢价");
  } else if (fundingRate < -0.0008) {
    score -= 6;
    signals.push("资金费率偏负，空头情绪占优");
  }

  if (fundingRateChange > 0.0005) {
    score += 4;
    signals.push("资金费率抬升，多头情绪增强");
  } else if (fundingRateChange < -0.0005) {
    score -= 4;
    signals.push("资金费率回落，市场风险偏好下降");
  }

  if (openInterestChangeRatio > 0.03) {
    score += priceChangeRatio >= 0 ? 8 : -4;
    signals.push("持仓量明显增加，市场参与度提升");
  } else if (openInterestChangeRatio < -0.03) {
    score -= 5;
    signals.push("持仓量下降，资金有撤退迹象");
  }

  if ((technical.rsi14 ?? 50) > 65) {
    score += 6;
    signals.push("RSI 偏强，短线动能占优");
  } else if ((technical.rsi14 ?? 50) < 35) {
    score -= 6;
    signals.push("RSI 偏弱，短线动能不足");
  }

  if ((technical.macdHistogram ?? 0) > 0) {
    score += 5;
    signals.push("MACD 柱体为正，趋势偏多");
  } else if ((technical.macdHistogram ?? 0) < 0) {
    score -= 5;
    signals.push("MACD 柱体为负，趋势偏空");
  }

  if ((technical.ema7 ?? 0) > (technical.ema25 ?? 0) && (technical.ema25 ?? 0) > (technical.ema99 ?? 0)) {
    score += 7;
    signals.push("EMA 多头排列成立");
  } else if ((technical.ema7 ?? 0) < (technical.ema25 ?? 0) && (technical.ema25 ?? 0) < (technical.ema99 ?? 0)) {
    score -= 7;
    signals.push("EMA 空头排列成立");
  }

  if (volatility > 0.04) {
    score += 2;
    signals.push("波动率较高，适合扩大网格区间并降低仓位密度");
  } else if (volatility < 0.015) {
    score -= 1;
    signals.push("波动率偏低，优先密集网格与保守杠杆");
  }

  const regime = inferRegime(input);
  const bias = inferBias(clamp(score, 0, 100));
  const confidence = clamp(45 + signals.length * 6 + Math.abs(score - 50) * 0.4, 0, 100);

  return {
    score: clamp(Number(score.toFixed(2)), 0, 100),
    bias,
    regime,
    confidence: Number(confidence.toFixed(2)),
    signals,
  };
}
