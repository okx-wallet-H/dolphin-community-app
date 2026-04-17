import { createHmac, randomBytes } from "crypto";

import { buildXLayerBuilderCodePayload } from "../../lib/builder-code";

const OKX_DEX_BASE_URL = "https://web3.okx.com";
const PLATFORM_REFERRER_ADDRESS = "0x29018d7e0dd00de315dd131fbe342817674430bd";
const EVM_FEE_PERCENT = "1.5";
const SOLANA_FEE_PERCENT = "3";
const DEFAULT_SLIPPAGE_PERCENT = "0.5";

type ChainKind = "evm" | "solana";
type ProviderMode = "okx" | "mock";

type OkxEnvelope<T> = {
  code?: string | number;
  msg?: string;
  data?: T;
};

type IntentResult = {
  action: "swap" | "unknown";
  amount: string;
  fromSymbol: string;
  toSymbol: string;
  chainKind: ChainKind | null;
  confidence: number;
  source: "openai" | "regex";
  mockMode: boolean;
  originalMessage: string;
};

type QuoteInput = {
  chainIndex: string;
  amount: string;
  fromTokenAddress: string;
  toTokenAddress: string;
  userWalletAddress: string;
  fromTokenSymbol?: string;
  toTokenSymbol?: string;
  displayAmount?: string;
  chainKind?: ChainKind;
};

type ExecuteInput = QuoteInput & {
  slippagePercent?: string;
  signedTx?: string;
  jitoSignedTx?: string;
  broadcastAddress?: string;
  builderCode?: string;
  builderCodeDataSuffix?: `0x${string}`;
  builderCodeCallDataMemo?: `0x${string}`;
};

type OrdersInput = {
  address: string;
  chainIndex: string;
  orderId?: string;
  txStatus?: string;
  cursor?: string;
  limit?: string;
  chainKind?: ChainKind;
};

type QuoteResult = {
  success: true;
  providerMode: ProviderMode;
  mockMode: boolean;
  chainKind: ChainKind;
  feePercent: string;
  referrerAddress: string;
  approvalRequired: boolean;
  quote: {
    fromAmount: string;
    toAmount: string;
    minReceived: string;
    platformFeeAmount: string;
    fromTokenSymbol: string;
    toTokenSymbol: string;
  };
  approvalTransaction: Record<string, unknown> | null;
  gas: Record<string, unknown> | null;
  raw: {
    quote?: unknown;
    approve?: unknown;
    gas?: unknown;
  };
};

type ExecuteResult = {
  success: true;
  providerMode: ProviderMode;
  mockMode: boolean;
  chainKind: ChainKind;
  feePercent: string;
  referrerAddress: string;
  status: "prepared" | "broadcasted" | "success";
  requiresSignature: boolean;
  orderId: string;
  txHash: string;
  progress: Array<{
    key: string;
    label: string;
    status: "done" | "pending";
  }>;
  builderCodeContext?: {
    builderCode: string;
    injectionMode: "data_suffix";
    targetCapability: "wallet_sendCalls";
    dataSuffix: `0x${string}`;
    callDataMemo: `0x${string}`;
    appliedToSwapQuery: boolean;
    appliedToPreparedTransaction: boolean;
  } | null;
  swapTransaction: Record<string, unknown> | null;
  order: Record<string, unknown> | null;
  raw: {
    swap?: unknown;
    broadcast?: unknown;
    orders?: unknown;
  };
};

