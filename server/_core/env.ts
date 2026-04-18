const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (value == null || value === "") {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

const parseNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseStringList = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const getFirstDefinedEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return "";
};

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  llmApiUrl: getFirstDefinedEnv(
    "LLM_API_URL",
    "GLM_API_URL",
    "BIGMODEL_API_URL",
    "ZHIPU_API_URL",
    "ZHIPU_API_BASE_URL",
    "BUILT_IN_FORGE_API_URL",
  ),
  llmApiKey: getFirstDefinedEnv(
    "LLM_API_KEY",
    "GLM_API_KEY",
    "BIGMODEL_API_KEY",
    "ZHIPU_API_KEY",
    "OPENAI_API_KEY",
    "BUILT_IN_FORGE_API_KEY",
  ),
  llmModel: getFirstDefinedEnv("LLM_MODEL", "GLM_MODEL", "BIGMODEL_MODEL") || "glm-5.1",
  okxApiKey: getFirstDefinedEnv("OKX_API_KEY"),
  okxApiSecret: getFirstDefinedEnv("OKX_API_SECRET", "OKX_SECRET_KEY"),
  okxApiPassphrase: getFirstDefinedEnv("OKX_API_PASSPHRASE", "OKX_PASSPHRASE"),
  okxProjectId: process.env.OKX_PROJECT_ID ?? "",
  okxEnableLiveGridTrading: parseBoolean(process.env.OKX_ENABLE_LIVE_GRID_TRADING, false),
  okxAllowEmergencyStop: parseBoolean(process.env.OKX_ALLOW_EMERGENCY_STOP, true),
  okxGridAllowedInstIds: parseStringList(process.env.OKX_GRID_ALLOWED_INST_IDS),
  okxGridMaxBudgetUsdt: parseNumber(process.env.OKX_GRID_MAX_BUDGET_USDT, 1000),
  okxGridMaxDrawdownRatio: parseNumber(process.env.OKX_GRID_MAX_DRAWDOWN_RATIO, 0.12),
  okxGridAbnormalFundingRateThreshold: parseNumber(process.env.OKX_GRID_ABNORMAL_FUNDING_RATE_THRESHOLD, 0.003),
  okxGridMonitorIntervalMs: parseNumber(process.env.OKX_GRID_MONITOR_INTERVAL_MS, 60000),
  okxGridRebalanceIntervalMs: parseNumber(process.env.OKX_GRID_REBALANCE_INTERVAL_MS, 3600000),
};
