import crypto from "crypto";

type ServerlessRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ServerlessResponse = {
  setHeader(name: string, value: number | string | readonly string[]): unknown;
  status(code: number): ServerlessResponse;
  json(body: unknown): ServerlessResponse;
  end(chunk?: unknown): unknown;
};

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
};

type JsonRpcError = {
  code: number;
  message: string;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: Record<string, unknown>;
  error?: JsonRpcError;
};

type ToolCallParams = {
  name?: string;
  arguments?: Record<string, unknown>;
};

type OkxJson = Record<string, unknown> | unknown[];

type ToolDefinition = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

type LocalToolName =
  | "token_price_info"
  | "token_hot_tokens"
  | "portfolio_all_balances"
  | "defi_search"
  | "smart_money_leaderboard_list"
  | "smart_money_trades"
  | "meme_scan_list"
  | "meme_scan_details"
  | "swap_quote"
  | "swap_execute"
  | "swap_approve_transaction"
  | "get_dex_quote"
  | "get_dex_swap"
  | "get_dex_approve_transaction";

const OKX_BASE_URL = process.env.OKX_BASE_URL?.trim() || "https://web3.okx.com";
const OKX_MCP_URLS = [
  process.env.OKX_MCP_URL?.trim(),
  "https://web3.okx.com/api/v1/onchainos-mcp",
  "https://www.okx.com/api/v5/dex/mcp",
].filter((value): value is string => Boolean(value));

const DEFAULT_OKX_API_KEY = "";
const DEFAULT_OKX_SECRET_KEY = "";
const DEFAULT_OKX_PASSPHRASE = "";
const REQUEST_TIMEOUT_MS = Number(process.env.OKX_REQUEST_TIMEOUT_MS ?? 15000);

const LOCAL_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "token_price_info",
    description: "获取代币价格、24 小时涨跌幅和成交量。",
  },
  {
    name: "token_hot_tokens",
    description: "获取指定链上的热门代币列表。",
  },
  {
    name: "portfolio_all_balances",
    description: "获取地址的多链资产余额列表。",
  },
  {
    name: "defi_search",
    description: "搜索 DeFi 投资与赚币产品。",
  },
  {
    name: "smart_money_leaderboard_list",
    description: "获取聪明钱榜单。",
  },
  {
    name: "smart_money_trades",
    description: "获取聪明钱近期交易。",
  },
  {
    name: "meme_scan_list",
    description: "获取热门 Meme 代币扫描列表。",
  },
  {
    name: "meme_scan_details",
    description: "获取单个 Meme 代币详情。",
  },
  {
    name: "swap_quote",
    description: "获取兑换报价。",
  },
  {
    name: "swap_execute",
    description: "构建兑换交易。",
  },
  {
    name: "swap_approve_transaction",
    description: "获取 ERC-20 授权交易。",
  },
  {
    name: "get_dex_quote",
    description: "获取兑换报价，与 swap_quote 等价。",
  },
  {
    name: "get_dex_swap",
    description: "构建兑换交易，与 swap_execute 等价。",
  },
  {
    name: "get_dex_approve_transaction",
    description: "获取授权交易，与 swap_approve_transaction 等价。",
  },
];

