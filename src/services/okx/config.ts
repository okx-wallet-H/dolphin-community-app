import { OKX_SWAP_FOCUS_INSTRUMENTS, OkxEnvironment, OkxWsSubscriptionArg } from "./types";

const DEFAULT_OKX_BASE_URL = "https://www.okx.com";
const DEFAULT_OKX_PUBLIC_WS_URL = "wss://ws.okx.com:8443/ws/v5/public";
const DEFAULT_OKX_PUBLIC_DEMO_WS_URL = "wss://wspap.okx.com:8443/ws/v5/public";
const DEFAULT_OKX_BUSINESS_WS_URL = "wss://ws.okx.com:8443/ws/v5/business";
const DEFAULT_OKX_BUSINESS_DEMO_WS_URL = "wss://wspap.okx.com:8443/ws/v5/business";

function normalizeEnvironment(value?: string | null): OkxEnvironment {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "prod" || normalized === "production") {
    return "production";
  }
  return "demo";
}

/**
 * 统一解析 OKX 环境。
 * 默认使用模拟盘环境，避免在开发阶段误连生产行情与交易链路。
 */
export function getOkxEnvironment(): OkxEnvironment {
  return normalizeEnvironment(
    process.env.OKX_ENV ?? process.env.OKX_MARKET_ENV ?? process.env.OKX_TRADING_ENV ?? "demo",
  );
}

/**
 * REST 公共行情接口沿用 OKX 主域名。
 */
export function getOkxBaseUrl(): string {
  return (process.env.OKX_BASE_URL ?? DEFAULT_OKX_BASE_URL).replace(/\/$/, "");
}

/**
 * ticker / 深度等公共频道连接 public WebSocket。
 */
export function getOkxPublicWsUrl(environment: OkxEnvironment = getOkxEnvironment()): string {
  if (environment === "production") {
    return process.env.OKX_PUBLIC_WS_URL ?? DEFAULT_OKX_PUBLIC_WS_URL;
  }
  return process.env.OKX_PUBLIC_DEMO_WS_URL ?? process.env.OKX_PUBLIC_WS_URL ?? DEFAULT_OKX_PUBLIC_DEMO_WS_URL;
}

/**
 * K 线等 business 频道连接 business WebSocket。
 */
export function getOkxBusinessWsUrl(environment: OkxEnvironment = getOkxEnvironment()): string {
  if (environment === "production") {
    return process.env.OKX_BUSINESS_WS_URL ?? DEFAULT_OKX_BUSINESS_WS_URL;
  }
  return (
    process.env.OKX_BUSINESS_DEMO_WS_URL ?? process.env.OKX_BUSINESS_WS_URL ?? DEFAULT_OKX_BUSINESS_DEMO_WS_URL
  );
}

/**
 * 开发期默认关注 BTC / ETH 永续，满足老板要求的重点品种。
 */
export function getDefaultOkxInstruments(): string[] {
  const raw = process.env.OKX_FOCUS_INSTRUMENTS?.trim();
  if (!raw) {
    return [...OKX_SWAP_FOCUS_INSTRUMENTS];
  }

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * public 端点默认订阅 ticker 与深度。
 */
export function getDefaultOkxPublicSubscriptions(instruments = getDefaultOkxInstruments()): OkxWsSubscriptionArg[] {
  return instruments.flatMap<OkxWsSubscriptionArg>((instId) => [
    { channel: "tickers", instId },
    { channel: "books5", instId },
  ]);
}

/**
 * business 端点默认订阅 1 分钟 K 线。
 */
export function getDefaultOkxBusinessSubscriptions(instruments = getDefaultOkxInstruments()): OkxWsSubscriptionArg[] {
  return instruments.map<OkxWsSubscriptionArg>((instId) => ({
    channel: "candle1m",
    instId,
  }));
}
