import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppHeader } from "@/components/AppHeader";
import { ScreenContainer } from "@/components/screen-container";
import { TopTabs } from "@/components/TopTabs";
import {
  executeDexSwap,
  getAccountAssets,
  getDexSwapQuote,
  getMarketSnapshotByMcp,
  getMemeScanListByMcp,
  getSmartMoneyLeaderboardByMcp,
  parseChatAiIntent,
  parseDexSwapIntent,
  searchDeFiProductsByMcp,
  type AgentWalletAssetsResponse,
  type ChatAiIntentResponse,
  type DeFiProductItem,
  type DexChainKind,
  type MarketSnapshot,
  type StoredWalletSnapshot,
} from "@/lib/_core/api";

const WALLET_STORAGE_KEY = "hwallet-agent-wallet";
const EVM_NATIVE = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const SOL_NATIVE = "So11111111111111111111111111111111111111112";
const POSITIVE = "#16A34A";
const NEGATIVE = "#DC2626";

const chatFilterTabs = [
  { key: "all", label: "全部" },
  { key: "favorite", label: "收藏" },
  { key: "trade", label: "交易" },
  { key: "data", label: "数据" },
] as const;

type ChatFilterKey = (typeof chatFilterTabs)[number]["key"];

type PriceCardPayload = {
  snapshot: MarketSnapshot;
};

type AssetCardPayload = {
  assets: AgentWalletAssetsResponse;
};

type DeFiCardPayload = {
  token: string;
  products: DeFiProductItem[];
};

type SmartMoneyCardPayload = {
  wallets: Awaited<ReturnType<typeof getSmartMoneyLeaderboardByMcp>>;
};

type MemeCardPayload = {
  tokens: Awaited<ReturnType<typeof getMemeScanListByMcp>>;
};

type SwapCardPayload = {
  amount: string;
  fromSymbol: string;
  toSymbol: string;
  chainKind: DexChainKind;
  estimatedReceive: string;
  estimatedPrice: string;
  slippage: string;
  priceImpact: string;
  routeLabel: string;
};

type ChatCard =
  | {
      kind: "price";
      payload: PriceCardPayload;
    }
  | {
      kind: "asset";
      payload: AssetCardPayload;
    }
  | {
      kind: "defi";
      payload: DeFiCardPayload;
    }
  | {
      kind: "smart-money";
      payload: SmartMoneyCardPayload;
    }
  | {
      kind: "meme";
      payload: MemeCardPayload;
    }
  | {
      kind: "swap";
      payload: SwapCardPayload;
    };

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  title?: string;
  content: string;
  tone?: "default" | "success" | "danger" | "warning";
  meta?: string;
  card?: ChatCard;
};

type TransferIntent = {
  amount: string;
  symbol: string;
  address: string;
  chainKind: DexChainKind;
};

const suggestions = [
  "查一下 BTC 价格",
  "看看我的资产",
  "有什么赚币产品",
  "把 100 USDT 换成 ETH",
  "转 20 USDT 到 0x1234567890abcdef1234567890abcdef12345678",
];

const initialMessages: ChatMessage[] = [
  {
    id: "welcome-1",
    role: "assistant",
    title: "H Wallet 智能助手",
    content:
      "我已经接入 OKX OnchainOS 的真实能力。你可以直接让我查价格、看资产、找赚币产品，或继续发起 Swap 等链上操作。",
    meta: "当前对话页优先走真实接口，调不通会直接返回错误提示",
  },
];

const EVM_TOKEN_MAP: Record<string, { address: string; chainIndex: string; decimals: number }> = {
  ETH: { address: EVM_NATIVE, chainIndex: "1", decimals: 18 },
  USDT: {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    chainIndex: "1",
    decimals: 6,
  },
  BTC: {
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    chainIndex: "1",
    decimals: 8,
  },
  WBTC: {
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    chainIndex: "1",
    decimals: 8,
  },
};

const SOLANA_TOKEN_MAP: Record<
  string,
  { address: string; chainIndex: string; decimals: number }
> = {
  SOL: { address: SOL_NATIVE, chainIndex: "501", decimals: 9 },
  USDT: {
    address: "Es9vMFrzaCER8m4sY5n8ApX2HFqRSbuuSSMzdg3NofM",
    chainIndex: "501",
    decimals: 6,
  },
};

function parseWallet(raw: string | null): StoredWalletSnapshot {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredWalletSnapshot;
  } catch {
    return null;
  }
}

function maskAddress(address: string) {
  if (!address) return "";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function normalizeSymbol(value: string) {
  return value.trim().toUpperCase();
}

function getPrimaryWalletAddress(
  wallet: StoredWalletSnapshot,
  chainKind: DexChainKind,
) {
  if (chainKind === "solana") {
    return wallet?.solanaAddress?.trim() ?? "";
  }
  return wallet?.evmAddress?.trim() ?? "";
}

function resolveSwapToken(symbol: string, chainKind: DexChainKind) {
  const normalized = normalizeSymbol(symbol);
  return chainKind === "solana"
    ? SOLANA_TOKEN_MAP[normalized]
    : EVM_TOKEN_MAP[normalized];
}

function toRawAmount(amount: string, decimals: number) {
  const normalized = amount.trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    throw new Error("兑换数量格式不正确，请输入有效数字。");
  }

  const [wholePart, fractionPart = ""] = normalized.split(".");
  const combined = `${wholePart}${fractionPart.padEnd(decimals, "0").slice(0, decimals)}`
    .replace(/^0+(?=\d)/, "")
    .replace(/^$/, "0");
  return BigInt(combined).toString();
}

function formatTokenAmount(raw: string, decimals: number, maxFractionDigits = 6) {
  if (!raw || !/^\d+$/.test(raw)) {
    return "0";
  }

  const normalized = raw.replace(/^0+(?=\d)/, "") || "0";
  const padded = normalized.padStart(decimals + 1, "0");
  const integerPart = padded.slice(0, -decimals) || "0";
  const fractionPart = decimals > 0 ? padded.slice(-decimals) : "";
  const trimmedFraction = fractionPart
    .slice(0, maxFractionDigits)
    .replace(/0+$/, "");
  return trimmedFraction ? `${integerPart}.${trimmedFraction}` : integerPart;
}

function formatSwapUnitPrice(fromAmount: string, toAmount: string, toSymbol: string, fromSymbol: string) {
  const fromValue = Number(fromAmount);
  const toValue = Number(toAmount);
  if (!Number.isFinite(fromValue) || !Number.isFinite(toValue) || fromValue <= 0 || toValue <= 0) {
    return "--";
  }

  const quote = toValue / fromValue;
  const digits = quote >= 1000 ? 2 : quote >= 1 ? 4 : 6;
  return `1 ${fromSymbol} ≈ ${quote.toFixed(digits)} ${toSymbol}`;
}

