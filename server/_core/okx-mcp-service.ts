import crypto from "crypto";
import { JSONRPCRequest, JSONRPCResponse } from "@modelcontextprotocol/sdk/types.js";
import "dotenv/config";

const OKX_BASE_URL = "https://web3.okx.com";
const OKX_ONCHAINOS_MCP_URL = "https://web3.okx.com/api/v1/onchainos-mcp";
const DEFAULT_OKX_API_KEY = "39b84d18-8693-4554-9a37-170cbc7a5812";
const DEFAULT_OKX_SECRET_KEY = "A07D90C0C2A85CE957A1619D8DA38E20";
const DEFAULT_OKX_PASSPHRASE = "Yy133678.";

type ToolCallParams = {
  name?: string;
  arguments?: Record<string, unknown>;
};

type LocalToolName =
  | "token_price_info"
  | "portfolio_all_balances"
  | "defi_search"
  | "smart_money_leaderboard_list"
  | "smart_money_trades"
  | "meme_scan_list"
  | "meme_scan_details"
  | "swap_quote"
  | "swap_execute"
  | "swap_approve_transaction";

type OkxJson = Record<string, unknown> | unknown[];

type UpstreamToolDefinition = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

const LOCAL_TOOL_DEFINITIONS: UpstreamToolDefinition[] = [
  {
    name: "token_price_info",
    description: "获取代币价格、24h 涨跌幅与成交量（兼容旧前端的本地别名）",
  },
  {
    name: "portfolio_all_balances",
    description: "获取地址多链资产余额列表（兼容旧前端的本地别名）",
  },
  {
    name: "defi_search",
    description: "搜索 DeFi 投资产品（兼容旧前端的本地别名）",
  },
  {
    name: "smart_money_leaderboard_list",
    description: "获取聪明钱 / KOL / 巨鲸榜单（对 dex-okx-market-leaderboard-list 的友好别名）",
  },
  {
    name: "smart_money_trades",
    description: "获取聪明钱近期买卖动向（对 dex-okx-market-address-tracker-trades 的友好别名）",
  },
  {
    name: "meme_scan_list",
    description: "获取 Meme 扫描代币列表（对 dex-okx-market-memepump-token-list 的友好别名）",
  },
  {
    name: "meme_scan_details",
    description: "获取单个 Meme 代币的扫链详情（对 dex-okx-market-memepump-token-details 的友好别名）",
  },
  {
    name: "swap_quote",
    description: "获取 Swap 报价（对 dex-okx-dex-quote 的友好别名）",
  },
  {
    name: "swap_execute",
    description: "获取 Swap 交易数据（对 dex-okx-dex-swap 的友好别名）",
  },
  {
    name: "swap_approve_transaction",
    description: "获取代币授权交易数据（对 dex-okx-dex-approve-transaction 的友好别名）",
  },
];