const MOCK_MARKET_RATES: Record<string, Record<string, number>> = {
  USDT: {
    ETH: 1 / 3200,
    BTC: 1 / 65000,
    SOL: 1 / 160,
  },
  ETH: {
    USDT: 3200,
    BTC: 0.049,
    SOL: 20,
  },
  SOL: {
    USDT: 160,
    ETH: 0.05,
  },
  BTC: {
    USDT: 65000,
    ETH: 20.2,
  },
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

function hasRealDexCredentials() {
  return Boolean(
    getEnv("OKX_DEX_API_KEY", "OKX_API_KEY") &&
      getEnv("OKX_DEX_SECRET_KEY", "OKX_SECRET_KEY") &&
      getEnv("OKX_DEX_PASSPHRASE", "OKX_PASSPHRASE"),
  );
}

function getProviderMode(): ProviderMode {
  return hasRealDexCredentials() ? "okx" : "mock";
}

function normalizeSymbol(value: string | undefined) {
  return (value ?? "").trim().toUpperCase();
}

function normalizeAddress(value: string | undefined) {
  return (value ?? "").trim();
}

function normalizeAmount(value: string | number | undefined) {
  return String(value ?? "").trim();
}

function isSolanaAddress(address: string) {
  return Boolean(address) && !address.startsWith("0x");
}

function resolveChainKind(input: {
  chainKind?: ChainKind;
  userWalletAddress?: string;
  chainIndex?: string;
}) {
  if (input.chainKind === "evm" || input.chainKind === "solana") {
    return input.chainKind;
  }

  const normalizedChainIndex = normalizeAmount(input.chainIndex);
  if (["501", "900", "1399811149"].includes(normalizedChainIndex)) {
    return "solana" as const;
  }

  if (isSolanaAddress(normalizeAddress(input.userWalletAddress))) {
    return "solana" as const;
  }

  return "evm" as const;
}

function getFeePercent(chainKind: ChainKind) {
  return chainKind === "solana" ? SOLANA_FEE_PERCENT : EVM_FEE_PERCENT;
}

type ExecuteBuilderCodeContext = NonNullable<ExecuteResult["builderCodeContext"]>;

function resolveBuilderCodeContext(input: {
  chainIndex: string;
  chainKind: ChainKind;
  builderCode?: string;
  builderCodeDataSuffix?: `0x${string}`;
  builderCodeCallDataMemo?: `0x${string}`;
}) {
  const derived = buildXLayerBuilderCodePayload({
    chainIndex: input.chainIndex,
    chainKind: input.chainKind,
  });

  const builderCode = normalizeAmount(input.builderCode) || derived?.builderCode || "";
  const dataSuffix = (normalizeAmount(input.builderCodeDataSuffix) as `0x${string}`) || derived?.dataSuffix;
  const callDataMemo = (normalizeAmount(input.builderCodeCallDataMemo) as `0x${string}`) || derived?.callDataMemo;

  if (!builderCode || !dataSuffix || !callDataMemo) {
    return null;
  }

  return {
    builderCode,
    injectionMode: "data_suffix" as const,
    targetCapability: "wallet_sendCalls" as const,
    dataSuffix,
    callDataMemo,
    appliedToSwapQuery: false,
    appliedToPreparedTransaction: false,
  } satisfies ExecuteBuilderCodeContext;
}

function appendHexSuffix(base: string, suffix: `0x${string}`) {
  const normalizedBase = normalizeAmount(base);
  if (!normalizedBase.startsWith("0x")) {
    return undefined;
  }

  const normalizedSuffix = suffix.slice(2).toLowerCase();
  if (normalizedBase.toLowerCase().endsWith(normalizedSuffix)) {
    return normalizedBase as `0x${string}`;
  }

  return `${normalizedBase}${suffix.slice(2)}` as `0x${string}`;
}

function applyBuilderCodeToPreparedSwapTransaction(
  swapTransaction: Record<string, unknown> | null,
  builderCodeContext: ExecuteBuilderCodeContext | null,
) {
  if (!swapTransaction || !builderCodeContext) {
    return { swapTransaction, appliedToPreparedTransaction: false };
  }

  const nextSwapTransaction: Record<string, unknown> = {
    ...swapTransaction,
    builderCode: builderCodeContext.builderCode,
    builderCodeDataSuffix: builderCodeContext.dataSuffix,
    callDataMemo: builderCodeContext.callDataMemo,
  };

  let appliedToPreparedTransaction = false;

  const tx = extractFirstObject(swapTransaction, ["tx"]);
  if (tx) {
    const nextTx: Record<string, unknown> = { ...tx };
    const txData = extractFirstString(tx, ["data", "txData", "callData"]);
    const nextTxData = appendHexSuffix(txData, builderCodeContext.dataSuffix);
    if (nextTxData) {
      if (typeof tx.data === "string") {
        nextTx.data = nextTxData;
      } else if (typeof tx.txData === "string") {
        nextTx.txData = nextTxData;
      } else if (typeof tx.callData === "string") {
        nextTx.callData = nextTxData;
      }
      nextTx.dataSuffix = builderCodeContext.dataSuffix;
      nextSwapTransaction.tx = nextTx;
      appliedToPreparedTransaction = true;
    }
  }

  return { swapTransaction: nextSwapTransaction, appliedToPreparedTransaction };
}

function parseNumber(value: string | number | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDecimal(value: number, digits = 6) {
  if (!Number.isFinite(value)) return "0";
  const fixed = value.toFixed(digits);
  return fixed.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function estimateMockRate(fromSymbol: string, toSymbol: string) {
  return MOCK_MARKET_RATES[fromSymbol]?.[toSymbol] ?? 1;
}

function isNativeEvmToken(address: string) {
  const normalized = address.trim().toLowerCase();
  return (
    !normalized ||
    normalized === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" ||
    normalized === "0x0000000000000000000000000000000000000000"
  );
}

function shouldApprove(input: { chainKind: ChainKind; fromTokenAddress: string }) {
  return input.chainKind === "evm" && !isNativeEvmToken(input.fromTokenAddress);
}

function buildQuery(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const normalized = normalizeAmount(value);
    if (normalized) {
      search.set(key, normalized);
    }
  }
  return search.toString();
}

function buildOkxHeaders(method: "GET" | "POST", requestPath: string, body = "") {
  const apiKey = getEnv("OKX_DEX_API_KEY", "OKX_API_KEY");
  const secretKey = getEnv("OKX_DEX_SECRET_KEY", "OKX_SECRET_KEY");
  const passphrase = getEnv("OKX_DEX_PASSPHRASE", "OKX_PASSPHRASE");
  const projectId = getEnv("OKX_DEX_PROJECT_ID", "OKX_PROJECT_ID");
  const timestamp = new Date().toISOString();
  const prehash = `${timestamp}${method}${requestPath}${body}`;
  const sign = createHmac("sha256", secretKey).update(prehash).digest("base64");

  return {
    "Content-Type": "application/json",
    "OK-ACCESS-KEY": apiKey,
    "OK-ACCESS-PASSPHRASE": passphrase,
    "OK-ACCESS-SIGN": sign,
    "OK-ACCESS-TIMESTAMP": timestamp,
    ...(projectId ? { "OK-ACCESS-PROJECT": projectId } : {}),
  };
}

async function safeJson(response: Response) {
  const text = await response.text();
  if (!text) return {} as Record<string, unknown>;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}

async function okxRequest<T>(method: "GET" | "POST", path: string, options?: {
  query?: Record<string, string | undefined>;
  body?: Record<string, unknown>;
}) {
  const queryString = buildQuery(options?.query ?? {});
  const requestPath = queryString ? `${path}?${queryString}` : path;
  const body = method === "POST" ? JSON.stringify(options?.body ?? {}) : "";
  const response = await fetch(`${OKX_DEX_BASE_URL}${requestPath}`, {
    method,
    headers: buildOkxHeaders(method, requestPath, body),
    ...(method === "POST" ? { body } : {}),
  });

  const data = (await safeJson(response)) as OkxEnvelope<T> & Record<string, unknown>;
  const diagnostic = `${String(data.code ?? "")} ${String(data.msg ?? "")}`;

  if (!response.ok || (typeof data.code !== "undefined" && String(data.code) !== "0")) {
    throw new Error(
      String(
        (data as Record<string, unknown>).error ??
          (data as Record<string, unknown>).message ??
          diagnostic ??
          `OKX DEX request failed: ${response.status}`,
      ),
    );
  }

  return data;
}

function extractFirstString(payload: unknown, candidates: string[]) {
  for (const candidate of candidates) {
    const value = candidate.split(".").reduce<unknown>((acc, key) => {
      if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, payload);

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function extractFirstObject(payload: unknown, candidates: string[]) {
  for (const candidate of candidates) {
    const value = candidate.split(".").reduce<unknown>((acc, key) => {
      if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, payload);

    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }
  return null;
}

function getFirstDataItem(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const data = (payload as Record<string, unknown>).data;
  if (Array.isArray(data)) {
    return data[0] ?? null;
  }
  return data ?? null;
}

function buildMockQuote(input: QuoteInput): QuoteResult {
  const chainKind = resolveChainKind(input);
  const feePercent = getFeePercent(chainKind);
  const fromTokenSymbol = normalizeSymbol(input.fromTokenSymbol) || "USDT";
  const toTokenSymbol = normalizeSymbol(input.toTokenSymbol) || "ETH";
  const displayAmount = parseNumber(input.displayAmount || input.amount, 0);
  const mockRate = estimateMockRate(fromTokenSymbol, toTokenSymbol);
  const platformFeeAmount = displayAmount * (parseNumber(feePercent) / 100);
  const toAmount = Math.max((displayAmount - platformFeeAmount) * mockRate * 0.997, 0);
  const minReceived = toAmount * 0.995;
  const approvalRequired = shouldApprove({
    chainKind,
    fromTokenAddress: normalizeAddress(input.fromTokenAddress),
  });

  return {
    success: true,
    providerMode: "mock",
    mockMode: true,
    chainKind,
    feePercent,
    referrerAddress: PLATFORM_REFERRER_ADDRESS,
    approvalRequired,
    quote: {
      fromAmount: formatDecimal(displayAmount, 6),
      toAmount: formatDecimal(toAmount, 6),
      minReceived: formatDecimal(minReceived, 6),
      platformFeeAmount: formatDecimal(platformFeeAmount, 6),
      fromTokenSymbol,
      toTokenSymbol,
    },
    approvalTransaction: approvalRequired
      ? {
          to: "0x1111111111111111111111111111111111111111",
          data: "0x095ea7b3",
          approveAmount: normalizeAmount(input.amount),
        }
      : null,
    gas:
      chainKind === "solana"
        ? { priorityFee: { proposePriorityFee: "120000", fastPriorityFee: "160000" } }
        : { normal: "22000000000", max: "30000000000", supportEip1559: true },
    raw: {
      quote: {
        mockRate,
      },
      approve: approvalRequired ? { mock: true } : null,
      gas: { mock: true },
    },
  };
}

function buildMockExecute(input: ExecuteInput): ExecuteResult {
  const chainKind = resolveChainKind(input);
  const feePercent = getFeePercent(chainKind);
  const builderCodeContext = resolveBuilderCodeContext({
    chainIndex: normalizeAmount(input.chainIndex),
    chainKind,
    builderCode: input.builderCode,
    builderCodeDataSuffix: input.builderCodeDataSuffix,
    builderCodeCallDataMemo: input.builderCodeCallDataMemo,
  });
  const txHash = chainKind === "solana"
    ? `SoMock${randomBytes(12).toString("hex")}`
    : `0x${randomBytes(32).toString("hex")}`;
  const orderId = `mock_${randomBytes(8).toString("hex")}`;

  return {
    success: true,
    providerMode: "mock",
    mockMode: true,
    chainKind,
    feePercent,
    referrerAddress: PLATFORM_REFERRER_ADDRESS,
    status: "success",
    requiresSignature: false,
    orderId,
    txHash,
    progress: [
      { key: "quote", label: "已获取报价", status: "done" },
      { key: "approve", label: shouldApprove({ chainKind, fromTokenAddress: input.fromTokenAddress }) ? "已构建授权交易" : "无需授权", status: "done" },
      { key: "swap", label: "已构建兑换交易", status: "done" },
      { key: "broadcast", label: "已广播交易", status: "done" },
      { key: "orders", label: "交易执行成功", status: "done" },
    ],
    builderCodeContext: builderCodeContext
      ? {
          ...builderCodeContext,
          appliedToSwapQuery: Boolean(builderCodeContext.callDataMemo),
          appliedToPreparedTransaction: false,
        }
      : null,
    swapTransaction: {
      mock: true,
      signedTx: input.signedTx || "mock-signed-tx",
    },
    order: {
      orderId,
      txHash,
      txStatus: "2",
      failReason: "",
    },
    raw: {
      swap: { mock: true },
      broadcast: { mock: true },
      orders: { mock: true },
    },
  };
}

async function callOpenAiIntentParser(message: string): Promise<IntentResult> {
  const apiKey = getEnv("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "你是加密货币兑换意图解析器。只返回 JSON。字段必须包含 action, amount, fromSymbol, toSymbol, chainKind, confidence。action 只能是 swap 或 unknown。chainKind 只能是 evm、solana 或 null。amount 必须为字符串。confidence 为 0 到 1。",
        },
        {
          role: "user",
          content: message,
        },
      ],
    }),
  });

  const payload = (await safeJson(response)) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(payload.error ?? payload.message ?? "OpenAI request failed"));
  }

  const content = extractFirstString(payload, ["choices.0.message.content"]);
  if (!content) {
    throw new Error("OpenAI intent parser returned empty content");
  }

  const parsed = JSON.parse(content) as Partial<IntentResult>;
  return {
    action: parsed.action === "swap" ? "swap" : "unknown",
    amount: normalizeAmount(parsed.amount),
    fromSymbol: normalizeSymbol(parsed.fromSymbol),
    toSymbol: normalizeSymbol(parsed.toSymbol),
    chainKind: parsed.chainKind === "evm" || parsed.chainKind === "solana" ? parsed.chainKind : null,
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0))),
    source: "openai",
    mockMode: false,
    originalMessage: message,
  };
}

