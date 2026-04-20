import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
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
import { PremiumCard, CardListRow } from "@/components/PremiumCard";
import { ConfirmModal } from "@/components/ConfirmModal";

import { ManusColors, ManusRadius, ManusSpacing } from "@/constants/manus-ui";
import { buildXLayerBuilderCodePayload } from "@/lib/builder-code";
import {
  buildConfirmCard,
  detectAgentIntent,
  type AgentSwapIntent,
} from "@/lib/agent-wallet-intent";
import {
  executeOnchainSwap,
  getAccountAssets,
  getMarketSnapshotByMcp,
  getMemeScanListByMcp,
  getOnchainExecutionReceipt,
  parseChatAiIntent,
  parseDexSwapIntent,
  previewOnchainSwap,
  searchDeFiProductsByMcp,
  getSmartMoneyLeaderboardByMcp,
  type AgentWalletAssetsResponse,
  type ChatAiIntentResponse,
  type DeFiProductItem,
  type DexChainKind,
  type MarketSnapshot,
  type OnchainTxPhase,
  type StoredWalletSnapshot,
} from "@/lib/_core/api";
import {
  buildSignatureCallbackUrl,
  clearPendingSignatureContext,
  encodeSignatureContextId,
  getPendingSignatureContext,
  savePendingSignatureContext,
  type PendingSignatureContext,
} from "@/lib/signature-bridge";

const WALLET_STORAGE_KEY = "hwallet-agent-wallet";
const EVM_NATIVE = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const SOL_NATIVE = "So11111111111111111111111111111111111111112";
const POSITIVE = "#10B981";
const NEGATIVE = "#EF4444";
const SIGNATURE_PORTAL_URL = (
  process.env.EXPO_PUBLIC_SIGNATURE_PORTAL_URL ??
  process.env.EXPO_PUBLIC_OKX_WALLET_SIGN_URL ??
  ""
).trim();

/* ── Card accent colors (each card type uses a unique tint) ── */
const CARD_TINTS = {
  price:      { bg: "#FAF5FF", accent: "#7C3AED", icon: "#7C3AED" },
  asset:      { bg: "#EFF6FF", accent: "#3B82F6", icon: "#3B82F6" },
  defi:       { bg: "#ECFDF5", accent: "#10B981", icon: "#10B981" },
  smartMoney: { bg: "#FFFBEB", accent: "#F59E0B", icon: "#F59E0B" },
  meme:       { bg: "#FDF2F8", accent: "#EC4899", icon: "#EC4899" },
  swap:       { bg: "#ECFEFF", accent: "#06B6D4", icon: "#06B6D4" },
  transfer:   { bg: "#F5F3FF", accent: "#8B5CF6", icon: "#8B5CF6" },
} as const;

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
  phase: OnchainTxPhase;
  signatureRequest?: NonNullable<PendingSignatureContext["swap"]>;
  progress?: {
    key: string;
    label: string;
    status: "done" | "pending";
  }[];
};

type TransferCardPayload = {
  amount: string;
  symbol: string;
  chainKind: DexChainKind;
  fromAddress: string;
  toAddress: string;
  phase: OnchainTxPhase;
  progress: {
    key: string;
    label: string;
    status: "done" | "pending";
  }[];
};

type ChatCard =
  | { kind: "price"; payload: PriceCardPayload }
  | { kind: "asset"; payload: AssetCardPayload }
  | { kind: "defi"; payload: DeFiCardPayload }
  | { kind: "smart-money"; payload: SmartMoneyCardPayload }
  | { kind: "meme"; payload: MemeCardPayload }
  | { kind: "swap"; payload: SwapCardPayload }
  | { kind: "transfer"; payload: TransferCardPayload };

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
  { label: "BTC 价格", icon: "chart-line" as const },
  { label: "看看我的资产", icon: "wallet-outline" as const },
  { label: "赚币产品", icon: "diamond-stone" as const },
  { label: "100 USDT 换 ETH", icon: "swap-horizontal-bold" as const },
];

