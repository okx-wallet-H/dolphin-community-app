import crypto from "node:crypto";
import { getOkxBaseUrl, getOkxEnvironment } from "./config";
import { OkxApiEnvelope } from "./types";
import {
  OkxGridAiParam,
  OkxGridAiParamRaw,
  OkxGridAlgoSummary,
  OkxGridAlgoSummaryRaw,
  OkxGridAmendBasicRequest,
  OkxGridAmendOrderRequest,
  OkxGridCreateRequest,
  OkxGridDetailsQuery,
  OkxGridHistoryQuery,
  OkxGridInstantTriggerRequest,
  OkxGridMinInvestment,
  OkxGridMinInvestmentRaw,
  OkxGridPendingQuery,
  OkxGridPosition,
  OkxGridPositionRaw,
  OkxGridPositionsQuery,
  OkxGridQuantity,
  OkxGridQuantityRaw,
  OkxGridStopRequestItem,
  OkxGridSubOrder,
  OkxGridSubOrderRaw,
  OkxGridSubOrdersQuery,
} from "./grid-bot-types";
import { okxPublicGet, okxPublicPost } from "./http-client";

type QueryValue = string | number | boolean | null | undefined;
type HttpMethod = "GET" | "POST";

type OkxPrivateRequestOptions = {
  query?: Record<string, QueryValue>;
  body?: Record<string, unknown>;
  signal?: AbortSignal;
};

type OkxApiCredentials = {
  apiKey: string;
  secretKey: string;
  passphrase: string;
  isDemo: boolean;
};

type OkxAlgoMutationResponseRaw = {
  algoId?: string;
  algoClOrdId?: string;
  sCode?: string;
  sMsg?: string;
  tag?: string;
};

function buildQueryString(query?: Record<string, QueryValue>) {
  const params = new URLSearchParams();

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    params.set(key, String(value));
  });

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

function extractErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const record = payload as Record<string, unknown>;
  return String(record.msg ?? record.message ?? record.error_message ?? record.error ?? fallback);
}