function parseMcpJsonResult(payload: any) {
  const text = payload?.result?.content?.[0]?.text;
  if (!text || typeof text !== "string") {
    throw new Error("OKX MCP 未返回可解析的报价内容。");
  }
  return JSON.parse(text) as Record<string, any>;
}

function detectTransferIntent(message: string): TransferIntent | null {
  const normalized = message.trim();
  const matched = normalized.match(
    /(?:转账|转|发送|打给|send)\s*([0-9]+(?:\.[0-9]+)?)\s*([A-Za-z]{2,10})\s*(?:到|给|to)\s*([A-Za-z0-9]{24,})/i,
  );

  if (!matched) {
    return null;
  }

  const [, amount, symbolRaw, address] = matched;
  const symbol = normalizeSymbol(symbolRaw);
  const chainKind: DexChainKind = address.startsWith("0x") ? "evm" : "solana";

  return {
    amount,
    symbol,
    address,
    chainKind,
  };
}

function buildAssistantMessages(
  response: ChatAiIntentResponse,
  seed: number,
): ChatMessage[] {
  if ("mode" in response && response.mode === "grid-strategy") {
    return [
      {
        id: `assistant-${seed}-grid`,
        role: "assistant",
        title:
          response.result.action === "create" ? "网格策略建议" : "策略执行结果",
        content: response.result.message,
        meta: "已连接服务端策略编排",
      },
    ];
  }

  if (!("intent" in response) || !response.intent) {
    return [
      {
        id: `assistant-${seed}-fallback`,
        role: "assistant",
        title: "系统提示",
        content: "当前请求已返回，但暂时没有可直接渲染的卡片结构。",
        tone: "warning",
      },
    ];
  }

  const titleMap: Record<string, string> = {
    market: "实时行情",
    earn: "AI 智能赚币",
    asset: "资产摘要",
    deposit: "充值指引",
    profit: "收益复盘",
    swap: "兑换意图",
    general: "策略回应",
  };

  const messages: ChatMessage[] = [
    {
      id: `assistant-${seed}-main`,
      role: "assistant",
      title: titleMap[response.intent.action] ?? "AI 回答",
      content: response.intent.reply,
      meta: `置信度 ${(response.intent.confidence * 100).toFixed(0)}%`,
    },
  ];

  if (response.intent.priceText) {
    messages.push({
      id: `assistant-${seed}-price`,
      role: "assistant",
      title: "价格快照",
      content: response.intent.priceText,
      tone: "success",
      meta: "已返回实时价格结果",
    });
  }

  if (response.earnPlan) {
    messages.push({
      id: `assistant-${seed}-earn`,
      role: "assistant",
      title: "推荐申购方案",
      content: `${response.earnPlan.protocol} · ${response.earnPlan.chain} · ${response.earnPlan.symbol}\n建议金额 $${response.earnPlan.amount.toLocaleString("zh-CN")}，参考 APR ${response.earnPlan.apr.toFixed(2)}%，风险等级 ${response.earnPlan.riskLabel}。\n${response.earnPlan.description}`,
      tone: "success",
      meta: `TVL $${response.earnPlan.tvlUsd.toLocaleString("zh-CN")}`,
    });
  }

  if (response.profit) {
    messages.push({
      id: `assistant-${seed}-profit`,
      role: "assistant",
      title: "收益表现",
      content: `${response.profit.protocol} · ${response.profit.chain}\n累计收益 $${response.profit.totalProfit.toFixed(2)}，今日收益 $${response.profit.todayProfit.toFixed(2)}，APR ${response.profit.apr.toFixed(2)}%。`,
      meta: `${response.profit.periodLabel} · 已投入 $${response.profit.totalInvested.toFixed(2)}`,
    });
  }

  if (response.deposit) {
    messages.push({
      id: `assistant-${seed}-deposit`,
      role: "assistant",
      title: "充值地址",
      content: `${response.deposit.networkLabel}\n${response.deposit.address}`,
      meta:
        response.deposit.chainKind === "solana" ? "Solana 网络" : "EVM 网络",
    });
  }

  if (response.intent.assetSummary) {
    messages.push({
      id: `assistant-${seed}-asset`,
      role: "assistant",
      title: "资产上下文",
      content: response.intent.assetSummary,
      meta: "基于钱包上下文返回",
    });
  }

  return messages;
}

function buildSwapMessages(params: {
  amount: string;
  fromSymbol: string;
  toSymbol: string;
  chainKind: DexChainKind;
  seed: number;
  estimatedReceive: string;
  estimatedPrice: string;
  slippage: string;
  priceImpact: string;
  routeLabel: string;
}): ChatMessage[] {
  const {
    amount,
    fromSymbol,
    toSymbol,
    chainKind,
    seed,
    estimatedReceive,
    estimatedPrice,
    slippage,
    priceImpact,
    routeLabel,
  } = params;

  return [
    {
      id: `assistant-${seed}-swap-intent`,
      role: "assistant",
      title: "兑换意图识别",
      content: `已识别你的兑换请求：${amount} ${fromSymbol} → ${toSymbol}。`,
      meta: chainKind === "solana" ? "Solana 路径" : "EVM 路径",
    },
    {
      id: `assistant-${seed}-swap-card`,
      role: "assistant",
      title: "Swap 确认卡片",
      content: `已通过 /api/okx/mcp 调用 get_dex_quote 获取 ${fromSymbol} → ${toSymbol} 的实时报价。`,
      tone: "success",
      meta: `数据来源：OKX OnchainOS MCP · 预估到账 ${estimatedReceive} ${toSymbol} · 价格影响 ${priceImpact}`,
      card: {
        kind: "swap",
        payload: {
          amount,
          fromSymbol,
          toSymbol,
          chainKind,
          estimatedReceive,
          estimatedPrice,
          slippage,
          priceImpact,
          routeLabel,
        },
      },
    },
  ];
}

function buildTransferMessages(
  intent: TransferIntent,
  wallet: StoredWalletSnapshot,
  seed: number,
): ChatMessage[] {
  const fromAddress = getPrimaryWalletAddress(wallet, intent.chainKind);
  return [
    {
      id: `assistant-${seed}-transfer-intent`,
      role: "assistant",
      title: "转账意图识别",
      content: `已识别你的转账请求：向 ${maskAddress(intent.address)} 发送 ${intent.amount} ${intent.symbol}。`,
      meta: intent.chainKind === "solana" ? "Solana 转账路径" : "EVM 转账路径",
    },
    {
      id: `assistant-${seed}-transfer-execute`,
      role: "assistant",
      title: "转账执行回执",
      content: `当前项目暂未接入独立转账广播接口，因此这里先返回待接入提示。\n发送地址：${maskAddress(fromAddress)}\n接收地址：${maskAddress(intent.address)}\n金额：${intent.amount} ${intent.symbol}`,
      tone: "warning",
      meta: "该能力尚未接入真实链上广播。",
    },
  ];
}