function getCredential(name: "OKX_API_KEY" | "OKX_SECRET_KEY" | "OKX_PASSPHRASE") {
  const value = process.env[name]?.trim();
  if (value) return value;

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

function resolveChainIndex(input?: unknown): string {
  const raw = typeof input === "string" ? input.trim().toLowerCase() : "";
  if (!raw) return "1";

  const chainMap: Record<string, string> = {
    "1": "1",
    ethereum: "1",
    eth: "1",
    "56": "56",
    bsc: "56",
    bnb: "56",
    binance: "56",
    "137": "137",
    polygon: "137",
    matic: "137",
    "42161": "42161",
    arbitrum: "42161",
    arb: "42161",
    "8453": "8453",
    base: "8453",
    solana: "501",
    sol: "501",
    "101": "501",
    "501": "501",
    "324": "324",
    zksync: "324",
    zksyncera: "324",
    "10": "10",
    optimism: "10",
    op: "10",
    "43114": "43114",
    avalanche: "43114",
    avax: "43114",
    "100": "100",
    gnosis: "100",
    xdai: "100",
    "59144": "59144",
    linea: "59144",
    "534352": "534352",
    scroll: "534352",
    "1101": "1101",
    polygonzkevm: "1101",
    "81457": "81457",
    blast: "81457",
    "196": "196",
    xlayer: "196",
    "204": "204",
    opbnb: "204",
    "784": "784",
    sui: "784",
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

function stringifyBody(body: unknown) {
  return body === undefined ? "" : JSON.stringify(body);
}

function sign(secretKey: string, timestamp: string, method: "GET" | "POST", requestPath: string, body = "") {
  return crypto.createHmac("sha256", secretKey).update(`${timestamp}${method}${requestPath}${body}`).digest("base64");
}

function buildHeaders(method: "GET" | "POST", requestPath: string, body = "") {
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

async function okxGet(path: string, params: Record<string, string>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.append(key, value);
  }
  const queryString = query.toString();
  const requestPath = queryString ? `${path}?${queryString}` : path;
  const response = await fetch(`${OKX_BASE_URL}${requestPath}`, {
    headers: buildHeaders("GET", requestPath),
  });
  return parseOkxResponse(response);
}

async function okxPost(path: string, payload: unknown) {
  const body = stringifyBody(payload);
  const response = await fetch(`${OKX_BASE_URL}${path}`, {
    method: "POST",
    headers: buildHeaders("POST", path, body),
    body,
  });
  return parseOkxResponse(response);
}

async function parseOkxResponse(response: Response) {
  const rawText = await response.text();
  if (!rawText) {
    throw new Error(`OKX 返回空响应（HTTP ${response.status}）`);
  }

  let payload: any;
  try {
    payload = JSON.parse(rawText);
  } catch {
    throw new Error(`OKX 返回了非 JSON 响应（HTTP ${response.status}）: ${rawText.slice(0, 240)}`);
  }

  const code = typeof payload?.code === "number" ? String(payload.code) : String(payload?.code ?? "");
  if (!response.ok || code !== "0") {
    const message = typeof payload?.msg === "string" && payload.msg ? payload.msg : rawText.slice(0, 240);
    throw new Error(`OKX API 请求失败（HTTP ${response.status}, code=${code || "unknown"}）：${message}`);
  }

  return payload.data;
}

async function parseMcpResponse(response: Response): Promise<JSONRPCResponse> {
  const rawText = await response.text();
  if (!rawText) {
    throw new Error(`OKX MCP 返回空响应（HTTP ${response.status}）`);
  }

  let payload: JSONRPCResponse;
  try {
    payload = JSON.parse(rawText) as JSONRPCResponse;
  } catch {
    throw new Error(`OKX MCP 返回了非 JSON 响应（HTTP ${response.status}）: ${rawText.slice(0, 240)}`);
  }

  if (!response.ok) {
    const rpcError = "error" in payload ? payload.error : undefined;
    const message = rpcError?.message || rawText.slice(0, 240);
    throw new Error(`OKX MCP 请求失败（HTTP ${response.status}）：${message}`);
  }

  return payload;
}

function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function wrapSuccess(id: JSONRPCRequest["id"], data: OkxJson): JSONRPCResponse {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    result: {
      content: [
        {
          type: "text",
          text: JSON.stringify(data),
        },
      ],
      isError: false,
    },
  } as JSONRPCResponse;
}

function wrapToolError(id: JSONRPCRequest["id"], message: string): JSONRPCResponse {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    result: {
      content: [
        {
          type: "text",
          text: message,
        },
      ],
      isError: true,
    },
  } as JSONRPCResponse;
}

function wrapRpcError(id: JSONRPCRequest["id"], code: number, message: string): JSONRPCResponse {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code,
      message,
    },
  } as JSONRPCResponse;
}

function parseMcpTextResult(payload: JSONRPCResponse): string {
  const result = "result" in payload ? (payload.result as any) : undefined;
  const content = Array.isArray(result?.content) ? result.content : [];
  const textBlock = content.find((item: any) => item?.type === "text");
  return typeof textBlock?.text === "string" ? textBlock.text : "";
}