function setCors(res: ServerlessResponse, req?: ServerlessRequest) {
  const origin = typeof req?.headers.origin === "string" ? req.headers.origin : "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

function getCredential(name: "OKX_API_KEY" | "OKX_SECRET_KEY" | "OKX_PASSPHRASE") {
  const envNames: Record<typeof name, string[]> = {
    OKX_API_KEY: ["OKX_API_KEY", "OKX_DEX_API_KEY", "OKX_ONCHAIN_API_KEY"],
    OKX_SECRET_KEY: ["OKX_SECRET_KEY", "OKX_DEX_SECRET_KEY", "OKX_ONCHAIN_SECRET_KEY"],
    OKX_PASSPHRASE: ["OKX_PASSPHRASE", "OKX_DEX_PASSPHRASE", "OKX_ONCHAIN_PASSPHRASE"],
  };

  for (const envName of envNames[name]) {
    const value = process.env[envName]?.trim();
    if (value) {
      return value;
    }
  }

  switch (name) {
    case "OKX_API_KEY":
      return DEFAULT_OKX_API_KEY;
    case "OKX_SECRET_KEY":
      return DEFAULT_OKX_SECRET_KEY;
    case "OKX_PASSPHRASE":
      return DEFAULT_OKX_PASSPHRASE;
    default:
      return "";
  }
}

function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function stringifyBody(body: unknown) {
  return body === undefined ? "" : JSON.stringify(body);
}

function sign(secretKey: string, timestamp: string, method: "GET" | "POST", requestPath: string, body = "") {
  return crypto
    .createHmac("sha256", secretKey)
    .update(`${timestamp}${method}${requestPath}${body}`)
    .digest("base64");
}

function buildRestHeaders(method: "GET" | "POST", requestPath: string, body = "") {
  const apiKey = getCredential("OKX_API_KEY");
  const secretKey = getCredential("OKX_SECRET_KEY");
  const passphrase = getCredential("OKX_PASSPHRASE");
  const timestamp = new Date().toISOString();

  return {
    "Content-Type": "application/json",
    "OK-ACCESS-KEY": apiKey,
    "OK-ACCESS-SIGN": sign(secretKey, timestamp, method, requestPath, body),
    "OK-ACCESS-PASSPHRASE": passphrase,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "ok-client-type": "cli",
  };
}

function buildUpstreamMcpHeaders() {
  return {
    "Content-Type": "application/json",
    "OK-ACCESS-KEY": getCredential("OKX_API_KEY"),
  };
}

function resolveChainIndex(input?: unknown): string {
  const raw = typeof input === "string" ? input.trim().toLowerCase() : "";
  if (!raw) return "1";

  const chainMap: Record<string, string> = {
    "1": "1",
    ethereum: "1",
    eth: "1",
    "10": "10",
    optimism: "10",
    op: "10",
    "56": "56",
    bsc: "56",
    bnb: "56",
    binance: "56",
    "100": "100",
    gnosis: "100",
    xdai: "100",
    "137": "137",
    polygon: "137",
    matic: "137",
    "196": "196",
    xlayer: "196",
    "204": "204",
    opbnb: "204",
    "324": "324",
    zksync: "324",
    zksyncera: "324",
    "501": "501",
    "101": "501",
    sol: "501",
    solana: "501",
    "784": "784",
    sui: "784",
    "1101": "1101",
    polygonzkevm: "1101",
    "8453": "8453",
    base: "8453",
    "42161": "42161",
    arb: "42161",
    arbitrum: "42161",
    "43114": "43114",
    avax: "43114",
    avalanche: "43114",
    "59144": "59144",
    linea: "59144",
    "81457": "81457",
    blast: "81457",
    "534352": "534352",
    scroll: "534352",
  };

  return chainMap[raw] ?? raw;
}

function resolveChainIndices(input: unknown): string {
  const raw = typeof input === "string" ? input.trim() : "";
  if (!raw) return "1";

  return raw
    .split(",")
    .map((item) => resolveChainIndex(item))
    .filter(Boolean)
    .join(",");
}

async function fetchWithTimeout(input: string, init: RequestInit) {
  return fetch(input, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

async function parseOkxResponse(response: Response) {
  const rawText = await response.text();
  if (!rawText) {
    throw new Error(`OKX 返回空响应（HTTP ${response.status}）`);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    throw new Error(`OKX 返回了非 JSON 响应（HTTP ${response.status}）：${rawText.slice(0, 240)}`);
  }

  const code = typeof payload.code === "number" ? String(payload.code) : String(payload.code ?? "");
  if (!response.ok || code !== "0") {
    const message = typeof payload.msg === "string" && payload.msg ? payload.msg : rawText.slice(0, 240);
    throw new Error(`OKX API 请求失败（HTTP ${response.status}, code=${code || "unknown"}）：${message}`);
  }

  return payload.data;
}

async function okxGet(path: string, params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.trim()) {
      query.set(key, value.trim());
    }
  }

  const queryString = query.toString();
  const requestPath = queryString ? `${path}?${queryString}` : path;
  const response = await fetchWithTimeout(`${OKX_BASE_URL}${requestPath}`, {
    headers: buildRestHeaders("GET", requestPath),
  });

  return parseOkxResponse(response);
}

async function okxPost(path: string, payload: unknown) {
  const body = stringifyBody(payload);
  const response = await fetchWithTimeout(`${OKX_BASE_URL}${path}`, {
    method: "POST",
    headers: buildRestHeaders("POST", path, body),
    body,
  });

  return parseOkxResponse(response);
}

function wrapJsonRpcError(id: JsonRpcId, code: number, message: string): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
    },
  };
}

