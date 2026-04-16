import type { Express, Request, Response } from "express";
import { sdk } from "./sdk";
import {
  executeDexSwap,
  getDexConfig,
  getDexSwapOrders,
  getDexSwapQuote,
  parseSwapIntent,
} from "./dex-swap";

function getBodyString(body: unknown, key: string) {
  const value = body && typeof body === "object" ? (body as Record<string, unknown>)[key] : undefined;
  return typeof value === "string" ? value : "";
}

function getOptionalBodyString(body: unknown, key: string) {
  const value = body && typeof body === "object" ? (body as Record<string, unknown>)[key] : undefined;
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function getQueryString(req: Request, key: string) {
  const value = req.query[key];
  return typeof value === "string" ? value : "";
}

async function requireAuth(req: Request, res: Response) {
  try {
    return await sdk.authenticateRequest(req);
  } catch (error) {
    console.error("[DEX Swap] auth failed", error);
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
}

export function registerDexSwapRoutes(app: Express) {
  app.get("/api/dex/config", async (req: Request, res: Response) => {
    const user = await requireAuth(req, res);
    if (!user) return;

    res.json({
      success: true,
      user: {
        openId: user.openId,
        email: user.email ?? null,
      },
      dex: getDexConfig(),
    });
  });

  app.post("/api/dex/intent", async (req: Request, res: Response) => {
    const user = await requireAuth(req, res);
    if (!user) return;

    const message = getBodyString(req.body, "message");
    if (!message.trim()) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    try {
      const result = await parseSwapIntent(message);
      res.json({
        success: true,
        user: {
          openId: user.openId,
        },
        intent: result,
      });
    } catch (error) {
      console.error("[DEX Swap] parse intent failed", error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Failed to parse swap intent",
      });
    }
  });

  app.post("/api/dex/quote", async (req: Request, res: Response) => {
    const user = await requireAuth(req, res);
    if (!user) return;

    const chainIndex = getBodyString(req.body, "chainIndex");
    const amount = getBodyString(req.body, "amount");
    const fromTokenAddress = getBodyString(req.body, "fromTokenAddress");
    const toTokenAddress = getBodyString(req.body, "toTokenAddress");
    const userWalletAddress = getBodyString(req.body, "userWalletAddress");

    if (!chainIndex || !amount || !fromTokenAddress || !toTokenAddress || !userWalletAddress) {
      res.status(400).json({
        error: "chainIndex, amount, fromTokenAddress, toTokenAddress and userWalletAddress are required",
      });
      return;
    }

    try {
      const result = await getDexSwapQuote({
        chainIndex,
        amount,
        fromTokenAddress,
        toTokenAddress,
        userWalletAddress,
        fromTokenSymbol: getOptionalBodyString(req.body, "fromTokenSymbol"),
        toTokenSymbol: getOptionalBodyString(req.body, "toTokenSymbol"),
        displayAmount: getOptionalBodyString(req.body, "displayAmount"),
        chainKind:
          getOptionalBodyString(req.body, "chainKind") === "solana"
            ? "solana"
            : getOptionalBodyString(req.body, "chainKind") === "evm"
              ? "evm"
              : undefined,
      });

      res.json({
        user: {
          openId: user.openId,
        },
        ...result,
      });
    } catch (error) {
      console.error("[DEX Swap] quote failed", error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Failed to get swap quote",
      });
    }
  });

  app.post("/api/dex/execute", async (req: Request, res: Response) => {
    const user = await requireAuth(req, res);
    if (!user) return;

    const chainIndex = getBodyString(req.body, "chainIndex");
    const amount = getBodyString(req.body, "amount");
    const fromTokenAddress = getBodyString(req.body, "fromTokenAddress");
    const toTokenAddress = getBodyString(req.body, "toTokenAddress");
    const userWalletAddress = getBodyString(req.body, "userWalletAddress");

    if (!chainIndex || !amount || !fromTokenAddress || !toTokenAddress || !userWalletAddress) {
      res.status(400).json({
        error: "chainIndex, amount, fromTokenAddress, toTokenAddress and userWalletAddress are required",
      });
      return;
    }

    try {
      const result = await executeDexSwap({
        chainIndex,
        amount,
        fromTokenAddress,
        toTokenAddress,
        userWalletAddress,
        fromTokenSymbol: getOptionalBodyString(req.body, "fromTokenSymbol"),
        toTokenSymbol: getOptionalBodyString(req.body, "toTokenSymbol"),
        displayAmount: getOptionalBodyString(req.body, "displayAmount"),
        slippagePercent: getOptionalBodyString(req.body, "slippagePercent"),
        signedTx: getOptionalBodyString(req.body, "signedTx"),
        jitoSignedTx: getOptionalBodyString(req.body, "jitoSignedTx"),
        broadcastAddress: getOptionalBodyString(req.body, "broadcastAddress"),
        chainKind:
          getOptionalBodyString(req.body, "chainKind") === "solana"
            ? "solana"
            : getOptionalBodyString(req.body, "chainKind") === "evm"
              ? "evm"
              : undefined,
      });

      res.json({
        user: {
          openId: user.openId,
        },
        ...result,
      });
    } catch (error) {
      console.error("[DEX Swap] execute failed", error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Failed to execute swap",
      });
    }
  });

  app.get("/api/dex/orders", async (req: Request, res: Response) => {
    const user = await requireAuth(req, res);
    if (!user) return;

    const address = getQueryString(req, "address");
    const chainIndex = getQueryString(req, "chainIndex");

    if (!address || !chainIndex) {
      res.status(400).json({ error: "address and chainIndex are required" });
      return;
    }

    try {
      const result = await getDexSwapOrders({
        address,
        chainIndex,
        orderId: getQueryString(req, "orderId") || undefined,
        txStatus: getQueryString(req, "txStatus") || undefined,
        cursor: getQueryString(req, "cursor") || undefined,
        limit: getQueryString(req, "limit") || undefined,
      });

      res.json({
        user: {
          openId: user.openId,
        },
        ...result,
      });
    } catch (error) {
      console.error("[DEX Swap] orders failed", error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Failed to query swap orders",
      });
    }
  });
}
