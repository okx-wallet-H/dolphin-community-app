
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import {
  executeOnchainSwap,
  getMe,
  parseChatAiIntent,
  parseDexSwapIntent,
  previewOnchainSwap,
  type ChatAiIntentResponse,
} from "@/lib/_core/api";

const { width: SW } = Dimensions.get("window");

const T = {
  bg1: "#F5F0FF",
  bg2: "#EDE5FF",
  bg3: "#E4DAFF",
  purple1: "#B794F6",
  purple2: "#8B5CF6",
  purple3: "#7C3AED",
  txt1: "#1A1A2E",
  txt2: "#6B6B8D",
  txt3: "#9B8FC0",
  white: "#FFFFFF",
  glass: "rgba(255,255,255,0.88)",
  glassBorder: "rgba(255,255,255,0.95)",
  stroke: "rgba(139,92,246,0.12)",
  positive: "#22C55E",
  negative: "#EF4444",
  warning: "#F59E0B",
};

const QUICK_ACTIONS = [
  { key: "finance", icon: "currency-usd" as const, label: "理财" },
  { key: "trade", icon: "swap-horizontal" as const, label: "交易" },
  { key: "market", icon: "chart-bar" as const, label: "行情" },
  { key: "strategy", icon: "cog-outline" as const, label: "策略" },
];

const WALLET_STORAGE_KEY = "hwallet-agent-wallet";

type WalletSnapshot = {
  email?: string;
  evmAddress?: string;
  solanaAddress?: string;
  mockMode?: boolean;
};

type SwapTokenConfig = {
  symbol: string;
  address: string;
  decimals: number;
  chainIndex: string;
  chainKind: "evm" | "solana";
};

type QuickSwapIntent = {
  amount: string;
  fromSymbol: string;
  toSymbol: string;
  chainKind: "evm" | "solana" | null;
};

