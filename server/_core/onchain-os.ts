import crypto from "crypto";
import {
  executeDexSwap,
  getDexConfig,
  getDexSwapOrders,
  getDexSwapQuote,
} from "./dex-swap";

const DEFAULT_ONCHAIN_BASE_URL = "https://web3.okx.com";
const DEFAULT_AGENT_WALLET_BASE_URL = "https://www.okx.com";
const RECEIPT_POLL_ATTEMPTS = 4;
const RECEIPT_POLL_INTERVAL_MS = 2000;

export type OnchainAssetItem = {
  address: string;
  balance: string;
  chainIndex: string;
  symbol?: string;
  tokenName?: string;
  tokenContractAddress?: string;
  tokenPrice: string;
  tokenLogoUrl?: string;
  isRiskToken: boolean;
};

export type OnchainAssetsResponse = {
  executionModel: "agent_wallet";
  source: "okx-onchain" | "mock";
  mockMode: boolean;
  totalAssetValue: string;
  walletAddresses: Array<{
    chainIndex: string;
    chainName: string;
    address: string;
    assets: Array<{
      chainIndex: string;
      chainName: string;
      tokenAddress: string;
      address: string;
      symbol: string;
      tokenName: string;
      balance: string;
      tokenPrice: string;
      valueUsd: string;
      isRiskToken: boolean;
      logoUrl?: string;
    }>;
  }>;
  updatedAt: string;
};

export type OnchainApprovalsResponse = {
  executionModel: "agent_wallet";
  source: "okx-onchain" | "mock";
  mockMode: boolean;
  approvals: Array<{
    chainIndex: string;
    cursor: string;
    approvalProjects: Array<{
      projectName: string;
      projectIcon?: string;
      approveAddress: string;
      tokens: Array<{
        coinId?: string;
        imageUrl?: string;
        symbol: string;
        status: string;
        tokenAddress: string;
        approvalNum: string;
      }>;
    }>;
  }>;
  updatedAt: string;
};

const CHAIN_INDEX_NAME_MAP: Record<string, string> = {
  "1": "Ethereum",
  "10": "Optimism",
  "56": "BNB Chain",
  "100": "Gnosis",
  "101": "Solana",
  "137": "Polygon",
  "196": "X Layer",
  "204": "opBNB",
  "324": "zkSync Era",
  "501": "Solana",
  "784": "Sui",
  "1101": "Polygon zkEVM",
  "8453": "Base",
  "1952": "X Layer Testnet",
  "42161": "Arbitrum",
  "43114": "Avalanche",
  "59144": "Linea",
  "534352": "Scroll",
  "81457": "Blast",
};

const CHAIN_INDEX_ALIAS_MAP: Record<string, string> = {
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
  "101": "501",
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
  sol: "501",
  solana: "501",
  "784": "784",
  sui: "784",
  "1101": "1101",
  polygonzkevm: "1101",
  "8453": "8453",
  base: "8453",
  "1952": "1952",
  xlayertestnet: "1952",
  "42161": "42161",
  arbitrum: "42161",
  arb: "42161",
  "43114": "43114",
  avalanche: "43114",
  avax: "43114",
  "59144": "59144",
  linea: "59144",
  "534352": "534352",
  scroll: "534352",
  "81457": "81457",
  blast: "81457",
};

function resolveChainIndices(input?: string) {
  const raw = typeof input === "string" ? input.trim() : "";
  if (!raw) return "1,196,501";
  return raw
    .split(",")
    .map((item) => CHAIN_INDEX_ALIAS_MAP[item.trim().toLowerCase()] ?? item.trim())
    .filter(Boolean)
    .join(",");
}

function buildSignedHeaders(method: "GET" | "POST", requestPath: string, body = "") {
  const timestamp = new Date().toISOString();
  const secretKey = getEnv("OKX_API_SECRET", "OKX_SECRET_KEY", "OKX_DEX_SECRET_KEY", "OKX_ONCHAIN_SECRET_KEY");
  const sign = crypto.createHmac("sha256", secretKey).update(`${timestamp}${method}${requestPath}${body}`).digest("base64");

  return {
    "Content-Type": "application/json",
    "OK-ACCESS-KEY": getEnv("OKX_API_KEY", "OKX_DEX_API_KEY", "OKX_ONCHAIN_API_KEY"),
    "OK-ACCESS-SIGN": sign,
    "OK-ACCESS-PASSPHRASE": getEnv("OKX_PASSPHRASE", "OKX_DEX_PASSPHRASE", "OKX_ONCHAIN_PASSPHRASE", "OKX_API_PASSPHRASE"),
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PROJECT": getEnv("OKX_PROJECT_ID", "OKX_DEX_PROJECT_ID"),
  };
}

