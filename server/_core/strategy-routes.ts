import { Express, Request, Response } from "express";
import { callMcpTool } from "./okx-mcp-service";
import { okxTradeMcpService } from "./okx-trade-mcp-service";

function toObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toArray(value: unknown) {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

function extractRows(value: unknown) {
  const root = toObject(value);
  return (
    toArray(root.data) ||
    toArray(root.list) ||
    toArray(root.items) ||
    toArray(root.rows) ||
    toArray(root.trades)
  );
}

export function registerStrategyRoutes(app: Express) {
  app.get("/api/strategy/signals", async (_req: Request, res: Response) => {
    try {
      const trackedTokens = [
        { symbol: "ETH", address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", chain: "ethereum" },
        { symbol: "BTC", address: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", chain: "ethereum" },
        { symbol: "SOL", address: "So11111111111111111111111111111111111111112", chain: "solana" },
      ] as const;

      const marketPulse = await Promise.all(
        trackedTokens.map(async (token) => {
          try {
            const result = await callMcpTool<any>("token_price_info", { address: token.address, chain: token.chain });
            return {
              symbol: token.symbol,
              chain: token.chain,
              price: typeof result?.price === "number" || typeof result?.price === "string" ? String(result.price) : "",
              timestamp: typeof result?.ts === "string" || typeof result?.time === "string" ? String(result.ts ?? result.time) : "",
              source: "okx-mcp",
            };
          } catch (error) {
            return {
              symbol: token.symbol,
              chain: token.chain,
              price: "",
              timestamp: "",
              source: "okx-mcp",
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }),
      );

      const smartMoneyRaw = await callMcpTool<any>("smart_money_trades", {
        trackerType: "smart",
        chain: "ethereum",
      }).catch((error) => ({
        error: error instanceof Error ? error.message : String(error),
      }));

      const smartMoneySignals = extractRows(smartMoneyRaw).slice(0, 8).map((item, index) => ({
        id: String(item.id ?? item.txHash ?? item.tradeId ?? item.walletAddress ?? index),
        tokenSymbol: String(item.tokenSymbol ?? item.symbol ?? item.token ?? item.baseTokenSymbol ?? "未知标的"),
        side: String(item.side ?? item.tradeType ?? item.direction ?? "signal"),
        walletAddress: String(item.walletAddress ?? item.address ?? item.ownerAddress ?? ""),
        amountUsd: String(item.amountUsd ?? item.volumeUsd ?? item.usdValue ?? item.totalValueUsd ?? ""),
        timestamp: String(item.timestamp ?? item.ts ?? item.time ?? item.tradeTime ?? ""),
        raw: item,
      }));

      res.json({
        marketPulse,
        smartMoneySignals,
        smartMoneyRaw,
      });
    } catch (error) {
      console.error("[Strategy] signals route failed:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "获取策略信号失败",
      });
    }
  });

  app.get("/api/strategy/status", async (_req: Request, res: Response) => {
    try {
      const [gridSpotActive, gridContractActive, dcaSpotActive, dcaContractActive, toolList] = await Promise.all([
        okxTradeMcpService.callTool("grid_get_orders", { algoOrdType: "grid", status: "active", limit: 20 }),
        okxTradeMcpService.callTool("grid_get_orders", { algoOrdType: "contract_grid", status: "active", limit: 20 }),
        okxTradeMcpService.callTool("dca_get_orders", { algoOrdType: "spot_dca", status: "active", limit: 20 }),
        okxTradeMcpService.callTool("dca_get_orders", { algoOrdType: "contract_dca", status: "active", limit: 20 }),
        okxTradeMcpService.listTools(),
      ]);

      res.json({
        gridSpotActive,
        gridContractActive,
        dcaSpotActive,
        dcaContractActive,
        toolList,
      });
    } catch (error) {
      console.error("[Strategy] status route failed:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "获取策略状态失败",
      });
    }
  });

  app.get("/api/strategy/performance", async (_req: Request, res: Response) => {
    try {
      const [balance, bills, swapPositionsHistory, futuresPositionsHistory] = await Promise.all([
        okxTradeMcpService.callTool("account_get_balance", {}),
        okxTradeMcpService.callTool("account_get_bills", { limit: 50 }),
        okxTradeMcpService.callTool("account_get_positions_history", { instType: "SWAP", limit: 20 }),
        okxTradeMcpService.callTool("account_get_positions_history", { instType: "FUTURES", limit: 20 }),
      ]);

      res.json({
        balance,
        bills,
        swapPositionsHistory,
        futuresPositionsHistory,
      });
    } catch (error) {
      console.error("[Strategy] performance route failed:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "获取策略收益数据失败",
      });
    }
  });

  app.get("/api/strategy/positions", async (_req: Request, res: Response) => {
    try {
      const [positions, balance] = await Promise.all([
        okxTradeMcpService.callTool("account_get_positions", {}),
        okxTradeMcpService.callTool("account_get_balance", {}),
      ]);

      res.json({
        positions,
        balance,
      });
    } catch (error) {
      console.error("[Strategy] positions route failed:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "获取当前持仓失败",
      });
    }
  });

  app.get("/api/strategy/logs", async (_req: Request, res: Response) => {
    try {
      const [spotFills, swapFills, futuresFills, spotOrders, swapOrders, futuresOrders, tradeHistory] = await Promise.all([
        okxTradeMcpService.callTool("spot_get_fills", { limit: 20 }),
        okxTradeMcpService.callTool("swap_get_fills", { limit: 20, archive: true }),
        okxTradeMcpService.callTool("futures_get_fills", { limit: 20, archive: true }),
        okxTradeMcpService.callTool("spot_get_orders", { status: "history", limit: 20 }),
        okxTradeMcpService.callTool("swap_get_orders", { status: "history", limit: 20 }),
        okxTradeMcpService.callTool("futures_get_orders", { status: "history", limit: 20 }),
        okxTradeMcpService.callTool("trade_get_history", { limit: 20 }),
      ]);

      res.json({
        spotFills,
        swapFills,
        futuresFills,
        spotOrders,
        swapOrders,
        futuresOrders,
        tradeHistory,
      });
    } catch (error) {
      console.error("[Strategy] logs route failed:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "获取策略日志失败",
      });
    }
  });
}