const EVM_SWAP_TOKEN_CANDIDATES: Record<string, SwapTokenConfig[]> = {
  USDT: [
    { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6, chainIndex: "1", chainKind: "evm" },
    { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18, chainIndex: "56", chainKind: "evm" },
  ],
  USDC: [{ symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6, chainIndex: "1", chainKind: "evm" }],
  ETH: [{ symbol: "ETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18, chainIndex: "1", chainKind: "evm" }],
  BTC: [{ symbol: "BTC", address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8, chainIndex: "1", chainKind: "evm" }],
  BNB: [{ symbol: "BNB", address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", decimals: 18, chainIndex: "56", chainKind: "evm" }],
};

const SOLANA_SWAP_TOKEN_CANDIDATES: Record<string, SwapTokenConfig[]> = {
  USDT: [{ symbol: "USDT", address: "Es9vMFrzaCERmJfrF4H2h1bD9n1VWeNseyX2VINeodui", decimals: 6, chainIndex: "501", chainKind: "solana" }],
  USDC: [{ symbol: "USDC", address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6, chainIndex: "501", chainKind: "solana" }],
  SOL: [{ symbol: "SOL", address: "So11111111111111111111111111111111111111112", decimals: 9, chainIndex: "501", chainKind: "solana" }],
};

const SYMBOL_ALIASES: Record<string, string> = {
  U: "USDT",
  USDT: "USDT",
  USDC: "USDC",
  ETH: "ETH",
  BTC: "BTC",
  SOL: "SOL",
  BNB: "BNB",
  WBNB: "BNB",
};

function normalizeTradeSymbol(value: string) {
  const raw = value.replace(/[^a-zA-Z]/g, "").toUpperCase();
  return SYMBOL_ALIASES[raw] || raw;
}

function getSwapTokenCandidates(kind: "evm" | "solana", symbol: string) {
  const normalizedSymbol = normalizeTradeSymbol(symbol);
  if (kind === "solana") {
    return SOLANA_SWAP_TOKEN_CANDIDATES[normalizedSymbol] || [];
  }
  return EVM_SWAP_TOKEN_CANDIDATES[normalizedSymbol] || [];
}

function parseQuickSwapIntent(message: string): QuickSwapIntent | null {
  const normalized = message.replace(/[，。；、]/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  const directSwapMatch = normalized.match(/(\d+(?:\.\d+)?)\s*([A-Za-z]{1,10}|U)\s*(?:换成|兑换|换|swap(?:\s+to)?|to)\s*([A-Za-z]{2,10})/i);
  if (directSwapMatch) {
    const [, amount, fromRaw, toRaw] = directSwapMatch;
    const fromSymbol = normalizeTradeSymbol(fromRaw);
    const toSymbol = normalizeTradeSymbol(toRaw);
    const chainKind = toSymbol === "SOL" || fromSymbol === "SOL" ? "solana" : "evm";
    if (fromSymbol && toSymbol && amount) {
      return { amount, fromSymbol, toSymbol, chainKind };
    }
  }

  const buyMatch = normalized.match(/(?:帮我)?(?:买入|购买|买|购入)\s*(\d+(?:\.\d+)?)\s*(?:U|USDT|USDC)\s*(?:的)?\s*([A-Za-z]{2,10})/i)
    || normalized.match(/(?:帮我)?(?:用)?\s*(\d+(?:\.\d+)?)\s*(?:U|USDT|USDC)\s*(?:买入|购买|买|购入)\s*([A-Za-z]{2,10})/i);
  if (buyMatch) {
    const [, amount, toRaw] = buyMatch;
    const toSymbol = normalizeTradeSymbol(toRaw);
    const chainKind = toSymbol === "SOL" ? "solana" : "evm";
    if (toSymbol && amount) {
      return { amount, fromSymbol: "USDT", toSymbol, chainKind };
    }
  }

  const sellMatch = normalized.match(/(?:帮我)?(?:卖出|出售)\s*(\d+(?:\.\d+)?)\s*([A-Za-z]{2,10})/i);
  if (sellMatch) {
    const [, amount, fromRaw] = sellMatch;
    const fromSymbol = normalizeTradeSymbol(fromRaw);
    const chainKind = fromSymbol === "SOL" ? "solana" : "evm";
    if (fromSymbol && amount) {
      return { amount, fromSymbol, toSymbol: "USDT", chainKind };
    }
  }

  return null;
}

type WorkflowButton = {
  label: string;
  prompt?: string;
  route?: string;
};

type ChatCard =
  | { kind: "price"; symbol: string; price: number; change?: number | null }
  | { kind: "deposit"; address: string; networkLabel: string; chainKind: "evm" | "solana" }
  | {
      kind: "swap";
      phase: "preview" | "awaiting_confirmation" | "executing" | "success" | "failed";
      amountDisplay: string;
      fromSymbol: string;
      toSymbol: string;
      chainKind: "evm" | "solana";
      quoteToAmount?: string;
      minReceived?: string;
      orderId?: string;
      txHash?: string;
      txId?: string;
      errorMessage?: string;
    }
  | {
      kind: "action";
      eyebrow: string;
      title: string;
      description: string;
      primary: WorkflowButton;
      secondary?: WorkflowButton;
    };

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  card?: ChatCard;
};

function formatPrice(v: number) {
  if (v >= 1000) return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${v.toFixed(4)}`;
}

function maskAddress(address: string) {
  if (!address) return "";
  if (address.length <= 18) return address;
  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}

function parseUnits(amount: string, decimals: number) {
  const normalized = amount.trim();
  if (!normalized) return "0";
  const [integerPartRaw, fractionPartRaw = ""] = normalized.split(".");
  const integerPart = integerPartRaw.replace(/\D/g, "") || "0";
  const fractionPart = fractionPartRaw.replace(/\D/g, "").slice(0, decimals).padEnd(decimals, "0");
  return `${BigInt(integerPart)}${fractionPart}`.replace(/^0+(?=\d)/, "") || "0";
}

function resolveSwapConfig(intent: {
  fromSymbol: string;
  toSymbol: string;
  chainKind: "evm" | "solana" | null;
  amount: string;
}, wallet: WalletSnapshot | null) {
  const preferredKinds = intent.chainKind ? [intent.chainKind] : (["evm", "solana"] as const);

  for (const kind of preferredKinds) {
    const userWalletAddress = kind === "solana" ? wallet?.solanaAddress : wallet?.evmAddress;
    if (!userWalletAddress) continue;

    const fromCandidates = getSwapTokenCandidates(kind, intent.fromSymbol);
    const toCandidates = getSwapTokenCandidates(kind, intent.toSymbol);

    for (const fromConfig of fromCandidates) {
      for (const toConfig of toCandidates) {
        if (fromConfig.chainIndex !== toConfig.chainIndex) continue;

        return {
          chainKind: kind,
          chainIndex: fromConfig.chainIndex,
          fromConfig,
          toConfig,
          userWalletAddress,
          displayAmount: intent.amount,
          amount: parseUnits(intent.amount, fromConfig.decimals),
        };
      }
    }
  }

  return null;
}

function getSwapPhaseTone(phase: Extract<ChatCard, { kind: "swap" }>['phase']) {
  if (phase === "success") return { label: "已完成", color: T.positive };
  if (phase === "failed") return { label: "失败", color: T.negative };
  if (phase === "executing") return { label: "执行中", color: T.warning };
  if (phase === "awaiting_confirmation") return { label: "待确认", color: T.purple2 };
  return { label: "已预览", color: T.txt2 };
}

function PriceCard({ symbol, price, change, onDetails, onTrade }: { symbol: string; price: number; change?: number | null; onDetails: () => void; onTrade: () => void }) {
  const hasChange = typeof change === "number" && Number.isFinite(change);
  const up = hasChange ? change >= 0 : true;
  return (
    <View style={s.priceCard}>
      <LinearGradient colors={["rgba(255,255,255,0.96)", "rgba(248,245,255,0.92)"]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <View style={s.pcHead}>
        <LinearGradient colors={["#F7931A", "#FFAB40"]} style={s.pcTokenIcon}>
          <Text style={s.pcTokenLetter}>{symbol[0]}</Text>
        </LinearGradient>
        <Text style={s.pcSymbol}>{symbol}/USDT</Text>
        <MaterialCommunityIcons name="chart-line" size={20} color={up ? T.positive : T.negative} style={{ marginLeft: "auto" }} />
      </View>
      <Text style={s.pcPrice}>{formatPrice(price)}</Text>
      <View style={s.pcChangeRow}>
        {hasChange ? (
          <>
            <MaterialCommunityIcons name={up ? "arrow-top-right" : "arrow-bottom-right"} size={16} color={up ? T.positive : T.negative} />
            <Text style={[s.pcChangeText, { color: up ? T.positive : T.negative }]}> {up ? "+" : ""}{(change * 100).toFixed(2)}% (24h)</Text>
          </>
        ) : (
          <Text style={s.pcChangeNeutral}>实时价格已更新</Text>
        )}
      </View>
      <View style={s.pcActions}>
        <Pressable style={s.pcBtnOutline} onPress={onDetails}><Text style={s.pcBtnOutlineTxt}>查看详情</Text></Pressable>
        <Pressable style={s.pcBtnFill} onPress={onTrade}><LinearGradient colors={[T.purple1, T.purple3]} style={s.pcBtnGrad}><Text style={s.pcBtnFillTxt}>立即交易</Text></LinearGradient></Pressable>
      </View>
    </View>
  );
}

function DepositCard({ address, networkLabel, chainKind }: { address: string; networkLabel: string; chainKind: "evm" | "solana" }) {
  return (
    <View style={s.depositCard}>
      <Text style={s.depositEyebrow}>{chainKind === "solana" ? "Solana 充值地址" : "EVM 充值地址"}</Text>
      <Text style={s.depositTitle}>{networkLabel}</Text>
      <View style={s.depositAddressWrap}>
        <Text style={s.depositAddressMono}>{maskAddress(address)}</Text>
      </View>
      <Text style={s.depositHint}>完整地址：{address}</Text>
    </View>
  );
}

function ActionCard({ card, onPrimary, onSecondary }: { card: Extract<ChatCard, { kind: "action" }>; onPrimary: () => void; onSecondary?: () => void }) {
  return (
    <View style={s.actionCard}>
      <Text style={s.depositEyebrow}>{card.eyebrow}</Text>
      <Text style={s.actionTitle}>{card.title}</Text>
      <Text style={s.actionDescription}>{card.description}</Text>
      <View style={s.pcActions}>
        {card.secondary ? (
          <Pressable style={s.pcBtnOutline} onPress={onSecondary}><Text style={s.pcBtnOutlineTxt}>{card.secondary.label}</Text></Pressable>
        ) : null}
        <Pressable style={s.pcBtnFill} onPress={onPrimary}><LinearGradient colors={[T.purple1, T.purple3]} style={s.pcBtnGrad}><Text style={s.pcBtnFillTxt}>{card.primary.label}</Text></LinearGradient></Pressable>
      </View>
    </View>
  );
}

function SwapCard({ card, onPrimaryAction, onSecondaryAction }: { card: Extract<ChatCard, { kind: "swap" }>; onPrimaryAction: () => void; onSecondaryAction: () => void }) {
  const tone = getSwapPhaseTone(card.phase);
  return (
    <View style={s.swapCard}>
      <View style={s.swapHead}>
        <View>
          <Text style={s.swapEyebrow}>一句话自动交易</Text>
          <Text style={s.swapTitle}>{card.amountDisplay} {card.fromSymbol} → {card.toSymbol}</Text>
        </View>
        <View style={[s.swapPhaseBadge, { backgroundColor: `${tone.color}18` }]}>
          <Text style={[s.swapPhaseText, { color: tone.color }]}>{tone.label}</Text>
        </View>
      </View>
      <Text style={s.swapMeta}>链路 {card.chainKind === "solana" ? "Solana" : "EVM"}</Text>
      <View style={s.swapMetricRow}>
        <View style={s.swapMetricCard}>
          <Text style={s.swapMetricLabel}>预估可得</Text>
          <Text style={s.swapMetricValue}>{card.quoteToAmount || "--"}</Text>
        </View>
        <View style={s.swapMetricCard}>
          <Text style={s.swapMetricLabel}>最少到账</Text>
          <Text style={s.swapMetricValue}>{card.minReceived || "--"}</Text>
        </View>
      </View>
      {card.txId ? <Text style={s.swapSubMeta}>任务 {maskAddress(card.txId)}</Text> : null}
      {card.orderId ? <Text style={s.swapSubMeta}>订单 {maskAddress(card.orderId)}</Text> : null}
      {card.txHash ? <Text style={s.swapSubMeta}>交易哈希 {maskAddress(card.txHash)}</Text> : null}
      {card.errorMessage ? <Text style={s.swapError}>{card.errorMessage}</Text> : null}
      <View style={s.swapActions}>
        <Pressable style={s.pcBtnOutline} onPress={onSecondaryAction}><Text style={s.pcBtnOutlineTxt}>{card.phase === "failed" ? "换个指令" : "查看钱包"}</Text></Pressable>
        <Pressable style={s.pcBtnFill} onPress={onPrimaryAction}><LinearGradient colors={[T.purple1, T.purple3]} style={s.pcBtnGrad}><Text style={s.pcBtnFillTxt}>{card.phase === "success" ? "继续交易" : card.phase === "failed" ? "查看行情" : "策略中心"}</Text></LinearGradient></Pressable>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ q?: string; source?: string }>();
  const [tab, setTab] = useState<"chat" | "community">("chat");
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(WALLET_STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as WalletSnapshot) : null;

        if (parsed?.evmAddress || parsed?.solanaAddress) {
          if (mounted) setWallet(parsed);
          return;
        }

        const me = await getMe();
        if (!mounted || (!me.wallet?.evmAddress && !me.wallet?.solanaAddress)) return;

        const restoredWallet: WalletSnapshot = {
          email: me.wallet.email ?? me.email ?? undefined,
          evmAddress: me.wallet.evmAddress ?? "",
          solanaAddress: me.wallet.solanaAddress ?? "",
          mockMode: false,
        };
        setWallet(restoredWallet);
        await AsyncStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify({ ...restoredWallet, updatedAt: new Date().toISOString() }));
      } catch (error) {
        console.warn("Load wallet snapshot failed:", error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof params.q === "string" && params.q.trim()) {
      setInput(params.q.trim());
      setTab("chat");
    }
  }, [params.q]);

  const push = useCallback((newMsgs: ChatMessage[]) => {
    setMsgs((prev) => [...prev, ...newMsgs]);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const appendAssistant = useCallback((content: string, card?: ChatCard) => {
    push([{ id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, role: "assistant", content, card }]);
  }, [push]);

  const handleSwapFlow = useCallback(async (text: string, aiReply: string, quickIntent?: QuickSwapIntent | null) => {
    let activeWallet = wallet;

    if (!activeWallet || activeWallet.mockMode || (!activeWallet.evmAddress && !activeWallet.solanaAddress)) {
      try {
        const me = await getMe();
        if (me.wallet?.evmAddress || me.wallet?.solanaAddress) {
          activeWallet = {
            email: me.wallet.email ?? me.email ?? undefined,
            evmAddress: me.wallet.evmAddress ?? "",
            solanaAddress: me.wallet.solanaAddress ?? "",
            mockMode: false,
          };
          setWallet(activeWallet);
          await AsyncStorage.setItem(
            WALLET_STORAGE_KEY,
            JSON.stringify({ ...activeWallet, updatedAt: new Date().toISOString() }),
          );
        }
      } catch (error) {
        console.warn("Restore wallet before swap failed:", error);
      }
    }

    if (!activeWallet || activeWallet.mockMode || (!activeWallet.evmAddress && !activeWallet.solanaAddress)) {
      appendAssistant("", {
        kind: "action",
        eyebrow: "需要登录",
        title: "先恢复 Agent Wallet",
        description: "登录后就能直接走自动交易工作流，不会再反复追问。",
        primary: { label: "立即登录", route: "/" },
        secondary: { label: "查看钱包", route: "/(tabs)/wallet" },
      });
      return;
    }

    const parsedIntent = quickIntent ?? parseQuickSwapIntent(text);
    const remoteIntent = parsedIntent ? null : await parseDexSwapIntent(text);
    const finalIntent = parsedIntent ?? (remoteIntent?.intent.action === "swap" ? remoteIntent.intent : null);

    if (!finalIntent) {
      appendAssistant("", {
        kind: "action",
        eyebrow: "需要更明确的交易参数",
        title: "直接点一个示例继续",
        description: "我会按固定交易工作流自动预览，不再来回追问。",
        primary: { label: "100 USDT 换 ETH", prompt: "100 USDT 换 ETH" },
        secondary: { label: "50 USDT 换 BTC", prompt: "50 USDT 换 BTC" },
      });
      return;
    }

    const resolved = resolveSwapConfig(finalIntent, activeWallet);
    if (!resolved) {
      appendAssistant("", {
        kind: "action",
        eyebrow: "当前交易链路未接入",
        title: `${finalIntent.fromSymbol || "FROM"} → ${finalIntent.toSymbol || "TO"} 还不能自动执行`,
        description: "先查看行情或改用主流资产，我会继续按固定流程返回交易卡片。",
        primary: { label: "查看行情", route: "/(tabs)/market" },
        secondary: { label: "改用 ETH 示例", prompt: "100 USDT 换 ETH" },
      });
      return;
    }

    const payload = {
      chainIndex: resolved.chainIndex,
      amount: resolved.amount,
      displayAmount: resolved.displayAmount,
      fromTokenAddress: resolved.fromConfig.address,
      toTokenAddress: resolved.toConfig.address,
      fromTokenSymbol: resolved.fromConfig.symbol,
      toTokenSymbol: resolved.toConfig.symbol,
      userWalletAddress: resolved.userWalletAddress,
      chainKind: resolved.chainKind,
    } as const;

    const [preview, execution] = await Promise.all([
      previewOnchainSwap(payload).catch(() => null),
      executeOnchainSwap({ ...payload, slippagePercent: "0.5" }),
    ]);
    const txAwareExecution = execution as unknown as Record<string, unknown>;
    const executionError = typeof txAwareExecution.error === "string" ? txAwareExecution.error : undefined;

    appendAssistant(
      aiReply || (execution.phase === "awaiting_confirmation"
        ? "交易已准备好，等待钱包确认。"
        : "交易工作流已启动。"),
      {
        kind: "swap",
        phase: execution.phase,
        amountDisplay: resolved.displayAmount,
        fromSymbol: resolved.fromConfig.symbol,
        toSymbol: resolved.toConfig.symbol,
        chainKind: resolved.chainKind,
        quoteToAmount: preview?.quote?.toAmount ? `${preview.quote.toAmount} ${resolved.toConfig.symbol}` : undefined,
        minReceived: preview?.quote?.minReceived ? `${preview.quote.minReceived} ${resolved.toConfig.symbol}` : undefined,
        orderId: execution.orderId,
        txHash: execution.txHash,
        txId: typeof txAwareExecution.txId === "string" ? txAwareExecution.txId : undefined,
        errorMessage: execution.phase === "failed" ? executionError || "交易执行失败，请稍后重试。" : undefined,
      },
    );
  }, [appendAssistant, wallet]);

  const submitMessage = useCallback(async (rawText: string) => {
    const text = rawText.trim();
    if (!text || busy) return;
    push([{ id: `u-${Date.now()}`, role: "user", content: text }]);
    setBusy(true);

    try {
      const quickSwapIntent = parseQuickSwapIntent(text);
      if (quickSwapIntent) {
        appendAssistant("正在准备交易...");
        await handleSwapFlow(text, "", quickSwapIntent);
        return;
      }

      const ai = await parseChatAiIntent({ message: text, wallet: wallet ?? undefined });
      if (!("intent" in ai) || !ai.intent) {
        appendAssistant("", {
          kind: "action",
          eyebrow: "策略链路已识别",
          title: "进入自动化策略流程",
          description: "这类请求我会直接带你进入策略中心，不再停留在文本追问。",
          primary: { label: "查看策略中心", route: "/(tabs)/community" },
          secondary: { label: "继续对话", prompt: "帮我追踪 BTC 信号" },
        });
        return;
      }

      if (ai.intent.action === "deposit" && ai.deposit?.address) {
        appendAssistant("", {
          kind: "deposit",
          address: String(ai.deposit.address),
          networkLabel: String(ai.deposit.networkLabel || "请充值到当前 Agent Wallet 地址"),
          chainKind: ai.deposit.chainKind === "solana" ? "solana" : "evm",
        });
      } else if (ai.intent.action === "market" && ai.intent.priceSymbol && ai.intent.priceText) {
        const priceNum = parseFloat(ai.intent.priceText.replace(/[^0-9.]/g, "")) || 0;
        appendAssistant("", { kind: "price", symbol: ai.intent.priceSymbol, price: priceNum, change: null });
      } else if (ai.intent.action === "swap") {
        appendAssistant("正在准备交易...");
        await handleSwapFlow(text, ai.intent.reply || "交易工作流已识别。");
      } else if (ai.intent.action === "earn") {
        appendAssistant("", {
          kind: "action",
          eyebrow: "理财工作流",
          title: "已准备好下一步操作",
          description: "点一下就进入赚币页，继续按卡片流程完成。",
          primary: { label: "前往理财", route: "/earn" },
          secondary: { label: "查看行情", route: "/(tabs)/market" },
        });
      } else {
        appendAssistant(ai.intent.reply || "已收到，我会继续按固定工作流处理。", ai.intent.action === "general" ? {
          kind: "action",
          eyebrow: "下一步",
          title: "选择你要继续的方向",
          description: "固定流程我会直接执行，避免重复确认。",
          primary: { label: "看 BTC 行情", prompt: "BTC 价格" },
          secondary: { label: "开始交易", prompt: "100 USDT 换 ETH" },
        } : undefined);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "网络错误";
      const normalizedMessage = /network request failed/i.test(message)
        ? "网络连接失败，请确认当前安装包可以访问线上服务后再重试。"
        : message;
      appendAssistant(normalizedMessage);
    } finally {
      setBusy(false);
    }
  }, [appendAssistant, busy, handleSwapFlow, push, wallet]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    await submitMessage(text);
  }, [busy, input, submitMessage]);


  const triggerWorkflowButton = useCallback((button?: WorkflowButton) => {
    if (!button) return;
    if (button.prompt) {
      setInput("");
      void submitMessage(button.prompt);
      return;
    }
    if (button.route) {
      router.push(button.route as never);
    }
  }, [router, submitMessage]);

  const onQuick = useCallback((key: string) => {
    if (key === "finance") {
      router.push("/earn");
      return;
    }
    if (key === "market") {
      router.push("/(tabs)/market");
      return;
    }
    if (key === "strategy") {
      router.push("/(tabs)/community");
      return;
    }

    const map: Record<string, string> = {
      trade: "100 USDT 换 ETH",
    };
    if (map[key]) {
      setInput("");
      void submitMessage(map[key]);
    }
  }, [router, submitMessage]);

  const renderMsg = useCallback(({ item }: { item: ChatMessage }) => {
    if (item.role === "user") {
      return (
        <View style={s.uRow}>
          <View style={s.uBubble}><Text style={s.uTxt}>{item.content}</Text></View>
        </View>
      );
    }

    const card = item.card;

    if (card?.kind === "price") {
      return (
        <View style={s.aRow}>
          <PriceCard
            symbol={card.symbol}
            price={card.price}
            change={card.change}
            onDetails={() => router.push("/(tabs)/market")}
            onTrade={() => void submitMessage(`买入 100 U 的 ${card.symbol}`)}
          />
        </View>
      );
    }

    if (card?.kind === "deposit") {
      return (
        <View style={s.aRow}>
          <DepositCard address={card.address} networkLabel={card.networkLabel} chainKind={card.chainKind} />
        </View>
      );
    }

    if (card?.kind === "swap") {
      return (
        <View style={s.aRow}>
          <SwapCard
            card={card}
            onPrimaryAction={() => {
              if (card.phase === "failed") {
                router.push("/(tabs)/market");
                return;
              }
              if (card.phase === "success") {
                void submitMessage(`买入 100 U 的 ${card.toSymbol}`);
                return;
              }
              router.push("/(tabs)/community");
            }}
            onSecondaryAction={() => {
              if (card.phase === "failed") {
                void submitMessage("100 USDT 换 ETH");
                return;
              }
              router.push("/(tabs)/wallet");
            }}
          />
        </View>
      );
    }

    if (card?.kind === "action") {
      return (
        <View style={s.aRow}>
          <ActionCard
            card={card}
            onPrimary={() => triggerWorkflowButton(card.primary)}
            onSecondary={card.secondary ? () => triggerWorkflowButton(card.secondary) : undefined}
          />
        </View>
      );
    }

    return (
      <View style={s.aRow}>
        <View style={s.aBubble}><Text style={s.aTxt}>{item.content}</Text></View>
      </View>
    );
  }, [router, submitMessage, triggerWorkflowButton]);

  const emptySubtitle = useMemo(() => {
    if (params.source === "strategy-center") {
      return "试试说“100 USDT 换 ETH”或“帮我追踪 ETH 信号并自动执行”";
    }
    return '试试说 "BTC 价格" 或 "100 USDT 换 ETH"';
  }, [params.source]);

  return (
    <View style={s.root}>
      <LinearGradient colors={[T.bg1, T.bg2, T.bg3]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={Platform.OS === "ios" ? 12 : insets.top + 12}>
          <View style={s.hdr}>
            <Pressable style={s.hdrBtn} onPress={() => router.push("/(tabs)/wallet")}>
              <MaterialCommunityIcons name="wallet-outline" size={22} color={T.txt1} />
            </Pressable>
            <View style={s.tabSwitch}>
              {(["chat", "community"] as const).map((t) => (
                <Pressable
                  key={t}
                  style={[s.tabItem, tab === t && s.tabOn]}
                  onPress={() => {
                    setTab(t);
                    if (t === "community") {
                      router.push("/(tabs)/community");
                    }
                  }}
                >
                  <Text style={[s.tabTxt, tab === t && s.tabOnTxt]}>{t === "chat" ? "对话" : "策略中心"}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={s.hdrAvatar} onPress={() => router.push("/(tabs)/profile")}>
              <Image source={require("@/assets/images/hwallet-official-logo.png")} style={s.avatarImg} />
            </Pressable>
          </View>

          <View style={s.body}>
            {msgs.length === 0 ? (
              <View style={s.empty}>
                <Image source={require("@/assets/images/hwallet-official-logo.png")} style={s.dolphin} resizeMode="contain" />
                <Text style={s.emptyTip}>你好，我是 H Wallet AI 助手</Text>
                <Text style={s.emptySub}>{emptySubtitle}</Text>
              </View>
            ) : (
              <FlatList
                ref={listRef}
                data={msgs}
                keyExtractor={(i) => i.id}
                renderItem={renderMsg}
                contentContainerStyle={s.msgList}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
              />
            )}
          </View>

          <View style={[s.bottom, { paddingBottom: Platform.OS === "android" ? Math.max(insets.bottom, 16) : Math.max(insets.bottom, 12) }]}>
            <View style={s.qRow}>
              {QUICK_ACTIONS.map((a) => (
                <Pressable key={a.key} style={s.qItem} onPress={() => onQuick(a.key)}>
                  <View style={s.qIcon}>
                    <MaterialCommunityIcons name={a.icon} size={24} color={T.purple2} />
                  </View>
                  <Text style={s.qLabel}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={s.inputBar}>
              <TextInput
                style={s.input}
                value={input}
                onChangeText={setInput}
                placeholder="输入一句话，让 AI 帮你交易、看行情或追踪信号..."
                placeholderTextColor={T.txt3}
                multiline
                maxLength={500}
              />
              <Pressable onPress={handleSend} disabled={busy}>
                <LinearGradient colors={[T.purple1, T.purple3]} style={s.sendBtn}>
                  {busy ? <ActivityIndicator color={T.white} size="small" /> : <MaterialCommunityIcons name="send" size={20} color={T.white} />}
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  hdr: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  hdrBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: T.glass, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: T.glassBorder },
  hdrAvatar: { width: 44, height: 44, borderRadius: 22, overflow: "hidden", borderWidth: 2, borderColor: T.purple2 },
  avatarImg: { width: "100%", height: "100%" },
  tabSwitch: { flexDirection: "row", backgroundColor: T.glass, borderRadius: 24, padding: 4, borderWidth: 1.5, borderColor: T.glassBorder },
  tabItem: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  tabOn: { backgroundColor: T.purple3 },
  tabTxt: { fontSize: 15, fontWeight: "600", color: T.txt2 },
  tabOnTxt: { color: T.white },
  body: { flex: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 80 },
  dolphin: { width: 160, height: 160, marginBottom: 20 },
  emptyTip: { fontSize: 17, fontWeight: "700", color: T.txt1, marginBottom: 6 },
  emptySub: { fontSize: 14, color: T.txt2, textAlign: "center", paddingHorizontal: 30 },
  msgList: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  uRow: { alignItems: "flex-end", marginBottom: 14 },
  uBubble: { maxWidth: "78%", backgroundColor: T.glass, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 22, borderBottomRightRadius: 6, borderWidth: 1.5, borderColor: T.glassBorder },
  uTxt: { fontSize: 15, color: T.txt1, lineHeight: 22 },
  aRow: { alignItems: "flex-start", marginBottom: 14 },
  aBubble: { maxWidth: "85%", backgroundColor: "rgba(255,255,255,0.75)", paddingHorizontal: 18, paddingVertical: 14, borderRadius: 22, borderBottomLeftRadius: 6, borderWidth: 1.5, borderColor: T.glassBorder },
  aTxt: { fontSize: 15, color: T.txt1, lineHeight: 22 },
  priceCard: { width: SW - 80, borderRadius: 24, padding: 20, borderWidth: 1.5, borderColor: T.glassBorder, shadowColor: T.purple3, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 6, overflow: "hidden" },
  depositCard: { width: SW - 80, borderRadius: 24, padding: 20, borderWidth: 1.5, borderColor: T.glassBorder, backgroundColor: "rgba(255,255,255,0.92)", shadowColor: T.purple3, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 6 },
  actionCard: { width: SW - 80, borderRadius: 24, padding: 20, borderWidth: 1.5, borderColor: T.glassBorder, backgroundColor: "rgba(255,255,255,0.94)", shadowColor: T.purple3, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 6, gap: 10 },
  swapCard: { width: SW - 80, borderRadius: 24, padding: 20, borderWidth: 1.5, borderColor: T.glassBorder, backgroundColor: "rgba(255,255,255,0.94)", shadowColor: T.purple3, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 6, gap: 12 },
  depositEyebrow: { fontSize: 12, fontWeight: "700", color: T.purple2, marginBottom: 8 },
  depositTitle: { fontSize: 16, fontWeight: "700", color: T.txt1, lineHeight: 22 },
  depositAddressWrap: { marginTop: 14, paddingHorizontal: 14, paddingVertical: 16, borderRadius: 16, backgroundColor: "rgba(124,58,237,0.08)", borderWidth: 1, borderColor: "rgba(124,58,237,0.12)" },
  depositAddressMono: { fontSize: 15, fontWeight: "700", color: T.txt1 },
  depositHint: { fontSize: 12, lineHeight: 18, color: T.txt2, marginTop: 12 },
  actionTitle: { fontSize: 18, fontWeight: "800", color: T.txt1, lineHeight: 24 },
  actionDescription: { fontSize: 14, lineHeight: 22, color: T.txt2 },
  pcHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  pcTokenIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  pcTokenLetter: { fontSize: 16, fontWeight: "800", color: T.white },
  pcSymbol: { fontSize: 16, fontWeight: "700", color: T.txt1 },
  pcPrice: { fontSize: 30, fontWeight: "800", color: T.txt1, marginTop: 14, letterSpacing: -0.5 },
  pcChangeRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  pcChangeText: { fontSize: 14, fontWeight: "600" },
  pcChangeNeutral: { fontSize: 13, fontWeight: "600", color: T.txt2 },
  pcActions: { flexDirection: "row", gap: 12, marginTop: 18 },
  pcBtnOutline: { flex: 1, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(139,92,246,0.2)", backgroundColor: T.glass },
  pcBtnOutlineTxt: { fontSize: 14, fontWeight: "600", color: T.txt2 },
  pcBtnFill: { flex: 1, height: 42, borderRadius: 14, overflow: "hidden" },
  pcBtnGrad: { flex: 1, alignItems: "center", justifyContent: "center" },
  pcBtnFillTxt: { fontSize: 14, fontWeight: "700", color: T.white },
  swapHead: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  swapEyebrow: { fontSize: 12, fontWeight: "700", color: T.purple2, marginBottom: 6 },
  swapTitle: { fontSize: 18, fontWeight: "800", color: T.txt1 },
  swapMeta: { fontSize: 12, color: T.txt2 },
  swapPhaseBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, alignSelf: "flex-start" },
  swapPhaseText: { fontSize: 12, fontWeight: "700" },
  swapMetricRow: { flexDirection: "row", gap: 10 },
  swapMetricCard: { flex: 1, backgroundColor: "rgba(124,58,237,0.06)", borderRadius: 16, padding: 12, gap: 6 },
  swapMetricLabel: { fontSize: 12, color: T.txt2 },
  swapMetricValue: { fontSize: 15, fontWeight: "700", color: T.txt1 },
  swapSubMeta: { fontSize: 12, lineHeight: 18, color: T.txt2 },
  swapError: { fontSize: 12, lineHeight: 18, color: T.negative },
  swapActions: { flexDirection: "row", gap: 12 },
  bottom: { paddingTop: 12, paddingHorizontal: 16, backgroundColor: "rgba(245,240,255,0.9)" },
  qRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  qItem: { alignItems: "center", flex: 1 },
  qIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: T.glass, borderWidth: 1.5, borderColor: T.glassBorder, alignItems: "center", justifyContent: "center", shadowColor: T.purple3, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  qLabel: { fontSize: 12, fontWeight: "700", color: T.txt2, marginTop: 6 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 10, backgroundColor: T.glass, borderRadius: 28, borderWidth: 1.5, borderColor: T.glassBorder, paddingLeft: 18, paddingRight: 6, paddingVertical: 6, shadowColor: T.purple3, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  input: { flex: 1, fontSize: 15, color: T.txt1, paddingVertical: 10, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