function parseIntentByRegex(message: string): IntentResult {
  const normalized = message.trim();
  const patterns = [
    /(?:帮我)?(?:把|将)?\s*([0-9]+(?:\.[0-9]+)?)\s*([A-Za-z]{2,10})\s*(?:换成|兑换成|兑换|swap\s+to|to|for)\s*([A-Za-z]{2,10})/i,
    /swap\s*([0-9]+(?:\.[0-9]+)?)\s*([A-Za-z]{2,10})\s*(?:to|for)\s*([A-Za-z]{2,10})/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const [, amount, fromSymbol, toSymbol] = match;
      const combinedText = `${fromSymbol} ${toSymbol} ${normalized}`.toUpperCase();
      const chainKind = combinedText.includes("SOL") || combinedText.includes("SOLANA") ? "solana" : "evm";
      return {
        action: "swap",
        amount: normalizeAmount(amount),
        fromSymbol: normalizeSymbol(fromSymbol),
        toSymbol: normalizeSymbol(toSymbol),
        chainKind,
        confidence: 0.72,
        source: "regex",
        mockMode: true,
        originalMessage: message,
      };
    }
  }

  return {
    action: "unknown",
    amount: "",
    fromSymbol: "",
    toSymbol: "",
    chainKind: null,
    confidence: 0,
    source: "regex",
    mockMode: true,
    originalMessage: message,
  };
}