function toNumber(value?: string) {
  if (value === undefined || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toTimestamp(value?: string) {
  const numberValue = toNumber(value);
  return typeof numberValue === "number" ? Math.trunc(numberValue) : undefined;
}

function normalizeAlgoSummary(raw: OkxGridAlgoSummaryRaw): OkxGridAlgoSummary {
  return {
    algoId: raw.algoId,
    instId: raw.instId,
    algoOrdType: raw.algoOrdType,
    state: raw.state,
    direction: raw.direction,
    maxPx: toNumber(raw.maxPx),
    minPx: toNumber(raw.minPx),
    gridNum: toNumber(raw.gridNum),
    lever: toNumber(raw.lever),
    actualLever: toNumber(raw.actualLever),
    totalPnl: toNumber(raw.totalPnl),
    pnlRatio: toNumber(raw.pnlRatio),
    gridProfit: toNumber(raw.gridProfit),
    floatProfit: toNumber(raw.floatProfit),
    fee: toNumber(raw.fee),
    fundingFee: toNumber(raw.fundingFee),
    liqPx: toNumber(raw.liqPx),
    availEq: toNumber(raw.availEq),
    createdAt: toTimestamp(raw.cTime),
    updatedAt: toTimestamp(raw.uTime),
    triggerParams: raw.triggerParams,
  };
}

function normalizeGridPosition(raw: OkxGridPositionRaw): OkxGridPosition {
  return {
    instId: raw.instId,
    avgPx: toNumber(raw.avgPx),
    liqPx: toNumber(raw.liqPx),
    markPx: toNumber(raw.markPx),
    mgnRatio: toNumber(raw.mgnRatio),
    notionalUsd: toNumber(raw.notionalUsd),
    upl: toNumber(raw.upl),
    uplRatio: toNumber(raw.uplRatio),
    pos: toNumber(raw.pos),
    posSide: raw.posSide,
    lever: toNumber(raw.lever),
  };
}

function normalizeSubOrder(raw: OkxGridSubOrderRaw): OkxGridSubOrder {
  return {
    ordId: raw.ordId,
    side: raw.side,
    state: raw.state,
    px: toNumber(raw.px),
    sz: toNumber(raw.sz),
    avgPx: toNumber(raw.avgPx),
    accFillSz: toNumber(raw.accFillSz),
    createdAt: toTimestamp(raw.cTime),
    updatedAt: toTimestamp(raw.uTime),
  };
}

function normalizeAiParam(raw: OkxGridAiParamRaw): OkxGridAiParam {
  return {
    instId: raw.instId,
    algoOrdType: raw.algoOrdType,
    direction: raw.direction as OkxGridAiParam["direction"],
    duration: raw.duration,
    gridNum: Number(raw.gridNum),
    maxPx: Number(raw.maxPx),
    minPx: Number(raw.minPx),
    lever: Number(raw.lever ?? 0),
    runType: raw.runType,
    annualizedRate: toNumber(raw.annualizedRate),
    minInvestment: toNumber(raw.minInvestment),
    perGridProfitRatio: toNumber(raw.perGridProfitRatio),
    perMaxProfitRate: toNumber(raw.perMaxProfitRate),
    perMinProfitRate: toNumber(raw.perMinProfitRate),
    ccy: raw.ccy,
    sourceCcy: raw.sourceCcy,
  };
}

function normalizeGridQuantity(raw: OkxGridQuantityRaw): OkxGridQuantity {
  return {
    gridNum: toNumber(raw.maxGridQty) ?? toNumber(raw.maxGridNum) ?? 0,
    maxGridNum: toNumber(raw.maxGridQty) ?? toNumber(raw.maxGridNum),
    minGridNum: toNumber(raw.minGridNum),
  };
}

function normalizeMinInvestment(raw: OkxGridMinInvestmentRaw): OkxGridMinInvestment {
  const firstItem = raw.minInvestmentData?.[0];
  return {
    minInvestment: toNumber(firstItem?.amt) ?? toNumber(raw.singleAmt) ?? 0,
    ccy: firstItem?.ccy,
  };
}

function getOkxApiCredentials(): OkxApiCredentials {
  const apiKey = process.env.OKX_API_KEY?.trim() ?? "";
  const secretKey = process.env.OKX_API_SECRET?.trim() ?? process.env.OKX_SECRET_KEY?.trim() ?? "";
  const passphrase = process.env.OKX_API_PASSPHRASE?.trim() ?? process.env.OKX_PASSPHRASE?.trim() ?? "";

  if (!apiKey || !secretKey || !passphrase) {
    throw new Error("缺少 OKX 私有接口鉴权环境变量，请配置 OKX_API_KEY、OKX_API_SECRET、OKX_API_PASSPHRASE");
  }

  return {
    apiKey,
    secretKey,
    passphrase,
    isDemo: getOkxEnvironment() !== "production",
  };
}

async function okxPrivateRequest<T>(method: HttpMethod, path: string, options?: OkxPrivateRequestOptions): Promise<OkxApiEnvelope<T>> {
  const credentials = getOkxApiCredentials();
  const requestPath = `${path}${buildQueryString(options?.query)}`;
  const requestBody = method === "POST" ? JSON.stringify(options?.body ?? {}) : "";
  const timestamp = new Date().toISOString();
  const prehash = `${timestamp}${method}${requestPath}${requestBody}`;
  const signature = crypto.createHmac("sha256", credentials.secretKey).update(prehash).digest("base64");

  const response = await fetch(`${getOkxBaseUrl()}${requestPath}`, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "OK-ACCESS-KEY": credentials.apiKey,
      "OK-ACCESS-SIGN": signature,
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": credentials.passphrase,
      ...(credentials.isDemo ? { "x-simulated-trading": "1" } : {}),
    },
    body: method === "POST" ? requestBody : undefined,
    signal: options?.signal,
  });

  const payload = (await response.json()) as OkxApiEnvelope<T> | Record<string, unknown>;

  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, `OKX 私有接口请求失败: ${response.status}`));
  }

  if (!("code" in payload) || payload.code !== "0") {
    throw new Error(extractErrorMessage(payload, "OKX 私有接口返回异常"));
  }

  return payload as OkxApiEnvelope<T>;
}

