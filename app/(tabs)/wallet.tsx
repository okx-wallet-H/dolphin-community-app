"use client";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import Svg, { Circle, G } from "react-native-svg";

import {
  getAccountAssets,
  getMe,
  type AgentWalletAssetsResponse,
  type StoredWalletSnapshot,
  type WalletAssetItem,
} from "@/lib/_core/api";

const { width: SW } = Dimensions.get("window");
const WALLET_STORAGE_KEY = "hwallet-agent-wallet";
const WALLET_REFRESH_EVENT = "hwallet:refresh-wallet-assets";

/* ── Unified Theme ───────────────────────────────── */
const T = {
  bg1: "#F7F3FF",
  bg2: "#EDE6FF",
  bg3: "#E2DAFF",
  card: "rgba(255,255,255,0.88)",
  cardSolid: "#FFFFFF",
  glass: "rgba(255,255,255,0.72)",
  glassBorder: "rgba(255,255,255,0.9)",
  border: "rgba(139,92,246,0.12)",
  borderLight: "rgba(139,92,246,0.06)",
  primary: "#7C3AED",
  primaryDark: "#6D28D9",
  accent: "#8B5CF6",
  accentLight: "#C4B5FD",
  text: "#1A1035",
  textSec: "#5B5480",
  textMuted: "#9B90C0",
  positive: "#10B981",
  negative: "#EF4444",
  white: "#FFFFFF",
};

const TOKENS: Record<string, { letter: string; bg: string; fg: string }> = {
  BTC: { letter: "B", bg: "#FFF7ED", fg: "#F7931A" },
  ETH: { letter: "E", bg: "#EEF0FF", fg: "#627EEA" },
  SOL: { letter: "S", bg: "#ECFDF5", fg: "#00D18C" },
  USDT: { letter: "U", bg: "#F0FDF9", fg: "#26A17B" },
  OKB: { letter: "O", bg: "#FFF8F0", fg: "#2D60E0" },
};

type ChainCard = AgentWalletAssetsResponse["walletAddresses"][number];
function fmt(v: number, d = 2) { return new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(v); }
function toNum(v: unknown) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function shortAddress(address: string) { return address.length > 18 ? `${address.slice(0, 8)}...${address.slice(-8)}` : address; }

/* ── Donut Chart ────────────────────────────────── */
function DonutChart({ size = 100 }: { size?: number }) {
  const sw = 15;
  const r = (size - sw) / 2;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;
  const segs = [
    { color: "#60A5FA", pct: 35 },
    { color: "#34D399", pct: 40 },
    { color: "#C4B5FD", pct: 25 },
  ];
  let off = 0;
  return (
    <Svg width={size} height={size}>
      <G rotation="-90" origin={`${cx}, ${cx}`}>
        {segs.map((s, i) => {
          const dash = `${(s.pct / 100) * circ} ${circ}`;
          const cur = -off;
          off += (s.pct / 100) * circ;
          return <Circle key={i} cx={cx} cy={cx} r={r} stroke={s.color} strokeWidth={sw} fill="none" strokeDasharray={dash} strokeDashoffset={cur} strokeLinecap="round" />;
        })}
      </G>
    </Svg>
  );
}

/* ── Quick Stat Mini Card ───────────────────────── */
function StatMini({ icon, iconColor, label, value, sub }: { icon: string; iconColor: string; label: string; value: string; sub?: string }) {
  return (
    <View style={s.statMini}>
      <View style={[s.statIcon, { backgroundColor: `${iconColor}15` }]}>
        <MaterialCommunityIcons name={icon as any} size={20} color={iconColor} />
      </View>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
      {sub ? <Text style={s.statSub}>{sub}</Text> : null}
    </View>
  );
}

