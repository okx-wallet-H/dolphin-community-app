import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getSessionToken } from "@/lib/_core/auth";
import { getApiBaseUrl } from "@/constants/oauth";
import { getMe } from "@/lib/_core/api";

const { width: SW } = Dimensions.get("window");

/* ── Unified purple glass theme ── */
const T = {
  bg1: "#F5F0FF", bg2: "#EDE5FF", bg3: "#E4DAFF",
  purple1: "#B794F6", purple2: "#8B5CF6", purple3: "#7C3AED",
  txt1: "#1A1A2E", txt2: "#6B6B8D", txt3: "#9B8FC0",
  white: "#FFFFFF",
  glass: "rgba(255,255,255,0.88)",
  glassBorder: "rgba(255,255,255,0.95)",
  stroke: "rgba(139,92,246,0.12)",
  positive: "#22C55E", negative: "#EF4444",
};

const QUICK_ACTIONS = [
  { key: "finance", icon: "currency-usd" as const, label: "理财" },
  { key: "trade", icon: "swap-horizontal" as const, label: "交易" },
  { key: "market", icon: "chart-bar" as const, label: "行情" },
  { key: "strategy", icon: "cog-outline" as const, label: "策略" },
];

const API_BASE = getApiBaseUrl();
const WALLET_STORAGE_KEY = "hwallet-agent-wallet";

type WalletSnapshot = {
  email?: string;
  evmAddress?: string;
  solanaAddress?: string;
};

type ChatCard =
  | { kind: "price"; symbol: string; price: number; change: number }
  | { kind: "deposit"; address: string; networkLabel: string; chainKind: "evm" | "solana" };

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