function parseMcpJsonResult<T = any>(payload: JSONRPCResponse): T {
  if ("error" in payload && payload.error) {
    throw new Error(payload.error.message || "OKX MCP 调用失败");
  }

  const result = "result" in payload ? (payload.result as any) : undefined;
  if (result?.isError) {
    throw new Error(parseMcpTextResult(payload) || "OKX MCP 工具执行失败");
  }

  const text = parseMcpTextResult(payload);
  if (!text) {
    return result as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}

function isOfficialOkxTool(name: string) {
  return /^dex-okx-|^okx-/.test(name);
}

async function callUpstreamMcp(request: JSONRPCRequest): Promise<JSONRPCResponse> {
  const body = JSON.stringify(request);
  const response = await fetch(OKX_ONCHAINOS_MCP_URL, {
    method: "POST",
    headers: buildUpstreamMcpHeaders(),
    body,
  });
  return parseMcpResponse(response);
}

async function callUpstreamTool<T = any>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const response = await callUpstreamMcp({
    jsonrpc: "2.0",
    id: `upstream-${name}-${Date.now()}`,
    method: "tools/call",
    params: {
      name,
      arguments: args,
    },
  } as JSONRPCRequest);

  return parseMcpJsonResult<T>(response);
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

async function handleTokenPriceInfo(args: Record<string, unknown>) {
  const address = typeof args.address === "string" ? args.address.trim() : "";
  const chainIndex = resolveChainIndex(args.chain);

  if (!address) {
    throw new Error("token_price_info 缺少 address 参数");
  }

  const data = (await okxPost("/api/v6/dex/market/price-info", [
    {
      chainIndex,
      tokenContractAddress: address,
    },
  ])) as any[];

  const first = Array.isArray(data) ? toObject(data[0]) : {};
  return {
    chainIndex,
    tokenContractAddress: address,
    price: typeof first.price === "string" ? first.price : "0",
    change24h:
      typeof first.priceChange24H === "string"
        ? first.priceChange24H
        : typeof first.change24h === "string"
          ? first.change24h
          : undefined,
    volume24h:
      typeof first.volume24H === "string"
        ? first.volume24H
        : typeof first.volume24h === "string"
          ? first.volume24h
          : undefined,
    lastUpdated:
      typeof first.time === "string"
        ? first.time
        : typeof first.lastUpdated === "string"
          ? first.lastUpdated
          : undefined,
    marketCap: typeof first.marketCap === "string" ? first.marketCap : undefined,
    liquidity: typeof first.liquidity === "string" ? first.liquidity : undefined,
  };
}

async function handlePortfolioAllBalances(args: Record<string, unknown>) {
  const address = typeof args.address === "string" ? args.address.trim() : "";
  const chains = resolveChainIndices(args.chains);
  const filter = typeof args.filter === "string" ? args.filter.trim() : "";
  const excludeRiskToken = typeof args.exclude_risk === "string" ? args.exclude_risk.trim() : "";

  if (!address) {
    throw new Error("portfolio_all_balances 缺少 address 参数");
  }

  const data = (await okxGet("/api/v6/dex/balance/all-token-balances-by-address", {
    address,
    chains,
    filter,
    excludeRiskToken,
  })) as any[];

  if (!Array.isArray(data)) return [];

  return data.flatMap((entry) => {
    const item = toObject(entry);
    const tokenAssets = Array.isArray(item.tokenAssets) ? item.tokenAssets : [];
    return tokenAssets.map((asset) => {
      const token = toObject(asset);
      return {
        address: typeof token.address === "string" ? token.address : address,
        balance: typeof token.balance === "string" ? token.balance : "0",
        chainIndex: typeof token.chainIndex === "string" ? token.chainIndex : "1",
        symbol: typeof token.symbol === "string" ? token.symbol : undefined,
        tokenName:
          typeof token.tokenName === "string"
            ? token.tokenName
            : typeof token.symbol === "string"
              ? token.symbol
              : undefined,
        tokenContractAddress:
          typeof token.tokenContractAddress === "string"
            ? token.tokenContractAddress
            : typeof token.tokenAddress === "string"
              ? token.tokenAddress
              : undefined,
        tokenPrice: typeof token.tokenPrice === "string" ? token.tokenPrice : "0",
        tokenLogoUrl:
          typeof token.tokenLogoUrl === "string"
            ? token.tokenLogoUrl
            : typeof token.logoUrl === "string"
              ? token.logoUrl
              : undefined,
        isRiskToken: Boolean(token.isRiskToken),
      };
    });
  });
}

async function handleDefiSearch(args: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};

  if (typeof args.token === "string" && args.token.trim()) {
    payload.tokenKeywordList = args.token
      .trim()
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof args.platform === "string" && args.platform.trim()) {
    payload.platformKeywordList = args.platform
      .trim()
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof args.chain === "string" && args.chain.trim()) {
    payload.chainIndex = resolveChainIndex(args.chain);
  }

  if (typeof args.product_group === "string" && args.product_group.trim()) {
    payload.productGroup = args.product_group.trim();
  }

  if (typeof args.page_num === "number" && Number.isFinite(args.page_num)) {
    payload.pageNum = args.page_num;
  }

  if (!payload.tokenKeywordList && !payload.platformKeywordList) {
    throw new Error("defi_search 至少需要 token 或 platform 参数之一");
  }

  const data = (await okxPost("/api/v6/defi/product/search", payload)) as any;
  const object = toObject(data);
  return {
    total: object.total ?? 0,
    list: Array.isArray(object.list) ? object.list : [],
  };
}