function extractPriceSymbol(message: string): string | null {
  const normalized = message.trim().toUpperCase();
  const wantsPrice = /(价格|多少钱|行情|报价|涨跌|PRICE|QUOTE|MARKET)/i.test(message);

  const aliases: Array<{ symbol: string; patterns: RegExp[] }> = [
    { symbol: "BTC", patterns: [/\bBTC\b/i, /比特币/i, /BITCOIN/i] },
    { symbol: "ETH", patterns: [/\bETH\b/i, /以太坊/i, /ETHEREUM/i] },
    { symbol: "SOL", patterns: [/\bSOL\b/i, /索拉纳/i, /SOLANA/i] },
    { symbol: "BNB", patterns: [/\bBNB\b/i, /币安币/i, /BINANCE COIN/i] },
    { symbol: "SUI", patterns: [/\bSUI\b/i] },
  ];

  for (const item of aliases) {
    if (item.patterns.some((pattern) => pattern.test(normalized)) && wantsPrice) {
      return item.symbol;
    }
  }

  return null;
}

function formatCurrency(value: number, digits = 2) {
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatPrice(value: number) {
  if (value >= 1000) {
    return `$${formatCurrency(value, 2)}`;
  }
  if (value >= 1) {
    return `$${formatCurrency(value, 4)}`;
  }
  return `$${formatCurrency(value, 6)}`;
}

function formatVolume(value?: string) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "--";
  }
  if (parsed >= 1_000_000_000) {
    return `$${formatCurrency(parsed / 1_000_000_000, 2)}B`;
  }
  if (parsed >= 1_000_000) {
    return `$${formatCurrency(parsed / 1_000_000, 2)}M`;
  }
  return `$${formatCurrency(parsed, 0)}`;
}

function formatChange(change24h: number | null) {
  if (change24h === null || !Number.isFinite(change24h)) {
    return "--";
  }
  const percent = change24h * 100;
  return `${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%`;
}

function formatSnapshotTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "刚刚";
  }
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildPriceMessages(snapshot: MarketSnapshot, seed: number): ChatMessage[] {
  return [
    {
      id: `assistant-${seed}-price-card`,
      role: "assistant",
      title: `${snapshot.symbol} 实时价格`,
      content: `已为你查询 ${snapshot.symbol} 的 OKX 实时价格数据。`,
      meta: "数据来源：OKX OnchainOS · 实时返回",
      card: {
        kind: "price",
        payload: {
          snapshot,
        },
      },
    },
  ];
}

function isAssetIntent(message: string) {
  return /(资产|余额|持仓|仓位|portfolio|balance)/i.test(message);
}

function extractDeFiToken(message: string) {
  const normalized = message.toUpperCase();
  const matched = normalized.match(/BTC|ETH|SOL|USDT|USDC|DAI/);
  return matched?.[0] ?? "USDT";
}

function isDeFiIntent(message: string) {
  return /(赚币|理财|收益|申购|赚利息|earn|defi|apy|apr|产品)/i.test(message);
}

function isSmartMoneyIntent(message: string) {
  return /(聪明钱|大户|巨鲸|kol|鲸鱼|最近在买什么|smart money)/i.test(message);
}

function isMemeIntent(message: string) {
  return /(meme|土狗|热门币|热门 meme|新币|pump|memecoin)/i.test(message);
}

function formatUsdCompact(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  if (value >= 1_000_000_000) return `$${formatCurrency(value / 1_000_000_000, 2)}B`;
  if (value >= 1_000_000) return `$${formatCurrency(value / 1_000_000, 2)}M`;
  if (value >= 1_000) return `$${formatCurrency(value / 1_000, 2)}K`;
  return `$${formatCurrency(value, 2)}`;
}

function buildAssetMessages(
  assets: AgentWalletAssetsResponse,
  seed: number,
): ChatMessage[] {
  const chainCount = assets.walletAddresses.length;
  const assetCount = assets.walletAddresses.reduce(
    (sum, item) => sum + item.assets.length,
    0,
  );

  return [
    {
      id: `assistant-${seed}-asset-card`,
      role: "assistant",
      title: "资产总览",
      content: `已为你拉取 Agent Wallet 的真实链上资产。当前共覆盖 ${chainCount} 条链、${assetCount} 个资产头寸。`,
      meta: `总资产 ${formatUsdCompact(Number(assets.totalAssetValue))} · ${new Date(assets.updatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`,
      card: {
        kind: "asset",
        payload: {
          assets,
        },
      },
    },
  ];
}

function buildDeFiMessages(
  token: string,
  products: DeFiProductItem[],
  seed: number,
): ChatMessage[] {
  return [
    {
      id: `assistant-${seed}-defi-card`,
      role: "assistant",
      title: `${token} DeFi 产品`,
      content: `已为你从 OKX OnchainOS 检索 ${token} 相关赚币产品。当前优先展示收益与体量靠前的可选项。`,
      meta: `共返回 ${products.length} 个结果 · 数据来源 OKX OnchainOS`,
      card: {
        kind: "defi",
        payload: {
          token,
          products,
        },
      },
    },
  ];
}

function buildSmartMoneyMessages(
  wallets: Awaited<ReturnType<typeof getSmartMoneyLeaderboardByMcp>>,
  seed: number,
): ChatMessage[] {
  return [
    {
      id: `assistant-${seed}-smart-money-card`,
      role: "assistant",
      title: "聪明钱追踪",
      content: "已为你拉取 OKX 市场监控中的聪明钱榜单，优先展示近期收益表现最强的钱包。",
      meta: `共返回 ${wallets.length} 个聪明钱地址 · 数据来源 OKX OnchainOS`,
      card: {
        kind: "smart-money",
        payload: { wallets },
      },
    },
  ];
}

