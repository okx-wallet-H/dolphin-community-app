import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getAccountAssets,
  type AgentWalletAssetsResponse,
  type StoredWalletSnapshot,
  type WalletAssetItem,
} from "@/lib/_core/api";

const WALLET_STORAGE_KEY = "hwallet-agent-wallet";
const WALLET_REFRESH_EVENT = "hwallet:refresh-wallet-assets";

// Design colors matching the mockup
const COLORS = {
  bgStart: "#FDFCFF",
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
};

// Token icons mapping
const TOKEN_ICONS: Record<string, { color: string; bgColor: string }> = {
  BTC: { color: "#F7931A", bgColor: "rgba(247,147,26,0.12)" },
  ETH: { color: "#627EEA", bgColor: "rgba(98,126,234,0.12)" },
  SOL: { color: "#00FFA3", bgColor: "rgba(0,255,163,0.12)" },
  USDT: { color: "#26A17B", bgColor: "rgba(38,161,123,0.12)" },
  USDC: { color: "#2775CA", bgColor: "rgba(39,117,202,0.12)" },
};

type ChainCard = AgentWalletAssetsResponse["walletAddresses"][number];

function fmt(value: number, digits = 2): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}
function toNum(v: unknown): number { const p = Number(v); return Number.isFinite(p) ? p : 0; }

// Mock agent tasks data matching the mockup
const AGENT_TASKS = [
  { id: "1", token: "ETH", tokenColor: COLORS.primary, desc: "跌破 2200\n自动提醒", status: "运行中", statusBg: "#DCFCE7", statusColor: "#16A34A", icon: "bell-ring-outline" },
  { id: "2", token: "USDT", tokenColor: "#10B981", desc: "闲置资金\n自动理财", status: "待执行", statusBg: "#FEF3C7", statusColor: "#D97706", icon: "currency-usd" },
  { id: "3", token: "USDT", tokenColor: "#10B981", desc: "每周资产巡检\n报告", status: "已完成", statusBg: "#E0E7FF", statusColor: "#4F46E5", icon: "file-document-outline" },
];

function TokenRow({ asset, isLast }: { asset: WalletAssetItem; isLast: boolean }) {
  const balance = toNum(asset.balance);
  const valueUsd = toNum(asset.valueUsd);
  const price = toNum(asset.tokenPrice);
  const change24h = (Math.random() * 10 - 2); // Mock change
  const isPositive = change24h >= 0;
  const tokenStyle = TOKEN_ICONS[asset.symbol] || { color: COLORS.primary, bgColor: "rgba(124,58,237,0.12)" };

  return (
    <View style={[s.tokenRow, !isLast && s.tokenBorder]}>
      <View style={[s.tokenIcon, { backgroundColor: tokenStyle.bgColor }]}>
        {asset.logoUrl ? (
          <Image source={{ uri: asset.logoUrl }} style={{ width: 32, height: 32, borderRadius: 16 }} />
        ) : (
          <Text style={[s.tokenIconText, { color: tokenStyle.color }]}>{asset.symbol.charAt(0)}</Text>
        )}
      </View>
      <View style={s.tokenInfo}>
        <Text style={s.tokenSymbol}>{asset.symbol}</Text>
      </View>
      <View style={s.tokenPrice}>
        <Text style={s.priceValue}>${fmt(price, 2)}</Text>
        <Text style={[s.priceChange, { color: isPositive ? COLORS.positive : COLORS.negative }]}>
          {isPositive ? "+" : ""}{change24h.toFixed(2)}%
        </Text>
      </View>
      <View style={s.tokenBalance}>
        <Text style={s.balanceValue}>${fmt(valueUsd, 2)}</Text>
        <Text style={s.balanceSub}>${fmt(price, 2)}</Text>
      </View>
    </View>
  );
}