async function callOnchainGet(path: string, params: Record<string, string>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      query.append(key, value);
    }
  }
  const queryString = query.toString();
  const requestPath = queryString ? `${path}?${queryString}` : path;
  const response = await fetch(`${getOnchainBaseUrl()}${requestPath}`, {
    headers: buildSignedHeaders("GET", requestPath),
  });
  const rawText = await response.text();
  const payload = rawText ? JSON.parse(rawText) : {};
  const code = typeof payload?.code === "number" ? String(payload.code) : String(payload?.code ?? "");

  if (!response.ok || code !== "0") {
    const message = typeof payload?.msg === "string" && payload.msg ? payload.msg : rawText.slice(0, 240);
    throw new Error(`Onchain OS 请求失败（HTTP ${response.status}, code=${code || "unknown"}）：${message}`);
  }

  return Array.isArray(payload?.data) ? payload.data : [];
}

function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function formatAmount(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (value === 0) return "0";
  if (Math.abs(value) >= 1) return value.toFixed(6).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  return value.toFixed(8).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function formatFiat(value: number) {
  if (!Number.isFinite(value)) return "0.00";
  return value.toFixed(2);
}

function normalizeAssetGroups(data: unknown[], fallbackAddress: string) {
  return data.flatMap((entry) => {
    const item = toObject(entry);
    const tokenAssets = Array.isArray(item.tokenAssets) ? item.tokenAssets : [];
    return tokenAssets.map((asset) => {
      const token = toObject(asset);
      const address = typeof token.address === "string" ? token.address : fallbackAddress;
      const chainIndex = typeof token.chainIndex === "string" ? token.chainIndex : "1";
      const chainName = CHAIN_INDEX_NAME_MAP[chainIndex] ?? `Chain ${chainIndex}`;
      const balance = typeof token.balance === "string" ? token.balance : "0";
      const tokenPrice = typeof token.tokenPrice === "string" ? token.tokenPrice : "0";
      const tokenAddress =
        typeof token.tokenContractAddress === "string"
          ? token.tokenContractAddress
          : typeof token.tokenAddress === "string"
            ? token.tokenAddress
            : "-";
      const symbol = typeof token.symbol === "string" ? token.symbol : "UNKNOWN";
      const tokenName = typeof token.tokenName === "string" ? token.tokenName : symbol;
      const logoUrl =
        typeof token.tokenLogoUrl === "string"
          ? token.tokenLogoUrl
          : typeof token.logoUrl === "string"
            ? token.logoUrl
            : undefined;
      const valueUsd = formatFiat(toNumber(balance) * toNumber(tokenPrice));

      return {
        chainIndex,
        chainName,
        address,
        symbol,
        tokenName,
        tokenAddress,
        balance: formatAmount(toNumber(balance)),
        tokenPrice,
        valueUsd,
        isRiskToken: Boolean(token.isRiskToken),
        logoUrl,
      };
    });
  });
}

function groupAssetsByWalletAddress(assets: ReturnType<typeof normalizeAssetGroups>) {
  const grouped = new Map<string, { chainIndex: string; chainName: string; address: string; assets: typeof assets }>();
  for (const asset of assets) {
    const key = `${asset.chainIndex}:${asset.address}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.assets.push(asset);
      continue;
    }
    grouped.set(key, {
      chainIndex: asset.chainIndex,
      chainName: asset.chainName,
      address: asset.address,
      assets: [asset],
    });
  }
  return Array.from(grouped.values()).map((group) => ({
    ...group,
    assets: group.assets.sort((left, right) => toNumber(right.valueUsd) - toNumber(left.valueUsd)),
  }));
}

function buildMockAssets(address: string): OnchainAssetsResponse {
  return {
    executionModel: "agent_wallet",
    source: "mock",
    mockMode: true,
    totalAssetValue: "0.00",
    walletAddresses: [
      {
        chainIndex: "196",
        chainName: "X Layer",
        address,
        assets: [],
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

function buildMockApprovals(chainIndex: string): OnchainApprovalsResponse {
  return {
    executionModel: "agent_wallet",
    source: "mock",
    mockMode: true,
    approvals: [
      {
        chainIndex,
        cursor: "",
        approvalProjects: [],
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

async function queryOnchainAssets(input: { address: string; chains?: string; filter?: string; excludeRiskToken?: string }) {
  const data = await callOnchainGet("/api/v6/dex/balance/all-token-balances-by-address", {
    address: input.address,
    chains: resolveChainIndices(input.chains),
    filter: input.filter ?? "",
    excludeRiskToken: input.excludeRiskToken ?? "",
  });
  const normalized = normalizeAssetGroups(data, input.address);
  const walletAddresses = groupAssetsByWalletAddress(normalized);
  const totalAssetValue = formatFiat(walletAddresses.flatMap((item) => item.assets).reduce((sum, asset) => sum + toNumber(asset.valueUsd), 0));

  return {
    executionModel: "agent_wallet" as const,
    source: "okx-onchain" as const,
    mockMode: false,
    totalAssetValue,
    walletAddresses,
    updatedAt: new Date().toISOString(),
  };
}

async function queryOnchainApprovals(input: { chainIndex: string; address: string; limit?: string; cursor?: string }) {
  const data = await callOnchainGet("/api/v5/wallet/security/approvals", {
    addressList: JSON.stringify([
      {
        chainIndex: resolveChainIndices(input.chainIndex).split(",")[0] || input.chainIndex,
        address: input.address,
      },
    ]),
    limit: input.limit ?? "",
    cursor: input.cursor ?? "",
  });

  const approvals = data.map((entry: unknown) => {
    const item = toObject(entry);
    const approvalProjects = Array.isArray(item.approvalProjects) ? item.approvalProjects : [];

    return {
      chainIndex: typeof item.chainIndex === "string" ? item.chainIndex : input.chainIndex,
      cursor: typeof item.cursor === "string" ? item.cursor : "",
      approvalProjects: approvalProjects.map((project) => {
        const projectItem = toObject(project);
        const tokens = Array.isArray(projectItem.tokens) ? projectItem.tokens : [];
        return {
          projectName: typeof projectItem.projectName === "string" ? projectItem.projectName : "Unknown Project",
          projectIcon: typeof projectItem.projectIcon === "string" ? projectItem.projectIcon : undefined,
          approveAddress: typeof projectItem.approveAddress === "string" ? projectItem.approveAddress : "",
          tokens: tokens.map((token) => {
            const tokenItem = toObject(token);
            return {
              coinId: typeof tokenItem.coinId === "string" ? tokenItem.coinId : undefined,
              imageUrl: typeof tokenItem.imageUrl === "string" ? tokenItem.imageUrl : undefined,
              symbol: typeof tokenItem.symbol === "string" ? tokenItem.symbol : "TOKEN",
              status: typeof tokenItem.status === "string" ? tokenItem.status : "0",
              tokenAddress: typeof tokenItem.tokenAddress === "string" ? tokenItem.tokenAddress : "",
              approvalNum: typeof tokenItem.approvalNum === "string" ? tokenItem.approvalNum : "0",
            };
          }),
        };
      }),
    };
  });

  return {
    executionModel: "agent_wallet" as const,
    source: "okx-onchain" as const,
    mockMode: false,
    approvals,
    updatedAt: new Date().toISOString(),
  };
}

export async function getOnchainAssets(input: { address: string; chains?: string; filter?: string; excludeRiskToken?: string }): Promise<OnchainAssetsResponse> {
  const address = input.address.trim();
  if (!address) {
    throw new Error("address is required");
  }

  const hasOpenApiCredentials = Boolean(
    getEnv("OKX_API_KEY", "OKX_DEX_API_KEY", "OKX_ONCHAIN_API_KEY") &&
      getEnv("OKX_API_SECRET", "OKX_SECRET_KEY", "OKX_DEX_SECRET_KEY", "OKX_ONCHAIN_SECRET_KEY") &&
      getEnv("OKX_PASSPHRASE", "OKX_DEX_PASSPHRASE", "OKX_ONCHAIN_PASSPHRASE", "OKX_API_PASSPHRASE") &&
      getEnv("OKX_PROJECT_ID", "OKX_DEX_PROJECT_ID"),
  );

  if (!hasOpenApiCredentials) {
    return buildMockAssets(address);
  }

  return queryOnchainAssets({
    address,
    chains: input.chains,
    filter: input.filter,
    excludeRiskToken: input.excludeRiskToken,
  });
}

export async function getOnchainApprovals(input: {
  chainIndex: string;
  address: string;
  limit?: string;
  cursor?: string;
}): Promise<OnchainApprovalsResponse> {
  const address = input.address.trim();
  const chainIndex = input.chainIndex.trim();
  if (!address || !chainIndex) {
    throw new Error("chainIndex and address are required");
  }

  const hasOpenApiCredentials = Boolean(
    getEnv("OKX_API_KEY", "OKX_DEX_API_KEY", "OKX_ONCHAIN_API_KEY") &&
      getEnv("OKX_API_SECRET", "OKX_SECRET_KEY", "OKX_DEX_SECRET_KEY", "OKX_ONCHAIN_SECRET_KEY") &&
      getEnv("OKX_PASSPHRASE", "OKX_DEX_PASSPHRASE", "OKX_ONCHAIN_PASSPHRASE", "OKX_API_PASSPHRASE"),
  );

  if (!hasOpenApiCredentials) {
    return buildMockApprovals(chainIndex);
  }

  return queryOnchainApprovals({
    chainIndex,
    address,
    limit: input.limit,
    cursor: input.cursor,
  });
}

export type OnchainChainKind = "evm" | "solana";
export type OnchainExecutionPhase = "preview" | "awaiting_confirmation" | "executing" | "success" | "failed";

type QuoteInput = {
  chainIndex: string;
  amount: string;
  fromTokenAddress: string;
  toTokenAddress: string;
  userWalletAddress: string;
  fromTokenSymbol?: string;
  toTokenSymbol?: string;
  displayAmount?: string;
  chainKind?: OnchainChainKind;
};

type ExecuteInput = QuoteInput & {
  slippagePercent?: string;
  signedTx?: string;
  jitoSignedTx?: string;
  broadcastAddress?: string;
};

type ReceiptInput = {
  address: string;
  chainIndex: string;
  orderId?: string;
  txStatus?: string;
  cursor?: string;
  limit?: string;
};

function getEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function getOnchainBaseUrl() {
  return getEnv("OKX_BASE_URL") || DEFAULT_ONCHAIN_BASE_URL;
}

function getAgentWalletBaseUrl() {
  return getEnv("OKX_AGENT_WALLET_BASE_URL") || DEFAULT_AGENT_WALLET_BASE_URL;
}

function replaceProgressLabel(label: string) {
  return label.replace(/签名/g, "确认");
}

function mapProgress(
  progress: Array<{ key: string; label: string; status: "done" | "pending" }> | undefined,
) {
  return (progress ?? []).map((item) => ({
    ...item,
    label: replaceProgressLabel(item.label),
  }));
}

function resolvePhase(input: { status: "prepared" | "broadcasted" | "success"; requiresSignature: boolean }): OnchainExecutionPhase {
  if (input.requiresSignature || input.status === "prepared") {
    return "awaiting_confirmation";
  }
  if (input.status === "success") {
    return "success";
  }
  return "executing";
}

function resolveReceiptPhase(result: Awaited<ReturnType<typeof getDexSwapOrders>>): Extract<OnchainExecutionPhase, "executing" | "success" | "failed"> {
  const firstOrder = result.data?.[0] as { txStatus?: string } | undefined;
  if (firstOrder?.txStatus === "2") {
    return "success";
  }
  if (firstOrder?.txStatus === "4" || firstOrder?.txStatus === "5") {
    return "failed";
  }
  return "executing";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldPollReceipt(input: ReceiptInput) {
  return Boolean(input.orderId || input.txStatus);
}

export function getOnchainOsConfig() {
  const dex = getDexConfig();
  const hasAgentWalletCredentials = Boolean(
    getEnv("OKX_AGENT_WALLET_API_KEY") &&
      getEnv("OKX_AGENT_WALLET_SECRET_KEY") &&
      getEnv("OKX_AGENT_WALLET_PASSPHRASE"),
  );
  const hasOpenApiCredentials = Boolean(
    getEnv("OKX_API_KEY", "OKX_DEX_API_KEY", "OKX_ONCHAIN_API_KEY") &&
      getEnv("OKX_SECRET_KEY", "OKX_DEX_SECRET_KEY", "OKX_ONCHAIN_SECRET_KEY", "OKX_API_SECRET") &&
      getEnv("OKX_PASSPHRASE", "OKX_DEX_PASSPHRASE", "OKX_ONCHAIN_PASSPHRASE", "OKX_API_PASSPHRASE") &&
      getEnv("OKX_PROJECT_ID", "OKX_DEX_PROJECT_ID"),
  );

  return {
    providerMode: dex.providerMode,
    executionModel: "agent_wallet" as const,
    authMode: hasOpenApiCredentials || hasAgentWalletCredentials ? "api_key" as const : "mock" as const,
    baseUrl: getOnchainBaseUrl(),
    endpoints: {
      onchainBaseUrl: getOnchainBaseUrl(),
      agentWalletBaseUrl: getAgentWalletBaseUrl(),
    },
    projectIdConfigured: Boolean(getEnv("OKX_PROJECT_ID", "OKX_DEX_PROJECT_ID")),
    builderCodeConfigured: Boolean(
      getEnv(
        "EXPO_PUBLIC_XLAYER_BUILDER_CODE",
        "EXPO_PUBLIC_OKX_XLAYER_BUILDER_CODE",
        "EXPO_PUBLIC_OKX_CO",
        "EXPO_PUBLIC_CO",
        "EXPO_PUBLIC_BUILDER_CODE",
      ),
    ),
    referrerAddress: dex.referrerAddress,
    evmFeePercent: dex.evmFeePercent,
    solanaFeePercent: dex.solanaFeePercent,
    defaultSlippagePercent: dex.defaultSlippagePercent,
    capabilities: {
      walletEmailLogin: hasAgentWalletCredentials,
      preview: true,
      execute: true,
      receipt: true,
      assets: true,
      securityApprovals: true,
      simulate: true,
      broadcast: true,
    },
    compatibility: {
      legacyDexRoutesAvailable: true,
      legacySignatureBridgeRetained: true,
    },
  };
}

export async function previewOnchainSwap(input: QuoteInput) {
  const result = await getDexSwapQuote(input);

  return {
    ...result,
    executionModel: "agent_wallet" as const,
    phase: "preview" as const,
    progress: [
      { key: "preview", label: "已生成执行确认摘要", status: "done" as const },
      { key: "confirm", label: "等待 Agent Wallet 确认", status: "pending" as const },
      { key: "broadcast", label: "等待链上广播", status: "pending" as const },
    ],
  };
}

export async function executeOnchainSwap(input: ExecuteInput) {
  const result = await executeDexSwap(input);
  const phase = resolvePhase(result);

  const { status: _legacyStatus, requiresSignature: _legacyRequiresSignature, ...rest } = result;

  return {
    ...rest,
    executionModel: "agent_wallet" as const,
    phase,
    progress: mapProgress(result.progress),
  };
}

export async function getOnchainExecutionReceipt(input: ReceiptInput) {
  let latestResult = await getDexSwapOrders(input);
  let latestPhase = resolveReceiptPhase(latestResult);

  if (shouldPollReceipt(input) && latestPhase === "executing") {
    for (let attempt = 1; attempt < RECEIPT_POLL_ATTEMPTS; attempt += 1) {
      await sleep(RECEIPT_POLL_INTERVAL_MS);
      latestResult = await getDexSwapOrders(input);
      latestPhase = resolveReceiptPhase(latestResult);
      if (latestPhase !== "executing") {
        break;
      }
    }
  }

  return {
    ...latestResult,
    executionModel: "agent_wallet" as const,
    phase: latestPhase,
  };
}