const initialMessages: ChatMessage[] = [
  {
    id: "welcome-1",
    role: "assistant",
    content: "Hi, 我是 Dolphin. 你可以让我查价格、看资产、找赚币产品，或发起 Swap 等链上操作。",
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

/* ══════════════════════════════════════════════════
 *  Utility functions (unchanged business logic)
 * ══════════════════════════════════════════════════ */

function parseWallet(raw: string | null): StoredWalletSnapshot {
  if (!raw) return null;
  try { return JSON.parse(raw) as StoredWalletSnapshot; } catch { return null; }
}

function maskAddress(address: string) {
  if (!address) return "";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function normalizeSymbol(value: string) { return value.trim().toUpperCase(); }

function getPrimaryWalletAddress(wallet: StoredWalletSnapshot, chainKind: DexChainKind) {
  if (chainKind === "solana") return wallet?.solanaAddress?.trim() ?? "";
  return wallet?.evmAddress?.trim() ?? "";
}

function resolveSwapToken(symbol: string, chainKind: DexChainKind) {
  const normalized = normalizeSymbol(symbol);
  return chainKind === "solana" ? SOLANA_TOKEN_MAP[normalized] : EVM_TOKEN_MAP[normalized];
}

function toRawAmount(amount: string, decimals: number) {
  const normalized = amount.trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) throw new Error("兑换数量格式不正确，请输入有效数字。");
  const [wholePart, fractionPart = ""] = normalized.split(".");
  const combined = `${wholePart}${fractionPart.padEnd(decimals, "0").slice(0, decimals)}`.replace(/^0+(?=\d)/, "").replace(/^$/, "0");
  return BigInt(combined).toString();
}

function formatTokenAmount(raw: string, decimals: number, maxFractionDigits = 6) {
  if (!raw || !/^\d+$/.test(raw)) return "0";
  const normalized = raw.replace(/^0+(?=\d)/, "") || "0";
  const padded = normalized.padStart(decimals + 1, "0");
  const integerPart = padded.slice(0, -decimals) || "0";
  const fractionPart = decimals > 0 ? padded.slice(-decimals) : "";
  const trimmedFraction = fractionPart.slice(0, maxFractionDigits).replace(/0+$/, "");
  return trimmedFraction ? `${integerPart}.${trimmedFraction}` : integerPart;
}

function formatSwapUnitPrice(fromAmount: string, toAmount: string, toSymbol: string, fromSymbol: string) {
  const fromValue = Number(fromAmount);
  const toValue = Number(toAmount);
  if (!Number.isFinite(fromValue) || !Number.isFinite(toValue) || fromValue <= 0 || toValue <= 0) return "--";
  const quote = toValue / fromValue;
  const digits = quote >= 1000 ? 2 : quote >= 1 ? 4 : 6;
  return `1 ${fromSymbol} ≈ ${quote.toFixed(digits)} ${toSymbol}`;
}

function parseMcpJsonResult(payload: any) {
  const text = payload?.result?.content?.[0]?.text;
  if (!text || typeof text !== "string") throw new Error("OKX MCP 未返回可解析的报价内容。");
  return JSON.parse(text) as Record<string, any>;
}

function detectTransferIntent(message: string): TransferIntent | null {
  const normalized = message.trim();
  const matched = normalized.match(
    /(?:转账|转|发送|打给|send)\s*([0-9]+(?:\.[0-9]+)?)\s*([A-Za-z]{2,10})\s*(?:到|给|to)\s*([A-Za-z0-9]{24,})/i,
  );
  if (!matched) return null;
  const [, amount, symbolRaw, address] = matched;
  const symbol = normalizeSymbol(symbolRaw);
  const chainKind: DexChainKind = address.startsWith("0x") ? "evm" : "solana";
  return { amount, symbol, address, chainKind };
}

function buildAssistantMessages(response: ChatAiIntentResponse, seed: number): ChatMessage[] {
  if ("mode" in response && response.mode === "grid-strategy") {
    return [{ id: `assistant-${seed}-grid`, role: "assistant", content: response.result.message }];
  }
  if (!("intent" in response) || !response.intent) {
    return [{ id: `assistant-${seed}-fallback`, role: "assistant", content: "当前请求已返回，但暂时没有可直接渲染的内容。", tone: "warning" }];
  }
  const messages: ChatMessage[] = [
    { id: `assistant-${seed}-main`, role: "assistant", content: response.intent.reply },
  ];
  if (response.intent.priceText) {
    messages.push({ id: `assistant-${seed}-price`, role: "assistant", content: response.intent.priceText, tone: "success" });
  }
  if (response.earnPlan) {
    messages.push({ id: `assistant-${seed}-earn`, role: "assistant", content: `${response.earnPlan.protocol} · ${response.earnPlan.chain} · ${response.earnPlan.symbol}\n建议金额 $${response.earnPlan.amount.toLocaleString("zh-CN")}，参考 APR ${response.earnPlan.apr.toFixed(2)}%，风险等级 ${response.earnPlan.riskLabel}。\n${response.earnPlan.description}`, tone: "success" });
  }
  if (response.profit) {
    messages.push({ id: `assistant-${seed}-profit`, role: "assistant", content: `${response.profit.protocol} · ${response.profit.chain}\n累计收益 $${response.profit.totalProfit.toFixed(2)}，今日收益 $${response.profit.todayProfit.toFixed(2)}，APR ${response.profit.apr.toFixed(2)}%。` });
  }
  if (response.deposit) {
    messages.push({ id: `assistant-${seed}-deposit`, role: "assistant", content: `${response.deposit.networkLabel}\n${response.deposit.address}` });
  }
  if (response.intent.assetSummary) {
    messages.push({ id: `assistant-${seed}-asset`, role: "assistant", content: response.intent.assetSummary });
  }
  return messages;
}

function buildSwapMessages(params: SwapCardPayload & { seed: number }): ChatMessage[] {
  const { seed, ...payload } = params;
  return [
    { id: `assistant-${seed}-swap-card`, role: "assistant", content: `已通过 OKX Onchain OS 生成 ${payload.fromSymbol} → ${payload.toSymbol} 的执行摘要。`, card: { kind: "swap", payload } },
  ];
}

function buildTransferMessages(intent: TransferIntent, wallet: StoredWalletSnapshot, seed: number): ChatMessage[] {
  const fromAddress = getPrimaryWalletAddress(wallet, intent.chainKind);
  const progress = [
    { key: "prepare", label: "已整理转账请求", status: "done" as const },
    { key: "confirm", label: "等待执行确认", status: "pending" as const },
    { key: "broadcast", label: "等待广播交易", status: "pending" as const },
  ];
  return [
    { id: `assistant-${seed}-transfer-execute`, role: "assistant", content: `已识别转账：向 ${maskAddress(intent.address)} 发送 ${intent.amount} ${intent.symbol}。`, card: { kind: "transfer", payload: { amount: intent.amount, symbol: intent.symbol, chainKind: intent.chainKind, fromAddress, toAddress: intent.address, phase: "awaiting_confirmation", progress } } },
  ];
}

function extractPriceSymbol(message: string): string | null {
  const wantsPrice = /(价格|多少钱|行情|报价|涨跌|PRICE|QUOTE|MARKET)/i.test(message);
  const aliases: Array<{ symbol: string; patterns: RegExp[] }> = [
    { symbol: "BTC", patterns: [/\bBTC\b/i, /比特币/i, /BITCOIN/i] },
    { symbol: "ETH", patterns: [/\bETH\b/i, /以太坊/i, /ETHEREUM/i] },
    { symbol: "SOL", patterns: [/\bSOL\b/i, /索拉纳/i, /SOLANA/i] },
    { symbol: "BNB", patterns: [/\bBNB\b/i, /币安币/i, /BINANCE COIN/i] },
    { symbol: "SUI", patterns: [/\bSUI\b/i] },
  ];
  const normalized = message.trim().toUpperCase();
  for (const item of aliases) {
    if (item.patterns.some((pattern) => pattern.test(normalized)) && wantsPrice) return item.symbol;
  }
  return null;
}

function formatCurrency(value: number, digits = 2) {
  return new Intl.NumberFormat("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}
function formatPrice(value: number) {
  if (value >= 1000) return `$${formatCurrency(value, 2)}`;
  if (value >= 1) return `$${formatCurrency(value, 4)}`;
  return `$${formatCurrency(value, 6)}`;
}
function formatVolume(value?: string) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return "--";
  if (parsed >= 1_000_000_000) return `$${formatCurrency(parsed / 1_000_000_000, 2)}B`;
  if (parsed >= 1_000_000) return `$${formatCurrency(parsed / 1_000_000, 2)}M`;
  return `$${formatCurrency(parsed, 0)}`;
}
function formatChange(change24h: number | null) {
  if (change24h === null || !Number.isFinite(change24h)) return "--";
  const percent = change24h * 100;
  return `${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%`;
}
function formatSnapshotTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}
function formatUsdCompact(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  if (value >= 1_000_000_000) return `$${formatCurrency(value / 1_000_000_000, 2)}B`;
  if (value >= 1_000_000) return `$${formatCurrency(value / 1_000_000, 2)}M`;
  if (value >= 1_000) return `$${formatCurrency(value / 1_000, 2)}K`;
  return `$${formatCurrency(value, 2)}`;
}

function buildPriceMessages(snapshot: MarketSnapshot, seed: number): ChatMessage[] {
  return [{ id: `assistant-${seed}-price-card`, role: "assistant", content: `已为你查询 ${snapshot.symbol} 的实时价格。`, card: { kind: "price", payload: { snapshot } } }];
}
function isAssetIntent(message: string) { return /(资产|余额|持仓|仓位|portfolio|balance)/i.test(message); }
function extractDeFiToken(message: string) { const matched = message.toUpperCase().match(/BTC|ETH|SOL|USDT|USDC|DAI/); return matched?.[0] ?? "USDT"; }
function isDeFiIntent(message: string) { return /(赚币|理财|收益|申购|赚利息|earn|defi|apy|apr|产品)/i.test(message); }
function isSmartMoneyIntent(message: string) { return /(聪明钱|大户|巨鲸|kol|鲸鱼|最近在买什么|smart money)/i.test(message); }
function isMemeIntent(message: string) { return /(meme|土狗|热门币|热门 meme|新币|pump|memecoin)/i.test(message); }

function buildAssetMessages(assets: AgentWalletAssetsResponse, seed: number): ChatMessage[] {
  return [{ id: `assistant-${seed}-asset-card`, role: "assistant", content: `已拉取 Agent Wallet 链上资产。`, card: { kind: "asset", payload: { assets } } }];
}
function buildDeFiMessages(token: string, products: DeFiProductItem[], seed: number): ChatMessage[] {
  return [{ id: `assistant-${seed}-defi-card`, role: "assistant", content: `已检索 ${token} 相关赚币产品。`, card: { kind: "defi", payload: { token, products } } }];
}
function buildSmartMoneyMessages(wallets: Awaited<ReturnType<typeof getSmartMoneyLeaderboardByMcp>>, seed: number): ChatMessage[] {
  return [{ id: `assistant-${seed}-smart-money-card`, role: "assistant", content: "已拉取聪明钱榜单。", card: { kind: "smart-money", payload: { wallets } } }];
}
function buildMemeMessages(tokens: Awaited<ReturnType<typeof getMemeScanListByMcp>>, seed: number): ChatMessage[] {
  return [{ id: `assistant-${seed}-meme-card`, role: "assistant", content: "已扫描热门 Meme 代币。", card: { kind: "meme", payload: { tokens } } }];
}

/* ══════════════════════════════════════════════════
 *  Chat Screen Component
 * ══════════════════════════════════════════════════ */

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    draft?: string; draftKey?: string; q?: string; source?: string;
    sigContextId?: string; sigFlow?: "swap" | "transfer"; sigStatus?: string;
    sigSignedTx?: string; sigJitoSignedTx?: string; sigTxHash?: string; sigError?: string;
  }>();
  const lastDraftKeyRef = useRef("");
  const lastSignatureKeyRef = useRef("");
  const lastSignatureResumeKeyRef = useRef("");
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState("");
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  
  // 交易确认弹窗状态
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmModalType, setConfirmModalType] = useState<"swap" | "transfer">("swap");
  const [confirmModalLoading, setConfirmModalLoading] = useState(false);
  const [pendingSwapPayload, setPendingSwapPayload] = useState<SwapCardPayload | null>(null);
  const [pendingTransferPayload, setPendingTransferPayload] = useState<TransferCardPayload | null>(null);

  const incomingQuery = typeof params.q === "string" ? params.q.trim() : "";
  const isFromCommunity = params.source === "community" && incomingQuery.length > 0;
  const isFromSignatureCallback = params.source === "signature-callback";

  const appendMessages = useCallback((nextMessages: ChatMessage[]) => {
    setMessages((prev) => [...prev, ...nextMessages]);
    requestAnimationFrame(() => { flatListRef.current?.scrollToEnd({ animated: true }); });
  }, []);

  const startSignatureFlow = useCallback(
    async (context: PendingSignatureContext, summary: { title: string; content: string }) => {
      const encodedContextId = encodeSignatureContextId(context.id);
      const callbackUrl = buildSignatureCallbackUrl({ ctx: encodedContextId });
      await savePendingSignatureContext(context);
      appendMessages([{ id: `assistant-signature-launch-${context.id}`, role: "assistant", content: summary.content, tone: SIGNATURE_PORTAL_URL ? "default" : "warning" }]);
      if (!SIGNATURE_PORTAL_URL) return;
      const launchUrl = new URL(SIGNATURE_PORTAL_URL);
      launchUrl.searchParams.set("flow", context.flow);
      launchUrl.searchParams.set("chainKind", context.chainKind);
      launchUrl.searchParams.set("ctx", encodedContextId);
      launchUrl.searchParams.set("callbackUrl", callbackUrl);
      if (context.flow === "swap" && context.swap?.builderCode) {
        launchUrl.searchParams.set("builderCode", context.swap.builderCode);
        launchUrl.searchParams.set("builderCodeInjectionMode", context.swap.builderCodeInjectionMode || "data_suffix");
        launchUrl.searchParams.set("builderCodeTargetCapability", context.swap.builderCodeTargetCapability || "wallet_sendCalls");
        if (context.swap.builderCodeDataSuffix) launchUrl.searchParams.set("builderCodeDataSuffix", context.swap.builderCodeDataSuffix);
        if (context.swap.builderCodeCallDataMemo) launchUrl.searchParams.set("builderCodeCallDataMemo", context.swap.builderCodeCallDataMemo);
      }
      launchUrl.searchParams.set("payload", JSON.stringify(
        context.flow === "swap"
          ? { amount: context.swap?.displayAmount || context.swap?.amount || "", fromTokenSymbol: context.swap?.fromTokenSymbol || "", toTokenSymbol: context.swap?.toTokenSymbol || "", routeLabel: context.swap?.routeLabel || "", builderCode: context.swap?.builderCode, builderCodeInjectionMode: context.swap?.builderCodeInjectionMode, builderCodeTargetCapability: context.swap?.builderCodeTargetCapability, builderCodeDataSuffix: context.swap?.builderCodeDataSuffix, builderCodeCallDataMemo: context.swap?.builderCodeCallDataMemo, swap: context.swap ?? null }
          : { transfer: context.transfer ?? null },
      ));
      try { await Linking.openURL(launchUrl.toString()); } catch (launchError) {
        appendMessages([{ id: `assistant-signature-launch-error-${context.id}`, role: "assistant", content: launchError instanceof Error ? launchError.message : "暂时无法打开确认页。", tone: "warning" }]);
      }
    }, [appendMessages],
  );

  const handleTransferSignature = useCallback(async (transferCard: TransferCardPayload) => {
    const context: PendingSignatureContext = {
      id: `transfer-sign-${Date.now()}`, flow: "transfer", chainKind: transferCard.chainKind,
      createdAt: new Date().toISOString(), source: "chat",
      draftPrompt: `我正在处理 ${transferCard.amount} ${transferCard.symbol} 转账确认。`,
      progress: transferCard.progress,
      transfer: { amount: transferCard.amount, symbol: transferCard.symbol, fromAddress: transferCard.fromAddress, toAddress: transferCard.toAddress },
    };
    await startSignatureFlow(context, { title: "已准备转账确认", content: `为 ${transferCard.amount} ${transferCard.symbol} 转账准备确认，正在打开 Agent Wallet...` });
  }, [startSignatureFlow]);

  const handleSwapSignature = useCallback(async (swapCard: SwapCardPayload) => {
    if (!swapCard.signatureRequest) {
      appendMessages([{ id: `assistant-swap-signature-missing-${Date.now()}`, role: "assistant", content: "当前卡片还没有完整的执行数据，请重新获取报价。", tone: "warning" }]);
      return;
    }
    const context: PendingSignatureContext = {
      id: `swap-sign-${Date.now()}`, flow: "swap", chainKind: swapCard.chainKind,
      createdAt: new Date().toISOString(), source: "chat",
      draftPrompt: `我正在处理 ${swapCard.amount} ${swapCard.fromSymbol} 换 ${swapCard.toSymbol} 的执行确认。`,
      progress: swapCard.progress, swap: swapCard.signatureRequest,
    };
    await startSignatureFlow(context, { title: "已准备兑换确认", content: `为 ${swapCard.amount} ${swapCard.fromSymbol} → ${swapCard.toSymbol} 兑换准备确认...` });
  }, [appendMessages, startSignatureFlow]);

  const runSwapFlow = useCallback(async (content: string, wallet: StoredWalletSnapshot, seed: number, presetIntent?: AgentSwapIntent) => {
    let parsedSwap: { amount: string; fromSymbol: string; toSymbol: string; chainKind: DexChainKind | null } | null = null;
    if (presetIntent) {
      parsedSwap = { amount: presetIntent.payload.amount, fromSymbol: presetIntent.payload.fromSymbol, toSymbol: presetIntent.payload.toSymbol, chainKind: presetIntent.payload.chainKind };
    } else {
      const parsed = await parseDexSwapIntent(content);
      if (parsed.intent.action !== "swap") return [{ id: `assistant-${seed}-swap-unknown`, role: "assistant", content: "信息不完整，试试「把 100 USDT 换成 ETH」这种说法。", tone: "warning" }] satisfies ChatMessage[];
      parsedSwap = { amount: parsed.intent.amount, fromSymbol: parsed.intent.fromSymbol, toSymbol: parsed.intent.toSymbol, chainKind: parsed.intent.chainKind };
    }
    const chainKind = parsedSwap.chainKind ?? "evm";
    const walletAddress = getPrimaryWalletAddress(wallet, chainKind);
    if (!walletAddress) return [{ id: `assistant-${seed}-swap-no-wallet`, role: "assistant", content: "当前没有可用的钱包地址，请先完成登录。", tone: "danger" }] satisfies ChatMessage[];
    const fromToken = resolveSwapToken(parsedSwap.fromSymbol, chainKind);
    const toToken = resolveSwapToken(parsedSwap.toSymbol, chainKind);
    if (!fromToken || !toToken) return [{ id: `assistant-${seed}-swap-token-miss`, role: "assistant", content: `${parsedSwap.fromSymbol} → ${parsedSwap.toSymbol} 当前暂未接入。`, tone: "warning" }] satisfies ChatMessage[];

    const slippage = "0.5";
    const rawAmount = toRawAmount(parsedSwap.amount, fromToken.decimals);
    const quoteResult = await previewOnchainSwap({ chainIndex: fromToken.chainIndex, amount: rawAmount, fromTokenAddress: fromToken.address, toTokenAddress: toToken.address, userWalletAddress: walletAddress, fromTokenSymbol: parsedSwap.fromSymbol, toTokenSymbol: parsedSwap.toSymbol, chainKind });
    const estimatedReceive = quoteResult.quote?.toAmount ?? "0";
    const estimatedPrice = formatSwapUnitPrice(parsedSwap.amount, estimatedReceive, parsedSwap.toSymbol, parsedSwap.fromSymbol);
    const routeLabel = "OKX Onchain OS";
    const priceImpact = "0%";

    let executeResult: Awaited<ReturnType<typeof executeOnchainSwap>> | null = null;
    try {
      executeResult = await executeOnchainSwap({ chainIndex: fromToken.chainIndex, amount: rawAmount, fromTokenAddress: fromToken.address, toTokenAddress: toToken.address, userWalletAddress: walletAddress, fromTokenSymbol: parsedSwap.fromSymbol, toTokenSymbol: parsedSwap.toSymbol, displayAmount: parsedSwap.amount, chainKind, slippagePercent: slippage });
    } catch (executeError) { console.warn("[runSwapFlow] executeOnchainSwap failed:", executeError); }

    const builderCodePayload = buildXLayerBuilderCodePayload({ chainIndex: fromToken.chainIndex, chainKind });
    const cardPayload: SwapCardPayload = {
      amount: parsedSwap.amount, fromSymbol: parsedSwap.fromSymbol, toSymbol: parsedSwap.toSymbol, chainKind,
      estimatedReceive, estimatedPrice, slippage, priceImpact, routeLabel,
      phase: executeResult?.phase ?? "preview",
      signatureRequest: executeResult?.phase === "awaiting_confirmation" && executeResult.swapTransaction
        ? { chainIndex: fromToken.chainIndex, amount: rawAmount, fromTokenAddress: fromToken.address, toTokenAddress: toToken.address, userWalletAddress: walletAddress, fromTokenSymbol: parsedSwap.fromSymbol, toTokenSymbol: parsedSwap.toSymbol, slippagePercent: slippage, broadcastAddress: walletAddress, routeLabel, displayAmount: parsedSwap.amount, builderCode: builderCodePayload?.builderCode, builderCodeInjectionMode: builderCodePayload?.injectionMode, builderCodeTargetCapability: builderCodePayload?.targetCapability, builderCodeDataSuffix: builderCodePayload?.dataSuffix, builderCodeCallDataMemo: builderCodePayload?.callDataMemo, swapTransaction: executeResult.swapTransaction }
        : undefined,
      progress: executeResult?.progress,
    };
    const swapMessages = buildSwapMessages({ ...cardPayload, seed });
    if (executeResult) {
      const phaseMsg = executeResult.phase === "awaiting_confirmation" ? "已生成待确认请求，请完成 Agent Wallet 确认。"
        : executeResult.phase === "success" ? `兑换完成，订单号 ${executeResult.orderId}。`
        : executeResult.phase === "failed" ? "兑换执行失败，请检查余额和滑点。"
        : `已提交执行，订单号 ${executeResult.orderId}。`;
      swapMessages.push({ id: `assistant-${seed}-swap-receipt`, role: "assistant", content: phaseMsg, tone: executeResult.phase === "success" ? "success" : executeResult.phase === "failed" ? "danger" : "default" });
    }
    return swapMessages;
  }, []);

  const sendMessage = useCallback(async (rawText?: string) => {
    const content = (rawText ?? input).trim();
    if (!content || submitting) return;
    setErrorText("");
    setInput("");
    appendMessages([{ id: `user-${Date.now()}`, role: "user", content }]);
    setSubmitting(true);
    try {
      const walletRaw = await AsyncStorage.getItem(WALLET_STORAGE_KEY);
      const wallet = parseWallet(walletRaw);
      const seed = Date.now();
      const triggeredIntent = detectAgentIntent(content);
      const confirmCard = buildConfirmCard(triggeredIntent);

      if (triggeredIntent.kind === "transfer") {
        appendMessages(buildTransferMessages(triggeredIntent.payload, wallet, seed));
        return;
      }
      if (triggeredIntent.kind === "swap") {
        const swapMessages = await runSwapFlow(content, wallet, seed, triggeredIntent);
        appendMessages(swapMessages);
        return;
      }
      if (triggeredIntent.kind === "price_query") {
        const snapshot = await getMarketSnapshotByMcp(triggeredIntent.payload.symbol);
        appendMessages(buildPriceMessages(snapshot, seed));
        return;
      }
      if (triggeredIntent.kind === "portfolio_query") {
        if (!wallet) throw new Error("请先完成登录并创建 Agent Wallet。");
        const assets = await getAccountAssets(wallet);
        appendMessages(buildAssetMessages(assets, seed));
        return;
      }
      if (triggeredIntent.kind === "earn_query") {
        const token = triggeredIntent.payload?.symbol ?? extractDeFiToken(content);
        const products = await searchDeFiProductsByMcp(token, "ethereum", "SINGLE_EARN");
        if (!products.length) throw new Error(`暂未检索到 ${token} 相关的赚币产品。`);
        appendMessages(buildDeFiMessages(token, products, seed));
        return;
      }
      const priceSymbol = extractPriceSymbol(content);
      if (priceSymbol) { appendMessages(buildPriceMessages(await getMarketSnapshotByMcp(priceSymbol), seed)); return; }
      if (isAssetIntent(content)) {
        if (!wallet) throw new Error("请先完成登录并创建 Agent Wallet。");
        appendMessages(buildAssetMessages(await getAccountAssets(wallet), seed)); return;
      }
      if (isDeFiIntent(content)) {
        const token = extractDeFiToken(content);
        const products = await searchDeFiProductsByMcp(token, "ethereum", "SINGLE_EARN");
        if (!products.length) throw new Error(`暂未检索到 ${token} 相关的赚币产品。`);
        appendMessages(buildDeFiMessages(token, products, seed)); return;
      }
      if (isSmartMoneyIntent(content)) {
        const wallets = await getSmartMoneyLeaderboardByMcp("solana");
        if (!wallets.length) throw new Error("暂未拉取到聪明钱榜单。");
        appendMessages(buildSmartMoneyMessages(wallets, seed)); return;
      }
      if (isMemeIntent(content)) {
        const tokens = await getMemeScanListByMcp("solana");
        if (!tokens.length) throw new Error("暂未拉取到热门 Meme 代币。");
        appendMessages(buildMemeMessages(tokens, seed)); return;
      }
      const response = await parseChatAiIntent({ message: content, wallet: wallet ?? undefined });
      if ("intent" in response && response.intent && response.intent.action === "swap") {
        const swapMessages = await runSwapFlow(response.intent.swapMessage || content, wallet, seed, undefined);
        appendMessages([{ id: `assistant-${seed}-swap-reply`, role: "assistant", content: response.intent.reply }, ...swapMessages]);
        return;
      }
      appendMessages(buildAssistantMessages(response, seed));
    } catch (error) {
      const message = error instanceof Error ? error.message : "消息发送失败，请稍后再试。";
      setErrorText(message);
      appendMessages([{ id: `assistant-error-${Date.now()}`, role: "assistant", content: message, tone: "danger" }]);
    } finally {
      setSubmitting(false);
    }
  }, [appendMessages, input, runSwapFlow, submitting]);

  /* ── Signature callback effects (unchanged logic) ── */
  useEffect(() => {
    const contextId = typeof params.sigContextId === "string" ? params.sigContextId : "";
    const flow = params.sigFlow === "transfer" ? "transfer" : "swap";
    const status = typeof params.sigStatus === "string" ? params.sigStatus : "returned";
    const signedTx = typeof params.sigSignedTx === "string" ? params.sigSignedTx : "";
    const jitoSignedTx = typeof params.sigJitoSignedTx === "string" ? params.sigJitoSignedTx : "";
    const txHash = typeof params.sigTxHash === "string" ? params.sigTxHash : "";
    const error = typeof params.sigError === "string" ? params.sigError : "";
    const signatureKey = contextId ? `${contextId}:${status}:${txHash || signedTx || jitoSignedTx || error}` : "";
    if (!isFromSignatureCallback || !signatureKey || lastSignatureKeyRef.current === signatureKey) return;
    lastSignatureKeyRef.current = signatureKey;
    const flowLabel = flow === "transfer" ? "转账" : "兑换";
    const assistantMessages: ChatMessage[] = [];
    assistantMessages.push({
      id: `assistant-signature-${signatureKey}-entry`, role: "assistant",
      content: status === "cancelled" ? `${flowLabel}确认已取消。` : status === "error" || error ? `${flowLabel}确认异常。` : `${flowLabel}确认结果已返回。`,
      tone: status === "error" || error ? "danger" : status === "cancelled" ? "warning" : "success",
    });
    appendMessages(assistantMessages);
  }, [appendMessages, isFromSignatureCallback, params.sigContextId, params.sigError, params.sigFlow, params.sigJitoSignedTx, params.sigSignedTx, params.sigStatus, params.sigTxHash]);

  useEffect(() => {
    const contextId = typeof params.sigContextId === "string" ? params.sigContextId : "";
    const flow = params.sigFlow === "transfer" ? "transfer" : "swap";
    const signedTx = typeof params.sigSignedTx === "string" ? params.sigSignedTx : "";
    const jitoSignedTx = typeof params.sigJitoSignedTx === "string" ? params.sigJitoSignedTx : "";
    const txHash = typeof params.sigTxHash === "string" ? params.sigTxHash : "";
    const status = typeof params.sigStatus === "string" ? params.sigStatus : "returned";
    const error = typeof params.sigError === "string" ? params.sigError : "";
    const resumeKey = contextId ? `${contextId}:${flow}:${status}:${txHash || signedTx || jitoSignedTx || error}` : "";
    if (!isFromSignatureCallback || !contextId || !resumeKey || lastSignatureResumeKeyRef.current === resumeKey || status === "cancelled" || status === "error" || error || (!signedTx && !jitoSignedTx)) return;
    lastSignatureResumeKeyRef.current = resumeKey;
    let active = true;
    const resumeSignedSwap = async () => {
      const pending = await getPendingSignatureContext();
      if (!active || !pending || pending.id !== contextId || pending.flow !== "swap" || !pending.swap) return;
      appendMessages([{ id: `assistant-signature-${resumeKey}-resume-start`, role: "assistant", content: "正在继续执行广播与订单回执查询..." }]);
      try {
        const executeResult = await executeOnchainSwap({ ...pending.swap, signedTx: signedTx || undefined, jitoSignedTx: jitoSignedTx || undefined });
        if (!active) return;
        appendMessages([{ id: `assistant-signature-${resumeKey}-resume-result`, role: "assistant", content: executeResult.phase === "success" ? `兑换完成，订单号 ${executeResult.orderId || "待补充"}。` : executeResult.phase === "failed" ? "兑换执行失败，请重试。" : `已提交执行，订单号 ${executeResult.orderId || "待补充"}。`, tone: executeResult.phase === "success" ? "success" : executeResult.phase === "failed" ? "danger" : "default" }]);
        const canPollOrder = executeResult.phase === "executing" && Boolean((executeResult.txHash || executeResult.orderId) && pending.swap?.chainIndex);
        if (canPollOrder) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          const ordersResult = await getOnchainExecutionReceipt({ address: pending.swap.broadcastAddress || pending.swap.userWalletAddress, chainIndex: pending.swap.chainIndex, orderId: executeResult.orderId, txHash: executeResult.txHash || undefined, limit: "1" });
          if (!active) return;
          const order = (ordersResult.data?.[0] ?? null) as Record<string, unknown> | null;
          const txStatus = typeof order?.txStatus === "string" ? order.txStatus : typeof order?.txstatus === "string" ? order.txstatus : "";
          const receiptStatus = typeof order?.status === "string" ? order.status.toLowerCase() : txStatus === "2" ? "success" : txStatus === "4" || txStatus === "5" ? "failure" : "pending";
          const isSettled = receiptStatus === "success";
          const isFailed = receiptStatus === "failure";
          appendMessages([{ id: `assistant-signature-${resumeKey}-poll-result`, role: "assistant", content: isSettled ? `订单已完成，订单号 ${executeResult.orderId}。` : isFailed ? `订单执行失败。` : `订单处理中...`, tone: isSettled ? "success" : isFailed ? "danger" : "default" }]);
          if (isSettled) await clearPendingSignatureContext();
          return;
        }
        await clearPendingSignatureContext();
      } catch (resumeError) {
        if (!active) return;
        appendMessages([{ id: `assistant-signature-${resumeKey}-resume-error`, role: "assistant", content: resumeError instanceof Error ? resumeError.message : "广播续跑暂未完成。", tone: "warning" }]);
      }
    };
    const resumeSignedTransfer = async () => {
      const pending = await getPendingSignatureContext();
      if (!active || !pending || pending.id !== contextId || pending.flow !== "transfer" || !pending.transfer) return;
      appendMessages([{
        id: `assistant-signature-${resumeKey}-transfer-resume-result`, role: "assistant",
        content: txHash ? `转账已返回链上回执。` : `转账确认已完成。`,
        tone: txHash ? "success" : "default",
        card: { kind: "transfer", payload: { amount: pending.transfer.amount, symbol: pending.transfer.symbol, chainKind: pending.chainKind, fromAddress: pending.transfer.fromAddress, toAddress: pending.transfer.toAddress, phase: txHash ? "executing" : "awaiting_confirmation", progress: [{ key: "prepare", label: "已整理转账请求", status: "done" as const }, { key: "confirm", label: "确认结果已返回", status: "done" as const }, { key: "broadcast", label: txHash ? "已记录链上回执" : "广播待接入", status: txHash ? "done" as const : "pending" as const }] } },
      }]);
      await clearPendingSignatureContext();
    };
    if (flow === "transfer") void resumeSignedTransfer(); else void resumeSignedSwap();
    return () => { active = false; };
  }, [appendMessages, isFromSignatureCallback, params.sigContextId, params.sigError, params.sigFlow, params.sigJitoSignedTx, params.sigSignedTx, params.sigStatus, params.sigTxHash]);

  useEffect(() => {
    const draft = typeof params.draft === "string" ? params.draft.trim() : "";
    const draftKey = typeof params.draftKey === "string" ? params.draftKey : "";
    const query = typeof params.q === "string" ? params.q.trim() : "";
    const source = typeof params.source === "string" ? params.source : "";
    const entryText = draft || query;
    const entryKey = draftKey || (query ? `${source || "external"}:${query}` : "");
    if (!entryText || !entryKey || lastDraftKeyRef.current === entryKey) return;
    lastDraftKeyRef.current = entryKey;
    void sendMessage(entryText);
  }, [params.draft, params.draftKey, params.q, params.source, sendMessage]);

  /* ════════════════════════════════════════��═════════════════════
   *  RENDER — Grok-style minimal chat with rich inline cards
   * ══════════════════════════════════════════════════════════════ */

  // 打开交易确认弹窗
  const openSwapConfirm = useCallback((payload: SwapCardPayload) => {
    setPendingSwapPayload(payload);
    setConfirmModalType("swap");
    setConfirmModalVisible(true);
  }, []);

  const openTransferConfirm = useCallback((payload: TransferCardPayload) => {
    setPendingTransferPayload(payload);
    setConfirmModalType("transfer");
    setConfirmModalVisible(true);
  }, []);

  // 确认执行交易
  const confirmTransaction = useCallback(async () => {
    setConfirmModalLoading(true);
    try {
      if (confirmModalType === "swap" && pendingSwapPayload) {
        await handleSwapSignature(pendingSwapPayload);
      } else if (confirmModalType === "transfer" && pendingTransferPayload) {
        await handleTransferSignature(pendingTransferPayload);
      }
      setConfirmModalVisible(false);
    } catch (err) {
      console.warn("[confirmTransaction] error:", err);
    } finally {
      setConfirmModalLoading(false);
    }
  }, [confirmModalType, pendingSwapPayload, pendingTransferPayload, handleSwapSignature, handleTransferSignature]);

  const renderCard = useCallback((card: ChatCard) => {
    switch (card.kind) {
      case "price": {
        const s = card.payload.snapshot;
        const isUp = (s.change24h ?? 0) >= 0;
        return (
          <PremiumCard
            variant="price"
            title={s.symbol}
            subtitle={`24h 量 ${formatVolume(s.volume24h)}`}
            badge={{ text: formatChange(s.change24h), positive: isUp }}
            heroValue={formatPrice(s.price)}
            actions={[
              { label: "大户动向", onPress: () => void sendMessage(`最近大户在买什么 ${s.symbol}`) },
              { label: "买入", primary: true, onPress: () => void sendMessage(`把 100 USDT 换成 ${s.symbol}`) },
            ]}
          />
        );
      }
      case "asset": {
        const a = card.payload.assets;
        return (
          <PremiumCard
            variant="asset"
            title="资产总览"
            subtitle="Agent Wallet"
            heroValue={formatUsdCompact(Number(a.totalAssetValue))}
            actions={[
              { label: "资产明细", onPress: () => router.push("/(tabs)/wallet") },
              { label: "市场机会", primary: true, onPress: () => void sendMessage("最近大户在买什么") },
            ]}
          >
            {a.walletAddresses.slice(0, 3).map((chain) => {
              const chainTotal = chain.assets.reduce((sum, asset) => sum + Number(asset.valueUsd || 0), 0);
              return (
                <CardListRow
                  key={`${chain.chainIndex}-${chain.address}`}
                  title={chain.chainName}
                  subtitle={maskAddress(chain.address)}
                  value={formatUsdCompact(chainTotal)}
                />
              );
            })}
          </PremiumCard>
        );
      }
      case "defi": {
        const d = card.payload;
        return (
          <PremiumCard
            variant="defi"
            title={`${d.token} 赚币`}
            subtitle="DeFi 理财产品"
            actions={[
              { label: "查看更多", primary: true, onPress: () => void sendMessage(`继续找 ${d.token} 的赚币产品`) },
            ]}
          >
            {d.products.slice(0, 3).map((p) => (
              <CardListRow
                key={p.id}
                title={p.name}
                subtitle={`${p.platform} · ${p.chain}`}
                value={`${p.apr.toFixed(2)}%`}
                valueColor={POSITIVE}
                valueSub={`TVL ${formatUsdCompact(Number(p.tvl || 0))}`}
              />
            ))}
          </PremiumCard>
        );
      }
      case "smart-money": {
        const sm = card.payload;
        return (
          <PremiumCard
            variant="smartMoney"
            title="聪明钱榜单"
            subtitle="高胜率交易者"
            actions={[
              { label: "热门 Meme", primary: true, onPress: () => void sendMessage("最近有什么热门Meme币") },
            ]}
          >
            {sm.wallets.slice(0, 3).map((w, i) => (
              <CardListRow
                key={`${w.walletAddress}-${i}`}
                rank={i + 1}
                title={maskAddress(w.walletAddress)}
                subtitle={`胜率 ${Number(w.winRatePercent || 0).toFixed(1)}% · 交易 ${w.txs}`}
                value={formatUsdCompact(Number(w.realizedPnlUsd || 0))}
                valueColor={POSITIVE}
              />
            ))}
          </PremiumCard>
        );
      }
      case "meme": {
        const m = card.payload;
        return (
          <PremiumCard
            variant="meme"
            title="热门 Meme"
            subtitle="聪明钱关注"
            actions={[
              { label: "刷新榜单", primary: true, onPress: () => void sendMessage("刷新热门Meme币") },
            ]}
          >
            {m.tokens.slice(0, 3).map((t, i) => (
              <CardListRow
                key={`${t.tokenContractAddress}-${i}`}
                rank={i + 1}
                title={t.tokenSymbol}
                subtitle={`持币 ${t.holders || "--"} · 聪明钱 ${t.smartMoneyBuys || "0"}`}
                value={formatUsdCompact(Number(t.marketCap || 0))}
              />
            ))}
          </PremiumCard>
        );
      }
      case "swap": {
        const sc = card.payload;
        const isAwaiting = sc.phase === "awaiting_confirmation" && sc.signatureRequest;
        return (
          <PremiumCard
            variant="swap"
            title={`${sc.fromSymbol} → ${sc.toSymbol}`}
            subtitle={sc.chainKind === "solana" ? "Solana 网络" : "Ethereum 网络"}
            heroValue={sc.amount}
            heroSuffix={sc.fromSymbol}
            actions={[
              { label: "钱包明细", onPress: () => router.push("/(tabs)/wallet") },
              isAwaiting
                ? { label: "确认执行", primary: true, onPress: () => openSwapConfirm(sc) }
                : { label: "查看结果", primary: true, onPress: () => router.push("/(tabs)/wallet") },
            ]}
          >
            <CardListRow title="预估获得" value={`${sc.estimatedReceive} ${sc.toSymbol}`} valueColor={POSITIVE} />
            <CardListRow title="兑换比率" value={sc.estimatedPrice} />
            <CardListRow title="滑点容差" value={sc.slippage + "%"} />
          </PremiumCard>
        );
      }
      case "transfer": {
        const tc = card.payload;
        return (
          <PremiumCard
            variant="transfer"
            title={`转账 ${tc.amount} ${tc.symbol}`}
            subtitle={tc.chainKind === "solana" ? "Solana 网络" : "Ethereum 网络"}
            heroValue={tc.amount}
            heroSuffix={tc.symbol}
            actions={[
              { label: "确认转账", primary: true, onPress: () => openTransferConfirm(tc) },
            ]}
          >
            <CardListRow title="发送地址" value={maskAddress(tc.fromAddress)} />
            <CardListRow title="接收地址" value={maskAddress(tc.toAddress)} />
          </PremiumCard>
        );
      }
    }
  }, [handleSwapSignature, handleTransferSignature, openSwapConfirm, openTransferConfirm, router, sendMessage]);

  const quickActions = [
    { key: "earn", label: "理财", icon: "cash-multiple" as const, query: "赚币产品" },
    { key: "trade", label: "交易", icon: "swap-horizontal-bold" as const, query: "100 USDT 换 ETH" },
    { key: "market", label: "行情", icon: "chart-line" as const, query: "BTC 价格" },
    { key: "strategy", label: "策略", icon: "robot-outline" as const, query: "聪明钱动向" },
  ];

  return (
    <View style={styles.rootContainer}>
      <LinearGradient
        colors={["#FDFCFF", "#F8F5FF", "#F0EBFF"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScreenContainer
        className="bg-transparent"
        safeAreaClassName="bg-transparent"
        containerClassName="bg-transparent"
      >
        <AppHeader
          onWalletPress={() => router.push("/(tabs)/wallet")}
          onRightPress={() => router.push("/(tabs)/profile")}
          centerContent={<Text style={styles.headerBrand}>Dolphin</Text>}
        />

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            messages.length <= 1 ? (
              <View style={styles.welcome}>
                <LinearGradient
                  colors={["#A78BFA", "#7C3AED"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.welcomeIcon}
                >
                  <MaterialCommunityIcons name="dolphin" size={36} color="#FFFFFF" />
                </LinearGradient>
                <Text style={styles.welcomeTitle}>{"Hi, I'm Dolphin"}</Text>
                <Text style={styles.welcomeSub}>你的链上 AI 助手，随时为你服务</Text>
                <View style={styles.suggestGrid}>
                  {suggestions.map((s) => (
                    <Pressable
                      key={s.label}
                      onPress={() => void sendMessage(s.label)}
                      style={({ pressed }) => [styles.suggestCard, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
                    >
                      <View style={styles.suggestIconWrap}>
                        <MaterialCommunityIcons name={s.icon} size={18} color={ManusColors.primary} />
                      </View>
                      <Text style={styles.suggestText}>{s.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const isUser = item.role === "user";
            return (
              <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
                {!isUser && (
                  <LinearGradient
                    colors={["#A78BFA", "#7C3AED"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.aiAvatar}
                  >
                    <MaterialCommunityIcons name="dolphin" size={14} color="#FFFFFF" />
                  </LinearGradient>
                )}
                <View style={[styles.msgContent, isUser && styles.msgContentUser]}>
                  {isUser ? (
                    <View style={styles.userBubble}>
                      <Text style={styles.userBubbleText}>{item.content}</Text>
                    </View>
                  ) : (
                    <Text style={styles.msgText}>{item.content}</Text>
                  )}
                  {item.card && renderCard(item.card)}
                </View>
              </View>
            );
          }}
          ListFooterComponent={<View style={{ height: 160 }} />}
        />

        {/* Quick Actions + Composer */}
        <View style={styles.bottomPanel}>
          <View style={styles.quickActions}>
            {quickActions.map((a) => (
              <Pressable
                key={a.key}
                onPress={() => void sendMessage(a.query)}
                style={({ pressed }) => [styles.quickBtn, pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] }]}
              >
                <View style={styles.quickIconWrap}>
                  <MaterialCommunityIcons name={a.icon} size={22} color={ManusColors.primary} />
                </View>
                <Text style={styles.quickLabel}>{a.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.composerWrap}>
            <View style={styles.composerInner}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="输入消息..."
                placeholderTextColor="#9CA3AF"
                returnKeyType="send"
                onSubmitEditing={() => void sendMessage()}
                style={styles.composerInput}
              />
              <Pressable
                onPress={() => void sendMessage()}
                disabled={submitting}
                style={({ pressed }) => [styles.sendBtn, (pressed || submitting) && { opacity: 0.6, transform: [{ scale: 0.95 }] }]}
              >
                <LinearGradient
                  colors={["#A78BFA", "#7C3AED"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.sendBtnGradient}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <MaterialCommunityIcons name="send" size={18} color="#FFFFFF" />
                  )}
                </LinearGradient>
              </Pressable>
            </View>
            {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
          </View>
        </View>
      </ScreenContainer>

      {/* 交易确认弹窗 */}
      <ConfirmModal
        visible={confirmModalVisible}
        type={confirmModalType}
        loading={confirmModalLoading}
        swapDetails={pendingSwapPayload ? {
          fromAmount: pendingSwapPayload.amount,
          fromSymbol: pendingSwapPayload.fromSymbol,
          toAmount: pendingSwapPayload.estimatedReceive,
          toSymbol: pendingSwapPayload.toSymbol,
          rate: pendingSwapPayload.estimatedPrice,
          slippage: pendingSwapPayload.slippage + "%",
          route: pendingSwapPayload.routeLabel,
        } : undefined}
        transferDetails={pendingTransferPayload ? {
          amount: pendingTransferPayload.amount,
          symbol: pendingTransferPayload.symbol,
          toAddress: pendingTransferPayload.toAddress,
          network: pendingTransferPayload.chainKind === "solana" ? "Solana" : "Ethereum",
        } : undefined}
        onConfirm={confirmTransaction}
        onCancel={() => setConfirmModalVisible(false)}
      />
    </View>
  );
}

/* ══════════════════════════════════════════════════
 *  Styles — Gradient + Glass morphism
 * ══════════════════════════════════════════════════ */

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },

  /* Header */
  headerBrand: {
    fontSize: 18,
    fontWeight: "800",
    color: ManusColors.text,
    letterSpacing: -0.5,
  },

  /* Chat content */
  chatContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },

  /* Welcome */
  welcome: {
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 32,
    gap: 10,
  },
  welcomeIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: ManusColors.text,
    letterSpacing: -0.5,
  },
  welcomeSub: {
    fontSize: 14,
    color: ManusColors.muted,
    marginTop: 2,
  },
  suggestGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginTop: 28,
    paddingHorizontal: 8,
  },
  suggestCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.1)",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  suggestIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(124,58,237,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  suggestText: {
    fontSize: 14,
    fontWeight: "600",
    color: ManusColors.text,
  },

  /* Message rows */
  msgRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    gap: 10,
  },
  msgRowUser: {
    justifyContent: "flex-end",
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  msgContent: {
    maxWidth: "82%",
    gap: 10,
  },
  msgContentUser: {
    alignItems: "flex-end",
  },
  msgText: {
    fontSize: 15,
    lineHeight: 22,
    color: ManusColors.text,
  },
  userBubble: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomRightRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.15)",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  userBubbleText: {
    fontSize: 15,
    lineHeight: 22,
    color: ManusColors.text,
  },

  /* Rich cards — Glass morphism */
  card: {
    borderRadius: 20,
    padding: 16,
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.08)",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: ManusColors.text,
    flex: 1,
  },
  cardBadge: {
    fontSize: 13,
    fontWeight: "700",
  },
  cardHero: {
    fontSize: 28,
    fontWeight: "800",
    color: ManusColors.text,
    letterSpacing: -0.8,
  },
  cardMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  cardMeta: {
    fontSize: 12,
    color: ManusColors.muted,
  },
  cardActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  cardBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.12)",
  },
  cardBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: ManusColors.textSecondary,
  },
  cardBtnPrimary: {
    backgroundColor: ManusColors.primary,
    borderWidth: 0,
  },
  cardBtnPrimaryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  /* List rows inside cards */
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.04)",
  },
  listTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: ManusColors.text,
  },
  listSub: {
    fontSize: 11,
    color: ManusColors.muted,
    marginTop: 2,
  },
  listValue: {
    fontSize: 14,
    fontWeight: "700",
    color: ManusColors.text,
  },

  /* Bottom panel */
  bottomPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 12,
    paddingBottom: 34,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderTopWidth: 1,
    borderTopColor: "rgba(124,58,237,0.08)",
    gap: 12,
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  quickBtn: {
    alignItems: "center",
    gap: 6,
  },
  quickIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(124,58,237,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: ManusColors.muted,
  },
  composerWrap: {
    gap: 4,
  },
  composerInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.12)",
    paddingLeft: 18,
    paddingRight: 5,
    paddingVertical: 5,
  },
  composerInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    color: ManusColors.text,
    paddingVertical: 10,
  },
  sendBtn: {
    borderRadius: 22,
    overflow: "hidden",
  },
  sendBtnGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontSize: 12,
    color: ManusColors.danger,
    marginTop: 4,
    paddingHorizontal: 4,
  },
});