async function handleSmartMoneyLeaderboardList(args: Record<string, unknown>) {
  return callUpstreamTool<any>("dex-okx-market-leaderboard-list", {
    chainIndex: resolveChainIndex(args.chain ?? args.chainIndex),
    timeFrame: typeof args.timeFrame === "string" && args.timeFrame.trim() ? args.timeFrame.trim() : "1",
    sortBy: typeof args.sortBy === "string" && args.sortBy.trim() ? args.sortBy.trim() : "1",
    walletType: typeof args.walletType === "string" && args.walletType.trim() ? args.walletType.trim() : "3",
    minRealizedPnlUsd:
      typeof args.minRealizedPnlUsd === "string" && args.minRealizedPnlUsd.trim() ? args.minRealizedPnlUsd.trim() : undefined,
    maxRealizedPnlUsd:
      typeof args.maxRealizedPnlUsd === "string" && args.maxRealizedPnlUsd.trim() ? args.maxRealizedPnlUsd.trim() : undefined,
    minWinRatePercent:
      typeof args.minWinRatePercent === "string" && args.minWinRatePercent.trim() ? args.minWinRatePercent.trim() : undefined,
    maxWinRatePercent:
      typeof args.maxWinRatePercent === "string" && args.maxWinRatePercent.trim() ? args.maxWinRatePercent.trim() : undefined,
    minTxs: typeof args.minTxs === "string" && args.minTxs.trim() ? args.minTxs.trim() : undefined,
    maxTxs: typeof args.maxTxs === "string" && args.maxTxs.trim() ? args.maxTxs.trim() : undefined,
    minTxVolume:
      typeof args.minTxVolume === "string" && args.minTxVolume.trim() ? args.minTxVolume.trim() : undefined,
    maxTxVolume:
      typeof args.maxTxVolume === "string" && args.maxTxVolume.trim() ? args.maxTxVolume.trim() : undefined,
  });
}

async function handleSmartMoneyTrades(args: Record<string, unknown>) {
  return callUpstreamTool<any>("dex-okx-market-address-tracker-trades", {
    trackerType: normalizeTrackerType(args.trackerType),
    walletAddress: typeof args.walletAddress === "string" && args.walletAddress.trim() ? args.walletAddress.trim() : undefined,
    tradeType: typeof args.tradeType === "string" && args.tradeType.trim() ? args.tradeType.trim() : undefined,
    chainIndex: typeof args.chain === "string" || typeof args.chainIndex === "string"
      ? resolveChainIndex(args.chain ?? args.chainIndex)
      : undefined,
    minVolume: typeof args.minVolume === "string" && args.minVolume.trim() ? args.minVolume.trim() : undefined,
    maxVolume: typeof args.maxVolume === "string" && args.maxVolume.trim() ? args.maxVolume.trim() : undefined,
    minHolders: typeof args.minHolders === "string" && args.minHolders.trim() ? args.minHolders.trim() : undefined,
    minMarketCap: typeof args.minMarketCap === "string" && args.minMarketCap.trim() ? args.minMarketCap.trim() : undefined,
    maxMarketCap: typeof args.maxMarketCap === "string" && args.maxMarketCap.trim() ? args.maxMarketCap.trim() : undefined,
    minLiquidity: typeof args.minLiquidity === "string" && args.minLiquidity.trim() ? args.minLiquidity.trim() : undefined,
    maxLiquidity: typeof args.maxLiquidity === "string" && args.maxLiquidity.trim() ? args.maxLiquidity.trim() : undefined,
    begin: typeof args.begin === "string" && args.begin.trim() ? args.begin.trim() : undefined,
    end: typeof args.end === "string" && args.end.trim() ? args.end.trim() : undefined,
  });
}

