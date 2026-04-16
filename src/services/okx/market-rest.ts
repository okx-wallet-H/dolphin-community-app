import { okxPublicGet } from "./http-client";
import {
  OkxBooksRaw,
  OkxCandle,
  OkxCandleBar,
  OkxCandleRaw,
  OkxFundingRate,
  OkxFundingRateRaw,
  OkxMarketSnapshotOptions,
  OkxMarketTicker,
  OkxOpenInterest,
  OkxOpenInterestRaw,
  OkxOrderBookLevel,
  OkxOrderBookSnapshot,
  OkxPublicRestMarketBundle,
  OkxTickerRaw,
  OkxTrade,
  OkxTradeRaw,
} from "./types";

function toNumber(value: string | number | undefined | null) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function toTimestamp(value: string | number | undefined | null) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : Date.now();
}

function toOrderBookLevel(entry: [string, string, string, string]): OkxOrderBookLevel {
  return {
    price: toNumber(entry[0]),
    size: toNumber(entry[1]),
    liquidatedOrders: toNumber(entry[2]),
    orderCount: toNumber(entry[3]),
  };
}

export function normalizeTicker(raw: OkxTickerRaw): OkxMarketTicker {
  const last = toNumber(raw.last);
  const open24h = toNumber(raw.open24h);
  const change24h = last - open24h;
  const change24hPct = open24h === 0 ? 0 : change24h / open24h;

  return {
    instType: raw.instType,
    instId: raw.instId,
    last,
    lastSize: toNumber(raw.lastSz),
    askPrice: toNumber(raw.askPx),
    askSize: toNumber(raw.askSz),
    bidPrice: toNumber(raw.bidPx),
    bidSize: toNumber(raw.bidSz),
    open24h,
    high24h: toNumber(raw.high24h),
    low24h: toNumber(raw.low24h),
    volume24h: toNumber(raw.vol24h),
    volumeCurrency24h: toNumber(raw.volCcy24h),
    change24h,
    change24hPct,
    sodUtc0: toNumber(raw.sodUtc0),
    sodUtc8: toNumber(raw.sodUtc8),
    timestamp: toTimestamp(raw.ts),
  };
}

export function normalizeBooks(instId: string, raw: OkxBooksRaw): OkxOrderBookSnapshot {
  const asks = raw.asks.map(toOrderBookLevel);
  const bids = raw.bids.map(toOrderBookLevel);
  const bestAsk = asks[0];
  const bestBid = bids[0];
  const spread = bestAsk && bestBid ? bestAsk.price - bestBid.price : undefined;
  const spreadBps = spread && bestBid?.price ? (spread / bestBid.price) * 10000 : undefined;

  return {
    instId,
    asks,
    bids,
    timestamp: toTimestamp(raw.ts),
    bestAsk,
    bestBid,
    spread,
    spreadBps,
  };
}

export function normalizeCandle(instId: string, bar: OkxCandleBar, raw: OkxCandleRaw): OkxCandle {
  return {
    instId,
    bar,
    timestamp: toTimestamp(raw[0]),
    open: toNumber(raw[1]),
    high: toNumber(raw[2]),
    low: toNumber(raw[3]),
    close: toNumber(raw[4]),
    volume: toNumber(raw[5]),
    volumeCurrency: toNumber(raw[6]),
    volumeQuote: toNumber(raw[7]),
    confirmed: raw[8] === "1",
  };
}

export function normalizeTrade(raw: OkxTradeRaw): OkxTrade {
  return {
    instId: raw.instId,
    tradeId: raw.tradeId,
    price: toNumber(raw.px),
    size: toNumber(raw.sz),
    side: raw.side,
    count: toNumber(raw.count ?? 1),
    timestamp: toTimestamp(raw.ts),
  };
}