function wrapToolResult(id: JsonRpcId, data: OkxJson, isError = false): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [
        {
          type: "text",
          text: JSON.stringify(data),
        },
      ],
      isError,
    },
  };
}

function wrapToolMessage(id: JsonRpcId, message: string, isError = false): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [
        {
          type: "text",
          text: message,
        },
      ],
      isError,
    },
  };
}

function parseMcpText(payload: JsonRpcResponse) {
  const content = Array.isArray(payload.result?.content)
    ? (payload.result?.content as Array<Record<string, unknown>>)
    : [];
  const textBlock = content.find((item) => item?.type === "text");
  return typeof textBlock?.text === "string" ? textBlock.text : "";
}

function parseMcpJson<T = unknown>(payload: JsonRpcResponse): T {
  if (payload.error) {
    throw new Error(payload.error.message || "OKX MCP 调用失败");
  }

  if (payload.result?.isError) {
    throw new Error(parseMcpText(payload) || "OKX MCP 工具执行失败");
  }

  const text = parseMcpText(payload);
  if (!text) {
    return (payload.result ?? {}) as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}

async function parseMcpResponse(response: Response): Promise<JsonRpcResponse> {
  const rawText = await response.text();
  if (!rawText) {
    throw new Error(`OKX MCP 返回空响应（HTTP ${response.status}）`);
  }

  let payload: JsonRpcResponse;
  try {
    payload = JSON.parse(rawText) as JsonRpcResponse;
  } catch {
    throw new Error(`OKX MCP 返回了非 JSON 响应（HTTP ${response.status}）：${rawText.slice(0, 240)}`);
  }

  if (!response.ok) {
    throw new Error(payload.error?.message || `OKX MCP 请求失败（HTTP ${response.status}）`);
  }

  return payload;
}

async function callUpstreamMcp(request: JsonRpcRequest): Promise<JsonRpcResponse> {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: request.id ?? null,
    method: request.method,
    params: request.params ?? {},
  });

  let lastError: Error | null = null;
  for (const url of OKX_MCP_URLS) {
    try {
      const response = await fetchWithTimeout(url, {
        method: "POST",
        headers: buildUpstreamMcpHeaders(),
        body,
      });
      return await parseMcpResponse(response);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("OKX MCP 上游请求失败");
    }
  }

  throw lastError ?? new Error("OKX MCP 上游请求失败");
}

async function callUpstreamTool<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const response = await callUpstreamMcp({
    jsonrpc: "2.0",
    id: `upstream-${name}-${Date.now()}`,
    method: "tools/call",
    params: {
      name,
      arguments: args,
    },
  });

  return parseMcpJson<T>(response);
}

function normalizeTrackerType(input: unknown): string {
  const raw = typeof input === "string" ? input.trim().toLowerCase() : "";
  if (!raw) return "1";

  const mapping: Record<string, string> = {
    smart: "1",
    smartmoney: "1",
    smart_money: "1",
    kol: "2",
    multi: "3",
    multi_address: "3",
  };

  return mapping[raw] ?? raw;
}

function isOfficialOkxTool(name: string) {
  return /^dex-okx-|^okx-/.test(name);
}

async function handleTokenPriceInfo(args: Record<string, unknown>) {
  const tokenContractAddress = firstNonEmptyString(
    args.tokenAddress,
    args.tokenContractAddress,
    args.address,
  );
  const chainIndex = resolveChainIndex(args.chainIndex ?? args.chain);

  if (!tokenContractAddress) {
    throw new Error("token_price_info 缺少 tokenAddress 或 address 参数");
  }

  const data = (await okxPost("/api/v6/dex/market/price-info", [
    {
      chainIndex,
      tokenContractAddress,
    },
  ])) as unknown[];

  const first = Array.isArray(data) ? toObject(data[0]) : {};
  return {
    chainIndex,
    tokenContractAddress,
    price: firstNonEmptyString(first.price, first.tokenPrice) || "0",
    change24h: firstNonEmptyString(first.priceChange24H, first.change24h),
    volume24h: firstNonEmptyString(first.volume24H, first.volume24h),
    marketCap: firstNonEmptyString(first.marketCap),
    liquidity: firstNonEmptyString(first.liquidity),
    lastUpdated: firstNonEmptyString(first.time, first.lastUpdated),
    raw: first,
  };
}