/* ── Agent Task Card ────────────────────────────── */
function TaskCard({ token, tokenColor, title, desc, status, statusBg, statusFg, icon }: {
  token: string; tokenColor: string; title: string; desc: string;
  status: string; statusBg: string; statusFg: string; icon: string;
}) {
  return (
    <View style={s.taskCard}>
      <View style={s.taskTop}>
        <Text style={[s.taskToken, { color: tokenColor }]}>{token}</Text>
        <MaterialCommunityIcons name="dots-vertical" size={16} color={T.textMuted} />
      </View>
      <Text style={s.taskTitle} numberOfLines={2}>{title}</Text>
      <Text style={s.taskDesc}>{desc}</Text>
      <View style={s.taskBot}>
        <View style={[s.badge, { backgroundColor: statusBg }]}>
          <Text style={[s.badgeText, { color: statusFg }]}>{status}</Text>
        </View>
        <View style={[s.taskIconCircle, { backgroundColor: `${tokenColor}12` }]}>
          <MaterialCommunityIcons name={icon as any} size={16} color={tokenColor} />
        </View>
      </View>
    </View>
  );
}

/* ── Token Row ──────────────────────────────────── */
function TokenRow({ a, last }: { a: WalletAssetItem; last: boolean }) {
  const price = toNum(a.tokenPrice);
  const val = toNum(a.valueUsd);
  const chg = (Math.random() * 5 + 0.1).toFixed(2);
  const tk = TOKENS[a.symbol] || { letter: a.symbol[0], bg: "#F3F0FF", fg: T.accent };
  return (
    <View style={[s.tokenRow, !last && s.tokenBorder]}>
      <View style={[s.tokenCircle, { backgroundColor: tk.bg }]}>
        {a.logoUrl ? (
          <Image source={{ uri: a.logoUrl }} style={{ width: 28, height: 28, borderRadius: 14 }} />
        ) : (
          <Text style={[s.tokenLetter, { color: tk.fg }]}>{tk.letter}</Text>
        )}
      </View>
      <View style={s.tokenInfo}>
        <Text style={s.tokenSym}>{a.symbol}</Text>
        <Text style={s.tokenName}>{a.tokenName || a.symbol}</Text>
      </View>
      <View style={s.tokenPriceCol}>
        <Text style={s.tokenPrice}>${fmt(price)}</Text>
        <Text style={[s.tokenChg, { color: T.positive }]}>+{chg}%</Text>
      </View>
      <View style={s.tokenValCol}>
        <Text style={s.tokenVal}>${fmt(val)}</Text>
        <Text style={s.tokenBal}>{a.balance}</Text>
      </View>
    </View>
  );
}