/* ── Price Card Component ── */
function PriceCard({ symbol, price, change }: { symbol: string; price: number; change: number }) {
  const up = change >= 0;
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
        <MaterialCommunityIcons name={up ? "arrow-top-right" : "arrow-bottom-right"} size={16} color={up ? T.positive : T.negative} />
        <Text style={[s.pcChangeText, { color: up ? T.positive : T.negative }]}>
          {up ? "+" : ""}{(change * 100).toFixed(2)}% (24h)
        </Text>
      </View>
      <View style={s.pcActions}>
        <Pressable style={s.pcBtnOutline}><Text style={s.pcBtnOutlineTxt}>查看详情</Text></Pressable>
        <Pressable style={s.pcBtnFill}>
          <LinearGradient colors={[T.purple1, T.purple3]} style={s.pcBtnGrad}><Text style={s.pcBtnFillTxt}>立即交易</Text></LinearGradient>
        </Pressable>
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

/* ── Main Chat Screen ── */
export default function ChatScreen() {
  const router = useRouter();
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
        if (raw) {
          const parsed = JSON.parse(raw) as WalletSnapshot;
          if (mounted) {
            setWallet(parsed);
          }
          return;
        }

        const me = await getMe();
        if (!mounted || (!me.wallet?.evmAddress && !me.wallet?.solanaAddress)) {
          return;
        }

        const restoredWallet: WalletSnapshot = {
          email: me.wallet.email ?? me.email ?? undefined,
          evmAddress: me.wallet.evmAddress ?? '',
          solanaAddress: me.wallet.solanaAddress ?? '',
        };
        setWallet(restoredWallet);
        await AsyncStorage.setItem(
          WALLET_STORAGE_KEY,
          JSON.stringify({
            ...restoredWallet,
            updatedAt: new Date().toISOString(),
            mockMode: false,
          }),
        );
      } catch (error) {
        console.warn("Load wallet snapshot failed:", error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const push = useCallback((newMsgs: ChatMessage[]) => {
    setMsgs((prev) => [...prev, ...newMsgs]);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    push([{ id: `u-${Date.now()}`, role: "user", content: text }]);
    setInput("");
    setBusy(true);

    try {
      // Call GLM AI backend via chat/intent API
      const token = await getSessionToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/chat/intent`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message: text, wallet }),
      });
      const json = await res.json();

      // API 返回结构: { success, intent: { intent: { action, reply, priceSymbol, priceText }, earnPlan? } }
      const outerIntent = json.intent || json.data?.intent;
      const innerIntent = outerIntent?.intent;
      const reply = innerIntent?.reply || outerIntent?.reply || "";
      const action = innerIntent?.action || outerIntent?.action || "";
      const priceSymbol = innerIntent?.priceSymbol || "";
      const priceText = innerIntent?.priceText || "";
      const deposit = outerIntent?.deposit;

      if (json.success && reply) {
        if (action === "deposit" && deposit?.address) {
          push([{
            id: `a-${Date.now()}`,
            role: "assistant",
            content: reply,
            card: {
              kind: "deposit",
              address: String(deposit.address),
              networkLabel: String(deposit.networkLabel || "请充值到当前 Agent Wallet 地址"),
              chainKind: deposit.chainKind === "solana" ? "solana" : "evm",
            },
          }]);
        } else if (action === "market" && priceSymbol && priceText) {
          const priceNum = parseFloat(priceText.replace(/[^0-9.]/g, "")) || 0;
          push([{
            id: `a-${Date.now()}`, role: "assistant",
            content: reply,
            card: { kind: "price", symbol: priceSymbol, price: priceNum, change: 0.02 },
          }]);
        } else {
          push([{ id: `a-${Date.now()}`, role: "assistant", content: reply }]);
        }
      } else {
        push([{ id: `a-${Date.now()}`, role: "assistant", content: json.msg || "请求失败，请稍后重试" }]);
      }
    } catch (e) {
      push([{ id: `ae-${Date.now()}`, role: "assistant", content: e instanceof Error ? e.message : "网络错误" }]);
    } finally { setBusy(false); }
  }, [input, busy, push]);

  const onQuick = useCallback((key: string) => {
    const map: Record<string, string> = { finance: "有什么赚币产品推荐？", trade: "100 USDT 换 ETH", market: "BTC 价格", strategy: "设置 ETH 跌破 2200 提醒" };
    if (map[key]) setInput(map[key]);
  }, []);

  const renderMsg = useCallback(({ item }: { item: ChatMessage }) => {
    if (item.role === "user") {
      return (
        <View style={s.uRow}>
          <View style={s.uBubble}><Text style={s.uTxt}>{item.content}</Text></View>
        </View>
      );
    }
    return (
      <View style={s.aRow}>
        {item.card?.kind === "price" ? (
          <PriceCard symbol={item.card.symbol} price={item.card.price} change={item.card.change} />
        ) : item.card?.kind === "deposit" ? (
          <DepositCard address={item.card.address} networkLabel={item.card.networkLabel} chainKind={item.card.chainKind} />
        ) : (
          <View style={s.aBubble}><Text style={s.aTxt}>{item.content}</Text></View>
        )}
      </View>
    );
  }, []);

  return (
    <View style={s.root}>
      <LinearGradient colors={[T.bg1, T.bg2, T.bg3]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
        >
          {/* Header */}
          <View style={s.hdr}>
            <Pressable style={s.hdrBtn} onPress={() => router.push("/(tabs)/wallet")}>
              <MaterialCommunityIcons name="wallet-outline" size={22} color={T.txt1} />
            </Pressable>
            <View style={s.tabSwitch}>
              {(["chat", "community"] as const).map((t) => (
                <Pressable key={t} style={[s.tabItem, tab === t && s.tabOn]} onPress={() => setTab(t)}>
                  <Text style={[s.tabTxt, tab === t && s.tabOnTxt]}>{t === "chat" ? "对话" : "社区"}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={s.hdrAvatar} onPress={() => router.push("/(tabs)/profile")}>
              <Image source={require("@/assets/images/hwallet-official-logo.png")} style={s.avatarImg} />
            </Pressable>
          </View>

          {/* Chat content */}
          <View style={s.body}>
            {msgs.length === 0 ? (
              <View style={s.empty}>
                <Image source={require("@/assets/images/dolphin-mascot.jpg")} style={s.dolphin} resizeMode="contain" />
                <Text style={s.emptyTip}>你好，我是 H Wallet AI 助手</Text>
                <Text style={s.emptySub}>试试说 "BTC 价格" 或 "100 USDT 换 ETH"</Text>
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

          {/* Bottom: quick actions + input */}
          <View style={s.bottom}>
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
              <TextInput style={s.input} value={input} onChangeText={setInput}
                placeholder="输入消息..." placeholderTextColor={T.txt3} multiline maxLength={500} />
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
  root: { flex: 1 }, safe: { flex: 1 },
  // Header
  hdr: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  hdrBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: T.glass, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: T.glassBorder },
  hdrAvatar: { width: 44, height: 44, borderRadius: 22, overflow: "hidden", borderWidth: 2, borderColor: T.purple2 },
  avatarImg: { width: "100%", height: "100%" },
  // Tabs
  tabSwitch: { flexDirection: "row", backgroundColor: T.glass, borderRadius: 24, padding: 4, borderWidth: 1.5, borderColor: T.glassBorder },
  tabItem: { paddingHorizontal: 28, paddingVertical: 10, borderRadius: 20 },
  tabOn: { backgroundColor: T.purple3 },
  tabTxt: { fontSize: 15, fontWeight: "600", color: T.txt2 },
  tabOnTxt: { color: T.white },
  // Body
  body: { flex: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 80 },
  dolphin: { width: 160, height: 160, marginBottom: 20 },
  emptyTip: { fontSize: 17, fontWeight: "700", color: T.txt1, marginBottom: 6 },
  emptySub: { fontSize: 14, color: T.txt2 },
  // Messages
  msgList: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  uRow: { alignItems: "flex-end", marginBottom: 14 },
  uBubble: { maxWidth: "78%", backgroundColor: T.glass, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 22, borderBottomRightRadius: 6, borderWidth: 1.5, borderColor: T.glassBorder },
  uTxt: { fontSize: 15, color: T.txt1, lineHeight: 22 },
  aRow: { alignItems: "flex-start", marginBottom: 14 },
  aBubble: { maxWidth: "85%", backgroundColor: "rgba(255,255,255,0.75)", paddingHorizontal: 18, paddingVertical: 14, borderRadius: 22, borderBottomLeftRadius: 6, borderWidth: 1.5, borderColor: T.glassBorder },
  aTxt: { fontSize: 15, color: T.txt1, lineHeight: 22 },
  // Price / deposit card
  priceCard: { width: SW - 80, borderRadius: 24, padding: 20, borderWidth: 1.5, borderColor: T.glassBorder, shadowColor: T.purple3, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.10, shadowRadius: 16, elevation: 6, overflow: "hidden" },
  depositCard: { width: SW - 80, borderRadius: 24, padding: 20, borderWidth: 1.5, borderColor: T.glassBorder, backgroundColor: "rgba(255,255,255,0.92)", shadowColor: T.purple3, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.10, shadowRadius: 16, elevation: 6 },
  depositEyebrow: { fontSize: 12, fontWeight: "700", color: T.purple2, marginBottom: 8 },
  depositTitle: { fontSize: 16, fontWeight: "700", color: T.txt1, lineHeight: 22 },
  depositAddressWrap: { marginTop: 14, paddingHorizontal: 14, paddingVertical: 16, borderRadius: 16, backgroundColor: "rgba(124,58,237,0.08)", borderWidth: 1, borderColor: "rgba(124,58,237,0.12)" },
  depositAddressMono: { fontSize: 15, fontWeight: "700", color: T.txt1 },
  depositHint: { fontSize: 12, lineHeight: 18, color: T.txt2, marginTop: 12 },
  pcHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  pcTokenIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  pcTokenLetter: { fontSize: 16, fontWeight: "800", color: T.white },
  pcSymbol: { fontSize: 16, fontWeight: "700", color: T.txt1 },
  pcPrice: { fontSize: 30, fontWeight: "800", color: T.txt1, marginTop: 14, letterSpacing: -0.5 },
  pcChangeRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  pcChangeText: { fontSize: 14, fontWeight: "600" },
  pcActions: { flexDirection: "row", gap: 12, marginTop: 18 },
  pcBtnOutline: { flex: 1, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(139,92,246,0.2)", backgroundColor: T.glass },
  pcBtnOutlineTxt: { fontSize: 14, fontWeight: "600", color: T.txt2 },
  pcBtnFill: { flex: 1, height: 42, borderRadius: 14, overflow: "hidden" },
  pcBtnGrad: { flex: 1, alignItems: "center", justifyContent: "center" },
  pcBtnFillTxt: { fontSize: 14, fontWeight: "700", color: T.white },
  // Bottom
  bottom: { paddingTop: 12, paddingBottom: Platform.OS === "ios" ? 12 : 10, paddingHorizontal: 16, backgroundColor: "rgba(245,240,255,0.72)" },
  qRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  qItem: { alignItems: "center", flex: 1 },
  qIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: T.glass, borderWidth: 1.5, borderColor: T.glassBorder, alignItems: "center", justifyContent: "center", shadowColor: T.purple3, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  qLabel: { fontSize: 12, fontWeight: "700", color: T.txt2, marginTop: 6 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 10, backgroundColor: T.glass, borderRadius: 28, borderWidth: 1.5, borderColor: T.glassBorder, paddingLeft: 18, paddingRight: 6, paddingVertical: 6, shadowColor: T.purple3, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  input: { flex: 1, fontSize: 15, color: T.txt1, paddingVertical: 10, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