async function handleTokenHotTokens(args: Record<string, unknown>) {
  const chainIndex = resolveChainIndex(args.chainIndex ?? args.chain);
  const sortBy = firstNonEmptyString(args.sortBy) || "5";
  const timeFrame = firstNonEmptyString(args.timeFrame) || "4";

  const raw = await callUpstreamTool("dex-okx-market-token-ranking", {
    chains: chainIndex,
    sortBy,
    timeFrame,
  });

  const rows = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.data)
      ? ((raw as Record<string, unknown>).data as unknown[])
      : [];

  return rows.map((entry) => {
    const item = toObject(entry);
    return {
      symbol: firstNonEmptyString(item.tokenSymbol) || "UNKNOWN",
      name: firstNonEmptyString(item.tokenName, item.tokenSymbol) || "Unknown Token",
      address: firstNonEmptyString(item.tokenContractAddress) || "",
      chain: chainIndex,
      chainIndex: firstNonEmptyString(item.chainIndex) || chainIndex,
      price: firstNonEmptyString(item.price) || "0",
      change24h: firstNonEmptyString(item.change) || "0",
      volume24h: firstNonEmptyString(item.volume) || "0",
      marketCap: firstNonEmptyString(item.marketCap) || "0",
      liquidity: firstNonEmptyString(item.liquidity) || "0",
      holders: firstNonEmptyString(item.holders) || "0",
      logoUrl: firstNonEmptyString(item.tokenLogoUrl),
      raw: item,
    };
  });
}

async function handlePortfolioAllBalances(args: Record<string, unknown>) {
  const address = firstNonEmptyString(args.address, args.walletAddress, args.userWalletAddress);
  const chains = resolveChainIndices(args.chains ?? args.chainIndices ?? args.chainIndex ?? args.chain);
  const filter = firstNonEmptyString(args.filter);
  const excludeRiskToken = firstNonEmptyString(args.excludeRiskToken, args.exclude_risk);

  if (!address) {
    throw new Error("portfolio_all_balances 缺少 address 参数");
  }

  const data = (await okxGet("/api/v6/dex/balance/all-token-balances-by-address", {
    address,
    chains,
    filter,
    excludeRiskToken,
  })) as unknown[];

  if (!Array.isArray(data)) {
    return [];
  }

  return data.flatMap((entry) => {
    const item = toObject(entry);
    const tokenAssets = Array.isArray(item.tokenAssets) ? item.tokenAssets : [];
    return tokenAssets.map((asset) => {
      const token = toObject(asset);
      return {
        address: firstNonEmptyString(token.address, address),
        balance: firstNonEmptyString(token.balance) || "0",
        chainIndex: firstNonEmptyString(token.chainIndex) || "1",
        symbol: firstNonEmptyString(token.symbol),
        tokenName: firstNonEmptyString(token.tokenName, token.symbol),
        tokenContractAddress: firstNonEmptyString(
          token.tokenContractAddress,
          token.tokenAddress,
          token.address,
        ),
        tokenPrice: firstNonEmptyString(token.tokenPrice) || "0",
        tokenLogoUrl: firstNonEmptyString(token.tokenLogoUrl, token.logoUrl),
        isRiskToken: Boolean(token.isRiskToken),
      };
    });
  });
}