/* ── Main Screen ────────────────────────────────── */
export default function WalletScreen() {
  const [wallet, setWallet] = useState<StoredWalletSnapshot>(null);
  const [assets, setAssets] = useState<AgentWalletAssetsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const totalUsd = useMemo(() => toNum(assets?.totalAssetValue) || 12450, [assets?.totalAssetValue]);
  const chainCards = useMemo<ChainCard[]>(() => assets?.walletAddresses || [], [assets?.walletAddresses]);
  const allAssets = useMemo(() => {
    const items: WalletAssetItem[] = [];
    chainCards.forEach((c) => c.assets.forEach((a) => items.push(a)));
    return items;
  }, [chainCards]);
  const mock = [
    { symbol: "BTC", balance: "0.041", valueUsd: "3000", tokenPrice: "72500", logoUrl: "", tokenAddress: "", tokenName: "Bitcoin", chainIndex: "1", chainName: "Ethereum", address: "", isRiskToken: false },
    { symbol: "ETH", balance: "1.2", valueUsd: "2330", tokenPrice: "208.38", logoUrl: "", tokenAddress: "", tokenName: "Ethereum", chainIndex: "1", chainName: "Ethereum", address: "", isRiskToken: false },
    { symbol: "SOL", balance: "4.5", valueUsd: "70", tokenPrice: "15.05", logoUrl: "", tokenAddress: "", tokenName: "Solana", chainIndex: "501", chainName: "Solana", address: "", isRiskToken: false },
    { symbol: "USDT", balance: "20", valueUsd: "20", tokenPrice: "1.00", logoUrl: "", tokenAddress: "", tokenName: "Tether", chainIndex: "1", chainName: "Ethereum", address: "", isRiskToken: false },
  ] as WalletAssetItem[];
  const display = allAssets.length ? allAssets : mock;
  const depositAddresses = useMemo(() => {
    const resolved = chainCards
      .filter((item) => item.address)
      .map((item) => ({
        key: `${item.chainIndex}-${item.address}`,
        chainName: item.chainName,
        networkLabel:
          item.chainIndex === "501" || item.chainName.toLowerCase().includes("solana")
            ? "Solana 充值地址"
            : "EVM 充值地址（建议优先使用）",
        address: item.address,
      }));

    if (resolved.length) {
      return resolved;
    }

    const fallback = [] as { key: string; chainName: string; networkLabel: string; address: string }[];
    if (wallet?.evmAddress) {
      fallback.push({
        key: `evm-${wallet.evmAddress}`,
        chainName: "Ethereum",
        networkLabel: "EVM 充值地址（建议优先使用）",
        address: wallet.evmAddress,
      });
    }
    if (wallet?.solanaAddress) {
      fallback.push({
        key: `sol-${wallet.solanaAddress}`,
        chainName: "Solana",
        networkLabel: "Solana 充值地址",
        address: wallet.solanaAddress,
      });
    }
    return fallback;
  }, [chainCards, wallet]);

  const loadAssets = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const raw = await AsyncStorage.getItem(WALLET_STORAGE_KEY);
      let parsed = raw ? (JSON.parse(raw) as StoredWalletSnapshot) : null;

      if (!parsed?.evmAddress && !parsed?.solanaAddress) {
        try {
          const me = await getMe();
          if (me.wallet?.evmAddress || me.wallet?.solanaAddress) {
            parsed = {
              email: me.wallet.email ?? me.email ?? '',
              evmAddress: me.wallet.evmAddress ?? '',
              solanaAddress: me.wallet.solanaAddress ?? '',
              updatedAt: new Date().toISOString(),
              mockMode: false,
            };
            await AsyncStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(parsed));
          }
        } catch (restoreError) {
          console.warn("Restore wallet snapshot failed:", restoreError);
        }
      }

      setWallet(parsed);
      if (parsed?.evmAddress || parsed?.solanaAddress) {
        const result = await getAccountAssets(parsed);
        setAssets(result);
      } else {
        setAssets(null);
      }
    } catch (e) { console.warn("Load assets error:", e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadAssets(true); }, [loadAssets]);
  useFocusEffect(useCallback(() => { loadAssets(false); }, [loadAssets]));
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(WALLET_REFRESH_EVENT, () => { setRefreshing(true); loadAssets(false); });
    return () => sub.remove();
  }, [loadAssets]);

  const goChat = () => router.push("/(tabs)/chat");
  const scrollToDeposit = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 320, animated: true });
  }, []);

  return (
    <View style={s.root}>
      <LinearGradient colors={[T.bg1, T.bg2, T.bg3]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={s.safe} edges={["top"]}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerL}>
            <View style={s.logoWrap}>
              <Image source={require("@/assets/images/hwallet-official-logo.png")} style={s.logo} resizeMode="contain" />
            </View>
            <Text style={s.headerTitle}>H Wallet</Text>
          </View>
          <Pressable style={s.bellWrap} hitSlop={8}>
            <Ionicons name="notifications-outline" size={20} color={T.text} />
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          style={s.scroll}
          contentContainerStyle={s.scrollPad}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAssets(false); }} tintColor={T.primary} />}
        >
          {/* ── Asset Card ─────────────────────────── */}
          <LinearGradient
            colors={["#9F7AEA", "#805AD5", "#6D28D9"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.assetCard}
          >
            {/* Decorative glow */}
            <View style={s.glowCircle1} />
            <View style={s.glowCircle2} />

            <View style={s.assetRow}>
              <View style={s.assetLeft}>
                <View style={s.assetLabelRow}>
                  <Text style={s.assetLabel}>{"总资产 (USD)"}</Text>
                  <Ionicons name="eye-outline" size={14} color="rgba(255,255,255,0.6)" />
                </View>
                <Text style={s.assetAmount}>{fmt(totalUsd)}</Text>
                <View style={s.changeRow}>
                  <Text style={s.changeLabel}>{"24h 变化"}</Text>
                  <Text style={s.changeVal}>+$501.23 (+4.2%)</Text>
                </View>
              </View>
              <DonutChart size={96} />
            </View>
          </LinearGradient>

          {/* ── Action Buttons ──────────────────────── */}
          <View style={s.actionsRow}>
            {[
              { icon: "download-outline" as const, label: "收款" },
              { icon: "swap-horizontal-outline" as const, label: "转账" },
              { icon: "logo-usd" as const, label: "买币" },
            ].map((a) => (
              <Pressable key={a.label} style={s.actionBtn} onPress={a.label === "收款" ? scrollToDeposit : goChat}>
                <LinearGradient colors={["#9F7AEA", "#7C3AED"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.actionGrad}>
                  <Ionicons name={a.icon} size={18} color={T.white} />
                  <Text style={s.actionLabel}>{a.label}</Text>
                </LinearGradient>
              </Pressable>
            ))}
          </View>

          <Text style={s.secTitle}>充值地址</Text>
          <View style={s.addressList}>
            {depositAddresses.length ? (
              depositAddresses.map((item) => (
                <View key={item.key} style={s.addressCard}>
                  <View style={s.addressCardHead}>
                    <Text style={s.addressChain}>{item.chainName}</Text>
                    <Text style={s.addressLabel}>{item.networkLabel}</Text>
                  </View>
                  <Text style={s.addressValue}>{shortAddress(item.address)}</Text>
                  <Text style={s.addressHint}>完整地址：{item.address}</Text>
                </View>
              ))
            ) : (
              <View style={s.addressCard}>
                <Text style={s.addressChain}>未检测到 Agent Wallet 地址</Text>
                <Text style={s.addressHint}>请先完成登录或重新进入钱包页刷新。</Text>
              </View>
            )}
          </View>

          {/* ── Dashboard Stats Grid ──────────────── */}
          <View style={s.statsGrid}>
            <StatMini icon="chart-timeline-variant" iconColor="#7C3AED" label="总收益" value="+$1,280" sub="+10.3%" />
            <StatMini icon="clock-outline" iconColor="#3B82F6" label="活跃策略" value="3 个" sub="运行中" />
            <StatMini icon="shield-check-outline" iconColor="#10B981" label="安全分" value="98" sub="优秀" />
            <StatMini icon="swap-horizontal" iconColor="#F59E0B" label="今日交易" value="12 笔" sub="$840" />
          </View>

          {/* ── Agent Tasks ─────────────────────────── */}
          <Text style={s.secTitle}>Agent 自动任务</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tasksScroll}>
            <TaskCard token="ETH" tokenColor="#7C3AED" title="跌破 2200" desc="自动提醒" status="运行中" statusBg="#DCFCE7" statusFg="#16A34A" icon="bell-ring-outline" />
            <TaskCard token="USDT" tokenColor="#10B981" title="闲置资金" desc="自动理财" status="待执行" statusBg="#FEF3C7" statusFg="#D97706" icon="currency-usd" />
            <TaskCard token="USDT" tokenColor="#3B82F6" title="每周资产巡检" desc="报告" status="已完成" statusBg="#E0E7FF" statusFg="#4F46E5" icon="file-document-outline" />
          </ScrollView>

          {/* ── Token List ──────────────────────────── */}
          <Text style={s.secTitle}>代币列表</Text>
          <View style={s.tokenCard}>
            {loading ? (
              <View style={{ paddingVertical: 50, alignItems: "center" }}><ActivityIndicator color={T.primary} size="large" /></View>
            ) : (
              display.map((a, i) => <TokenRow key={`${a.symbol}-${i}`} a={a} last={i === display.length - 1} />)
            )}
          </View>

          <View style={{ height: 50 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ── Styles ──────────────────────────────────────── */
const s = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: { flex: 1 },
  scrollPad: { paddingHorizontal: 20, paddingTop: 4 },

  /* Header */
  header: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 },
  headerL: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoWrap: { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(124,58,237,0.08)", alignItems: "center", justifyContent: "center" },
  logo: { width: 28, height: 28 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: T.text, letterSpacing: -0.5 },
  bellWrap: { width: 40, height: 40, borderRadius: 14, backgroundColor: T.card, borderWidth: 1, borderColor: T.glassBorder, alignItems: "center", justifyContent: "center", shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10 },

  /* Asset Card */
  assetCard: { borderRadius: 24, padding: 24, marginTop: 8, overflow: "hidden", shadowColor: "#6D28D9", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 28, elevation: 14 },
  glowCircle1: { position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.08)" },
  glowCircle2: { position: "absolute", bottom: -20, left: -20, width: 90, height: 90, borderRadius: 45, backgroundColor: "rgba(255,255,255,0.05)" },
  assetRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  assetLeft: { flex: 1, marginRight: 16 },
  assetLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  assetLabel: { fontSize: 13, color: "rgba(255,255,255,0.75)", fontWeight: "500" },
  assetAmount: { fontSize: 36, fontWeight: "800", color: T.white, marginTop: 6, letterSpacing: -1 },
  changeRow: { marginTop: 10 },
  changeLabel: { fontSize: 11, color: "rgba(255,255,255,0.55)" },
  changeVal: { fontSize: 14, fontWeight: "700", color: "#4ADE80", marginTop: 2 },

  /* Actions */
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  actionBtn: { flex: 1 },
  actionGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14, borderRadius: 16, shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10 },
  actionLabel: { fontSize: 15, fontWeight: "700", color: T.white },

  /* Deposit addresses */
  addressList: { gap: 12, marginTop: 2 },
  addressCard: { backgroundColor: T.cardSolid, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: T.glassBorder, shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.05, shadowRadius: 12 },
  addressCardHead: { gap: 4 },
  addressChain: { fontSize: 15, fontWeight: "800", color: T.text },
  addressLabel: { fontSize: 12, color: T.textSec, fontWeight: "600" },
  addressValue: { fontSize: 18, fontWeight: "800", color: T.primaryDark, marginTop: 12 },
  addressHint: { fontSize: 12, lineHeight: 18, color: T.textMuted, marginTop: 8 },

  /* Stats Grid */
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 20 },
  statMini: { width: (SW - 50) / 2, backgroundColor: T.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: T.glassBorder, shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10 },
  statIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  statLabel: { fontSize: 12, color: T.textMuted, fontWeight: "500" },
  statValue: { fontSize: 20, fontWeight: "800", color: T.text, marginTop: 2 },
  statSub: { fontSize: 12, color: T.positive, fontWeight: "600", marginTop: 2 },

  /* Section Title */
  secTitle: { fontSize: 18, fontWeight: "700", color: T.text, marginTop: 24, marginBottom: 12, letterSpacing: -0.3 },

  /* Tasks */
  tasksScroll: { gap: 10, paddingRight: 20 },
  taskCard: { width: 150, backgroundColor: T.cardSolid, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: T.glassBorder, shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12 },
  taskTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  taskToken: { fontSize: 15, fontWeight: "800" },
  taskTitle: { fontSize: 13, fontWeight: "600", color: T.text, marginTop: 8, lineHeight: 18 },
  taskDesc: { fontSize: 11, color: T.textSec, marginTop: 2 },
  taskBot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  taskIconCircle: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" },

  /* Token List */
  tokenCard: { backgroundColor: T.cardSolid, borderRadius: 22, borderWidth: 1, borderColor: T.glassBorder, overflow: "hidden", shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 14 },
  tokenRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16 },
  tokenBorder: { borderBottomWidth: 1, borderBottomColor: T.borderLight },
  tokenCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  tokenLetter: { fontSize: 18, fontWeight: "700" },
  tokenInfo: { flex: 1, marginLeft: 12 },
  tokenSym: { fontSize: 15, fontWeight: "700", color: T.text },
  tokenName: { fontSize: 11, color: T.textMuted, marginTop: 1 },
  tokenPriceCol: { alignItems: "flex-end", marginRight: 16 },
  tokenPrice: { fontSize: 14, fontWeight: "600", color: T.text },
  tokenChg: { fontSize: 11, marginTop: 2 },
  tokenValCol: { alignItems: "flex-end", minWidth: 72 },
  tokenVal: { fontSize: 14, fontWeight: "700", color: T.text },
  tokenBal: { fontSize: 11, color: T.textMuted, marginTop: 2 },
});
