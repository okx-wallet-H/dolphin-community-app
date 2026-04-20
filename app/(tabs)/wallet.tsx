import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
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

import { ManusColors } from "@/constants/manus-ui";
import {
  getAccountAssets,
  type AgentWalletAssetsResponse,
  type StoredWalletSnapshot,
  type WalletAssetItem,
} from "@/lib/_core/api";

const WALLET_STORAGE_KEY = "hwallet-agent-wallet";
const WALLET_REFRESH_EVENT = "hwallet:refresh-wallet-assets";
const PRIMARY = ManusColors.primary;

type ChainCard = AgentWalletAssetsResponse["walletAddresses"][number];

function fmt(value: number, digits = 2): string {
  return new Intl.NumberFormat("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}
function fmtAmt(value: number): string {
  if (value >= 1000) return fmt(value, 2);
  if (value >= 1) return new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(value);
  return new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 8 }).format(value);
}
function toNum(v: unknown): number { const p = Number(v); return Number.isFinite(p) ? p : 0; }
function mask(a: string) { return a.length <= 12 ? a : `${a.slice(0, 6)}...${a.slice(-4)}`; }

function AssetRow({ asset, isLast }: { asset: WalletAssetItem; isLast: boolean }) {
  const balance = fmtAmt(toNum(asset.balance));
  const valueUsd = fmt(toNum(asset.valueUsd), 2);
  const change24h = Math.random() * 10 - 5; // Mock
  const isPositive = change24h >= 0;
  return (
    <Pressable style={({ pressed }) => [s.assetRow, !isLast && s.assetBorder, pressed && { opacity: 0.7 }]}>
      <View style={s.assetIcon}>
        {asset.logoUrl ? (
          <Image source={{ uri: asset.logoUrl }} style={{ width: 36, height: 36, borderRadius: 18 }} />
        ) : (
          <MaterialCommunityIcons name="currency-btc" size={22} color={PRIMARY} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.assetSymbol}>{asset.symbol}</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={s.assetValue}>${valueUsd}</Text>
        <Text style={[s.assetChange, { color: isPositive ? "#10B981" : "#EF4444" }]}>
          {isPositive ? "+" : ""}{change24h.toFixed(2)}%
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", marginLeft: 12 }}>
        <Text style={s.assetBalance}>${fmt(toNum(asset.valueUsd), 2)}</Text>
        <Text style={s.assetSub}>${asset.tokenPrice || "0.00"}</Text>
      </View>
    </Pressable>
  );
}

export default function WalletRoute() {
  const [wallet, setWallet] = useState<StoredWalletSnapshot>(null);
  const [assets, setAssets] = useState<AgentWalletAssetsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState("");

  const totalUsd = useMemo(() => fmt(toNum(assets?.totalAssetValue), 2), [assets?.totalAssetValue]);
  const chainCards = useMemo<ChainCard[]>(() => assets?.walletAddresses || [], [assets?.walletAddresses]);

  // Mock 24h change
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

  // Flatten all assets for list
  const allAssets = useMemo(() => {
    const items: WalletAssetItem[] = [];
    chainCards.forEach((chain) => {
      chain.assets.forEach((asset) => items.push(asset));
    });
    return items;
  }, [chainCards]);

  return (
    <View style={s.root}>
      <LinearGradient
        colors={["#FDFCFF", "#F8F5FF", "#F0EBFF"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
        {/* Header */}
        <View style={s.header}>
          <Pressable hitSlop={8} onPress={() => router.push("/(tabs)/chat")} style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.5 }]}>
            <MaterialIcons name="arrow-back-ios-new" size={18} color={ManusColors.text} />
          </Pressable>
          <Text style={s.headerTitle}>H Wallet</Text>
          <Pressable hitSlop={8} style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.5 }]}>
            <MaterialCommunityIcons name="bell-outline" size={22} color={ManusColors.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAssets(false); }} tintColor={PRIMARY} />}
        >
          {/* Hero Card */}
          <LinearGradient
            colors={["#A78BFA", "#7C3AED", "#6D28D9"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.heroCard}
          >
            <View style={s.heroTop}>
              <View>
                <Text style={s.heroLabel}>总资产 (USD)</Text>
                <Text style={s.heroValue}>{totalUsd}</Text>
                <Text style={s.heroChange}>24h 变化  +${fmt(change24h, 2)} (+{changePercent}%)</Text>
              </View>
              {/* Pie chart placeholder */}
              <View style={s.pieWrap}>
                <View style={s.piePlaceholder}>
                  <View style={[s.pieSlice, { backgroundColor: "#60A5FA" }]} />
                  <View style={[s.pieSlice, s.pieSlice2, { backgroundColor: "#34D399" }]} />
                  <View style={[s.pieSlice, s.pieSlice3, { backgroundColor: "#A78BFA" }]} />
                </View>
              </View>
            </View>

            {/* Quick actions */}
            <View style={s.heroActions}>
              <Pressable style={s.heroBtn} onPress={() => router.push("/(tabs)/chat")}>
                <MaterialCommunityIcons name="download-outline" size={18} color="#FFFFFF" />
                <Text style={s.heroBtnText}>收款</Text>
              </Pressable>
              <Pressable style={s.heroBtn} onPress={() => router.push("/(tabs)/chat")}>
                <MaterialCommunityIcons name="swap-horizontal" size={18} color="#FFFFFF" />
                <Text style={s.heroBtnText}>转账</Text>
              </Pressable>
              <Pressable style={s.heroBtn} onPress={() => router.push("/(tabs)/chat")}>
                <MaterialCommunityIcons name="currency-usd" size={18} color="#FFFFFF" />
                <Text style={s.heroBtnText}>买币</Text>
              </Pressable>
            </View>
          </LinearGradient>

          {/* Agent Tasks */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Agent 自动任务</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tasksScroll}>
              <View style={[s.taskCard, { backgroundColor: "rgba(255,255,255,0.9)" }]}>
                <Text style={s.taskToken}>ETH</Text>
                <Text style={s.taskDesc}>跌破 2200{"\n"}自动提醒</Text>
                <View style={[s.taskBadge, { backgroundColor: "#DCFCE7" }]}>
                  <Text style={[s.taskBadgeText, { color: "#16A34A" }]}>运行中</Text>
                </View>
              </View>
              <View style={[s.taskCard, { backgroundColor: "rgba(255,255,255,0.9)" }]}>
                <Text style={[s.taskToken, { color: "#10B981" }]}>USDT</Text>
                <Text style={s.taskDesc}>闲置资金{"\n"}自动理财</Text>
                <View style={[s.taskBadge, { backgroundColor: "#FEF3C7" }]}>
                  <Text style={[s.taskBadgeText, { color: "#D97706" }]}>待执行</Text>
                </View>
              </View>
              <View style={[s.taskCard, { backgroundColor: "rgba(255,255,255,0.9)" }]}>
                <Text style={[s.taskToken, { color: "#10B981" }]}>USDT</Text>
                <Text style={s.taskDesc}>每周资产巡检{"\n"}报告</Text>
                <View style={[s.taskBadge, { backgroundColor: "#E0E7FF" }]}>
                  <Text style={[s.taskBadgeText, { color: "#4F46E5" }]}>已完成</Text>
                </View>
              </View>
            </ScrollView>
          </View>

          {/* Token list */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>代币列表</Text>

            {loading ? (
              <View style={s.center}><ActivityIndicator color={PRIMARY} size="large" /></View>
            ) : errorText ? (
              <View style={s.center}><Text style={[s.centerText, { color: ManusColors.danger }]}>{errorText}</Text></View>
            ) : allAssets.length ? (
              <View style={s.tokenCard}>
                {allAssets.map((asset, i) => (
                  <AssetRow key={`${asset.symbol}-${asset.tokenAddress || i}`} asset={asset} isLast={i === allAssets.length - 1} />
                ))}
              </View>
            ) : (
              <View style={s.center}>
                <Text style={s.centerText}>登录并创建 Agent Wallet 后显示资产</Text>
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
  header: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: ManusColors.text },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },

  /* Hero Card */
  heroCard: {
    borderRadius: 24,
    padding: 20,
    gap: 20,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  heroTop: { flexDirection: "row", justifyContent: "space-between" },
  heroLabel: { fontSize: 13, color: "rgba(255,255,255,0.8)" },
  heroValue: { fontSize: 34, fontWeight: "800", color: "#FFFFFF", letterSpacing: -1, marginTop: 4 },
  heroChange: { fontSize: 13, color: "rgba(255,255,255,0.9)", marginTop: 4 },
  pieWrap: { width: 80, height: 80, alignItems: "center", justifyContent: "center" },
  piePlaceholder: { width: 70, height: 70, borderRadius: 35, backgroundColor: "rgba(255,255,255,0.2)", overflow: "hidden", position: "relative" },
  pieSlice: { position: "absolute", width: 35, height: 35, top: 0, left: 0 },
  pieSlice2: { left: 35 },
  pieSlice3: { top: 35, width: 70, height: 35 },
  heroActions: { flexDirection: "row", gap: 12 },
  heroBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  heroBtnText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },

  /* Section */
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: ManusColors.text, marginBottom: 12 },

  /* Tasks */
  tasksScroll: { gap: 12 },
  taskCard: {
    width: 120,
    padding: 14,
    borderRadius: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.1)",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  taskToken: { fontSize: 14, fontWeight: "800", color: PRIMARY },
  taskDesc: { fontSize: 12, color: ManusColors.textSecondary, lineHeight: 16 },
  taskBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  taskBadgeText: { fontSize: 11, fontWeight: "700" },

  /* Token list */
  tokenCard: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.08)",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  assetRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  assetBorder: { borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.04)" },
  assetIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  assetSymbol: { fontSize: 15, fontWeight: "700", color: ManusColors.text },
  assetValue: { fontSize: 14, fontWeight: "600", color: ManusColors.text },
  assetChange: { fontSize: 12, marginTop: 2 },
  assetBalance: { fontSize: 14, fontWeight: "600", color: ManusColors.text },
  assetSub: { fontSize: 11, color: ManusColors.muted, marginTop: 2 },

  /* Misc */
  center: { alignItems: "center", paddingVertical: 40, gap: 8 },
  centerText: { fontSize: 14, color: ManusColors.muted },
});