async function handleDefiSearch(args: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};

  const token = firstNonEmptyString(args.token, args.tokenKeyword);
  const platform = firstNonEmptyString(args.platform, args.platformKeyword);
  const chainIndex = firstNonEmptyString(args.chainIndex, args.chain);
  const productGroup = firstNonEmptyString(args.productGroup, args.product_group);

  if (token) {
    payload.tokenKeywordList = token
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  } else if (Array.isArray(args.tokenKeywordList)) {
    payload.tokenKeywordList = args.tokenKeywordList;
  }

  if (platform) {
    payload.platformKeywordList = platform
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  } else if (Array.isArray(args.platformKeywordList)) {
    payload.platformKeywordList = args.platformKeywordList;
  }

  if (chainIndex) {
    payload.chainIndex = resolveChainIndex(chainIndex);
  }

  if (productGroup) {
    payload.productGroup = productGroup;
  }

  if (typeof args.pageNum === "number" && Number.isFinite(args.pageNum)) {
    payload.pageNum = args.pageNum;
  } else if (typeof args.page_num === "number" && Number.isFinite(args.page_num)) {
    payload.pageNum = args.page_num;
  }

  if (!payload.tokenKeywordList && !payload.platformKeywordList) {
    throw new Error("defi_search 至少需要 token 或 platform 参数之一");
  }

  const data = (await okxPost("/api/v6/defi/product/search", payload)) as Record<string, unknown>;
  const object = toObject(data);
  return {
    total: typeof object.total === "number" ? object.total : Number(object.total ?? 0),
    list: Array.isArray(object.list) ? object.list : [],
    raw: object,
  };
}

async function handleSmartMoneyLeaderboardList(args: Record<string, unknown>) {
  return callUpstreamTool("dex-okx-market-leaderboard-list", {
    chainIndex: resolveChainIndex(args.chainIndex ?? args.chain),
    timeFrame: firstNonEmptyString(args.timeFrame) || "1",
    sortBy: firstNonEmptyString(args.sortBy) || "1",
    walletType: firstNonEmptyString(args.walletType) || "3",
    minRealizedPnlUsd: firstNonEmptyString(args.minRealizedPnlUsd) || undefined,
    maxRealizedPnlUsd: firstNonEmptyString(args.maxRealizedPnlUsd) || undefined,
    minWinRatePercent: firstNonEmptyString(args.minWinRatePercent) || undefined,
    maxWinRatePercent: firstNonEmptyString(args.maxWinRatePercent) || undefined,
    minTxs: firstNonEmptyString(args.minTxs) || undefined,
    maxTxs: firstNonEmptyString(args.maxTxs) || undefined,
    minTxVolume: firstNonEmptyString(args.minTxVolume) || undefined,
    maxTxVolume: firstNonEmptyString(args.maxTxVolume) || undefined,
  });
}

async function handleSmartMoneyTrades(args: Record<string, unknown>) {
  return callUpstreamTool("dex-okx-market-address-tracker-trades", {
    trackerType: normalizeTrackerType(args.trackerType),
    walletAddress: firstNonEmptyString(args.walletAddress) || undefined,
    tradeType: firstNonEmptyString(args.tradeType) || undefined,
    chainIndex: firstNonEmptyString(args.chainIndex, args.chain)
      ? resolveChainIndex(args.chainIndex ?? args.chain)
      : undefined,
    minVolume: firstNonEmptyString(args.minVolume) || undefined,
    maxVolume: firstNonEmptyString(args.maxVolume) || undefined,
    minHolders: firstNonEmptyString(args.minHolders) || undefined,
    minMarketCap: firstNonEmptyString(args.minMarketCap) || undefined,
    maxMarketCap: firstNonEmptyString(args.maxMarketCap) || undefined,
    minLiquidity: firstNonEmptyString(args.minLiquidity) || undefined,
    maxLiquidity: firstNonEmptyString(args.maxLiquidity) || undefined,
    begin: firstNonEmptyString(args.begin) || undefined,
    end: firstNonEmptyString(args.end) || undefined,
  });
}

async function handleMemeScanList(args: Record<string, unknown>) {
  return callUpstreamTool("dex-okx-market-memepump-token-list", {
    chainIndex: firstNonEmptyString(args.chainIndex, args.chain)
      ? resolveChainIndex(args.chainIndex ?? args.chain)
      : undefined,
    stage: firstNonEmptyString(args.stage) || undefined,
    walletAddress: firstNonEmptyString(args.walletAddress) || undefined,
    protocolIdList: firstNonEmptyString(args.protocolIdList) || undefined,
    sortBy: firstNonEmptyString(args.sortBy) || undefined,
    order: firstNonEmptyString(args.order) || undefined,
    page: firstNonEmptyString(args.page) || undefined,
    limit: firstNonEmptyString(args.limit) || undefined,
  });
}

