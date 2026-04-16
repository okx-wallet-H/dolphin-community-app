import { Express, Request, Response } from "express";
import { JSONRPCRequest } from "@modelcontextprotocol/sdk/types.js";
import { okxMcpService } from "./okx-mcp-service";

/**
 * 注册 OKX OnchainOS MCP 服务路由
 * 该路由充当 MCP 客户端与 OKX onchainos-cli 之间的桥梁
 */
export function registerOkxMcpRoutes(app: Express) {
  app.post("/api/okx/mcp", async (req: Request, res: Response) => {
    const mcpRequest = req.body as JSONRPCRequest;

    try {
      // 使用会话管理的 MCP 服务处理请求
      const mcpResponse = await okxMcpService.handleRequest(mcpRequest);
      res.json(mcpResponse);
    } catch (error) {
      console.error("[OKX MCP] Request failed:", error);
      res.status(500).json({
        jsonrpc: "2.0",
        id: mcpRequest.id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : "Internal MCP error",
        },
      });
    }
  });
}