export function normalizeFundingRate(raw: OkxFundingRateRaw): OkxFundingRate {
  return {
    instId: raw.instId,
    fundingRate: toNumber(raw.fundingRate),
    nextFundingRate: raw.nextFundingRate ? toNumber(raw.nextFundingRate) : undefined,
    fundingTime: toTimestamp(raw.fundingTime),
    nextFundingTime: raw.nextFundingTime ? toTimestamp(raw.nextFundingTime) : undefined,
    method: raw.method,
    maxFundingRate: raw.maxFundingRate ? toNumber(raw.maxFundingRate) : undefined,
    minFundingRate: raw.minFundingRate ? toNumber(raw.minFundingRate) : undefined,
    settlementFundingRate: raw.settFundingRate ? toNumber(raw.settFundingRate) : undefined,
    settlementState: raw.settState,
    timestamp: raw.ts ? toTimestamp(raw.ts) : undefined,
  };
}

export function normalizeOpenInterest(raw: OkxOpenInterestRaw): OkxOpenInterest {
  return {
    instId: raw.instId,
    instType: raw.instType,
    openInterest: toNumber(raw.oi),
    openInterestCurrency: raw.oiCcy ? toNumber(raw.oiCcy) : undefined,
    timestamp: toTimestamp(raw.ts),
  };
}

/**
 * OKX 公共行情 REST 服务。
 * 这里先聚焦 BTC/ETH 永续所需数据，为后续 AI 因子计算提供统一数据入口。
 */
export class OkxMarketDataService {
  async getTicker(instId: string) {
    const payload = await okxPublicGet<OkxTickerRaw>("/api/v5/market/ticker", {
      query: { instId },
    });

    const target = payload.data[0];
    if (!target) {
      throw new Error(`未获取到 ${instId} 的 ticker 数据`);
    }

    return normalizeTicker(target);
  }

  async getBooks(instId: string, sz = 20) {
    const payload = await okxPublicGet<OkxBooksRaw>("/api/v5/market/books", {
      query: { instId, sz },
    });

    const target = payload.data[0];
    if (!target) {
      throw new Error(`未获取到 ${instId} 的深度数据`);
    }

    return normalizeBooks(instId, target);
  }

  async getCandles(instId: string, bar: OkxCandleBar = "1m", limit = 200) {
    const payload = await okxPublicGet<OkxCandleRaw>("/api/v5/market/candles", {
      query: { instId, bar, limit },
    });

    return payload.data.map((item) => normalizeCandle(instId, bar, item));
  }

  async getTrades(instId: string, limit = 100) {
    const payload = await okxPublicGet<OkxTradeRaw>("/api/v5/market/trades", {
      query: { instId, limit },
    });

    return payload.data.map(normalizeTrade);
  }

  async getFundingRate(instId: string) {
    const payload = await okxPublicGet<OkxFundingRateRaw>("/api/v5/public/funding-rate", {
      query: { instId },
    });

    const target = payload.data[0];
    if (!target) {
      return undefined;
    }

    return normalizeFundingRate(target);
  }

  async getOpenInterest(instId: string) {
    const payload = await okxPublicGet<OkxOpenInterestRaw>("/api/v5/public/open-interest", {
      query: { instType: "SWAP", instId },
    });

    const target = payload.data[0];
    if (!target) {
      return undefined;
    }

    return normalizeOpenInterest(target);
  }

  async getMarketBundle(instId: string, options?: OkxMarketSnapshotOptions): Promise<OkxPublicRestMarketBundle> {
    const candleBar = options?.candleBar ?? "1m";
    const candleLimit = options?.candleLimit ?? 200;
    const tradeLimit = options?.tradeLimit ?? 100;
    const bookDepth = options?.bookDepth ?? 20;

    const [ticker, book, candles, trades, fundingRate, openInterest] = await Promise.all([
      this.getTicker(instId),
      this.getBooks(instId, bookDepth),
      this.getCandles(instId, candleBar, candleLimit),
      this.getTrades(instId, tradeLimit),
      this.getFundingRate(instId),
      this.getOpenInterest(instId),
    ]);

    return {
      instId,
      ticker,
      book,
      candles,
      trades,
      fundingRate,
      openInterest,
    };
  }
}

export const okxMarketDataService = new OkxMarketDataService();