async function handleMemeScanList(args: Record<string, unknown>) {
  return callUpstreamTool<any>("dex-okx-market-memepump-token-list", {
    chainIndex: typeof args.chain === "string" || typeof args.chainIndex === "string"
      ? resolveChainIndex(args.chain ?? args.chainIndex)
      : undefined,
    stage: typeof args.stage === "string" && args.stage.trim() ? args.stage.trim() : undefined,
    walletAddress: typeof args.walletAddress === "string" && args.walletAddress.trim() ? args.walletAddress.trim() : undefined,
    protocolIdList: typeof args.protocolIdList === "string" && args.protocolIdList.trim() ? args.protocolIdList.trim() : undefined,
    sortBy: typeof args.sortBy === "string" && args.sortBy.trim() ? args.sortBy.trim() : undefined,
    order: typeof args.order === "string" && args.order.trim() ? args.order.trim() : undefined,
    page: typeof args.page === "string" && args.page.trim() ? args.page.trim() : undefined,
    limit: typeof args.limit === "string" && args.limit.trim() ? args.limit.trim() : undefined,
  });
}

async function handleMemeScanDetails(args: Record<string, unknown>) {
  const chainIndex = resolveChainIndex(args.chain ?? args.chainIndex);
  const tokenContractAddress = typeof args.tokenContractAddress === "string"
    ? args.tokenContractAddress.trim()
    : typeof args.address === "string"
      ? args.address.trim()
      : "";

  if (!tokenContractAddress) {
    throw new Error("meme_scan_details 缺少 tokenContractAddress 参数");
  }

  return callUpstreamTool<any>("dex-okx-market-memepump-token-details", {
    chainIndex,
    tokenContractAddress,
    walletAddress: typeof args.walletAddress === "string" && args.walletAddress.trim() ? args.walletAddress.trim() : undefined,
  });
}

async function handleSwapQuote(args: Record<string, unknown>) {
  const chainIndex = resolveChainIndex(args.chain ?? args.chainIndex);
  const amount = typeof args.amount === "string" ? args.amount.trim() : "";
  const swapMode = typeof args.swapMode === "string" && args.swapMode.trim() ? args.swapMode.trim() : "exactIn";
  const fromTokenAddress = typeof args.fromTokenAddress === "string" ? args.fromTokenAddress.trim() : "";
  const toTokenAddress = typeof args.toTokenAddress === "string" ? args.toTokenAddress.trim() : "";

  if (!amount || !fromTokenAddress || !toTokenAddress) {
    throw new Error("swap_quote 缺少 amount、fromTokenAddress 或 toTokenAddress 参数");
  }

  return callUpstreamTool<any>("dex-okx-dex-quote", {
    chainIndex,
    amount,
    swapMode,
    fromTokenAddress,
    toTokenAddress,
    dexIds: typeof args.dexIds === "string" && args.dexIds.trim() ? args.dexIds.trim() : undefined,
    directRoute: typeof args.directRoute === "boolean" ? args.directRoute : undefined,
    priceImpactProtectionPercent:
      typeof args.priceImpactProtectionPercent === "string" && args.priceImpactProtectionPercent.trim()
        ? args.priceImpactProtectionPercent.trim()
        : undefined,
    feePercent: typeof args.feePercent === "string" && args.feePercent.trim() ? args.feePercent.trim() : undefined,
  });
}

async function handleSwapApproveTransaction(args: Record<string, unknown>) {
  const chainIndex = resolveChainIndex(args.chain ?? args.chainIndex);
  const tokenContractAddress = typeof args.tokenContractAddress === "string" ? args.tokenContractAddress.trim() : "";
  const approveAmount = typeof args.approveAmount === "string" ? args.approveAmount.trim() : "";

  if (!tokenContractAddress || !approveAmount) {
    throw new Error("swap_approve_transaction 缺少 tokenContractAddress 或 approveAmount 参数");
  }

  return callUpstreamTool<any>("dex-okx-dex-approve-transaction", {
    chainIndex,
    tokenContractAddress,
    approveAmount,
  });
}