async function handleMemeScanDetails(args: Record<string, unknown>) {
  const chainIndex = resolveChainIndex(args.chainIndex ?? args.chain);
  const tokenContractAddress = firstNonEmptyString(
    args.tokenContractAddress,
    args.tokenAddress,
    args.address,
  );

  if (!tokenContractAddress) {
    throw new Error("meme_scan_details 缺少 tokenContractAddress 或 tokenAddress 参数");
  }

  return callUpstreamTool("dex-okx-market-memepump-token-details", {
    chainIndex,
    tokenContractAddress,
    walletAddress: firstNonEmptyString(args.walletAddress) || undefined,
  });
}

async function handleSwapQuote(args: Record<string, unknown>) {
  const chainIndex = resolveChainIndex(args.chainIndex ?? args.chain);
  const amount = firstNonEmptyString(args.amount);
  const swapMode = firstNonEmptyString(args.swapMode) || "exactIn";
  const fromTokenAddress = firstNonEmptyString(args.fromTokenAddress, args.fromToken, args.fromTokenContractAddress);
  const toTokenAddress = firstNonEmptyString(args.toTokenAddress, args.toToken, args.toTokenContractAddress);

  if (!amount || !fromTokenAddress || !toTokenAddress) {
    throw new Error("swap_quote 缺少 amount、fromTokenAddress 或 toTokenAddress 参数");
  }

  return callUpstreamTool("dex-okx-dex-quote", {
    chainIndex,
    amount,
    swapMode,
    fromTokenAddress,
    toTokenAddress,
    userWalletAddress: firstNonEmptyString(args.userWalletAddress, args.walletAddress) || undefined,
    dexIds: firstNonEmptyString(args.dexIds) || undefined,
    directRoute: typeof args.directRoute === "boolean" ? args.directRoute : undefined,
    priceImpactProtectionPercent:
      firstNonEmptyString(args.priceImpactProtectionPercent, args.slippage) || undefined,
    feePercent: firstNonEmptyString(args.feePercent) || undefined,
  });
}

async function handleSwapApproveTransaction(args: Record<string, unknown>) {
  const chainIndex = resolveChainIndex(args.chainIndex ?? args.chain);
  const tokenContractAddress = firstNonEmptyString(
    args.tokenContractAddress,
    args.tokenAddress,
    args.fromTokenAddress,
  );
  const approveAmount = firstNonEmptyString(args.approveAmount, args.amount);

  if (!tokenContractAddress || !approveAmount) {
    throw new Error("swap_approve_transaction 缺少 tokenContractAddress 或 approveAmount 参数");
  }

  return callUpstreamTool("dex-okx-dex-approve-transaction", {
    chainIndex,
    tokenContractAddress,
    approveAmount,
  });
}

async function handleSwapExecute(args: Record<string, unknown>) {
  const chainIndex = resolveChainIndex(args.chainIndex ?? args.chain);
  const amount = firstNonEmptyString(args.amount);
  const userWalletAddress = firstNonEmptyString(args.userWalletAddress, args.walletAddress);
  const fromTokenAddress = firstNonEmptyString(args.fromTokenAddress, args.fromToken, args.fromTokenContractAddress);
  const toTokenAddress = firstNonEmptyString(args.toTokenAddress, args.toToken, args.toTokenContractAddress);
  const slippage = firstNonEmptyString(args.slippage, args.priceImpactProtectionPercent) || "0.5";

  if (!amount || !userWalletAddress || !fromTokenAddress || !toTokenAddress) {
    throw new Error("swap_execute 缺少 amount、userWalletAddress、fromTokenAddress 或 toTokenAddress 参数");
  }

  return callUpstreamTool("dex-okx-dex-swap", {
    chainIndex,
    amount,
    userWalletAddress,
    fromTokenAddress,
    toTokenAddress,
    slippage,
    receiveAddress: firstNonEmptyString(args.receiveAddress) || undefined,
    dexIds: firstNonEmptyString(args.dexIds) || undefined,
    priceImpactProtectionPercent: firstNonEmptyString(args.priceImpactProtectionPercent) || undefined,
    feePercent: firstNonEmptyString(args.feePercent) || undefined,
  });
}

