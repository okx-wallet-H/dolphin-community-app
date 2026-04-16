type NumericSeries = Array<number | null | undefined>;


export type OkxIndicatorCandle = {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type EmaSeriesPoint = {
  period: number;
  value: number | null;
};

export type RsiSeriesPoint = {
  period: number;
  value: number | null;
};

export type BollingerBandPoint = {
  period: number;
  multiplier: number;
  middle: number | null;
  upper: number | null;
  lower: number | null;
  bandwidth: number | null;
};

export type AtrSeriesPoint = {
  period: number;
  value: number | null;
};

export type MacdSeriesPoint = {
  fastPeriod: number;
  slowPeriod: number;
  signalPeriod: number;
  macd: number | null;
  signal: number | null;
  histogram: number | null;
};

export type TechnicalIndicatorSnapshot = {
  lastClose: number | null;
  ema7: number | null;
  ema25: number | null;
  ema99: number | null;
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  bollMiddle: number | null;
  bollUpper: number | null;
  bollLower: number | null;
  bollBandwidth: number | null;
  atr14: number | null;
};

function round(value: number | null | undefined, digits = 6) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  return Number(value.toFixed(digits));
}

function takeLast<T>(values: T[]) {
  return values.length > 0 ? values[values.length - 1] : null;
}

function getCloseSeries(candles: OkxIndicatorCandle[]) {
  return candles.map((item) => item.close);
}

export function calculateEma(values: NumericSeries, period: number): EmaSeriesPoint[] {
  if (period <= 0) {
    throw new Error("EMA 周期必须大于 0");
  }

  const multiplier = 2 / (period + 1);
  const result: EmaSeriesPoint[] = [];
  let prevEma: number | null = null;
  const buffer: number[] = [];

  values.forEach((value) => {
    if (typeof value !== "number" || Number.isNaN(value)) {
      result.push({ period, value: null });
      return;
    }

    buffer.push(value);
    if (buffer.length < period) {
      result.push({ period, value: null });
      return;
    }

    if (prevEma === null) {
      const seed = buffer.slice(-period).reduce((sum, item) => sum + item, 0) / period;
      prevEma = seed;
      result.push({ period, value: round(seed) });
      return;
    }

    prevEma = (value - prevEma) * multiplier + prevEma;
    result.push({ period, value: round(prevEma) });
  });

  return result;
}

export function calculateRsi(values: NumericSeries, period: number): RsiSeriesPoint[] {
  if (period <= 0) {
    throw new Error("RSI 周期必须大于 0");
  }

  const result: RsiSeriesPoint[] = values.map(() => ({ period, value: null }));
  if (values.length <= period) {
    return result;
  }

  let gains = 0;
  let losses = 0;

  for (let index = 1; index <= period; index += 1) {
    const change = Number(values[index] ?? 0) - Number(values[index - 1] ?? 0);
    gains += Math.max(change, 0);
    losses += Math.max(-change, 0);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  result[period] = {
    period,
    value: round(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)),
  };

  for (let index = period + 1; index < values.length; index += 1) {
    const change = Number(values[index] ?? 0) - Number(values[index - 1] ?? 0);
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    result[index] = {
      period,
      value: round(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)),
    };
  }

  return result;
}

export function calculateMacd(values: NumericSeries, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9): MacdSeriesPoint[] {
  if (fastPeriod <= 0 || slowPeriod <= 0 || signalPeriod <= 0) {
    throw new Error("MACD 周期必须大于 0");
  }

  const fast = calculateEma(values, fastPeriod).map((item) => item.value);
  const slow = calculateEma(values, slowPeriod).map((item) => item.value);
  const macdLine = values.map((_, index) => {
    if (fast[index] === null || slow[index] === null) {
      return null;
    }
    return Number((fast[index]! - slow[index]!).toFixed(6));
  });
  const signalLine = calculateEma(macdLine, signalPeriod).map((item) => item.value);

  return values.map((_, index) => {
    const macd = macdLine[index];
    const signal = signalLine[index];
    return {
      fastPeriod,
      slowPeriod,
      signalPeriod,
      macd,
      signal,
      histogram: macd !== null && signal !== null ? round(macd - signal) : null,
    };
  });
}

export function calculateBollingerBands(values: NumericSeries, period = 20, multiplier = 2): BollingerBandPoint[] {
  if (period <= 0) {
    throw new Error("布林带周期必须大于 0");
  }

  return values.map((_, index) => {
    const window = values.slice(Math.max(0, index - period + 1), index + 1).filter((value): value is number => typeof value === "number");

    if (window.length < period) {
      return {
        period,
        multiplier,
        middle: null,
        upper: null,
        lower: null,
        bandwidth: null,
      };
    }

    const middle = window.reduce((sum, value) => sum + value, 0) / period;
    const variance = window.reduce((sum, value) => sum + (value - middle) ** 2, 0) / period;
    const deviation = Math.sqrt(variance);
    const upper = middle + deviation * multiplier;
    const lower = middle - deviation * multiplier;

    return {
      period,
      multiplier,
      middle: round(middle),
      upper: round(upper),
      lower: round(lower),
      bandwidth: middle === 0 ? null : round((upper - lower) / middle),
    };
  });
}

export function calculateAtr(candles: OkxIndicatorCandle[], period = 14): AtrSeriesPoint[] {
  if (period <= 0) {
    throw new Error("ATR 周期必须大于 0");
  }

  const trueRanges = candles.map((candle, index) => {
    if (index === 0) {
      return candle.high - candle.low;
    }
    const prevClose = candles[index - 1]?.close ?? candle.close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - prevClose),
      Math.abs(candle.low - prevClose),
    );
  });

  const result: AtrSeriesPoint[] = trueRanges.map(() => ({ period, value: null }));
  if (trueRanges.length < period) {
    return result;
  }

  let prevAtr = trueRanges.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  result[period - 1] = { period, value: round(prevAtr) };

  for (let index = period; index < trueRanges.length; index += 1) {
    prevAtr = (prevAtr * (period - 1) + trueRanges[index]) / period;
    result[index] = { period, value: round(prevAtr) };
  }

  return result;
}

export function calculateTechnicalIndicators(candles: OkxIndicatorCandle[]): TechnicalIndicatorSnapshot {
  const closes = getCloseSeries(candles);
  const ema7 = takeLast(calculateEma(closes, 7));
  const ema25 = takeLast(calculateEma(closes, 25));
  const ema99 = takeLast(calculateEma(closes, 99));
  const rsi14 = takeLast(calculateRsi(closes, 14));
  const macd = takeLast(calculateMacd(closes, 12, 26, 9));
  const boll = takeLast(calculateBollingerBands(closes, 20, 2));
  const atr14 = takeLast(calculateAtr(candles, 14));

  return {
    lastClose: candles[candles.length - 1]?.close ?? null,
    ema7: ema7?.value ?? null,
    ema25: ema25?.value ?? null,
    ema99: ema99?.value ?? null,
    rsi14: rsi14?.value ?? null,
    macd: macd?.macd ?? null,
    macdSignal: macd?.signal ?? null,
    macdHistogram: macd?.histogram ?? null,
    bollMiddle: boll?.middle ?? null,
    bollUpper: boll?.upper ?? null,
    bollLower: boll?.lower ?? null,
    bollBandwidth: boll?.bandwidth ?? null,
    atr14: atr14?.value ?? null,
  };
}
