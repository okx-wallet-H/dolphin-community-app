import { getOkxBaseUrl } from "./config";
import { OkxApiEnvelope } from "./types";

type QueryValue = string | number | boolean | null | undefined;
type HttpMethod = "GET" | "POST";

type OkxPublicRequestOptions = {
  query?: Record<string, QueryValue>;
  body?: Record<string, unknown>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
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

async function okxPublicRequest<T>(method: HttpMethod, path: string, options?: OkxPublicRequestOptions): Promise<OkxApiEnvelope<T>> {
  const requestPath = `${path}${buildQueryString(options?.query)}`;
  const body = method === "POST" ? JSON.stringify(options?.body ?? {}) : undefined;
  const response = await fetch(`${getOkxBaseUrl()}${requestPath}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      ...options?.headers,
    },
    body,
    signal: options?.signal,
  });

  const payload = (await response.json()) as OkxApiEnvelope<T> | Record<string, unknown>;

  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, `OKX 公共接口请求失败: ${response.status}`));
  }

  if (!("code" in payload) || payload.code !== "0") {
    throw new Error(extractErrorMessage(payload, "OKX 公共接口返回异常"));
  }

  return payload as OkxApiEnvelope<T>;
}

/**
 * OKX 公共 REST GET 请求封装。
 * 行情接口无需鉴权，统一在这里处理错误码和 URL 拼接。
 */
export async function okxPublicGet<T>(path: string, options?: OkxPublicRequestOptions): Promise<OkxApiEnvelope<T>> {
  return okxPublicRequest<T>("GET", path, options);
}

/**
 * OKX 公共 REST POST 请求封装。
 * 用于最小投入等无需鉴权但要求 POST 的公共能力。
 */
export async function okxPublicPost<T>(path: string, options?: OkxPublicRequestOptions): Promise<OkxApiEnvelope<T>> {
  return okxPublicRequest<T>("POST", path, options);
}