function buildMemeMessages(
  tokens: Awaited<ReturnType<typeof getMemeScanListByMcp>>,
  seed: number,
): ChatMessage[] {
  return [
    {
      id: `assistant-${seed}-meme-card`,
      role: "assistant",
      title: "热门 Meme 扫描",
      content: "已为你拉取 OKX 扫链能力中的新晋 Meme 代币，优先展示最新上榜且交易活跃的项目。",
      meta: `共返回 ${tokens.length} 个代币 · 数据来源 OKX OnchainOS`,
      card: {
        kind: "meme",
        payload: { tokens },
      },
    },
  ];
}

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ draft?: string; draftKey?: string; q?: string; source?: string }>();
  const lastDraftKeyRef = useRef("");
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [activeFilter, setActiveFilter] = useState<ChatFilterKey>("all");
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  const incomingQuery = typeof params.q === "string" ? params.q.trim() : "";
  const isFromCommunity = params.source === "community" && incomingQuery.length > 0;

  const walletHint = useMemo(() => {
    return "支持查询实时行情、赚币产品、钱包资产、聪明钱、Meme 扫描，以及基于钱包地址发起真实兑换链路。";
  }, []);

  const appendMessages = useCallback((nextMessages: ChatMessage[]) => {
    setMessages((prev) => [...prev, ...nextMessages]);
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const runSwapFlow = useCallback(
    async (content: string, wallet: StoredWalletSnapshot, seed: number) => {
      const parsed = await parseDexSwapIntent(content);
      if (parsed.intent.action !== "swap") {
        return [
          {
            id: `assistant-${seed}-swap-unknown`,
            role: "assistant",
            title: "兑换识别失败",
            content:
              "我识别到了你的兑换意图，但暂时没能提取出金额和币种。你可以试试“把 100 USDT 换成 ETH”这种说法。",
            tone: "warning",
          },
        ] satisfies ChatMessage[];
      }

      const chainKind = parsed.intent.chainKind ?? "evm";
      const walletAddress = getPrimaryWalletAddress(wallet, chainKind);
      if (!walletAddress) {
        return [
          {
            id: `assistant-${seed}-swap-no-wallet`,
            role: "assistant",
            title: "无法发起兑换",
            content: "当前没有可用的钱包地址，请先完成登录并创建智能钱包。",
            tone: "danger",
          },
        ] satisfies ChatMessage[];
      }

      const fromToken = resolveSwapToken(parsed.intent.fromSymbol, chainKind);
      const toToken = resolveSwapToken(parsed.intent.toSymbol, chainKind);
      if (!fromToken || !toToken) {
        return [
          {
            id: `assistant-${seed}-swap-token-miss`,
            role: "assistant",
            title: "暂不支持的币种",
            content: `当前已接入 ${chainKind === "solana" ? "SOL / USDT" : "ETH / USDT / BTC"} 的兑换链路。你输入的是 ${parsed.intent.fromSymbol} → ${parsed.intent.toSymbol}。如果需要更多币种，需要继续补充 OKX 代币映射。`,
            tone: "warning",
          },
        ] satisfies ChatMessage[];
      }

      const slippage = "0.5";
      const rawAmount = toRawAmount(parsed.intent.amount, fromToken.decimals);
      const quoteResult = await getDexSwapQuote({
        chainIndex: fromToken.chainIndex,
        amount: rawAmount,
        fromTokenAddress: fromToken.address,
        toTokenAddress: toToken.address,
        userWalletAddress: walletAddress,
        fromTokenSymbol: parsed.intent.fromSymbol,
        toTokenSymbol: parsed.intent.toSymbol,
        chainKind,
      });

      const estimatedReceive = quoteResult.quote?.toAmount ?? "0";
      const estimatedPrice = formatSwapUnitPrice(
        parsed.intent.amount,
        estimatedReceive,
        parsed.intent.toSymbol,
        parsed.intent.fromSymbol,
      );
      const routeLabel = "OKX 聚合路由";
      const priceImpact = "0%";

      let executeResult: Awaited<ReturnType<typeof executeDexSwap>> | null = null;
      try {
        executeResult = await executeDexSwap({
          chainIndex: fromToken.chainIndex,
          amount: rawAmount,
          fromTokenAddress: fromToken.address,
          toTokenAddress: toToken.address,
          userWalletAddress: walletAddress,
          fromTokenSymbol: parsed.intent.fromSymbol,
          toTokenSymbol: parsed.intent.toSymbol,
          chainKind,
          slippagePercent: slippage,
        });
      } catch (executeError) {
        console.warn("[runSwapFlow] executeDexSwap failed (best-effort):", executeError);
      }

      const swapMessages = buildSwapMessages({
        amount: parsed.intent.amount,
        fromSymbol: parsed.intent.fromSymbol,
        toSymbol: parsed.intent.toSymbol,
        chainKind,
        seed,
        estimatedReceive,
        estimatedPrice,
        slippage,
        priceImpact,
        routeLabel,
      });

      if (executeResult) {
        swapMessages.push({
          id: `assistant-${seed}-swap-receipt`,
          role: "assistant",
          title: "兑换执行回执",
          content: `兑换订单已提交，订单号 ${executeResult.orderId}，状态：${executeResult.status}。`,
          tone: "success",
          meta: executeResult.txHash ? `TxHash: ${executeResult.txHash}` : undefined,
        });
      }

      return swapMessages;
    },
    [],
  );

  const sendMessage = useCallback(
    async (rawText?: string) => {
      const content = (rawText ?? input).trim();
      if (!content || submitting) {
        return;
      }

      setErrorText("");
      setInput("");
      appendMessages([
        {
          id: `user-${Date.now()}`,
          role: "user",
          content,
        },
      ]);
      setSubmitting(true);

      try {
        const walletRaw = await AsyncStorage.getItem(WALLET_STORAGE_KEY);
          const wallet = parseWallet(walletRaw);

        const transferIntent = detectTransferIntent(content);
        const seed = Date.now();

        if (transferIntent) {
          appendMessages(buildTransferMessages(transferIntent, wallet, seed));
          return;
        }

        const priceSymbol = extractPriceSymbol(content);
        if (priceSymbol) {
          const snapshot = await getMarketSnapshotByMcp(priceSymbol);
          appendMessages(buildPriceMessages(snapshot, seed));
          return;
        }

        if (isAssetIntent(content)) {
          if (!wallet) {
            throw new Error("当前没有可用的钱包，请先完成邮箱登录并自动创建 Agent Wallet。");
          }
          const assets = await getAccountAssets(wallet);
          appendMessages(buildAssetMessages(assets, seed));
          return;
        }

        if (isDeFiIntent(content)) {
          const token = extractDeFiToken(content);
          const products = await searchDeFiProductsByMcp(token, "ethereum", "SINGLE_EARN");
          if (!products.length) {
            throw new Error(`暂未检索到 ${token} 相关的可用赚币产品，请稍后再试。`);
          }
          appendMessages(buildDeFiMessages(token, products, seed));
          return;
        }

        if (isSmartMoneyIntent(content)) {
          const wallets = await getSmartMoneyLeaderboardByMcp("solana");
          if (!wallets.length) {
            throw new Error("暂未拉取到可展示的聪明钱榜单，请稍后再试。");
          }
          appendMessages(buildSmartMoneyMessages(wallets, seed));
          return;
        }

        if (isMemeIntent(content)) {
          const tokens = await getMemeScanListByMcp("solana");
          if (!tokens.length) {
            throw new Error("暂未拉取到可展示的热门 Meme 代币，请稍后再试。");
          }
          appendMessages(buildMemeMessages(tokens, seed));
          return;
        }

        const response = await parseChatAiIntent({
          message: content,
          wallet: wallet ?? undefined,
        });
        if (
          "intent" in response &&
          response.intent &&
          response.intent.action === "swap"
        ) {
          const swapMessages = await runSwapFlow(
            response.intent.swapMessage || content,
            wallet,
            seed,
          );
          appendMessages([
            {
              id: `assistant-${seed}-swap-reply`,
              role: "assistant",
              title: "AI 意图识别",
              content: response.intent.reply,
              meta: "已由服务端返回兑换意图",
            },
            ...swapMessages,
          ]);
          return;
        }

        appendMessages(buildAssistantMessages(response, seed));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "消息发送失败，请稍后再试。";
        setErrorText(message);
        appendMessages([
          {
            id: `assistant-error-${Date.now()}`,
            role: "assistant",
            title: "请求失败",
            content: message,
            tone: "danger",
            meta: "请确认已登录钱包并检查网络状态",
          },
        ]);
      } finally {
        setSubmitting(false);
      }
    },
    [appendMessages, input, runSwapFlow, submitting],
  );

  useEffect(() => {
    const draft = typeof params.draft === "string" ? params.draft.trim() : "";
    const draftKey = typeof params.draftKey === "string" ? params.draftKey : "";
    const query = typeof params.q === "string" ? params.q.trim() : "";
    const source = typeof params.source === "string" ? params.source : "";
    const entryText = draft || query;
    const entryKey = draftKey || (query ? `${source || "external"}:${query}` : "");

    if (!entryText || !entryKey || lastDraftKeyRef.current === entryKey) {
      return;
    }

    lastDraftKeyRef.current = entryKey;
    void sendMessage(entryText);
  }, [params.draft, params.draftKey, params.q, params.source, sendMessage]);

  return (
    <ScreenContainer
      className="bg-[#F5F5F7]"
      safeAreaClassName="bg-[#F5F5F7]"
      containerClassName="bg-[#F5F5F7]"
    >
      <View style={styles.fixedHeaderWrap}>
        <AppHeader
          onWalletPress={() => router.push("/(tabs)/wallet")}
          onRightPress={() => router.push("/(tabs)/profile")}
          centerContent={
            <TopTabs
              activeTab="chat"
              onChange={(tab) => {
                if (tab === "community") {
                  router.push("/(tabs)/community");
                }
              }}
            />
          }
        />

        <View style={styles.filterRow}>
          {chatFilterTabs.map((filter) => {
            const active = filter.key === activeFilter;
            return (
              <Pressable
                key={filter.key}
                onPress={() => setActiveFilter(filter.key)}
                style={({ pressed }) => [
                  styles.filterChip,
                  active && styles.filterChipActive,
                  pressed && styles.filterChipPressed,
                ]}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <LinearGradient
              colors={["rgba(255,255,255,0.98)", "rgba(244,241,255,0.96)", "rgba(237,242,255,0.94)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.heroInner}>
                <View style={styles.statusPill}>
                  <Text style={styles.statusPillText}>{isFromCommunity ? "已从社区进入对话" : "Agent 对话主线程"}</Text>
                </View>
                <Text style={styles.heroTitle}>{isFromCommunity ? `继续理解：${incomingQuery}` : "在聊天里完成理解、决策与执行"}</Text>
                <Text style={styles.heroDescription}>
                  {isFromCommunity ? "我已经接住你在社区里输入的关注点，接下来会围绕这个主题继续分析、判断并给出可执行结果。" : walletHint}
                </Text>
              </View>
            </LinearGradient>

            <FlatList
              horizontal
              data={suggestions}
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionList}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => void sendMessage(item)}
                  style={({ pressed }) => [
                    styles.suggestionChip,
                    pressed && styles.suggestionChipPressed,
                  ]}
                >
                  <Text style={styles.suggestionText}>{item}</Text>
                </Pressable>
              )}
            />
          </View>
        }
        renderItem={({ item }) => {
          const isUser = item.role === "user";
          const toneStyle =
            item.tone === "success"
              ? styles.assistantSuccess
              : item.tone === "danger"
                ? styles.assistantDanger
                : item.tone === "warning"
                  ? styles.assistantWarning
                  : undefined;

          return (
            <View
              style={[
                styles.bubbleRow,
                isUser ? styles.userRow : styles.assistantRow,
              ]}
            >
              <View
                style={[
                  styles.bubble,
                  isUser ? styles.userBubble : styles.assistantBubble,
                  !isUser && toneStyle,
                ]}
              >
                {item.title ? (
                  <Text style={styles.bubbleTitle}>{item.title}</Text>
                ) : null}
                <Text style={styles.bubbleContent}>{item.content}</Text>
                {item.meta ? (
                  <Text style={styles.bubbleMeta}>{item.meta}</Text>
                ) : null}

                {item.card?.kind === "price" ? (() => {
                  const snapshot = item.card.payload.snapshot;
                  return (
                    <LinearGradient
                      colors={["rgba(15,23,42,0.98)", "rgba(31,41,55,0.96)", "rgba(110,91,255,0.84)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.richCard}
                    >
                      <View style={styles.cardHeaderRow}>
                        <View style={styles.cardIconWrap}>
                          <MaterialCommunityIcons name="chart-line" size={20} color="#FFFFFF" />
                        </View>
                        <View style={styles.cardHeaderTextWrap}>
                          <Text style={styles.cardEyebrow}>实时价格</Text>
                          <Text style={styles.cardTitle}>{snapshot.symbol}</Text>
                        </View>
                        <View style={styles.badgeWrap}>
                          <Text
                            style={[
                              styles.badgeText,
                              { color: (snapshot.change24h ?? 0) >= 0 ? "#86EFAC" : "#FCA5A5" },
                            ]}
                          >
                            {formatChange(snapshot.change24h)}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.priceValue}>{formatPrice(snapshot.price)}</Text>

                      <View style={styles.metricGrid}>
                        <View style={styles.metricCell}>
                          <Text style={styles.metricLabel}>24h 成交量</Text>
                          <Text style={styles.metricValue}>{formatVolume(snapshot.volume24h)}</Text>
                        </View>
                        <View style={styles.metricCell}>
                          <Text style={styles.metricLabel}>更新时间</Text>
                          <Text style={styles.metricValue}>{formatSnapshotTime(snapshot.updateTime)}</Text>
                        </View>
                      </View>

                      <View style={styles.cardActionRow}>
                        <Pressable style={styles.secondaryAction} onPress={() => void sendMessage(`最近大户在买什么 ${snapshot.symbol}`)}>
                          <Text style={styles.secondaryActionText}>查看大户动向</Text>
                        </Pressable>
                        <Pressable style={styles.primaryAction} onPress={() => void sendMessage(`继续追踪 ${snapshot.symbol} 行情`)}>
                          <Text style={styles.primaryActionText}>继续追踪</Text>
                        </Pressable>
                      </View>
                    </LinearGradient>
                  );
                })() : null}

                {item.card?.kind === "asset" ? (() => {
                  const assets = item.card.payload.assets;
                  return (
                    <LinearGradient
                      colors={["rgba(255,255,255,0.98)", "rgba(245,247,250,0.96)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.glassCard}
                    >
                      <View style={styles.cardHeaderRow}>
                        <View style={[styles.cardIconWrap, styles.assetIconWrap]}>
                          <MaterialCommunityIcons name="wallet-outline" size={20} color="#7C3AED" />
                        </View>
                        <View style={styles.cardHeaderTextWrap}>
                          <Text style={[styles.cardEyebrow, styles.darkEyebrow]}>链上资产总览</Text>
                          <Text style={[styles.cardTitle, styles.darkTitle]}>{formatUsdCompact(Number(assets.totalAssetValue))}</Text>
                        </View>
                      </View>

                      {assets.walletAddresses.slice(0, 3).map((chain) => {
                        const chainTotal = chain.assets.reduce((sum, asset) => sum + Number(asset.valueUsd || 0), 0);
                        return (
                          <View key={`${chain.chainIndex}-${chain.address}`} style={styles.assetChainRow}>
                            <View>
                              <Text style={styles.assetChainTitle}>{chain.chainName}</Text>
                              <Text style={styles.assetChainMeta}>{maskAddress(chain.address)}</Text>
                            </View>
                            <View style={styles.assetChainRight}>
                              <Text style={styles.assetChainValue}>{formatUsdCompact(chainTotal)}</Text>
                              <Text style={styles.assetChainMeta}>{chain.assets.length} 个资产</Text>
                            </View>
                          </View>
                        );
                      })}

                      <View style={styles.cardActionRow}>
                        <Pressable style={styles.secondaryActionLight} onPress={() => router.push("/(tabs)/wallet")}>
                          <Text style={styles.secondaryActionLightText}>查看资产明细</Text>
                        </Pressable>
                        <Pressable style={styles.primaryAction} onPress={() => void sendMessage("最近大户在买什么")}>
                          <Text style={styles.primaryActionText}>看看市场机会</Text>
                        </Pressable>
                      </View>
                    </LinearGradient>
                  );
                })() : null}

                {item.card?.kind === "defi" ? (() => {
                  const defiCard = item.card.payload;
                  return (
                    <LinearGradient
                      colors={["rgba(255,255,255,0.98)", "rgba(244,246,250,0.98)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.glassCard}
                    >
                      <View style={styles.cardHeaderRow}>
                        <View style={[styles.cardIconWrap, styles.assetIconWrap]}>
                          <MaterialCommunityIcons name="diamond-stone" size={20} color="#7C3AED" />
                        </View>
                        <View style={styles.cardHeaderTextWrap}>
                          <Text style={[styles.cardEyebrow, styles.darkEyebrow]}>OKX DeFi 搜索</Text>
                          <Text style={[styles.cardTitle, styles.darkTitle]}>{defiCard.token} 赚币机会</Text>
                        </View>
                      </View>

                      {defiCard.products.slice(0, 3).map((product) => (
                        <View key={product.id} style={styles.defiRow}>
                          <View style={styles.defiLeft}>
                            <Text style={styles.defiName}>{product.name}</Text>
                            <Text style={styles.defiMeta}>{product.platform} · {product.chain}</Text>
                          </View>
                          <View style={styles.defiRight}>
                            <Text style={styles.defiApy}>{product.apr.toFixed(2)}%</Text>
                            <Text style={styles.defiMeta}>TVL {formatUsdCompact(Number(product.tvl || 0))}</Text>
                          </View>
                        </View>
                      ))}

                      <View style={styles.cardActionRow}>
                        <Pressable style={styles.secondaryActionLight} onPress={() => void sendMessage(`继续找 ${defiCard.token} 的赚币产品`)}>
                          <Text style={styles.secondaryActionLightText}>查看更多</Text>
                        </Pressable>
                        <Pressable style={styles.primaryAction} onPress={() => router.push("/(tabs)/earn")}>
                          <Text style={styles.primaryActionText}>去申购</Text>
                        </Pressable>
                      </View>
                    </LinearGradient>
                  );
                })() : null}

                {item.card?.kind === "smart-money" ? (() => {
                  const smartMoneyCard = item.card.payload;
                  return (
                    <LinearGradient
                      colors={["rgba(15,23,42,0.98)", "rgba(30,41,59,0.96)", "rgba(110,91,255,0.82)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.richCard}
                    >
                      <View style={styles.cardHeaderRow}>
                        <View style={styles.cardIconWrap}>
                          <MaterialCommunityIcons name="account-search-outline" size={20} color="#FFFFFF" />
                        </View>
                        <View style={styles.cardHeaderTextWrap}>
                          <Text style={styles.cardEyebrow}>聪明钱榜单</Text>
                          <Text style={styles.cardTitle}>最近大户在买什么</Text>
                        </View>
                      </View>

                      {smartMoneyCard.wallets.slice(0, 3).map((wallet, index) => (
                        <View key={`${wallet.walletAddress}-${index}`} style={styles.smartMoneyRow}>
                          <View style={styles.smartMoneyLeft}>
                            <Text style={styles.smartMoneyRank}>#{index + 1} {maskAddress(wallet.walletAddress)}</Text>
                            <Text style={styles.smartMoneyMeta}>胜率 {Number(wallet.winRatePercent || 0).toFixed(1)}% · 交易 {wallet.txs}</Text>
                            <Text style={styles.smartMoneyToken}>代表代币 {wallet.topPnlTokenList?.[0]?.tokenSymbol || "--"}</Text>
                          </View>
                          <View style={styles.smartMoneyRight}>
                            <Text style={styles.smartMoneyPnl}>{formatUsdCompact(Number(wallet.realizedPnlUsd || 0))}</Text>
                            <Text style={styles.smartMoneyMeta}>成交额 {formatUsdCompact(Number(wallet.txVolume || 0))}</Text>
                          </View>
                        </View>
                      ))}

                      <View style={styles.cardActionRow}>
                        <Pressable style={styles.secondaryAction} onPress={() => void sendMessage("继续追踪聪明钱最近交易") }>
                          <Text style={styles.secondaryActionText}>继续追踪</Text>
                        </Pressable>
                        <Pressable style={styles.primaryGhostAction} onPress={() => void sendMessage("最近有什么热门Meme币") }>
                          <Text style={styles.primaryActionText}>查看热门 Meme</Text>
                        </Pressable>
                      </View>
                    </LinearGradient>
                  );
                })() : null}

                {item.card?.kind === "swap" ? (() => {
                  const swapCard = item.card.payload;
                  return (
                    <LinearGradient
                      colors={["rgba(15,23,42,0.98)", "rgba(31,41,55,0.96)", "rgba(110,91,255,0.8)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.richCard}
                    >
                      <View style={styles.cardHeaderRow}>
                        <View style={styles.cardIconWrap}>
                          <MaterialCommunityIcons name="swap-horizontal-bold" size={20} color="#FFFFFF" />
                        </View>
                        <View style={styles.cardHeaderTextWrap}>
                          <Text style={styles.cardEyebrow}>OKX Swap 报价</Text>
                          <Text style={styles.cardTitle}>{swapCard.fromSymbol} → {swapCard.toSymbol}</Text>
                        </View>
                        <View style={styles.badgeWrap}>
                          <Text style={[styles.badgeText, { color: "#BFDBFE" }]}>
                            {swapCard.chainKind === "solana" ? "Solana" : "Ethereum"}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.priceValue}>{swapCard.amount} {swapCard.fromSymbol}</Text>

                      <View style={styles.metricGrid}>
                        <View style={styles.metricCell}>
                          <Text style={styles.metricLabel}>目标代币</Text>
                          <Text style={styles.metricValue}>{swapCard.toSymbol}</Text>
                        </View>
                        <View style={styles.metricCell}>
                          <Text style={styles.metricLabel}>预估到账</Text>
                          <Text style={styles.metricValue}>{swapCard.estimatedReceive} {swapCard.toSymbol}</Text>
                        </View>
                        <View style={styles.metricCell}>
                          <Text style={styles.metricLabel}>预估价格</Text>
                          <Text style={styles.metricValue}>{swapCard.estimatedPrice}</Text>
                        </View>
                        <View style={styles.metricCell}>
                          <Text style={styles.metricLabel}>滑点</Text>
                          <Text style={styles.metricValue}>{swapCard.slippage}%</Text>
                        </View>
                      </View>

                      <View style={{ marginTop: 14, borderRadius: 14, backgroundColor: "rgba(15,23,42,0.32)", padding: 12, gap: 6 }}>
                        <Text style={[styles.metricLabel, { marginBottom: 2 }]}>路由摘要</Text>
                        <Text style={[styles.metricValue, { fontSize: 13, lineHeight: 18 }]}>路径：{swapCard.fromSymbol} → {swapCard.toSymbol}</Text>
                        <Text style={[styles.metricValue, { fontSize: 13, lineHeight: 18 }]}>路由来源：{swapCard.routeLabel}</Text>
                        <Text style={[styles.metricValue, { fontSize: 13, lineHeight: 18 }]}>价格影响：{swapCard.priceImpact}</Text>
                      </View>

                      <View style={styles.cardActionRow}>
                        <Pressable style={styles.secondaryAction} onPress={() => void sendMessage(`重新报价 ${swapCard.amount} ${swapCard.fromSymbol} 换 ${swapCard.toSymbol}`)}>
                          <Text style={styles.secondaryActionText}>刷新报价</Text>
                        </Pressable>
                        <Pressable style={styles.primaryGhostAction} onPress={() => router.push("/(tabs)/wallet")}>
                          <Text style={styles.primaryActionText}>去钱包确认余额</Text>
                        </Pressable>
                      </View>
                    </LinearGradient>
                  );
                })() : null}

                {item.card?.kind === "meme" ? (() => {
                  const memeCard = item.card.payload;
                  return (
                    <LinearGradient
                      colors={["rgba(255,255,255,0.98)", "rgba(246,247,250,0.98)", "rgba(239,242,247,0.96)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.glassCard}
                    >
                      <View style={styles.cardHeaderRow}>
                        <View style={[styles.cardIconWrap, styles.assetIconWrap]}>
                          <MaterialCommunityIcons name="fire-circle" size={20} color="#7C3AED" />
                        </View>
                        <View style={styles.cardHeaderTextWrap}>
                          <Text style={[styles.cardEyebrow, styles.darkEyebrow]}>Meme 扫描</Text>
                          <Text style={[styles.cardTitle, styles.darkTitle]}>最新热门 Meme</Text>
                        </View>
                      </View>

                      {memeCard.tokens.slice(0, 3).map((token, index) => (
                        <View key={`${token.tokenContractAddress}-${index}`} style={styles.memeRow}>
                          <View style={styles.memeLeft}>
                            <Text style={styles.memeName}>{token.tokenSymbol}</Text>
                            <Text style={styles.memeMeta}>持币地址 {token.holders || "--"} · 聪明钱买入 {token.smartMoneyBuys || "0"}</Text>
                          </View>
                          <View style={styles.memeRight}>
                            <Text style={styles.memeCap}>{formatUsdCompact(Number(token.marketCap || 0))}</Text>
                            <Text style={styles.memeMeta}>1h 成交 {formatUsdCompact(Number(token.volume24h || 0))}</Text>
                          </View>
                        </View>
                      ))}

                      <View style={styles.cardActionRow}>
                        <Pressable style={styles.secondaryActionLight} onPress={() => void sendMessage("继续扫描新的 Meme 币") }>
                          <Text style={styles.secondaryActionLightText}>继续扫描</Text>
                        </Pressable>
                        <Pressable style={styles.primaryAction} onPress={() => void sendMessage("最近大户在买什么") }>
                          <Text style={styles.primaryActionText}>查看聪明钱</Text>
                        </Pressable>
                      </View>
                    </LinearGradient>
                  );
                })() : null}
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          <View style={styles.footerComposerWrap}>
            <View style={styles.quickNavRow}>
              <Pressable
                style={styles.quickNavCard}
                onPress={() => router.push("/(tabs)/wallet")}
              >
                <Text style={styles.quickNavTitle}>查看钱包资产</Text>
                <Text style={styles.quickNavDesc}>
                  回到资产页核对余额和代币明细。
                </Text>
              </Pressable>
              <Pressable
                style={styles.quickNavCard}
                onPress={() => router.push("/(tabs)/earn")}
              >
                <Text style={styles.quickNavTitle}>去赚币页</Text>
                <Text style={styles.quickNavDesc}>
                  查看策略选择与自动赚币回执。
                </Text>
              </Pressable>
              <Pressable
                style={styles.quickNavCard}
                onPress={() => router.push("/(tabs)/wallet")}
              >
                <Text style={styles.quickNavTitle}>返回资产总览</Text>
                <Text style={styles.quickNavDesc}>
                  回到主资产页，验证登录后的主路径跳转是否顺畅。
                </Text>
              </Pressable>
            </View>

            <View style={styles.footerComposer}>
              <Text style={styles.composerLabel}>输入区</Text>
              <Text style={styles.composerHint}>
                例如：帮我查一下 ETH 最新价格；把 100 USDT 换成 ETH；转 20 USDT
                到某个地址；或者给我一个低波动赚币方案。
              </Text>

              <View style={styles.composerRow}>
              <View style={styles.inputWrap}>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="说说你想让 H Wallet 帮你做什么"
                  placeholderTextColor="rgba(148,163,184,0.72)"
                  multiline
                  returnKeyType="done"
                  onSubmitEditing={() => void sendMessage()}
                  style={styles.input}
                />
              </View>

              <Pressable
                onPress={() => void sendMessage()}
                disabled={submitting}
                style={({ pressed }) => [
                  styles.sendButtonWrap,
                  (pressed || submitting) && styles.sendButtonPressed,
                ]}
              >
                <LinearGradient
                  colors={["#111827", "#6E5BFF"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.sendButton}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.sendButtonText}>发</Text>
                  )}
                </LinearGradient>
              </Pressable>
            </View>

              {errorText ? (
                <Text style={styles.errorText}>{errorText}</Text>
              ) : null}
            </View>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  fixedHeaderWrap: {
    backgroundColor: "#F5F5F7",
    paddingTop: 4,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15,23,42,0.05)",
    gap: 8,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 20,
  },
  filterChip: {
    flex: 1,
    minHeight: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
  },
  filterChipActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  filterChipPressed: {
    opacity: 0.88,
  },
  filterChipText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: "#667085",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 150,
    backgroundColor: "#F5F5F7",
  },
  headerBlock: {
    marginBottom: 24,
    gap: 16,
    width: "100%",
  },
  headingWrap: {
    gap: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    color: "#1A1A2E",
  },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(17,24,39,0.06)",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.05)",
  },
  statusPillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    color: "#475467",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: "#666C85",
  },
  heroCard: {
    borderRadius: 30,
    padding: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    backgroundColor: "rgba(255,255,255,0.92)",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },
  heroInner: {
    gap: 8,
  },
  heroEyebrow: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: "#666C85",
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: "#111827",
  },
  heroDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: "#475467",
  },
  quickNavRow: {
    flexDirection: "column",
    gap: 10,
    width: "100%",
  },
  quickNavCard: {
    width: "100%",
    minWidth: 0,
    borderRadius: 22,
    padding: 15,
    backgroundColor: "rgba(255, 255, 255, 0.82)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.10)",
    gap: 6,
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  quickNavTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: "#1A1A2E",
  },
  quickNavDesc: {
    fontSize: 12,
    lineHeight: 18,
    color: "#666C85",
  },
  suggestionList: {
    paddingRight: 0,
    gap: 10,
  },
  suggestionChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.86)",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
  },
  suggestionChipPressed: {
    opacity: 0.82,
  },
  suggestionText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: "#344054",
  },
  bubbleRow: {
    marginBottom: 12,
    flexDirection: "row",
  },
  userRow: {
    justifyContent: "flex-end",
  },
  assistantRow: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "100%",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  userBubble: {
    backgroundColor: "#7C3AED",
  },
  assistantBubble: {
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
    elevation: 2,
  },
  assistantSuccess: {
    borderColor: "#BBF7D0",
    backgroundColor: "#ECFDF5",
  },
  assistantDanger: {
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
  },
  assistantWarning: {
    borderColor: "#E5E7EB",
    backgroundColor: "#F8FAFC",
  },
  bubbleTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: "#1A1A2E",
  },
  bubbleContent: {
    fontSize: 14,
    lineHeight: 22,
    color: "#31324A",
  },
  bubbleMeta: {
    fontSize: 12,
    lineHeight: 18,
    color: "#666C85",
  },
  richCard: {
    marginTop: 12,
    borderRadius: 24,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 22,
    elevation: 4,
  },
  glassCard: {
    marginTop: 12,
    borderRadius: 24,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    backgroundColor: "rgba(255,255,255,0.94)",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 3,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  assetIconWrap: {
    backgroundColor: "rgba(124,58,237,0.10)",
  },
  cardHeaderTextWrap: {
    flex: 1,
    gap: 2,
  },
  cardEyebrow: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: "rgba(255,255,255,0.78)",
  },
  darkEyebrow: {
    color: "#7C3AED",
  },
  cardTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  darkTitle: {
    color: "#1A1A2E",
  },
  badgeWrap: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  badgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  priceValue: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  metricGrid: {
    flexDirection: "row",
    gap: 10,
  },
  metricCell: {
    flex: 1,
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    gap: 4,
  },
  metricLabel: {
    fontSize: 11,
    lineHeight: 16,
    color: "rgba(255,255,255,0.72)",
  },
  metricValue: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  cardActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  primaryAction: {
    flex: 1,
    minHeight: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7C3AED",
    paddingHorizontal: 14,
  },
  primaryActionText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  secondaryAction: {
    flex: 1,
    minHeight: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 14,
  },
  secondaryActionText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  secondaryActionLight: {
    flex: 1,
    minHeight: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(124,58,237,0.08)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.18)",
    paddingHorizontal: 14,
  },
  secondaryActionLightText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: "#6D28D9",
  },
  assetChainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(124,58,237,0.06)",
  },
  assetChainTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: "#1A1A2E",
  },
  assetChainMeta: {
    fontSize: 12,
    lineHeight: 18,
    color: "#666C85",
  },
  assetChainRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  assetChainValue: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    color: "#1A1A2E",
  },
  defiRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(124,58,237,0.06)",
  },
  defiLeft: {
    flex: 1,
    gap: 2,
  },
  defiRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  defiName: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: "#1A1A2E",
  },
  defiMeta: {
    fontSize: 12,
    lineHeight: 18,
    color: "#666C85",
  },
  defiApy: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
    color: "#16A34A",
  },
  smartMoneyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  smartMoneyLeft: {
    flex: 1,
    gap: 2,
  },
  smartMoneyRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  smartMoneyRank: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  smartMoneyMeta: {
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.74)",
  },
  smartMoneyToken: {
    fontSize: 12,
    lineHeight: 18,
    color: "#C4B5FD",
  },
  smartMoneyPnl: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
    color: "#86EFAC",
  },
  primaryGhostAction: {
    flex: 1,
    minHeight: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 14,
  },
  memeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(124,58,237,0.06)",
  },
  memeLeft: {
    flex: 1,
    gap: 2,
  },
  memeRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  memeName: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    color: "#1A1A2E",
  },
  memeMeta: {
    fontSize: 12,
    lineHeight: 18,
    color: "#666C85",
  },
  memeCap: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    color: "#7C3AED",
  },
  footerComposerWrap: {
    marginTop: 8,
    gap: 16,
  },
  footerComposer: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    gap: 10,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 3,
  },
  composerLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: "#1A1A2E",
  },
  composerHint: {
    fontSize: 13,
    lineHeight: 19,
    color: "#666C85",
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    width: "100%",
  },
  inputWrap: {
    flex: 1,
    minWidth: 0,
    minHeight: 112,
    borderRadius: 22,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: "#1A1A2E",
    textAlignVertical: "top",
  },
  sendButtonWrap: {
    borderRadius: 22,
    overflow: "hidden",
  },
  sendButtonPressed: {
    opacity: 0.9,
  },
  sendButton: {
    width: 54,
    height: 54,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonText: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#DC2626",
  },
});
