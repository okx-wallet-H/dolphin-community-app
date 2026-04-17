import express from "express";

function safeRegister(app: express.Express, label: string, register: () => void) {
  try {
    register();
  } catch (error) {
    console.error(`[Bootstrap] Failed to register ${label}:`, error);
  }
}

export function createApp() {
  const app = express();

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }

    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  const healthPayload = () => ({ ok: true, timestamp: Date.now() });

  app.get("/", (_req, res) => {
    res.json(healthPayload());
  });

  app.get("/api", (_req, res) => {
    res.json(healthPayload());
  });

  app.get("/api/health", (_req, res) => {
    res.json(healthPayload());
  });

  safeRegister(app, "oauth routes", () => {
    const { registerOAuthRoutes } = require("./_core/oauth");
    registerOAuthRoutes(app);
  });

  safeRegister(app, "agent wallet routes", () => {
    const { registerAgentWalletRoutes } = require("./_core/agent-wallet-routes");
    registerAgentWalletRoutes(app);
  });

  safeRegister(app, "dex swap routes", () => {
    const { registerDexSwapRoutes } = require("./_core/dex-swap-routes");
    registerDexSwapRoutes(app);
  });

  safeRegister(app, "onchain os routes", () => {
    const { registerOnchainOsRoutes } = require("./_core/onchain-os-routes");
    registerOnchainOsRoutes(app);
  });

  safeRegister(app, "chat ai routes", () => {
    const { registerChatAiRoutes } = require("./_core/chat-ai-routes");
    registerChatAiRoutes(app);
  });

  safeRegister(app, "okx mcp routes", () => {
    const { registerOkxMcpRoutes } = require("./_core/okx-mcp-routes");
    registerOkxMcpRoutes(app);
  });

  safeRegister(app, "okx onchain routes", () => {
    const { registerOkxOnchainRoutes } = require("./_core/okx-onchain-routes");
    registerOkxOnchainRoutes(app);
  });

  safeRegister(app, "strategy routes", () => {
    const { registerStrategyRoutes } = require("./_core/strategy-routes");
    registerStrategyRoutes(app);
  });

  safeRegister(app, "trpc middleware", () => {
    const { createExpressMiddleware } = require("@trpc/server/adapters/express");
    const { appRouter } = require("./routers");
    const { createContext } = require("./_core/context");
    app.use(
      "/api/trpc",
      createExpressMiddleware({
        router: appRouter,
        createContext,
      }),
    );
  });

  return app;
}
