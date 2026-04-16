export const OKX_SWAP_FOCUS_INSTRUMENTS = ["BTC-USDT-SWAP", "ETH-USDT-SWAP"] as const;

export type OkxFocusInstrumentId = (typeof OKX_SWAP_FOCUS_INSTRUMENTS)[number];

export type OkxEnvironment = "production" | "demo";

export type OkxWsPublicChannel =
  | "tickers"
  | "books"
  | "books5"
  | "books50-l2-tbt"
  | "trades"
  | "candle1m"
  | "candle5m"
  | "candle15m"
  | "candle1H"
  | string;

export type OkxCandleBar =
  | "1m"
  | "3m"
  | "5m"
  | "15m"
  | "30m"
  | "1H"
  | "2H"
  | "4H"
  | "6H"
  | "12H"
  | "1D"
  | "1W"
  | "1M"
  | string;

export type OkxApiEnvelope<T> = {
  code: string;
  msg: string;
  data: T[];
};

export type OkxTickerRaw = {
  instType: string;
  instId: string;
  last: string;
  lastSz: string;
  askPx: string;
  askSz: string;
  bidPx: string;
  bidSz: string;
  open24h: string;
  high24h: string;
  low24h: string;
  volCcy24h: string;
  vol24h: string;
  sodUtc0: string;
  sodUtc8: string;
  ts: string;
};

export type OkxBooksRaw = {
  asks: [string, string, string, string][];
  bids: [string, string, string, string][];
  ts: string;
};

export type OkxCandleRaw = [
  ts: string,
  open: string,
  high: string,
  low: string,
  close: string,
  vol: string,
  volCcy: string,
  volCcyQuote: string,
  confirm: string,
];

export type OkxTradeRaw = {
  instId: string;
  tradeId: string;
  px: string;
  sz: string;
  side: "buy" | "sell" | string;
  ts: string;
  count?: string;
};

export type OkxFundingRateRaw = {
  instId: string;
  fundingRate: string;
  nextFundingRate?: string;
  fundingTime: string;
  nextFundingTime?: string;
  method?: string;
  maxFundingRate?: string;
  minFundingRate?: string;
  settFundingRate?: string;
  settState?: string;
  ts?: string;
};

export type OkxOpenInterestRaw = {
  instId: string;
  instType: string;
  oi: string;
  oiCcy?: string;
  ts: string;
};

export type OkxOrderBookLevel = {
  price: number;
  size: number;
  liquidatedOrders: number;
  orderCount: number;
};

export type OkxMarketTicker = {
  instType: string;
  instId: string;
  last: number;
  lastSize: number;
  askPrice: number;
  askSize: number;
  bidPrice: number;
  bidSize: number;
  open24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  volumeCurrency24h: number;
  change24h: number;
  change24hPct: number;
  sodUtc0: number;
  sodUtc8: number;
  timestamp: number;
};

export type OkxOrderBookSnapshot = {
  instId: string;
  asks: OkxOrderBookLevel[];
  bids: OkxOrderBookLevel[];
  timestamp: number;
  bestAsk?: OkxOrderBookLevel;
  bestBid?: OkxOrderBookLevel;
  spread?: number;
  spreadBps?: number;
};

export type OkxCandle = {
  instId: string;
  bar: OkxCandleBar;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  volumeCurrency: number;
  volumeQuote: number;
  confirmed: boolean;
};

export type OkxTrade = {
  instId: string;
  tradeId: string;
  price: number;
  size: number;
  side: "buy" | "sell" | string;
  count: number;
  timestamp: number;
};

export type OkxFundingRate = {
  instId: string;
  fundingRate: number;
  nextFundingRate?: number;
  fundingTime: number;
  nextFundingTime?: number;
  method?: string;
  maxFundingRate?: number;
  minFundingRate?: number;
  settlementFundingRate?: number;
  settlementState?: string;
  timestamp?: number;
};

export type OkxOpenInterest = {
  instId: string;
  instType: string;
  openInterest: number;
  openInterestCurrency?: number;
  timestamp: number;
};

export type OkxMarketSnapshot = {
  instId: string;
  ticker: OkxMarketTicker;
  orderBook: OkxOrderBookSnapshot;
  candles: OkxCandle[];
  trades: OkxTrade[];
  fundingRate?: OkxFundingRate;
  openInterest?: OkxOpenInterest;
};

export type OkxWsSubscriptionArg = {
  channel: OkxWsPublicChannel;
  instId: string;
};

export type OkxWsEventEnvelope = {
  event: string;
  arg?: OkxWsSubscriptionArg;
  code?: string;
  msg?: string;
  connId?: string;
};

export type OkxWsDataEnvelope<T = unknown> = {
  arg: OkxWsSubscriptionArg;
  action?: string;
  data: T[];
};

export type OkxWsRawMessage<T = unknown> = OkxWsEventEnvelope | OkxWsDataEnvelope<T> | Record<string, unknown>;

export type OkxWsGatewayState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "closed";

export type OkxWsLogger = {
  info?: (message: string, extra?: Record<string, unknown>) => void;
  warn?: (message: string, extra?: Record<string, unknown>) => void;
  error?: (message: string, extra?: Record<string, unknown>) => void;
  debug?: (message: string, extra?: Record<string, unknown>) => void;
};

export type OkxPublicWsGatewayOptions = {
  url?: string;
  reconnectBaseDelayMs?: number;
  reconnectMaxDelayMs?: number;
  heartbeatIntervalMs?: number;
  pongTimeoutMs?: number;
  logger?: OkxWsLogger;
};

export type OkxPublicWsMessageHandler = (message: OkxWsRawMessage) => void;
export type OkxPublicWsStateHandler = (state: OkxWsGatewayState) => void;

export type OkxMarketSnapshotOptions = {
  bookDepth?: number;
  candleBar?: OkxCandleBar;
  candleLimit?: number;
  tradeLimit?: number;
};

export type OkxOrderBookSubscriptionData = {
  asks: [string, string, string, string][];
  bids: [string, string, string, string][];
  ts: string;
  checksum?: string;
};

export type OkxTickerSubscriptionData = OkxTickerRaw;
export type OkxCandleSubscriptionData = OkxCandleRaw;
export type OkxTradeSubscriptionData = OkxTradeRaw;

export type OkxMarketRegime = "trend" | "range" | "breakout" | "pullback" | "unknown";

export type OkxMarketSentiment = {
  instId: string;
  score: number;
  regime: OkxMarketRegime;
  summary: string;
  fundingBias: number;
  openInterestBias: number;
  volatilityBias: number;
  timestamp: number;
};

export type OkxMarketIndicatorPack = {
  instId: string;
  closeSeries: number[];
  highSeries: number[];
  lowSeries: number[];
  timestampSeries: number[];
};

export type OkxGridRiskLevel = "low" | "medium" | "high";

export type OkxGridParameterSuggestion = {
  instId: string;
  upperPrice: number;
  lowerPrice: number;
  gridSpacing: number;
  leverage: number;
  gridCount: number;
  quantityPerGrid: number;
  confidence: number;
  reason: string;
};

export type OkxPublicRestMarketBundle = {
  instId: string;
  ticker: OkxMarketTicker;
  book: OkxOrderBookSnapshot;
  candles: OkxCandle[];
  trades: OkxTrade[];
  fundingRate?: OkxFundingRate;
  openInterest?: OkxOpenInterest;
};
