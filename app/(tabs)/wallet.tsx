"use client";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
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
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, G, Path } from "react-native-svg";

import {
  getAccountAssets,
  type AgentWalletAssetsResponse,
  type StoredWalletSnapshot,
  type WalletAssetItem,
} from "@/lib/_core/api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const WALLET_STORAGE_KEY = "hwallet-agent-wallet";
const WALLET_REFRESH_EVENT = "hwallet:refresh-wallet-assets";

// Unified glass theme (matching login & chat)
const C = {
  bg: "#F5F0FF",
  bgCard: "#FFFFFF",
  primary: "#7C3AED",
  primaryDark: "#6D28D9",
  primaryLight: "#A78BFA",
  text: "#1A1A2E",
  textSec: "#6B6B8D",
  textMuted: "#9B8FC0",
  positive: "#10B981",
  negative: "#EF4444",
  white: "#FFFFFF",
  glass: "rgba(255,255,255,0.92)",
  glassBorder: "rgba(255,255,255,0.95)",
  border: "rgba(139,92,246,0.10)",
};

// Token data with icons
const TOKEN_DATA: Record<string, { icon: any; bg: string; color: string }> = {
  BTC: { icon: require("@/assets/images/hwallet-official-logo.png"), bg: "#FFF7ED", color: "#F7931A" },
  ETH: { icon: require("@/assets/images/hwallet-official-logo.png"), bg: "#EEF2FF", color: "#627EEA" },
  SOL: { icon: require("@/assets/images/hwallet-official-logo.png"), bg: "#ECFDF5", color: "#00D18C" },
  USDT: { icon: require("@/assets/images/hwallet-official-logo.png"), bg: "#ECFDF5", color: "#26A17B" },
};

type ChainCard = AgentWalletAssetsResponse["walletAddresses"][number];

function fmt(v: number, d = 2): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
}
function toNum(v: unknown): number { const n = Number(v); return Number.isFinite(n) ? n : 0; }

// Agent Task Card
function AgentTaskCard({ token, tokenColor, title, subtitle, status, statusBg, statusColor, icon }: {
  token: string; tokenColor: string; title: string; subtitle: string;
  status: string; statusBg: string; statusColor: string; icon: string;
}) {
  return (
    <View style={s.taskCard}>
      <View style={s.taskHeader}>
        <Text style={[s.taskToken, { color: tokenColor }]}>{token}</Text>
        <Pressable hitSlop={8}>
          <MaterialCommunityIcons name="dots-vertical" size={18} color={C.textMuted} />
        </Pressable>
      </View>
      <Text style={s.taskTitle}>{title}</Text>
      <Text style={s.taskSubtitle}>{subtitle}</Text>
      <View style={s.taskFooter}>
        <View style={[s.taskBadge, { backgroundColor: statusBg }]}>
          <Text style={[s.taskBadgeText, { color: statusColor }]}>{status}</Text>
        </View>
        <View style={[s.taskIconWrap, { backgroundColor: `${tokenColor}15` }]}>
          <MaterialCommunityIcons name={icon as any} size={18} color={tokenColor} />
        </View>
      </View>
    </View>
  );
}

// Token Row Component
function TokenRow({ asset, isLast }: { asset: WalletAssetItem; isLast: boolean }) {
  const balance = toNum(asset.balance);
  const valueUsd = toNum(asset.valueUsd);
  const price = toNum(asset.tokenPrice);
  const change = (Math.random() * 6 - 1).toFixed(2);
  const isUp = parseFloat(change) >= 0;
  const tokenInfo = TOKEN_DATA[asset.symbol] || { bg: "#F3F4F6", color: C.primary };

  return (
    <View style={[s.tokenRow, !isLast && s.tokenRowBorder]}>
      <View style={[s.tokenIcon, { backgroundColor: tokenInfo.bg }]}>
        {asset.logoUrl ? (
          <Image source={{ uri: asset.logoUrl }} style={s.tokenImg} />
        ) : (
          <Text style={[s.tokenLetter, { color: tokenInfo.color }]}>{asset.symbol[0]}</Text>
        )}
      </View>
      <Text style={s.tokenName}>{asset.symbol}</Text>
      <View style={s.tokenPriceCol}>
        <Text style={s.tokenPrice}>${fmt(price)}</Text>
        <Text style={[s.tokenChange, { color: isUp ? C.positive : C.negative }]}>
          {isUp ? "+" : ""}{change}%
        </Text>
      </View>
      <View style={s.tokenValueCol}>
        <Text style={s.tokenValue}>${fmt(valueUsd)}</Text>
        <Text style={s.tokenValueSub}>${fmt(price)}</Text>
      </View>
    </View>
  );
}

