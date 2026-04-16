import { Express, Request, Response } from "express";
import { okxTradeMcpService } from "./okx-trade-mcp-service";

export function registerStrategyRoutes(app: Express) {
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
