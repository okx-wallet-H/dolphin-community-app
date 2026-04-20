import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getMarketSnapshotByMcp,
  type MarketSnapshot,
  type StoredWalletSnapshot,
} from "@/lib/_core/api";

const WALLET_STORAGE_KEY = "hwallet-agent-wallet";

// Design colors matching the mockup exactly
const COLORS = {
  bgStart: "#FFFFFF",
  bgMid: "#F8F5FF",
  bgEnd: "#F0EBFF",
  primary: "#7C3AED",
  primaryLight: "#A78BFA",
  text: "#1F1F3D",
  textSecondary: "#6B6B8D",
  positive: "#10B981",
  negative: "#EF4444",
  white: "#FFFFFF",
  cardBg: "rgba(255,255,255,0.92)",
  tabBg: "rgba(255,255,255,0.85)",
  tabActive: "#7C3AED",
};

// Quick action buttons matching the mockup
const QUICK_ACTIONS = [
  { key: "finance", icon: "currency-usd", label: "理财", color: "#7C3AED" },
  { key: "trade", icon: "chart-line", label: "交易", color: "#7C3AED" },
  { key: "market", icon: "chart-bar", label: "行情", color: "#7C3AED" },
  { key: "strategy", icon: "cog-outline", label: "策略", color: "#7C3AED" },
];

type PriceCardPayload = { snapshot: MarketSnapshot };
type ChatCard = { kind: "price"; payload: PriceCardPayload };
type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  card?: ChatCard;
};

const initialMessages: ChatMessage[] = [];

function formatPrice(value: number) {
  if (value >= 1000) return `$ ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$ ${value.toFixed(4)}`;
}
function formatChange(change: number | null) {
  if (change === null || !Number.isFinite(change)) return "--";
  const percent = change * 100;
  return `${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%`;
}

