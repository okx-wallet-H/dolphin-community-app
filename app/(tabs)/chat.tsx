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
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getMarketSnapshotByMcp,
  type MarketSnapshot,
} from "@/lib/_core/api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Purple gradient theme matching mockup
const COLORS = {
  // Background gradients
  bgTop: "#E8E0F0",
  bgMid: "#DED4F0", 
  bgBottom: "#D4C8F0",
  
  // Primary purple
  primary: "#6B4EE6",
  primaryDark: "#5A3DD6",
  primaryLight: "#8B6FF0",
  
  // Text
  text: "#2D1F4E",
  textSecondary: "#7A6B9E",
  textMuted: "#9B8FC0",
  
  // Accents
  positive: "#22C55E",
  negative: "#EF4444",
  white: "#FFFFFF",
  
  // Glass effects
  glassBg: "rgba(255,255,255,0.75)",
  glassLight: "rgba(255,255,255,0.9)",
  glassBorder: "rgba(255,255,255,0.6)",
  purpleGlass: "rgba(107,78,230,0.08)",
};

// Quick actions with purple icons
const QUICK_ACTIONS = [
  { key: "finance", icon: "currency-usd", label: "理财" },
  { key: "trade", icon: "swap-horizontal", label: "交易" },
  { key: "market", icon: "chart-bar", label: "行情" },
  { key: "strategy", icon: "cog", label: "策略" },
];

type PriceCardPayload = { snapshot: MarketSnapshot };
type ChatCard = { kind: "price"; payload: PriceCardPayload };
type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  card?: ChatCard;
};

function formatPrice(value: number) {
  if (value >= 1000) return `$ ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$ ${value.toFixed(4)}`;
}

function formatChange(change: number | null) {
  if (change === null || !Number.isFinite(change)) return "--";
  const percent = change * 100;
  return `${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%`;
}