async function handleSwapExecute(args: Record<string, unknown>) {
  const chainIndex = resolveChainIndex(args.chain ?? args.chainIndex);
  const amount = typeof args.amount === "string" ? args.amount.trim() : "";
  const userWalletAddress = typeof args.userWalletAddress === "string" ? args.userWalletAddress.trim() : "";
  const fromTokenAddress = typeof args.fromTokenAddress === "string" ? args.fromTokenAddress.trim() : "";
  const toTokenAddress = typeof args.toTokenAddress === "string" ? args.toTokenAddress.trim() : "";
  const slippage = typeof args.slippage === "string" && args.slippage.trim() ? args.slippage.trim() : "0.5";

  if (!amount || !userWalletAddress || !fromTokenAddress || !toTokenAddress) {
    throw new Error("swap_execute 缺少 amount、userWalletAddress、fromTokenAddress 或 toTokenAddress 参数");
  }

  return callUpstreamTool<any>("dex-okx-dex-swap", {
    chainIndex,
    amount,
    userWalletAddress,
    fromTokenAddress,
    toTokenAddress,
    slippage,
    receiveAddress: typeof args.receiveAddress === "string" && args.receiveAddress.trim() ? args.receiveAddress.trim() : undefined,
    dexIds: typeof args.dexIds === "string" && args.dexIds.trim() ? args.dexIds.trim() : undefined,
    priceImpactProtectionPercent:
      typeof args.priceImpactProtectionPercent === "string" && args.priceImpactProtectionPercent.trim()
        ? args.priceImpactProtectionPercent.trim()
        : undefined,
    feePercent: typeof args.feePercent === "string" && args.feePercent.trim() ? args.feePercent.trim() : undefined,
  });
}

class OkxMcpService {
  private async executeLocalTool(name: LocalToolName, args: Record<string, unknown>) {
    switch (name) {
      case "token_price_info":
        return handleTokenPriceInfo(args);
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
        return handleSwapQuote(args);
      case "swap_execute":
        return handleSwapExecute(args);
      case "swap_approve_transaction":
        return handleSwapApproveTransaction(args);
      default:
        throw new Error(`暂不支持的本地 OKX 工具：${name}`);
    }
  }

  async handleRequest(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    if (request.method === "initialize") {
      return {
        jsonrpc: "2.0",
        id: request.id ?? null,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          serverInfo: {
            name: "h-wallet-okx-proxy",
            version: "2.0.0",
          },
        },
      } as JSONRPCResponse;
    }

    if (request.method === "tools/list") {
      try {
        const upstream = await callUpstreamMcp({
          jsonrpc: "2.0",
          id: request.id ?? null,
          method: "tools/list",
          params: {},
        } as JSONRPCRequest);

        const upstreamTools = (("result" in upstream ? (upstream.result as any)?.content?.[0]?.text : undefined)
          ? []
          : (("result" in upstream ? (upstream.result as any)?.tools : []) as UpstreamToolDefinition[])) || [];

        const result = "result" in upstream ? (upstream.result as any) : {};
        const toolsFromResult = Array.isArray(result?.tools) ? (result.tools as UpstreamToolDefinition[]) : upstreamTools;
        const dedup = new Map<string, UpstreamToolDefinition>();

        for (const tool of [...LOCAL_TOOL_DEFINITIONS, ...toolsFromResult]) {
          if (tool?.name) dedup.set(tool.name, tool);
        }

        return wrapSuccess(request.id, {
          tools: Array.from(dedup.values()),
        });
      } catch (error) {
        console.error("[OKX MCP Proxy] tools/list upstream failed:", error);
        return wrapSuccess(request.id, {
          tools: LOCAL_TOOL_DEFINITIONS,
        });
      }
    }

    if (request.method !== "tools/call") {
      return wrapRpcError(request.id, -32601, `不支持的方法：${request.method}`);
    }

    const params = toObject(request.params) as ToolCallParams;
    const name = typeof params.name === "string" ? params.name.trim() : "";
    const args = toObject(params.arguments);

    if (!name) {
      return wrapRpcError(request.id, -32602, "tools/call 缺少 name 参数");
    }

    try {
      if (isOfficialOkxTool(name)) {
        return await callUpstreamMcp({
          jsonrpc: "2.0",
          id: request.id ?? null,
          method: "tools/call",
          params: {
            name,
            arguments: args,
          },
        } as JSONRPCRequest);
      }

      const data = await this.executeLocalTool(name as LocalToolName, args);
      return wrapSuccess(request.id, data as OkxJson);
    } catch (error) {
      const message = error instanceof Error ? error.message : "OKX 工具调用失败";
      console.error("[OKX MCP Proxy]", name, message);
      return wrapToolError(request.id, message);
    }
  }
}

export const okxMcpService = new OkxMcpService();

export async function callMcpTool<T = any>(name: string, args: any = {}): Promise<T> {
  const response = await okxMcpService.handleRequest({
    jsonrpc: "2.0",
    id: `internal-${Date.now()}`,
    method: "tools/call",
    params: {
      name,
      arguments: args,
    },
  } as JSONRPCRequest);

  return parseMcpJsonResult<T>(response);
}