// Price Card Component matching the mockup
function PriceCard({ snapshot }: { snapshot: MarketSnapshot }) {
  const price = Number(snapshot.price) || 0;
  const change24h = snapshot.change24h;
  const isPositive = (change24h ?? 0) >= 0;
  const high = Number((snapshot as any).high24h) || price * 1.01;
  const low = Number((snapshot as any).low24h) || price * 0.99;
  const volume = Number(snapshot.volume24h) || 0;

  return (
    <View style={s.priceCard}>
      {/* Header */}
      <View style={s.priceCardHeader}>
        <View style={s.priceCardToken}>
          <View style={s.tokenIconSmall}>
            <MaterialCommunityIcons name="bitcoin" size={20} color="#F7931A" />
          </View>
          <Text style={s.priceCardSymbol}>{snapshot.symbol}/USDT</Text>
        </View>
        <View style={s.priceCardChart}>
          <MaterialCommunityIcons name="chart-line" size={24} color={isPositive ? COLORS.positive : COLORS.negative} />
        </View>
        <MaterialCommunityIcons name="star-outline" size={20} color={COLORS.primary} />
      </View>

      {/* Price */}
      <View style={s.priceCardMain}>
        <Text style={s.priceCardValue}>{formatPrice(price)}</Text>
        <View style={s.priceCardChange}>
          <MaterialCommunityIcons name={isPositive ? "arrow-up" : "arrow-down"} size={16} color={isPositive ? COLORS.positive : COLORS.negative} />
          <Text style={[s.priceCardChangeText, { color: isPositive ? COLORS.positive : COLORS.negative }]}>
            {formatChange(change24h)} (24h)
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View style={s.priceCardStats}>
        <View style={s.priceCardStat}>
          <Text style={s.priceCardStatLabel}>最高价 (High)</Text>
          <Text style={s.priceCardStatValue}>$ {high.toLocaleString("en-US", { minimumFractionDigits: 2 })}</Text>
        </View>
        <View style={s.priceCardStat}>
          <Text style={s.priceCardStatLabel}>最低价 (Low)</Text>
          <Text style={s.priceCardStatValue}>$ {low.toLocaleString("en-US", { minimumFractionDigits: 2 })}</Text>
        </View>
        <View style={s.priceCardStat}>
          <Text style={s.priceCardStatLabel}>成交量 (Vol)</Text>
          <Text style={s.priceCardStatValue}>{(volume / 1e9).toFixed(2)}B USDT</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={s.priceCardActions}>
        <Pressable style={s.priceCardBtn}>
          <Text style={s.priceCardBtnText}>查看详情</Text>
        </Pressable>
        <Pressable style={[s.priceCardBtn, s.priceCardBtnPrimary]}>
          <Text style={s.priceCardBtnPrimaryText}>立即交易</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"chat" | "community">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  const appendMessages = useCallback((nextMessages: ChatMessage[]) => {
    setMessages((prev) => [...prev, ...nextMessages]);
    requestAnimationFrame(() => { flatListRef.current?.scrollToEnd({ animated: true }); });
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || submitting) return;

    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: "user", content: text };
    appendMessages([userMsg]);
    setInput("");
    setSubmitting(true);

    try {
      // Check if asking for price
      const priceMatch = text.match(/(\bBTC\b|\bETH\b|\bSOL\b|比特币|以太坊)/i);
      if (priceMatch) {
        const symbolMap: Record<string, string> = { btc: "BTC", eth: "ETH", sol: "SOL", 比特币: "BTC", 以太坊: "ETH" };
        const symbol = symbolMap[priceMatch[1].toLowerCase()] || "BTC";
        const snapshot = await getMarketSnapshotByMcp(symbol);
        appendMessages([{
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: `已为你查询 ${symbol} 的实时价格`,
          card: { kind: "price", payload: { snapshot } },
        }]);
      } else {
        appendMessages([{
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: "你可以问我代币价格、资产查询、Swap交易等问题。试试说「BTC价格」",
        }]);
      }
    } catch (error) {
      appendMessages([{
        id: `assistant-error-${Date.now()}`,
        role: "assistant",
        content: error instanceof Error ? error.message : "请求失败，请稍后重试",
      }]);
    } finally {
      setSubmitting(false);
    }
  }, [input, submitting, appendMessages]);

  const handleQuickAction = useCallback((key: string) => {
    const prompts: Record<string, string> = {
      finance: "有什么赚币产品推荐？",
      trade: "100 USDT 换 ETH",
      market: "BTC 价格",
      strategy: "设置 ETH 跌破 2200 提醒",
    };
    if (prompts[key]) {
      setInput(prompts[key]);
    }
  }, []);

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    if (item.role === "user") {
      return (
        <View style={s.userMsgRow}>
          <View style={s.userBubble}>
            <Text style={s.userBubbleText}>{item.content}</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={s.aiMsgRow}>
        {item.card?.kind === "price" ? (
          <PriceCard snapshot={item.card.payload.snapshot} />
        ) : (
          <View style={s.aiBubble}>
            <Text style={s.aiBubbleText}>{item.content}</Text>
          </View>
        )}
      </View>
    );
  }, []);

  return (
    <View style={s.root}>
      <LinearGradient colors={[COLORS.bgStart, COLORS.bgMid, COLORS.bgEnd]} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
        {/* Header with tabs */}
        <View style={s.header}>
          <Pressable style={s.headerIcon} onPress={() => router.push("/(tabs)/wallet")}>
            <MaterialCommunityIcons name="wallet-outline" size={22} color={COLORS.text} />
          </Pressable>

          <View style={s.tabContainer}>
            <Pressable style={[s.tab, activeTab === "chat" && s.tabActive]} onPress={() => setActiveTab("chat")}>
              <Text style={[s.tabText, activeTab === "chat" && s.tabTextActive]}>对话</Text>
            </Pressable>
            <Pressable style={[s.tab, activeTab === "community" && s.tabActive]} onPress={() => setActiveTab("community")}>
              <Text style={[s.tabText, activeTab === "community" && s.tabTextActive]}>社区</Text>
            </Pressable>
          </View>

          <Pressable style={s.headerAvatar}>
            <Image source={require("@/assets/images/hwallet-official-logo.png")} style={s.avatarImg} />
          </Pressable>
        </View>

        {/* Chat content */}
        <View style={s.chatContent}>
          {messages.length === 0 ? (
            <View style={s.welcomeContainer}>
              {/* Dolphin illustration */}
              <View style={s.dolphinContainer}>
                <Image
                  source={require("@/assets/images/dolphin-mascot.jpg")}
                  style={s.dolphinImage}
                  resizeMode="contain"
                />
              </View>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              contentContainerStyle={s.messageList}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>

        {/* Bottom panel */}
        <View style={s.bottomPanel}>
          {/* Quick actions */}
          <View style={s.quickActions}>
            {QUICK_ACTIONS.map((action) => (
              <Pressable key={action.key} style={s.quickBtn} onPress={() => handleQuickAction(action.key)}>
                <View style={s.quickIconWrap}>
                  <MaterialCommunityIcons name={action.icon as any} size={24} color={action.color} />
                </View>
                <Text style={s.quickLabel}>{action.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Input */}
          <View style={s.inputContainer}>
            <TextInput
              style={s.input}
              value={input}
              onChangeText={setInput}
              placeholder="输入消息..."
              placeholderTextColor={COLORS.textSecondary}
              multiline
              maxLength={500}
            />
            <Pressable style={s.sendBtn} onPress={handleSend} disabled={submitting}>
              <LinearGradient colors={[COLORS.primaryLight, COLORS.primary]} style={s.sendBtnGradient}>
                {submitting ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <MaterialCommunityIcons name="send" size={20} color={COLORS.white} />
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },

  // Header
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.8)",
  },
  avatarImg: { width: 40, height: 40 },

  // Tabs
  tabContainer: {
    flexDirection: "row",
    backgroundColor: COLORS.tabBg,
    borderRadius: 20,
    padding: 4,
  },
  tab: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 16,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.white,
  },

  // Chat content
  chatContent: { flex: 1 },
  welcomeContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  dolphinContainer: {
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  dolphinImage: { width: 150, height: 150, opacity: 0.8 },

  // Messages
  messageList: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 },
  userMsgRow: { alignItems: "flex-end", marginBottom: 16 },
  userBubble: {
    maxWidth: "80%",
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomRightRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.12)",
  },
  userBubbleText: { fontSize: 15, color: COLORS.text, lineHeight: 22 },
  aiMsgRow: { alignItems: "flex-start", marginBottom: 16 },
  aiBubble: {
    maxWidth: "85%",
    backgroundColor: "rgba(255,255,255,0.85)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
  },
  aiBubbleText: { fontSize: 15, color: COLORS.text, lineHeight: 22 },

  // Price Card
  priceCard: {
    width: 280,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.08)",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  priceCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  priceCardToken: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  tokenIconSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(247,147,26,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  priceCardSymbol: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },
  priceCardChart: { marginRight: 8 },
  priceCardMain: { marginTop: 12 },
  priceCardValue: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -1,
  },
  priceCardChange: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  priceCardChangeText: { fontSize: 14, fontWeight: "600" },
  priceCardStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  priceCardStat: { alignItems: "center" },
  priceCardStatLabel: { fontSize: 11, color: COLORS.textSecondary },
  priceCardStatValue: { fontSize: 13, fontWeight: "600", color: COLORS.text, marginTop: 2 },
  priceCardActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  priceCardBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.15)",
  },
  priceCardBtnText: { fontSize: 14, fontWeight: "600", color: COLORS.textSecondary },
  priceCardBtnPrimary: {
    backgroundColor: COLORS.primary,
    borderWidth: 0,
  },
  priceCardBtnPrimaryText: { fontSize: 14, fontWeight: "600", color: COLORS.white },

  // Bottom panel
  bottomPanel: {
    paddingTop: 12,
    paddingBottom: 34,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderTopWidth: 1,
    borderTopColor: "rgba(124,58,237,0.06)",
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
  },
  quickBtn: { alignItems: "center", gap: 6 },
  quickIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(124,58,237,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary },

  // Input
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.1)",
    paddingLeft: 18,
    paddingRight: 5,
    paddingVertical: 5,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    paddingVertical: 10,
    maxHeight: 100,
  },
  sendBtn: { borderRadius: 22, overflow: "hidden" },
  sendBtnGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
