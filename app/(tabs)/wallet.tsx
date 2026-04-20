import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
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
  getOnchainApprovals,
  type AgentWalletAssetsResponse,
  type OnchainApprovalsResponse,
  type StoredWalletSnapshot,
  type WalletAssetItem,
} from "@/lib/_core/api";

const WALLET_STORAGE_KEY = "hwallet-agent-wallet";
const WALLET_REFRESH_EVENT = "hwallet:refresh-wallet-assets";
const PRIMARY = ManusColors.primary;

type ChainCard = AgentWalletAssetsResponse["walletAddresses"][number];
type ApprovalGroup = OnchainApprovalsResponse["approvals"][number];

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
function fmtCompact(v: number) {
  if (!Number.isFinite(v) || v <= 0) return "$0";
  if (v >= 1e9) return `$${fmt(v / 1e9, 2)}B`;
  if (v >= 1e6) return `$${fmt(v / 1e6, 2)}M`;
  if (v >= 1e3) return `$${fmt(v / 1e3, 2)}K`;
  return `$${fmt(v, 2)}`;
}

function AssetRow({ asset, isLast, onPress }: { asset: WalletAssetItem; isLast: boolean; onPress?: () => void }) {
  const balance = fmtAmt(toNum(asset.balance));
  const valueUsd = fmt(toNum(asset.valueUsd), 2);
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => [s.assetRow, !isLast && s.assetBorder, pressed && { opacity: 0.7 }]}>
      <View style={s.assetIcon}>
        {asset.logoUrl ? (
          <Image source={{ uri: asset.logoUrl }} style={{ width: 32, height: 32, borderRadius: 16 }} />
        ) : (
          <MaterialCommunityIcons name="wallet-outline" size={20} color={PRIMARY} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.assetSymbol}>{asset.symbol}</Text>
        <Text style={s.assetSub}>{balance} {asset.symbol}</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={s.assetValue}>${valueUsd}</Text>
        <Text style={s.assetSub}>≈ ${asset.tokenPrice || "0.00"}</Text>
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

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable hitSlop={8} onPress={() => router.push("/(tabs)/chat")} style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.5 }]}>
          <MaterialIcons name="arrow-back-ios-new" size={18} color={ManusColors.text} />
        </Pressable>
        <Text style={s.headerTitle}>钱包</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAssets(false); }} tintColor={PRIMARY} />}
      >
        {/* Total asset hero */}
        <View style={s.hero}>
          <Text style={s.heroLabel}>总资产</Text>
          <Text style={s.heroValue}>${totalUsd}</Text>
          <View style={s.addressRow}>
            {wallet?.evmAddress ? (
              <View style={s.addrChip}>
                <Text style={s.addrChipLabel}>EVM</Text>
                <Text style={s.addrChipText}>{mask(wallet.evmAddress)}</Text>
              </View>
            ) : null}
            {wallet?.solanaAddress ? (
              <View style={s.addrChip}>
                <Text style={s.addrChipLabel}>SOL</Text>
                <Text style={s.addrChipText}>{mask(wallet.solanaAddress)}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Quick actions */}
        <View style={s.quickRow}>
          <Pressable style={s.quickCard} onPress={() => router.push("/(tabs)/chat")}>
            <MaterialCommunityIcons name="swap-horizontal-bold" size={20} color={PRIMARY} />
            <Text style={s.quickLabel}>兑换</Text>
          </Pressable>
          <Pressable style={s.quickCard} onPress={() => router.push("/(tabs)/chat")}>
            <MaterialCommunityIcons name="send-circle-outline" size={20} color="#3B82F6" />
            <Text style={s.quickLabel}>转账</Text>
          </Pressable>
          <Pressable style={s.quickCard} onPress={() => router.push("/(tabs)/chat")}>
            <MaterialCommunityIcons name="diamond-stone" size={20} color="#10B981" />
            <Text style={s.quickLabel}>赚币</Text>
          </Pressable>
        </View>

        {/* Loading / Error */}
        {loading ? (
          <View style={s.center}><ActivityIndicator color={PRIMARY} size="large" /><Text style={s.centerText}>加载中...</Text></View>
        ) : errorText ? (
          <View style={s.center}><Text style={[s.centerText, { color: ManusColors.danger }]}>{errorText}</Text></View>
        ) : null}

        {/* Chain assets */}
        {!loading && !errorText && chainCards.map((chain) => {
          const chainTotal = chain.assets.reduce((sum, a) => sum + toNum(a.valueUsd), 0);
          return (
            <View key={`${chain.chainName}-${chain.address}`} style={s.chainSection}>
              <View style={s.chainHead}>
                <Text style={s.chainName}>{chain.chainName}</Text>
                <Text style={s.chainTotal}>{fmtCompact(chainTotal)}</Text>
              </View>
              <View style={s.chainCard}>
                {chain.assets.length ? chain.assets.map((asset, i) => (
                  <AssetRow
                    key={`${chain.chainName}-${asset.symbol}-${asset.tokenAddress || "native"}`}
                    asset={asset}
                    isLast={i === chain.assets.length - 1}
                    onPress={() => router.push({
                      pathname: "/token-detail/[symbol]" as never,
                      params: { symbol: asset.symbol, tokenName: asset.tokenName || asset.symbol, chainName: asset.chainName || chain.chainName, chainIndex: asset.chainIndex, tokenAddress: asset.tokenAddress || "", walletAddress: chain.address, balance: asset.balance, valueUsd: asset.valueUsd, tokenPrice: asset.tokenPrice, logoUrl: asset.logoUrl || "" } as never,
                    })}
                  />
                )) : (
                  <Text style={s.emptyText}>暂无资产</Text>
                )}
              </View>
            </View>
          );
        })}

        {!loading && !errorText && !chainCards.length ? (
          <View style={s.center}>
            <Text style={s.centerText}>登录并创建 Agent Wallet 后显示资产</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  header: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: ManusColors.text },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },

  /* Hero */
  hero: { paddingVertical: 24, gap: 4 },
  heroLabel: { fontSize: 13, color: ManusColors.muted },
  heroValue: { fontSize: 32, fontWeight: "700", color: ManusColors.text, letterSpacing: -1 },
  addressRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  addrChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: ManusColors.surfaceTint, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  addrChipLabel: { fontSize: 11, fontWeight: "700", color: PRIMARY },
  addrChipText: { fontSize: 11, color: ManusColors.textSecondary },

  /* Quick actions */
  quickRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  quickCard: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 14, borderRadius: 14, backgroundColor: "#F9FAFB" },
  quickLabel: { fontSize: 12, fontWeight: "600", color: ManusColors.text },

  /* Chain section */
  chainSection: { marginBottom: 20 },
  chainHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  chainName: { fontSize: 14, fontWeight: "700", color: ManusColors.text },
  chainTotal: { fontSize: 14, fontWeight: "600", color: ManusColors.muted },
  chainCard: { backgroundColor: "#F9FAFB", borderRadius: 14, overflow: "hidden" },

  /* Asset row */
  assetRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  assetBorder: { borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.04)" },
  assetIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: ManusColors.surfaceTint, alignItems: "center", justifyContent: "center" },
  assetSymbol: { fontSize: 15, fontWeight: "600", color: ManusColors.text },
  assetSub: { fontSize: 11, color: ManusColors.muted, marginTop: 1 },
  assetValue: { fontSize: 15, fontWeight: "700", color: ManusColors.text },

  /* Misc */
  center: { alignItems: "center", paddingVertical: 40, gap: 8 },
  centerText: { fontSize: 14, color: ManusColors.muted },
  emptyText: { fontSize: 13, color: ManusColors.muted, padding: 16, textAlign: "center" },
});