// Donut Chart Component
function DonutChart() {
  const size = 90;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = [
    { color: "#60A5FA", percent: 35 },
    { color: "#34D399", percent: 40 },
    { color: "#C4B5FD", percent: 25 },
  ];

  let offset = 0;
  return (
    <Svg width={size} height={size}>
      <G rotation="-90" origin={`${cx}, ${cy}`}>
        {segments.map((seg, i) => {
          const strokeDasharray = `${(seg.percent / 100) * circumference} ${circumference}`;
          const strokeDashoffset = -offset;
          offset += (seg.percent / 100) * circumference;
          return (
            <Circle
              key={i}
              cx={cx}
              cy={cy}
              r={radius}
              stroke={seg.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          );
        })}
      </G>
    </Svg>
  );
}

export default function WalletScreen() {
  const [wallet, setWallet] = useState<StoredWalletSnapshot>(null);
  const [assets, setAssets] = useState<AgentWalletAssetsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const totalUsd = useMemo(() => toNum(assets?.totalAssetValue) || 12450, [assets?.totalAssetValue]);
  const chainCards = useMemo<ChainCard[]>(() => assets?.walletAddresses || [], [assets?.walletAddresses]);
  const allAssets = useMemo(() => {
    const items: WalletAssetItem[] = [];
    chainCards.forEach((chain) => chain.assets.forEach((a) => items.push(a)));
    return items;
  }, [chainCards]);

  // Mock data for display
  const mockAssets = [
    { symbol: "BTC", balance: "0.041", valueUsd: "3000", tokenPrice: "72500", logoUrl: "", tokenAddress: "", tokenName: "Bitcoin", chainIndex: "1", chainName: "Ethereum", address: "", isRiskToken: false },
    { symbol: "ETH", balance: "1.2", valueUsd: "2330", tokenPrice: "208.38", logoUrl: "", tokenAddress: "", tokenName: "Ethereum", chainIndex: "1", chainName: "Ethereum", address: "", isRiskToken: false },
    { symbol: "SOL", balance: "4.5", valueUsd: "70", tokenPrice: "15.05", logoUrl: "", tokenAddress: "", tokenName: "Solana", chainIndex: "501", chainName: "Solana", address: "", isRiskToken: false },
    { symbol: "USDT", balance: "20", valueUsd: "20", tokenPrice: "0.45", logoUrl: "", tokenAddress: "", tokenName: "Tether", chainIndex: "1", chainName: "Ethereum", address: "", isRiskToken: false },
  ] as WalletAssetItem[];
  const displayAssets: WalletAssetItem[] = allAssets.length ? allAssets : mockAssets;

  const loadAssets = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const rawWallet = await AsyncStorage.getItem(WALLET_STORAGE_KEY);
      const parsedWallet = rawWallet ? (JSON.parse(rawWallet) as StoredWalletSnapshot) : null;
      setWallet(parsedWallet);
      if (parsedWallet?.evmAddress || parsedWallet?.solanaAddress) {
        const result = await getAccountAssets(parsedWallet);
        setAssets(result);
      }
    } catch (e) {
      console.warn("Load assets error:", e);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadAssets(true); }, [loadAssets]);
  useFocusEffect(useCallback(() => { loadAssets(false); }, [loadAssets]));
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(WALLET_REFRESH_EVENT, () => { setRefreshing(true); loadAssets(false); });
    return () => sub.remove();
  }, [loadAssets]);

  return (
    <View style={s.root}>
      {/* Background gradient */}
      <LinearGradient colors={["#FDFCFF", "#F5F0FF", "#EDE8FF"]} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={s.safe} edges={["top"]}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Image source={require("@/assets/images/hwallet-official-logo.png")} style={s.logo} resizeMode="contain" />
            <Text style={s.headerTitle}>H Wallet</Text>
          </View>
          <Pressable style={s.bellBtn} hitSlop={8}>
            <Ionicons name="notifications-outline" size={22} color={C.text} />
          </Pressable>
        </View>

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAssets(false); }} tintColor={C.primary} />}
        >
          {/* Asset Card */}
          <LinearGradient
            colors={["#B794F4", "#9F7AEA", "#805AD5"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.assetCard}
          >
            <View style={s.assetTop}>
              <View style={s.assetLeft}>
                <View style={s.assetLabelRow}>
                  <Text style={s.assetLabel}>总资产 (USD)</Text>
                  <Ionicons name="eye-outline" size={16} color="rgba(255,255,255,0.7)" />
                </View>
                <Text style={s.assetTotal}>{fmt(totalUsd, 2)}</Text>
                <Text style={s.changeLabel}>24h 变化</Text>
                <Text style={s.changeValue}>+$501.23 (+4.2%)</Text>
              </View>
              <View style={s.chartWrap}>
                <DonutChart />
              </View>
            </View>

            {/* Action Buttons */}
            <View style={s.actions}>
              <Pressable style={s.actionBtn} onPress={() => router.push("/(tabs)/chat")}>
                <Ionicons name="download-outline" size={18} color={C.white} />
                <Text style={s.actionText}>收款</Text>
              </Pressable>
              <Pressable style={s.actionBtn} onPress={() => router.push("/(tabs)/chat")}>
                <Ionicons name="swap-horizontal-outline" size={18} color={C.white} />
                <Text style={s.actionText}>转账</Text>
              </Pressable>
              <Pressable style={s.actionBtn} onPress={() => router.push("/(tabs)/chat")}>
                <Ionicons name="logo-usd" size={18} color={C.white} />
                <Text style={s.actionText}>买币</Text>
              </Pressable>
            </View>
          </LinearGradient>

          {/* Agent Tasks */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Agent 自动任务</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tasksRow}>
              <AgentTaskCard
                token="ETH"
                tokenColor={C.primary}
                title="跌破 2200"
                subtitle="自动提醒"
                status="运行中"
                statusBg="#DCFCE7"
                statusColor="#16A34A"
                icon="bell-ring-outline"
              />
              <AgentTaskCard
                token="USDT"
                tokenColor="#10B981"
                title="闲置资金"
                subtitle="自动理财"
                status="待执行"
                statusBg="#FEF3C7"
                statusColor="#D97706"
                icon="currency-usd"
              />
              <AgentTaskCard
                token="USDT"
                tokenColor="#10B981"
                title="每周资产巡检"
                subtitle="报告"
                status="已完成"
                statusBg="#E0E7FF"
                statusColor="#4F46E5"
                icon="file-document-outline"
              />
            </ScrollView>
          </View>

          {/* Token List */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>代币列表</Text>
            <View style={s.tokenCard}>
              {loading ? (
                <View style={s.loadingWrap}><ActivityIndicator color={C.primary} size="large" /></View>
              ) : (
                displayAssets.map((asset, i) => (
                  <TokenRow key={`${asset.symbol}-${i}`} asset={asset} isLast={i === displayAssets.length - 1} />
                ))
              )}
            </View>
          </View>

          {/* Bottom spacer */}
          <View style={{ height: 40 }} />
        </ScrollView>
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
    paddingHorizontal: 20,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 34, height: 34 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: C.text, letterSpacing: -0.5 },
  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.8)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },

  // Asset Card
  assetCard: {
    borderRadius: 28,
    padding: 24,
    marginTop: 8,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  assetTop: { flexDirection: "row", justifyContent: "space-between" },
  assetLeft: { flex: 1 },
  assetLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  assetLabel: { fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: "500" },
  assetTotal: { fontSize: 40, fontWeight: "800", color: C.white, marginTop: 4, letterSpacing: -1 },
  changeLabel: { fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 10 },
  changeValue: { fontSize: 15, fontWeight: "700", color: "#4ADE80", marginTop: 2 },
  chartWrap: { marginLeft: 16 },

  // Actions
  actions: { flexDirection: "row", gap: 10, marginTop: 24 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  actionText: { fontSize: 15, fontWeight: "600", color: C.white },

  // Section
  section: { marginTop: 28 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: C.text, marginBottom: 14, letterSpacing: -0.3 },

  // Tasks
  tasksRow: { gap: 12, paddingRight: 20 },
  taskCard: {
    width: 140,
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 16,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  taskHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  taskToken: { fontSize: 16, fontWeight: "800" },
  taskTitle: { fontSize: 13, fontWeight: "600", color: C.text, marginTop: 10, lineHeight: 18 },
  taskSubtitle: { fontSize: 12, color: C.textSec, marginTop: 2 },
  taskFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14 },
  taskBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  taskBadgeText: { fontSize: 11, fontWeight: "700" },
  taskIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },

  // Token List
  tokenCard: {
    backgroundColor: C.white,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
    borderWidth: 1,
    borderColor: C.border,
  },
  tokenRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 18 },
  tokenRowBorder: { borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.04)" },
  tokenIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  tokenImg: { width: 32, height: 32, borderRadius: 16 },
  tokenLetter: { fontSize: 20, fontWeight: "700" },
  tokenName: { flex: 1, fontSize: 16, fontWeight: "700", color: C.text, marginLeft: 14 },
  tokenPriceCol: { alignItems: "flex-end", marginRight: 24 },
  tokenPrice: { fontSize: 15, fontWeight: "600", color: C.text },
  tokenChange: { fontSize: 12, marginTop: 3 },
  tokenValueCol: { alignItems: "flex-end", minWidth: 80 },
  tokenValue: { fontSize: 15, fontWeight: "600", color: C.text },
  tokenValueSub: { fontSize: 11, color: C.textMuted, marginTop: 3 },

  loadingWrap: { paddingVertical: 60, alignItems: "center" },
});