/**
 * OKX Grid Bot 服务封装。
 * 采用“公共推荐参数 + 私有执行控制 + 详情监控”的混合模式。
 */
export class OkxGridBotService {
  async getAiParam(query: { algoOrdType: "grid" | "contract_grid"; instId: string; direction?: string; duration?: string }) {
    const response = await okxPublicGet<OkxGridAiParamRaw>("/api/v5/tradingBot/grid/ai-param", { query });
    return response.data.map(normalizeAiParam);
  }

  async getGridQuantity(query: {
    algoOrdType: "grid" | "contract_grid";
    instId: string;
    maxPx: string;
    minPx: string;
    runType: string;
    lever?: string;
  }) {
    const response = await okxPublicGet<OkxGridQuantityRaw>("/api/v5/tradingBot/grid/grid-quantity", { query });
    return response.data.map(normalizeGridQuantity);
  }

  async getMinInvestment(body: {
    algoOrdType: "grid" | "contract_grid";
    instId: string;
    maxPx: string;
    minPx: string;
    gridNum: string;
    runType?: string;
    lever?: string;
    direction?: string;
  }) {
    const response = await okxPublicPost<OkxGridMinInvestmentRaw>("/api/v5/tradingBot/grid/min-investment", {
      body,
    });
    return response.data.map(normalizeMinInvestment);
  }

  async createOrder(body: OkxGridCreateRequest) {
    return okxPrivateRequest<OkxAlgoMutationResponseRaw>("POST", "/api/v5/tradingBot/grid/order-algo", { body });
  }

  async instantTrigger(body: OkxGridInstantTriggerRequest) {
    return okxPrivateRequest<OkxAlgoMutationResponseRaw>("POST", "/api/v5/tradingBot/grid/order-instant-trigger", {
      body,
    });
  }

  async amendBasicParams(body: OkxGridAmendBasicRequest) {
    return okxPrivateRequest<OkxAlgoMutationResponseRaw>("POST", "/api/v5/tradingBot/grid/amend-algo-basic-param", {
      body,
    });
  }

  async amendOrder(body: OkxGridAmendOrderRequest) {
    return okxPrivateRequest<OkxAlgoMutationResponseRaw>("POST", "/api/v5/tradingBot/grid/amend-order-algo", {
      body,
    });
  }

  async stopOrders(body: { algoOrders: OkxGridStopRequestItem[] }) {
    return okxPrivateRequest<OkxAlgoMutationResponseRaw>("POST", "/api/v5/tradingBot/grid/stop-order-algo", {
      body,
    });
  }

  async getPendingOrders(query: OkxGridPendingQuery) {
    const response = await okxPrivateRequest<OkxGridAlgoSummaryRaw>("GET", "/api/v5/tradingBot/grid/orders-algo-pending", {
      query,
    });
    return response.data.map(normalizeAlgoSummary);
  }

  async getOrderHistory(query: OkxGridHistoryQuery) {
    const response = await okxPrivateRequest<OkxGridAlgoSummaryRaw>("GET", "/api/v5/tradingBot/grid/orders-algo-history", {
      query,
    });
    return response.data.map(normalizeAlgoSummary);
  }

  async getOrderDetails(query: OkxGridDetailsQuery) {
    const response = await okxPrivateRequest<OkxGridAlgoSummaryRaw>("GET", "/api/v5/tradingBot/grid/orders-algo-details", {
      query,
    });
    return response.data.map(normalizeAlgoSummary);
  }

  async getSubOrders(query: OkxGridSubOrdersQuery) {
    const response = await okxPrivateRequest<OkxGridSubOrderRaw>("GET", "/api/v5/tradingBot/grid/sub-orders", {
      query,
    });
    return response.data.map(normalizeSubOrder);
  }

  async getPositions(query: OkxGridPositionsQuery) {
    const response = await okxPrivateRequest<OkxGridPositionRaw>("GET", "/api/v5/tradingBot/grid/positions", {
      query,
    });
    return response.data.map(normalizeGridPosition);
  }
}