export async function parseSwapIntent(message: string) {
  const normalized = message.trim();
  if (!normalized) {
    throw new Error("message is required");
  }

  try {
    return await callOpenAiIntentParser(normalized);
  } catch (error) {
    console.warn("[DEX Swap] parseSwapIntent fallback to regex:", error);
    return parseIntentByRegex(normalized);
  }
}

export async function getDexSwapQuote(input: QuoteInput): Promise<QuoteResult> {
  const normalizedInput: QuoteInput = {
    ...input,
    chainIndex: normalizeAmount(input.chainIndex),
    amount: normalizeAmount(input.amount),
    fromTokenAddress: normalizeAddress(input.fromTokenAddress),
    toTokenAddress: normalizeAddress(input.toTokenAddress),
    userWalletAddress: normalizeAddress(input.userWalletAddress),
    displayAmount: normalizeAmount(input.displayAmount),
    fromTokenSymbol: normalizeSymbol(input.fromTokenSymbol),
    toTokenSymbol: normalizeSymbol(input.toTokenSymbol),
  };

  if (
    !normalizedInput.chainIndex ||
    !normalizedInput.amount ||
    !normalizedInput.fromTokenAddress ||
    !normalizedInput.toTokenAddress ||
    !normalizedInput.userWalletAddress
  ) {
    throw new Error("chainIndex, amount, fromTokenAddress, toTokenAddress and userWalletAddress are required");
  }

  if (!hasRealDexCredentials()) {
    return buildMockQuote(normalizedInput);
  }

  try {
    const chainKind = resolveChainKind(normalizedInput);
    const feePercent = getFeePercent(chainKind);
    const approvalRequired = shouldApprove({
      chainKind,
      fromTokenAddress: normalizedInput.fromTokenAddress,
    });

    const quoteResponse = await okxRequest<unknown[]>("GET", "/api/v6/dex/aggregator/quote", {
      query: {
        chainIndex: normalizedInput.chainIndex,
        amount: normalizedInput.amount,
        fromTokenAddress: normalizedInput.fromTokenAddress,
        toTokenAddress: normalizedInput.toTokenAddress,
        userWalletAddress: normalizedInput.userWalletAddress,
        feePercent,
      },
    });

    const approveResponse = approvalRequired
      ? await okxRequest<unknown[]>("GET", "/api/v6/dex/aggregator/approve-transaction", {
          query: {
            chainIndex: normalizedInput.chainIndex,
            tokenContractAddress: normalizedInput.fromTokenAddress,
            approveAmount: normalizedInput.amount,
          },
        })
      : null;

    const gasResponse = await okxRequest<unknown[]>("GET", "/api/v6/dex/pre-transaction/gas-price", {
      query: {
        chainIndex: normalizedInput.chainIndex,
      },
    });

    const quoteData = getFirstDataItem(quoteResponse);
    const fromAmount = normalizedInput.displayAmount || extractFirstString(quoteData, ["fromTokenAmount", "amountIn", "routerResult.fromTokenAmount"]);
    const toAmount = extractFirstString(quoteData, ["toTokenAmount", "amountOut", "routerResult.toTokenAmount", "routerResult.amountOut"]);
    const minReceived = extractFirstString(quoteData, ["minReceiveAmount", "routerResult.minReceiveAmount", "amountOutMin"]);
    const platformFeeAmount =
      extractFirstString(quoteData, ["feeAmount", "routerResult.feeAmount", "tradeFee"]) ||
      formatDecimal(parseNumber(normalizedInput.displayAmount || normalizedInput.amount) * (parseNumber(feePercent) / 100), 6);

    return {
      success: true,
      providerMode: "okx",
      mockMode: false,
      chainKind,
      feePercent,
      referrerAddress: PLATFORM_REFERRER_ADDRESS,
      approvalRequired,
      quote: {
        fromAmount: fromAmount || normalizedInput.displayAmount || normalizedInput.amount,
        toAmount: toAmount || "",
        minReceived: minReceived || toAmount || "",
        platformFeeAmount,
        fromTokenSymbol: normalizedInput.fromTokenSymbol || "FROM",
        toTokenSymbol: normalizedInput.toTokenSymbol || "TO",
      },
      approvalTransaction: approvalRequired ? getFirstDataItem(approveResponse) : null,
      gas: getFirstDataItem(gasResponse) as Record<string, unknown> | null,
      raw: {
        quote: quoteResponse,
        approve: approveResponse,
        gas: gasResponse,
      },
    };
  } catch (error) {
    console.warn("[DEX Swap] getDexSwapQuote fallback to mock:", error);
    if (getEnv("OKX_DEX_STRICT") === "1") {
      throw error;
    }
    return buildMockQuote(normalizedInput);
  }
}