async function executeLocalTool(name: LocalToolName, args: Record<string, unknown>) {
  switch (name) {
    case "token_price_info":
      return handleTokenPriceInfo(args);
    case "token_hot_tokens":
      return handleTokenHotTokens(args);
    case "portfolio_all_balances":
      return handlePortfolioAllBalances(args);
    case "defi_search":
      return handleDefiSearch(args);
    case "smart_money_leaderboard_list":
      return handleSmartMoneyLeaderboardList(args);
    case "smart_money_trades":
      return handleSmartMoneyTrades(args);
    case "meme_scan_list":
      return handleMemeScanList(args);
    case "meme_scan_details":
      return handleMemeScanDetails(args);
    case "swap_quote":
    case "get_dex_quote":
      return handleSwapQuote(args);
    case "swap_execute":
    case "get_dex_swap":
      return handleSwapExecute(args);
    case "swap_approve_transaction":
    case "get_dex_approve_transaction":
      return handleSwapApproveTransaction(args);
    default:
      throw new Error(`暂不支持的本地 OKX 工具：${name}`);
  }
}

async function handleInitialize(id: JsonRpcId): Promise<JsonRpcResponse> {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: "h-wallet-okx-proxy",
        version: "2.1.0",
      },
    },
  };
}

async function handleToolsList(id: JsonRpcId): Promise<JsonRpcResponse> {
  try {
    const upstream = await callUpstreamMcp({
      jsonrpc: "2.0",
      id,
      method: "tools/list",
      params: {},
    });

    const upstreamTools = Array.isArray(upstream.result?.tools)
      ? (upstream.result?.tools as ToolDefinition[])
      : [];
    const merged = new Map<string, ToolDefinition>();

    for (const tool of [...LOCAL_TOOL_DEFINITIONS, ...upstreamTools]) {
      if (tool?.name) {
        merged.set(tool.name, tool);
      }
    }

    return {
      jsonrpc: "2.0",
      id,
      result: {
        tools: Array.from(merged.values()),
      },
    };
  } catch (error) {
    console.error("[OKX MCP Proxy] tools/list 上游失败", error);
    return {
      jsonrpc: "2.0",
      id,
      result: {
        tools: LOCAL_TOOL_DEFINITIONS,
      },
    };
  }
}

async function handleToolsCall(id: JsonRpcId, params: ToolCallParams): Promise<JsonRpcResponse> {
  const name = typeof params.name === "string" ? params.name.trim() : "";
  const args = toObject(params.arguments);

  if (!name) {
    return wrapJsonRpcError(id, -32602, "tools/call 缺少 name 参数");
  }

  try {
    if (isOfficialOkxTool(name)) {
      return await callUpstreamMcp({
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: {
          name,
          arguments: args,
        },
      });
    }

    const data = await executeLocalTool(name as LocalToolName, args);
    return wrapToolResult(id, data as OkxJson, false);
  } catch (error) {
    const message = error instanceof Error ? error.message : "OKX 工具调用失败";
    console.error("[OKX MCP Proxy] tools/call 失败", { name, message });
    return wrapToolMessage(id, message, true);
  }
}

async function handleJsonRpcRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
  const id = request.id ?? null;
  const method = typeof request.method === "string" ? request.method : "";

  if ((request.jsonrpc ?? "2.0") !== "2.0") {
    return wrapJsonRpcError(id, -32600, "仅支持 JSON-RPC 2.0 请求");
  }

  if (method === "initialize") {
    return handleInitialize(id);
  }

  if (method === "tools/list") {
    return handleToolsList(id);
  }

  if (method === "tools/call") {
    return handleToolsCall(id, toObject(request.params) as ToolCallParams);
  }

  return wrapJsonRpcError(id, -32601, `不支持的方法：${method || "unknown"}`);
}

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  setCors(res, req);

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32601,
        message: "仅支持 POST 请求",
      },
    });
    return;
  }

  try {
    const request = toObject(req.body) as JsonRpcRequest;
    const response = await handleJsonRpcRequest(request);
    res.status(200).json(response);
  } catch (error) {
    const request = toObject(req.body) as JsonRpcRequest;
    const message = error instanceof Error ? error.message : "OKX MCP 代理内部错误";
    console.error("[OKX MCP Proxy] 未处理异常", error);
    res.status(500).json(wrapJsonRpcError(request.id ?? null, -32603, message));
  }
}