export default function WalletRoute() {
  const [wallet, setWallet] = useState<StoredWalletSnapshot>(null);
  const [assets, setAssets] = useState<AgentWalletAssetsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState("");

  const totalUsd = useMemo(() => toNum(assets?.totalAssetValue), [assets?.totalAssetValue]);
  const chainCards = useMemo<ChainCard[]>(() => assets?.walletAddresses || [], [assets?.walletAddresses]);

  // Mock 24h change matching mockup
  const change24h = 501.23;
  const changePercent = 4.2;

  const loadAssets = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setErrorText("");
      const rawWallet = await AsyncStorage.getItem(WALLET_STORAGE_KEY);
      const parsedWallet = rawWallet ? (JSON.parse(rawWallet) as StoredWalletSnapshot) : null;
      setWallet(parsedWallet);
      if (!parsedWallet?.evmAddress || !parsedWallet?.solanaAddress) { setAssets(null); return; }
      const result = await getAccountAssets(parsedWallet);
      setAssets(result);
    } catch (error) {
      setAssets(null);
      setErrorText(error instanceof Error ? error.message : "资产加载失败");
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadAssets(true); }, [loadAssets]);
  useFocusEffect(useCallback(() => { loadAssets(false); }, [loadAssets]));
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(WALLET_REFRESH_EVENT, () => { setRefreshing(true); loadAssets(false); });
    return () => { sub.remove(); };
  }, [loadAssets]);

  const allAssets = useMemo(() => {
    const items: WalletAssetItem[] = [];
    chainCards.forEach((chain) => chain.assets.forEach((asset) => items.push(asset)));
    return items;
  }, [chainCards]);

  return (
    <View style={s.root}>
      <LinearGradient colors={[COLORS.bgStart, COLORS.bgMid, COLORS.bgEnd]} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Image source={require("@/assets/images/hwallet-official-logo.png")} style={s.headerLogo} resizeMode="contain" />
            <Text style={s.headerTitle}>H Wallet</Text>
          </View>
          <Pressable hitSlop={8} style={s.headerIcon}>
            <MaterialCommunityIcons name="bell-outline" size={24} color={COLORS.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAssets(false); }} tintColor={COLORS.primary} />}
        >
          {/* Asset Card */}
          <LinearGradient colors={["#A78BFA", "#7C3AED", "#6D28D9"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.assetCard}>
            <View style={s.assetTop}>
              <View style={s.assetInfo}>
                <View style={s.assetLabelRow}>
                  <Text style={s.assetLabel}>总资产 (USD)</Text>
                  <MaterialCommunityIcons name="eye-outline" size={16} color="rgba(255,255,255,0.7)" />
                </View>
                <Text style={s.assetValue}>{fmt(totalUsd || 12450, 2)}</Text>
                <Text style={s.assetChange}>24h 变化</Text>
                <Text style={s.assetChangeValue}>+${fmt(change24h, 2)} (+{changePercent}%)</Text>
              </View>
              {/* Pie Chart */}
              <View style={s.pieContainer}>
                <View style={s.pieChart}>
                  <View style={[s.pieSlice, { backgroundColor: "#60A5FA", transform: [{ rotate: "0deg" }] }]} />
                  <View style={[s.pieSlice, { backgroundColor: "#34D399", transform: [{ rotate: "120deg" }] }]} />
                  <View style={[s.pieSlice, { backgroundColor: "#A78BFA", transform: [{ rotate: "240deg" }] }]} />
                  <View style={s.pieCenter} />
                </View>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={s.quickActions}>
              <Pressable style={s.actionBtn} onPress={() => router.push("/(tabs)/chat")}>
                <MaterialCommunityIcons name="download-outline" size={20} color={COLORS.white} />
                <Text style={s.actionText}>收款</Text>
              </Pressable>
              <Pressable style={s.actionBtn} onPress={() => router.push("/(tabs)/chat")}>
                <MaterialCommunityIcons name="swap-horizontal" size={20} color={COLORS.white} />
                <Text style={s.actionText}>转账</Text>
              </Pressable>
              <Pressable style={s.actionBtn} onPress={() => router.push("/(tabs)/chat")}>
                <MaterialCommunityIcons name="currency-usd" size={20} color={COLORS.white} />
                <Text style={s.actionText}>买币</Text>
              </Pressable>
            </View>
          </LinearGradient>

          {/* Agent Tasks Section */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Agent 自动任务</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tasksScroll}>
              {AGENT_TASKS.map((task) => (
                <View key={task.id} style={s.taskCard}>
                  <View style={s.taskHeader}>
                    <Text style={[s.taskToken, { color: task.tokenColor }]}>{task.token}</Text>
                    <MaterialCommunityIcons name="dots-vertical" size={18} color={COLORS.textSecondary} />
                  </View>
                  <Text style={s.taskDesc}>{task.desc}</Text>
                  <View style={s.taskFooter}>
                    <View style={[s.taskBadge, { backgroundColor: task.statusBg }]}>
                      <Text style={[s.taskBadgeText, { color: task.statusColor }]}>{task.status}</Text>
                    </View>
                    <MaterialCommunityIcons name={task.icon as any} size={20} color={COLORS.primary} />
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Token List */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>代币列表</Text>
            {loading ? (
              <View style={s.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>
            ) : errorText ? (
              <View style={s.center}><Text style={s.errorText}>{errorText}</Text></View>
            ) : allAssets.length ? (
              <View style={s.tokenList}>
                {allAssets.map((asset, i) => (
                  <TokenRow key={`${asset.symbol}-${asset.tokenAddress || i}`} asset={asset} isLast={i === allAssets.length - 1} />
                ))}
              </View>
            ) : (
              <View style={s.center}>
                <Text style={s.emptyText}>登录并创建 Agent Wallet 后显示资产</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },

  // Header
  header: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerLogo: { width: 32, height: 32 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: COLORS.text },
  headerIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },

  scroll: { paddingHorizontal: 20, paddingBottom: 100 },

  // Asset Card
  assetCard: {
    borderRadius: 24,
    padding: 20,
    marginTop: 8,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  assetTop: { flexDirection: "row", justifyContent: "space-between" },
  assetInfo: { flex: 1 },
  assetLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  assetLabel: { fontSize: 13, color: "rgba(255,255,255,0.8)" },
  assetValue: { fontSize: 36, fontWeight: "800", color: COLORS.white, marginTop: 4, letterSpacing: -1 },
  assetChange: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 8 },
  assetChangeValue: { fontSize: 14, fontWeight: "600", color: "#4ADE80" },

  // Pie Chart
  pieContainer: { width: 80, height: 80, alignItems: "center", justifyContent: "center" },
  pieChart: { width: 70, height: 70, borderRadius: 35, position: "relative", overflow: "hidden" },
  pieSlice: { position: "absolute", width: 35, height: 70, left: 17.5, top: 0, transformOrigin: "17.5px 35px" },
  pieCenter: { position: "absolute", width: 40, height: 40, borderRadius: 20, backgroundColor: "#7C3AED", top: 15, left: 15 },

  // Quick Actions
  quickActions: { flexDirection: "row", gap: 12, marginTop: 20 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  actionText: { fontSize: 15, fontWeight: "600", color: COLORS.white },

  // Section
  section: { marginTop: 28 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text, marginBottom: 14 },

  // Tasks
  tasksScroll: { gap: 12 },
  taskCard: {
    width: 130,
    backgroundColor: COLORS.cardBg,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.08)",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  taskHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  taskToken: { fontSize: 15, fontWeight: "800" },
  taskDesc: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 18, marginTop: 8 },
  taskFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  taskBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  taskBadgeText: { fontSize: 11, fontWeight: "700" },

  // Token List
  tokenList: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.06)",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  tokenRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16 },
  tokenBorder: { borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.04)" },
  tokenIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  tokenIconText: { fontSize: 18, fontWeight: "700" },
  tokenInfo: { flex: 1, marginLeft: 12 },
  tokenSymbol: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  tokenPrice: { alignItems: "flex-end", marginRight: 20 },
  priceValue: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  priceChange: { fontSize: 12, marginTop: 2 },
  tokenBalance: { alignItems: "flex-end" },
  balanceValue: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  balanceSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },

  // Misc
  center: { alignItems: "center", paddingVertical: 40 },
  errorText: { fontSize: 14, color: "#EF4444" },
  emptyText: { fontSize: 14, color: COLORS.textSecondary },
});