export async function executeDexSwap(input: ExecuteInput): Promise<ExecuteResult> {
  const normalizedInput = {
    ...input,
    chainIndex: normalizeAmount(input.chainIndex),
    amount: normalizeAmount(input.amount),
    fromTokenAddress: normalizeAddress(input.fromTokenAddress),
    toTokenAddress: normalizeAddress(input.toTokenAddress),
    userWalletAddress: normalizeAddress(input.userWalletAddress),
    displayAmount: normalizeAmount(input.displayAmount),
    fromTokenSymbol: normalizeSymbol(input.fromTokenSymbol),
    toTokenSymbol: normalizeSymbol(input.toTokenSymbol),
    signedTx: normalizeAmount(input.signedTx),
    jitoSignedTx: normalizeAmount(input.jitoSignedTx),
    broadcastAddress: normalizeAddress(input.broadcastAddress),
    builderCode: normalizeAmount(input.builderCode),
    builderCodeDataSuffix: normalizeAmount(input.builderCodeDataSuffix) as `0x${string}`,
    builderCodeCallDataMemo: normalizeAmount(input.builderCodeCallDataMemo) as `0x${string}`,
    slippagePercent: normalizeAmount(input.slippagePercent) || DEFAULT_SLIPPAGE_PERCENT,
  };

  if (
    !normalizedInput.chainIndex ||
    !normalizedInput.amount ||
    !normalizedInput.fromTokenAddress ||
    !normalizedInput.toTokenAddress ||
    !normalizedInput.userWalletAddress
  ) {
    throw new Error("chainIndex, amount, fromTokenAddress, toTokenAddress and userWalletAddress are required");
  }

  if (!hasRealDexCredentials()) {
    return buildMockExecute(normalizedInput);
  }

  try {
    const chainKind = resolveChainKind(normalizedInput);
    const feePercent = getFeePercent(chainKind);
    const builderCodeContext = resolveBuilderCodeContext({
      chainIndex: normalizedInput.chainIndex,
      chainKind,
      builderCode: normalizedInput.builderCode,
      builderCodeDataSuffix: normalizedInput.builderCodeDataSuffix,
      builderCodeCallDataMemo: normalizedInput.builderCodeCallDataMemo,
    });

    const swapResponse = await okxRequest<unknown[]>("GET", "/api/v6/dex/aggregator/swap", {
      query: {
        chainIndex: normalizedInput.chainIndex,
        amount: normalizedInput.amount,
        fromTokenAddress: normalizedInput.fromTokenAddress,
        toTokenAddress: normalizedInput.toTokenAddress,
        userWalletAddress: normalizedInput.userWalletAddress,
        slippagePercent: normalizedInput.slippagePercent,
        feePercent,
        fromTokenReferrerWalletAddress: PLATFORM_REFERRER_ADDRESS,
        ...(builderCodeContext?.callDataMemo ? { callDataMemo: builderCodeContext.callDataMemo } : {}),
      },
    });

    const rawSwapData = (getFirstDataItem(swapResponse) ?? {}) as Record<string, unknown>;
    const { swapTransaction: swapData, appliedToPreparedTransaction } = applyBuilderCodeToPreparedSwapTransaction(
      rawSwapData,
      builderCodeContext,
    );
    const appliedBuilderCodeContext = builderCodeContext
      ? {
          ...builderCodeContext,
          appliedToSwapQuery: Boolean(builderCodeContext.callDataMemo),
          appliedToPreparedTransaction,
        }
      : null;
    const signedTx = normalizedInput.signedTx;

    if (!signedTx) {
      return {
        success: true,
        providerMode: "okx",
        mockMode: false,
        chainKind,
        feePercent,
        referrerAddress: PLATFORM_REFERRER_ADDRESS,
        status: "prepared",
        requiresSignature: true,
        orderId: "",
        txHash: "",
        progress: [
          { key: "swap", label: "已构建兑换交易，等待签名", status: "done" },
          { key: "broadcast", label: "等待广播交易", status: "pending" },
        ],
        builderCodeContext: appliedBuilderCodeContext,
        swapTransaction: swapData,
        order: null,
        raw: {
          swap: swapResponse,
        },
      };
    }

    const broadcastAddress = normalizedInput.broadcastAddress || normalizedInput.userWalletAddress;
    const extraData =
      chainKind === "solana" && normalizedInput.jitoSignedTx
        ? JSON.stringify({ jitoSignedTx: normalizedInput.jitoSignedTx })
        : undefined;

    const broadcastResponse = await okxRequest<unknown[]>("POST", "/api/v6/dex/pre-transaction/broadcast-transaction", {
      body: {
        signedTx,
        chainIndex: normalizedInput.chainIndex,
        address: broadcastAddress,
        ...(extraData ? { extraData } : {}),
      },
    });

    const broadcastData = (getFirstDataItem(broadcastResponse) ?? {}) as Record<string, unknown>;
    const orderId = extractFirstString(broadcastData, ["orderId"]);
    const txHash = extractFirstString(broadcastData, ["txHash"]);

    const ordersResponse = await okxRequest<unknown[]>("GET", "/api/v6/dex/post-transaction/orders", {
      query: {
        address: broadcastAddress,
        chainIndex: normalizedInput.chainIndex,
        orderId,
      },
    });

    const ordersData = (getFirstDataItem(ordersResponse) ?? {}) as Record<string, unknown>;
    const order = Array.isArray(ordersData.orders)
      ? ((ordersData.orders[0] ?? null) as Record<string, unknown> | null)
      : null;
    const txStatus = extractFirstString(order, ["txStatus", "txstatus"]);

    return {
      success: true,
      providerMode: "okx",
      mockMode: false,
      chainKind,
      feePercent,
      referrerAddress: PLATFORM_REFERRER_ADDRESS,
      status: txStatus === "2" ? "success" : "broadcasted",
      requiresSignature: false,
      orderId,
      txHash: txHash || extractFirstString(order, ["txHash"]),
      progress: [
        { key: "swap", label: "已构建兑换交易", status: "done" },
        { key: "broadcast", label: "已广播交易", status: "done" },
        { key: "orders", label: txStatus === "2" ? "交易执行成功" : "交易处理中", status: txStatus === "2" ? "done" : "pending" },
      ],
      builderCodeContext: appliedBuilderCodeContext,
      swapTransaction: swapData,
      order,
      raw: {
        swap: swapResponse,
        broadcast: broadcastResponse,
        orders: ordersResponse,
      },
    };
  } catch (error) {
    console.warn("[DEX Swap] executeDexSwap fallback to mock:", error);
    if (getEnv("OKX_DEX_STRICT") === "1") {
      throw error;
    }
    return buildMockExecute(normalizedInput);
  }
}

