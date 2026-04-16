import crypto from "crypto";
import type { Express, Request, Response } from "express";

const OKX_ONCHAIN_API_BASE_URL = "https://web3.okx.com";
const OKX_ONCHAIN_CURRENT_PRICE_PATH = "/api/v5/wallet/token/real-time-price";
const OKX_ONCHAIN_TOKEN_DETAIL_PATH = "/api/v5/wallet/token/token-detail";

type OkxTokenQuery = {
  chainIndex: string;
  tokenAddress: string;
};

function getRequiredEnv(name: "OKX_ONCHAIN_API_KEY" | "OKX_ONCHAIN_SECRET_KEY" | "OKX_ONCHAIN_PASSPHRASE"): string {
  const value = process.env[name]?.trim() ?? "";
  if (!value) {
    throw new Error(`缺少服务端环境变量 ${name}`);
  }
  return value;
}

function buildSignedHeaders(method: "GET" | "POST", requestPath: string, body = "") {
  const apiKey = getRequiredEnv("OKX_ONCHAIN_API_KEY");
  const secretKey = getRequiredEnv("OKX_ONCHAIN_SECRET_KEY");
  const passphrase = getRequiredEnv("OKX_ONCHAIN_PASSPHRASE");
  const timestamp = new Date().toISOString();
  const signPayload = `${timestamp}${method}${requestPath}${body}`;
  const signature = crypto.createHmac("sha256", secretKey).update(signPayload).digest("base64");

  return {
    "Content-Type": "application/json",
    "OK-ACCESS-KEY": apiKey,
    "OK-ACCESS-PASSPHRASE": passphrase,
    "OK-ACCESS-SIGN": signature,
    "OK-ACCESS-TIMESTAMP": timestamp,
  } as const;
}

function parseBodyArray(body: unknown): OkxTokenQuery[] {
  if (!Array.isArray(body) || body.length === 0) {
    throw new Error("请求体必须是非空数组");
  }

  return body.map((item) => {
    const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const chainIndex = typeof record.chainIndex === "string" ? record.chainIndex.trim() : "";
    const tokenAddress = typeof record.tokenAddress === "string" ? record.tokenAddress.trim() : "";

    if (!chainIndex || !tokenAddress) {
      throw new Error("chainIndex 和 tokenAddress 均为必填项");
    }

    return { chainIndex, tokenAddress };
  });
}

function parseTokenQuery(req: Request): OkxTokenQuery {
  const chainIndex = typeof req.query.chainIndex === "string" ? req.query.chainIndex.trim() : "";
  const tokenAddress = typeof req.query.tokenAddress === "string" ? req.query.tokenAddress.trim() : "";

  if (!chainIndex || !tokenAddress) {
    throw new Error("chainIndex 和 tokenAddress 均为必填项");
  }

  return { chainIndex, tokenAddress };
}

async function proxyOkxResponse(res: Response, response: globalThis.Response) {
  const text = await response.text();
  res.status(response.status).type("application/json").send(text);
}

export function registerOkxOnchainRoutes(app: Express) {
  app.post("/api/okx/onchain/price", async (req: Request, res: Response) => {
    try {
      const payload = parseBodyArray(req.body);
      const body = JSON.stringify(payload);
      const response = await fetch(`${OKX_ONCHAIN_API_BASE_URL}${OKX_ONCHAIN_CURRENT_PRICE_PATH}`, {
        method: "POST",
        headers: buildSignedHeaders("POST", OKX_ONCHAIN_CURRENT_PRICE_PATH, body),
        body,
      });
      await proxyOkxResponse(res, response);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "OKX 链上价格代理请求失败",
      });
    }
  });

  app.get("/api/okx/onchain/token-detail", async (req: Request, res: Response) => {
    try {
      const { chainIndex, tokenAddress } = parseTokenQuery(req);
      const query = `chainIndex=${encodeURIComponent(chainIndex)}&tokenAddress=${encodeURIComponent(tokenAddress)}`;
      const requestPath = `${OKX_ONCHAIN_TOKEN_DETAIL_PATH}?${query}`;
      const response = await fetch(`${OKX_ONCHAIN_API_BASE_URL}${requestPath}`, {
        headers: buildSignedHeaders("GET", requestPath),
      });
      await proxyOkxResponse(res, response);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "OKX 代币详情代理请求失败",
      });
    }
  });
}
