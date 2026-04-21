import type { Express, Request, Response } from "express";
import {
  executeOnchainSwap,
  getOnchainApprovals,
  getOnchainAssets,
  getOnchainExecutionReceipt,
  getOnchainOsConfig,
  previewOnchainSwap,
} from "./onchain-os";
import { validateOnchainExecutionRisk } from "./onchain-execution-guard";
import { buildOnchainIdempotencyKey, shouldBlockDuplicateExecution } from "./onchain-idempotency";
import {
  appendOnchainTxLog,
  createOnchainTxRecord,
  findOnchainTxByIdempotencyKey,
  getOnchainTxLogs,
  listOnchainTxs,
  updateOnchainTx,
  updateOnchainTxByOrderId,
} from "./onchain-tx-store";
import { sdk } from "./sdk";

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

function getQueryNumber(req: Request, key: string, fallback: number) {
  const raw = Number(getQueryString(req, key));
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

async function requireAuth(req: Request, res: Response) {
  try {
    return await sdk.authenticateRequest(req);
  } catch (error) {
    console.error("[Onchain OS] auth failed", error);
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
}

export function registerOnchainOsRoutes(app: Express) {
  app.get("/api/onchain/tasks", async (req: Request, res: Response) => {
    const user = await requireAuth(req, res);
    if (!user) return;

    try {
      const limit = Math.min(getQueryNumber(req, "limit", 12), 50);
      const txId = getQueryString(req, "txId") || undefined;
      const tasks = await listOnchainTxs(user.openId);
      const filteredTasks = txId ? tasks.filter((item) => item.txId === txId) : tasks;
      const selectedTasks = filteredTasks.slice(0, limit);
      const allLogs = await getOnchainTxLogs();
      const logsByTxId = new Map<string, ReturnType<typeof allLogs.filter>>();

      for (const log of allLogs) {
        if (!log.txId) continue;
        const bucket = logsByTxId.get(log.txId) ?? [];
        if (bucket.length < 8) {
          bucket.push(log);
          logsByTxId.set(log.txId, bucket);
        }
      }

      const summary = filteredTasks.reduce(
        (acc, item) => {
          if (item.phase === "success") acc.successCount += 1;
          else if (item.phase === "failed") acc.failedCount += 1;
          else acc.runningCount += 1;
          return acc;
        },
        { total: filteredTasks.length, runningCount: 0, successCount: 0, failedCount: 0 },
      );

      res.json({
        success: true,
        user: {
          openId: user.openId,
        },
        summary,
        tasks: selectedTasks.map((task) => ({
          ...task,
          logs: logsByTxId.get(task.txId) ?? [],
        })),
      });
    } catch (error) {
      console.error("[Onchain OS] tasks failed", error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Failed to query Onchain OS tasks",
      });
    }
  });

  app.get("/api/onchain/config", async (req: Request, res: Response) => {
    const user = await requireAuth(req, res);
    if (!user) return;

    res.json({
      success: true,
      user: {
        openId: user.openId,
        email: user.email ?? null,
      },
      onchainOs: getOnchainOsConfig(),
    });
  });

  app.get("/api/onchain/assets", async (req: Request, res: Response) => {
    const user = await requireAuth(req, res);
    if (!user) return;

    const address = getQueryString(req, "address");
    if (!address) {
      res.status(400).json({ error: "address is required" });
      return;
    }

    try {
      const result = await getOnchainAssets({
        address,
        chains: getQueryString(req, "chains") || undefined,
        filter: getQueryString(req, "filter") || undefined,
        excludeRiskToken: getQueryString(req, "excludeRiskToken") || undefined,
      });

      res.json({
        user: {
          openId: user.openId,
        },
        ...result,
      });
    } catch (error) {
      console.error("[Onchain OS] assets failed", error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Failed to query Onchain OS assets",
      });
    }
  });

  app.get("/api/onchain/approvals", async (req: Request, res: Response) => {
    const user = await requireAuth(req, res);
    if (!user) return;

    const chainIndex = getQueryString(req, "chainIndex");
    const address = getQueryString(req, "address");
    if (!chainIndex || !address) {
      res.status(400).json({ error: "chainIndex and address are required" });
      return;
    }

    try {
      const result = await getOnchainApprovals({
        chainIndex,
        address,
        limit: getQueryString(req, "limit") || undefined,
        cursor: getQueryString(req, "cursor") || undefined,
      });

      res.json({
        user: {
          openId: user.openId,
        },
        ...result,
      });
    } catch (error) {
      console.error("[Onchain OS] approvals failed", error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Failed to query Onchain OS approvals",
      });
    }
  });

  app.post("/api/onchain/preview", async (req: Request, res: Response) => {
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
      const result = await previewOnchainSwap({
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
      console.error("[Onchain OS] preview failed", error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Failed to preview swap with Onchain OS",
      });
    }
  });

  app.post("/api/onchain/execute", async (req: Request, res: Response) => {
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

    const fromTokenSymbol = getOptionalBodyString(req.body, "fromTokenSymbol");
    const toTokenSymbol = getOptionalBodyString(req.body, "toTokenSymbol");
    const displayAmount = getOptionalBodyString(req.body, "displayAmount");
    const slippagePercent = getOptionalBodyString(req.body, "slippagePercent");
    const riskError = validateOnchainExecutionRisk({
      chainIndex,
      displayAmount,
      slippagePercent,
    });
    if (riskError) {
      res.status(400).json({
        code: riskError.code,
        error: riskError.message,
      });
      return;
    }

    const signedTx = getOptionalBodyString(req.body, "signedTx");
    const jitoSignedTx = getOptionalBodyString(req.body, "jitoSignedTx");
    const broadcastAddress = getOptionalBodyString(req.body, "broadcastAddress");
    const idempotencyKey = buildOnchainIdempotencyKey({
      userId: user.openId,
      chainIndex,
      amount,
      fromToken: fromTokenSymbol ?? fromTokenAddress,
      toToken: toTokenSymbol ?? toTokenAddress,
    });
    const existingTx = await findOnchainTxByIdempotencyKey(idempotencyKey);
    if (existingTx && shouldBlockDuplicateExecution(existingTx.phase)) {
      await appendOnchainTxLog({
        txId: existingTx.txId,
        userId: user.openId,
        eventType: "duplicate",
        level: "warn",
        message: "Duplicate Onchain execution request blocked by idempotency guard",
        context: {
          idempotencyKey,
          phase: existingTx.phase,
        },
      });

      res.json({
        user: {
          openId: user.openId,
        },
        txId: existingTx.txId,
        idempotent: true,
        ...(existingTx.lastResponse ?? {
          executionModel: "agent_wallet",
          phase: existingTx.phase,
          orderId: existingTx.orderId,
          txHash: existingTx.txHash,
          progress: [],
        }),
      });
      return;
    }

    const chainKindRaw = getOptionalBodyString(req.body, "chainKind");
    const chainKind =
      chainKindRaw === "solana"
        ? "solana"
        : chainKindRaw === "evm"
          ? "evm"
          : undefined;

    const txRecord = await createOnchainTxRecord({
      userId: user.openId,
      type: "swap",
      phase: "preview",
      chainIndex,
      userWalletAddress,
      broadcastAddress,
      fromToken: fromTokenSymbol ?? fromTokenAddress,
      toToken: toTokenSymbol ?? toTokenAddress,
      amount,
      slippagePercent,
      idempotencyKey,
      retryCount: 0,
    });

    await appendOnchainTxLog({
      txId: txRecord.txId,
      userId: user.openId,
      eventType: "create",
      level: "info",
      message: "Onchain swap execution task created",
      context: {
        chainIndex,
        fromTokenAddress,
        toTokenAddress,
        amount,
      },
    });

    try {
      const result = await executeOnchainSwap({
        chainIndex,
        amount,
        fromTokenAddress,
        toTokenAddress,
        userWalletAddress,
        fromTokenSymbol,
        toTokenSymbol,
        displayAmount,
        slippagePercent,
        signedTx,
        jitoSignedTx,
        broadcastAddress,
        chainKind,
      });

      await updateOnchainTx(txRecord.txId, (current) => ({
        ...current,
        phase: result.phase,
        orderId: result.orderId ?? current.orderId,
        txHash: result.txHash ?? current.txHash,
        lastResponse: result as Record<string, unknown>,
      }));

      await appendOnchainTxLog({
        txId: txRecord.txId,
        userId: user.openId,
        eventType: "execute",
        level: result.phase === "failed" ? "error" : "info",
        message: `Onchain swap execution moved to ${result.phase}`,
        context: {
          orderId: result.orderId,
          txHash: result.txHash,
          phase: result.phase,
        },
      });

      res.json({
        user: {
          openId: user.openId,
        },
        txId: txRecord.txId,
        ...result,
      });
    } catch (error) {
      await updateOnchainTx(txRecord.txId, (current) => ({
        ...current,
        phase: "failed",
        lastError: error instanceof Error ? error.message : "Failed to execute swap with Onchain OS",
        lastResponse: {
          executionModel: "agent_wallet",
          phase: "failed",
          progress: [],
          error: error instanceof Error ? error.message : "Failed to execute swap with Onchain OS",
        },
      }));

      await appendOnchainTxLog({
        txId: txRecord.txId,
        userId: user.openId,
        eventType: "failure",
        level: "error",
        message: "Onchain swap execution failed",
        context: {
          error: error instanceof Error ? error.message : String(error),
        },
      });

      console.error("[Onchain OS] execute failed", error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Failed to execute swap with Onchain OS",
      });
    }
  });

  app.get("/api/onchain/receipt", async (req: Request, res: Response) => {
    const user = await requireAuth(req, res);
    if (!user) return;

    const address = getQueryString(req, "address");
    const chainIndex = getQueryString(req, "chainIndex");

    if (!address || !chainIndex) {
      res.status(400).json({ error: "address and chainIndex are required" });
      return;
    }

    const orderId = getQueryString(req, "orderId") || undefined;
    const txStatus = getQueryString(req, "txStatus") || undefined;
    const cursor = getQueryString(req, "cursor") || undefined;
    const limit = getQueryString(req, "limit") || undefined;

    try {
      const result = await getOnchainExecutionReceipt({
        address,
        chainIndex,
        orderId,
        txStatus,
        cursor,
        limit,
      });

      const firstOrder = (result.data?.[0] ?? null) as Record<string, unknown> | null;
      const txHash = typeof firstOrder?.txHash === "string" ? firstOrder.txHash : undefined;

      if (orderId) {
        await updateOnchainTxByOrderId(orderId, (current) => ({
          ...current,
          phase: result.phase,
          txHash: txHash ?? current.txHash,
        }));

        await appendOnchainTxLog({
          txId: undefined,
          userId: user.openId,
          eventType: "receipt",
          level: result.phase === "failed" ? "error" : "info",
          message: `Onchain receipt synced with phase ${result.phase}`,
          context: {
            orderId,
            txHash,
            chainIndex,
            phase: result.phase,
          },
        });
      }

      res.json({
        user: {
          openId: user.openId,
        },
        ...result,
      });
    } catch (error) {
      console.error("[Onchain OS] receipt failed", error);
      res.status(400).json({
        error: error instanceof Error ? error.message : "Failed to query Onchain OS receipt",
      });
    }
  });
}