export async function getDexSwapOrders(input: OrdersInput) {
  const normalizedInput: OrdersInput = {
    ...input,
    address: normalizeAddress(input.address),
    chainIndex: normalizeAmount(input.chainIndex),
    orderId: normalizeAmount(input.orderId),
    txStatus: normalizeAmount(input.txStatus),
    cursor: normalizeAmount(input.cursor),
    limit: normalizeAmount(input.limit),
  };

  if (!normalizedInput.address || !normalizedInput.chainIndex) {
    throw new Error("address and chainIndex are required");
  }

  if (!hasRealDexCredentials()) {
    return {
      success: true,
      providerMode: "mock" as const,
      mockMode: true,
      data: [
        {
          orderId: normalizedInput.orderId || `mock_${randomBytes(8).toString("hex")}`,
          address: normalizedInput.address,
          chainIndex: normalizedInput.chainIndex,
          txHash: normalizedInput.address.startsWith("0x")
            ? `0x${randomBytes(32).toString("hex")}`
            : `SoMock${randomBytes(12).toString("hex")}`,
          txStatus: "2",
          failReason: "",
        },
      ],
    };
  }

  try {
    const response = await okxRequest<unknown[]>("GET", "/api/v6/dex/post-transaction/orders", {
      query: {
        address: normalizedInput.address,
        chainIndex: normalizedInput.chainIndex,
        orderId: normalizedInput.orderId,
        txStatus: normalizedInput.txStatus,
        cursor: normalizedInput.cursor,
        limit: normalizedInput.limit,
      },
    });

    const first = (getFirstDataItem(response) ?? {}) as Record<string, unknown>;
    const orders = Array.isArray(first.orders) ? first.orders : [];

    return {
      success: true,
      providerMode: "okx" as const,
      mockMode: false,
      cursor: extractFirstString(first, ["cursor"]),
      data: orders,
      raw: response,
    };
  } catch (error) {
    console.warn("[DEX Swap] getDexSwapOrders fallback to mock:", error);
    if (getEnv("OKX_DEX_STRICT") === "1") {
      throw error;
    }
    return {
      success: true,
      providerMode: "mock" as const,
      mockMode: true,
      data: [
        {
          orderId: normalizedInput.orderId || `mock_${randomBytes(8).toString("hex")}`,
          address: normalizedInput.address,
          chainIndex: normalizedInput.chainIndex,
          txHash: normalizedInput.address.startsWith("0x")
            ? `0x${randomBytes(32).toString("hex")}`
            : `SoMock${randomBytes(12).toString("hex")}`,
          txStatus: "2",
          failReason: "",
        },
      ],
    };
  }
}

export function getDexConfig() {
  return {
    providerMode: getProviderMode(),
    referrerAddress: PLATFORM_REFERRER_ADDRESS,
    evmFeePercent: EVM_FEE_PERCENT,
    solanaFeePercent: SOLANA_FEE_PERCENT,
    defaultSlippagePercent: DEFAULT_SLIPPAGE_PERCENT,
  };
}