// Premium Price Card Component
function PriceCard({ snapshot }: { snapshot: MarketSnapshot }) {
  const price = Number(snapshot.price) || 0;
  const change24h = snapshot.change24h;
  const isPositive = (change24h ?? 0) >= 0;
  const high = Number((snapshot as any).high24h) || price * 1.01;
  const low = Number((snapshot as any).low24h) || price * 0.99;
  const volume = Number(snapshot.volume24h) || 0;

  return (
    <View style={s.priceCard}>
      {/* Glass effect background */}
      <LinearGradient
        colors={["rgba(255,255,255,0.95)", "rgba(248,245,255,0.9)"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      {/* Header */}
      <View style={s.priceCardHeader}>
        <View style={s.priceCardToken}>
          <LinearGradient colors={["#F7931A", "#FFAB40"]} style={s.tokenIcon}>
            <MaterialCommunityIcons name="bitcoin" size={18} color={COLORS.white} />
          </LinearGradient>
          <Text style={s.priceCardSymbol}>{snapshot.symbol}/USDT</Text>
        </View>
        <View style={s.miniChart}>
          <MaterialCommunityIcons 
            name="chart-line" 
            size={22} 
            color={isPositive ? COLORS.positive : COLORS.negative} 
          />
        </View>
        <View style={s.starBtn}>
          <MaterialCommunityIcons name="star-four-points" size={18} color={COLORS.primary} />
        </View>
      </View>

      {/* Main Price */}
      <View style={s.priceCardMain}>
        <Text style={s.priceValue}>{formatPrice(price)}</Text>
        <View style={s.priceChange}>
          <MaterialCommunityIcons 
            name={isPositive ? "arrow-top-right" : "arrow-bottom-right"} 
            size={18} 
            color={isPositive ? COLORS.positive : COLORS.negative} 
          />
          <Text style={[s.priceChangeText, { color: isPositive ? COLORS.positive : COLORS.negative }]}>
            {formatChange(change24h)} (24h)
          </Text>
        </View>
      </View>

      {/* Stats Row */}
      <View style={s.statsRow}>
        <View style={s.statItem}>
          <Text style={s.statLabel}>最高价 (High)</Text>
          <Text style={s.statValue}>$ {high.toLocaleString("en-US", { minimumFractionDigits: 2 })}</Text>
        </View>
        <View style={s.statItem}>
          <Text style={s.statLabel}>最低价 (Low)</Text>
          <Text style={s.statValue}>$ {low.toLocaleString("en-US", { minimumFractionDigits: 2 })}</Text>
        </View>
        <View style={s.statItem}>
          <Text style={s.statLabel}>成交量 (Vol)</Text>
          <Text style={s.statValue}>{(volume / 1e9).toFixed(2)}B USDT</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={s.cardActions}>
        <Pressable style={s.cardBtnOutline}>
          <Text style={s.cardBtnOutlineText}>查看详情</Text>
        </Pressable>
        <Pressable style={s.cardBtnPrimary}>
          <LinearGradient 
            colors={[COLORS.primaryLight, COLORS.primary]} 
            style={s.cardBtnGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={s.cardBtnPrimaryText}>立即交易</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"chat" | "community">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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
    if (prompts[key]) setInput(prompts[key]);
  }, []);

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    if (item.role === "user") {
      return (
        <View style={s.userRow}>
          <View style={s.userBubble}>
            <Text style={s.userText}>{item.content}</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={s.aiRow}>
        {item.card?.kind === "price" ? (
          <PriceCard snapshot={item.card.payload.snapshot} />
        ) : (
          <View style={s.aiBubble}>
            <Text style={s.aiText}>{item.content}</Text>
          </View>
        )}
      </View>
    );
  }, []);

  return (
    <View style={s.container}>
      {/* Purple gradient background */}
      <LinearGradient 
        colors={[COLORS.bgTop, COLORS.bgMid, COLORS.bgBottom]} 
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <SafeAreaView style={s.safe} edges={["top"]}>
        {/* Header */}
        <View style={s.header}>
          <Pressable style={s.headerBtn} onPress={() => router.push("/(tabs)/wallet")}>
            <MaterialCommunityIcons name="wallet-outline" size={22} color={COLORS.text} />
          </Pressable>

          {/* Tab Switcher */}
          <View style={s.tabSwitcher}>
            <Pressable 
              style={[s.tab, activeTab === "chat" && s.tabActive]} 
              onPress={() => setActiveTab("chat")}
            >
              <Text style={[s.tabText, activeTab === "chat" && s.tabTextActive]}>对话</Text>
            </Pressable>
            <Pressable 
              style={[s.tab, activeTab === "community" && s.tabActive]} 
              onPress={() => setActiveTab("community")}
            >
              <Text style={[s.tabText, activeTab === "community" && s.tabTextActive]}>社区</Text>
            </Pressable>
          </View>

          <Pressable style={s.headerAvatar} onPress={() => router.push("/(tabs)/profile")}>
            <Image 
              source={require("@/assets/images/hwallet-official-logo.png")} 
              style={s.avatarImg} 
            />
          </Pressable>
        </View>

        {/* Main Content */}
        <View style={s.content}>
          {messages.length === 0 ? (
            <View style={s.emptyState}>
              <Image
                source={require("@/assets/images/dolphin-mascot.jpg")}
                style={s.dolphinImg}
                resizeMode="contain"
              />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              contentContainerStyle={s.msgList}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>

        {/* Bottom Section */}
        <View style={s.bottomSection}>
          {/* Quick Actions */}
          <View style={s.quickActions}>
            {QUICK_ACTIONS.map((action) => (
              <Pressable 
                key={action.key} 
                style={s.quickAction}
                onPress={() => handleQuickAction(action.key)}
              >
                <View style={s.quickIconBox}>
                  <MaterialCommunityIcons name={action.icon as any} size={26} color={COLORS.primary} />
                </View>
                <Text style={s.quickLabel}>{action.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Input Bar */}
          <View style={s.inputBar}>
            <TextInput
              style={s.input}
              value={input}
              onChangeText={setInput}
              placeholder="输入消息..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              maxLength={500}
            />
            <Pressable onPress={handleSend} disabled={submitting}>
              <LinearGradient 
                colors={[COLORS.primaryLight, COLORS.primary]}
                style={s.sendBtn}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
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
  container: { flex: 1 },
  safe: { flex: 1 },

  // Header
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.glassBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: COLORS.glassBg,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  avatarImg: { width: "100%", height: "100%" },

  // Tabs
  tabSwitcher: {
    flexDirection: "row",
    backgroundColor: COLORS.glassBg,
    borderRadius: 24,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  tab: {
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 20,
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

  // Content
  content: { flex: 1 },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 100,
  },
  dolphinImg: {
    width: 180,
    height: 180,
  },

  // Messages
  msgList: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 },
  userRow: { alignItems: "flex-end", marginBottom: 16 },
  userBubble: {
    maxWidth: "78%",
    backgroundColor: COLORS.glassLight,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 22,
    borderBottomRightRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  userText: { fontSize: 15, color: COLORS.text, lineHeight: 22 },
  aiRow: { alignItems: "flex-start", marginBottom: 16 },
  aiBubble: {
    maxWidth: "85%",
    backgroundColor: COLORS.glassBg,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 22,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  aiText: { fontSize: 15, color: COLORS.text, lineHeight: 22 },

  // Price Card
  priceCard: {
    width: SCREEN_WIDTH - 80,
    backgroundColor: COLORS.glassLight,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: "rgba(107,78,230,0.15)",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    overflow: "hidden",
  },
  priceCardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  priceCardToken: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  tokenIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  priceCardSymbol: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },
  miniChart: { marginRight: 12 },
  starBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.purpleGlass,
    alignItems: "center",
    justifyContent: "center",
  },
  priceCardMain: { marginTop: 16 },
  priceValue: {
    fontSize: 32,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -1,
  },
  priceChange: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  priceChangeText: { fontSize: 15, fontWeight: "600" },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(107,78,230,0.08)",
  },
  statItem: { alignItems: "center" },
  statLabel: { fontSize: 11, color: COLORS.textMuted, marginBottom: 4 },
  statValue: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  cardActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  cardBtnOutline: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.glassBg,
    borderWidth: 1.5,
    borderColor: "rgba(107,78,230,0.2)",
  },
  cardBtnOutlineText: { fontSize: 14, fontWeight: "600", color: COLORS.textSecondary },
  cardBtnPrimary: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    overflow: "hidden",
  },
  cardBtnGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBtnPrimaryText: { fontSize: 14, fontWeight: "700", color: COLORS.white },

  // Bottom Section
  bottomSection: {
    paddingTop: 16,
    paddingBottom: 34,
    paddingHorizontal: 16,
  },

  // Quick Actions
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  quickAction: {
    alignItems: "center",
    gap: 8,
  },
  quickIconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: COLORS.glassBg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  quickLabel: { 
    fontSize: 13, 
    fontWeight: "600", 
    color: COLORS.textSecondary,
  },

  // Input Bar
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    backgroundColor: COLORS.glassLight,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    paddingLeft: 20,
    paddingRight: 6,
    paddingVertical: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    paddingVertical: 10,
    maxHeight: 100,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
});
