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
const PRIMARY = "#7C3AED";
const PRIMARY_LIGHT = "#F5F3FF";
const PAGE_BG = "#FCFAFF";
const BORDER = "#E8EAF2";
const TEXT_PRIMARY = "#1A1A2E";

const TEXT_SECONDARY = "#666C85";
const ERROR = "#DC2626";

type ChainCard = AgentWalletAssetsResponse["walletAddresses"][number];
type ApprovalGroup = OnchainApprovalsResponse["approvals"][number];

const AGENT_TASKS = [
  {
    title: "稳定币收益巡航",
    subtitle: "自动监控收益池 APY 与安全阈值，收益下降时提醒换仓。",
    status: "运行中",
    cadence: "每 30 分钟",
    accent: "#7C3AED",
    icon: "chart-timeline-variant",
  },
  {
    title: "代币异动盯盘",
    subtitle: "联动 OKX 行情价格波动，识别突破与急跌并生成提醒。",
    status: "待执行",
    cadence: "实时",
    accent: "#2563EB",
    icon: "bell-ring-outline",
  },
  {
    title: "链上余额健康检查",
    subtitle: "定时检查多链余额、Gas 充足度和关键地址资产变化。",
    status: "今日 18:00",
    cadence: "每天",
    accent: "#16A34A",
    icon: "wallet-outline",
  },
] as const;

function formatFiat(value: number, digits = 2): string {
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatAmount(value: number): string {
  if (value >= 1000) {
    return formatFiat(value, 2);
  }
  if (value >= 1) {
    return new Intl.NumberFormat("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(value);
  }
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(value);
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function maskAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function ChainIcon({ chainName }: { chainName: string }) {
  if (chainName === "Solana") {
    return (
      <MaterialCommunityIcons
        name="hexagon-multiple-outline"
        size={22}
        color={PRIMARY}
      />
    );
  }
  if (chainName === "Base") {
    return (
      <MaterialCommunityIcons
        name="alpha-b-circle-outline"
        size={22}
        color={PRIMARY}
      />
    );
  }
  if (chainName === "Polygon") {
    return (
      <MaterialCommunityIcons
        name="hexagon-slice-6"
        size={22}
        color={PRIMARY}
      />
    );
  }
  return <MaterialCommunityIcons name="ethereum" size={22} color={PRIMARY} />;
}

function getPriceSourceLabel(source?: WalletAssetItem["priceSource"]) {
  if (source === "okx-onchain") return "OKX 链上实时价";
  if (source === "okx-market") return "OKX MCP 实时价";
  return "其他行情来源";
}

function formatUpdatedAt(value?: string) {
  if (!value) return "刚刚";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AssetRow({
  asset,
  isLast,
  onPress,
}: {
  asset: WalletAssetItem;
  isLast: boolean;
  onPress?: () => void;
}) {
  const balance = formatAmount(toNumber(asset.balance));
  const valueUsd = formatFiat(toNumber(asset.valueUsd), 2);
  const tokenPrice = asset.tokenPrice || "0.00";
  const sourceLabel = getPriceSourceLabel(asset.priceSource);
  const updatedLabel = formatUpdatedAt(asset.priceUpdatedAt);

  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.assetRow,
        !isLast && styles.assetRowBorder,
        pressed && styles.assetRowPressed,
      ]}
    >
      <View style={styles.assetMain}>
        <View style={styles.assetBadge}>
          {asset.logoUrl ? (
            <Image source={{ uri: asset.logoUrl }} style={styles.assetIcon} />
          ) : (
            <MaterialCommunityIcons
              name="wallet-outline"
              size={26}
              color={PRIMARY}
            />
          )}
        </View>
        <View style={styles.assetInfo}>
          <Text style={styles.assetSymbol}>{asset.symbol}</Text>
          <Text style={styles.assetName}>
            {asset.tokenName || asset.symbol}
          </Text>
          <Text style={styles.assetMeta}>
            {sourceLabel} · {updatedLabel}
          </Text>
        </View>
      </View>
      <View style={styles.assetValueWrap}>
        <Text style={styles.assetValue}>${valueUsd}</Text>
        <Text style={styles.assetBalance}>
          {balance} {asset.symbol}
        </Text>
        <Text style={styles.assetUnitPrice}>≈ ${tokenPrice}</Text>
      </View>
      <MaterialIcons
        name="arrow-forward-ios"
        size={16}
        color="#A78BFA"
        style={styles.assetRowChevron}
      />
    </Pressable>
  );
}

export default function WalletRoute() {
  const [wallet, setWallet] = useState<StoredWalletSnapshot>(null);
  const [assets, setAssets] = useState<AgentWalletAssetsResponse | null>(null);
  const [approvalGroups, setApprovalGroups] = useState<ApprovalGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState("");

  const totalUsd = useMemo(
    () => formatFiat(toNumber(assets?.totalAssetValue), 2),
    [assets?.totalAssetValue],
  );
  const chainCards = useMemo<ChainCard[]>(
    () => assets?.walletAddresses || [],
    [assets?.walletAddresses],
  );
  const assetSourceText = useMemo(() => {
    if (!wallet?.evmAddress && !wallet?.solanaAddress) {
      return "登录并创建 Agent Wallet 后，这里会展示真实链上余额。";
    }
    if (assets?.source === "okx-mcp") {
      return "数据来源：OKX onchainos-skills MCP 实时资产与持仓";
    }
    return "当前仅展示真实链上数据；未查询到余额时会直接显示空状态。";
  }, [assets?.source, wallet?.evmAddress, wallet?.solanaAddress]);

  const securitySummary = useMemo(() => {
    const projects = approvalGroups.flatMap((group) => group.approvalProjects || []);
    const tokenCount = projects.reduce((acc, project) => acc + project.tokens.length, 0);
    return {
      projectCount: projects.length,
      tokenCount,
      sampleProjects: projects
        .map((project) => project.projectName || maskAddress(project.approveAddress))
        .filter(Boolean)
        .slice(0, 3),
    };
  }, [approvalGroups]);

  const loadAssets = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setErrorText("");

      const rawWallet = await AsyncStorage.getItem(WALLET_STORAGE_KEY);
      const parsedWallet = rawWallet
        ? (JSON.parse(rawWallet) as StoredWalletSnapshot)
        : null;

      setWallet(parsedWallet);

      // 只展示真实钱包数据；如果当前还没有完整地址，则直接进入空状态。
      if (!parsedWallet?.evmAddress || !parsedWallet?.solanaAddress) {
        setAssets(null);
        setApprovalGroups([]);
        return;
      }

      const [result, approvalsResult] = await Promise.all([
        getAccountAssets(parsedWallet),
        getOnchainApprovals({
          chainIndex: "1",
          address: parsedWallet.evmAddress,
          limit: "20",
        }).catch(() => null),
      ]);
      setAssets(result);
      setApprovalGroups(approvalsResult?.approvals ?? []);
    } catch (error) {
      setAssets(null);
      setErrorText(
        error instanceof Error ? error.message : "资产加载失败，请稍后重试。",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAssets(true);
  }, [loadAssets]);

  useFocusEffect(
    useCallback(() => {
      loadAssets(false);
    }, [loadAssets]),
  );

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      WALLET_REFRESH_EVENT,
      () => {
        setRefreshing(true);
        loadAssets(false);
      },
    );

    return () => {
      subscription.remove();
    };
  }, [loadAssets]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAssets(false);
  }, [loadAssets]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.pageGlowTop} />
      <View style={styles.pageGlowBottom} />

      <View style={styles.container}>
        <View style={styles.topBar}>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>资产总览</Text>
          </View>

          <Text style={styles.headerTitle}>钱包</Text>

          <Pressable
            style={styles.headerAction}
            onPress={() => router.push("/(tabs)/chat")}
          >
            <MaterialIcons
              name="arrow-back-ios-new"
              size={18}
              color={TEXT_PRIMARY}
            />
            <Text style={styles.headerActionText}>返回</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={PRIMARY}
            />
          }
        >
          <LinearGradient
            colors={["#FFFFFF", "#F7F3FF", "#EFEAFF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <Text style={styles.heroLabel}>总资产估值</Text>
            <Text style={styles.heroValue}>${totalUsd}</Text>
            <Text style={styles.heroSubText}>{assetSourceText}</Text>

            <View style={styles.addressList}>
              {wallet?.evmAddress ? (
                <View style={styles.addressChip}>
                  <Text style={styles.addressChipLabel}>EVM</Text>
                  <Text style={styles.addressChipText}>
                    {maskAddress(wallet.evmAddress)}
                  </Text>
                </View>
              ) : null}
              {wallet?.solanaAddress ? (
                <View style={styles.addressChip}>
                  <Text style={styles.addressChipLabel}>SOL</Text>
                  <Text style={styles.addressChipText}>
                    {maskAddress(wallet.solanaAddress)}
                  </Text>
                </View>
              ) : null}
            </View>
          </LinearGradient>


          <View style={styles.quickActionGrid}>
            <Pressable
              style={styles.quickActionCard}
              onPress={() => router.push("/(tabs)/earn")}
            >
              <View style={styles.quickActionIconWrap}>
                <MaterialCommunityIcons
                  name="cash-fast"
                  size={22}
                  color={PRIMARY}
                />
              </View>
              <Text style={styles.quickActionTitle}>AI 智能赚币</Text>
              <Text style={styles.quickActionDesc}>
                基于钱包状态与行情变化生成赚币策略。
              </Text>
            </Pressable>
            <Pressable
              style={styles.quickActionCard}
              onPress={() => router.push("/(tabs)/community")}
            >
              <View style={styles.quickActionIconWrap}>
                <MaterialCommunityIcons
                  name="robot-excited-outline"
                  size={22}
                  color={PRIMARY}
                />
              </View>
              <Text style={styles.quickActionTitle}>自动任务</Text>
              <Text style={styles.quickActionDesc}>
                查看盯盘、调仓与余额巡检任务的当前状态。
              </Text>
            </Pressable>
          </View>

          <View style={styles.securitySection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>钱包安全</Text>
              <Text style={styles.sectionHint}>已接入 OKX 授权查询</Text>
            </View>
            <View style={styles.securityCard}>
              <View style={styles.securityHeaderRow}>
                <View style={styles.securityIconWrap}>
                  <MaterialCommunityIcons
                    name="shield-check-outline"
                    size={22}
                    color={PRIMARY}
                  />
                </View>
                <View style={styles.securityTextWrap}>
                  <Text style={styles.securityTitle}>授权与风险暴露摘要</Text>
                  <Text style={styles.securityDesc}>
                    {wallet?.evmAddress
                      ? securitySummary.projectCount > 0
                        ? `当前在以太坊主链检测到 ${securitySummary.projectCount} 个已授权项目、${securitySummary.tokenCount} 条代币授权记录。`
                        : "当前未检测到需要关注的已授权项目，后续可继续接撤销授权链路。"
                      : "登录并生成 Agent Wallet 后，这里会展示真实授权与风险暴露摘要。"}
                  </Text>
                </View>
              </View>

              {securitySummary.sampleProjects.length ? (
                <View style={styles.securityTagRow}>
                  {securitySummary.sampleProjects.map((project) => (
                    <View key={project} style={styles.securityTag}>
                      <Text style={styles.securityTagText}>{project}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <Pressable
                style={styles.securityAction}
                onPress={() => router.push("/(tabs)/chat")}
              >
                <Text style={styles.securityActionText}>去对话页继续处理授权与风控</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.taskSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>自动任务卡片</Text>
              <Text style={styles.sectionHint}>已接入自动化展示骨架</Text>
            </View>
            {AGENT_TASKS.map((task) => (
              <View key={task.title} style={styles.taskCard}>
                <View style={styles.taskCardHeader}>
                  <View
                    style={[
                      styles.taskIconWrap,
                      { backgroundColor: `${task.accent}14` },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={task.icon}
                      size={22}
                      color={task.accent}
                    />
                  </View>
                  <View style={styles.taskCardTitleWrap}>
                    <Text style={styles.taskCardTitle}>{task.title}</Text>
                    <Text style={styles.taskCardSubtitle}>{task.subtitle}</Text>
                  </View>
                  <View
                    style={[
                      styles.taskStatusPill,
                      { backgroundColor: `${task.accent}14` },
                    ]}
                  >
                    <Text
                      style={[styles.taskStatusText, { color: task.accent }]}
                    >
                      {task.status}
                    </Text>
                  </View>
                </View>
                <View style={styles.taskMetaRow}>
                  <View style={styles.taskMetaItem}>
                    <MaterialCommunityIcons
                      name="clock-time-four-outline"
                      size={16}
                      color={TEXT_SECONDARY}
                    />
                    <Text style={styles.taskMetaText}>{task.cadence}</Text>
                  </View>
                  <View style={styles.taskMetaItem}>
                    <MaterialCommunityIcons
                      name="flash-outline"
                      size={16}
                      color={TEXT_SECONDARY}
                    />
                    <Text style={styles.taskMetaText}>
                      支持告警卡片与执行建议
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color={PRIMARY} />
              <Text style={styles.loadingText}>正在加载真实链上资产...</Text>
            </View>
          ) : null}

          {!loading && !!errorText ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>资产加载失败</Text>
              <Text style={styles.errorText}>{errorText}</Text>
            </View>
          ) : null}

          {!loading && !errorText
            ? chainCards.map((chain) => (
                <View
                  key={`${chain.chainName}-${chain.address}`}
                  style={styles.chainSection}
                >
                  <View style={styles.chainHeader}>
                    <View style={styles.chainTitleWrap}>
                      <View style={styles.chainIconWrap}>
                        <ChainIcon chainName={chain.chainName} />
                      </View>
                      <View>
                        <Text style={styles.chainTitle}>{chain.chainName}</Text>
                        <Text style={styles.chainAddress}>
                          {maskAddress(chain.address)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.chainCount}>
                      {chain.assets.length} 项资产
                    </Text>
                  </View>

                  <View style={styles.chainAssetCard}>
                    {chain.assets.length ? (
                      chain.assets.map((asset, index) => (
                        <AssetRow
                          key={`${chain.chainName}-${asset.symbol}-${asset.tokenAddress || "native"}`}
                          asset={asset}
                          isLast={index === chain.assets.length - 1}
                          onPress={() =>
                            router.push({
                              pathname: "/token-detail/[symbol]" as never,
                              params: {
                                symbol: asset.symbol,
                                tokenName: asset.tokenName || asset.symbol,
                                chainName: asset.chainName || chain.chainName,
                                chainIndex: asset.chainIndex,
                                tokenAddress: asset.tokenAddress || "",
                                walletAddress: chain.address,
                                balance: asset.balance,
                                valueUsd: asset.valueUsd,
                                tokenPrice: asset.tokenPrice,
                                logoUrl: asset.logoUrl || "",
                              } as never,
                            })
                          }
                        />
                      ))
                    ) : (
                      <Text style={styles.emptyText}>
                        该地址当前暂无可展示的链上资产。
                      </Text>
                    )}
                  </View>
                </View>
              ))
            : null}

          {!loading && !errorText && !chainCards.length ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>暂无链上资产</Text>
              <Text style={styles.emptyDesc}>
                当前没有读取到真实链上余额；完成登录或后续入金后会在这里展示真实资产明细。
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  pageGlowTop: {
    position: "absolute",
    top: -40,
    right: -30,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(124,58,237,0.10)",
  },
  pageGlowBottom: {
    position: "absolute",
    bottom: 100,
    left: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(124,58,237,0.08)",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 60,
    marginBottom: 8,
  },
  headerBadge: {
    minWidth: 88,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(124,58,237,0.10)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.12)",
  },
  headerBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    color: PRIMARY,
    fontWeight: "700",
    textAlign: "center",
  },
  headerAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 88,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.12)",
  },
  headerActionText: {
    fontSize: 14,
    lineHeight: 20,
    color: TEXT_PRIMARY,
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  heroCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(110,91,255,0.12)",
    shadowColor: "#C7BAFF",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 4,
  },
  heroLabel: {
    fontSize: 13,
    lineHeight: 18,
    color: PRIMARY,
    marginBottom: 4,
  },
  heroValue: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  heroSubText: {
    fontSize: 13,
    lineHeight: 18,
    color: TEXT_SECONDARY,
    marginBottom: 20,
  },
  addressList: {
    flexDirection: "row",
    gap: 8,
  },
  addressChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 99,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
  },
  addressChipLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: PRIMARY,
  },
  addressChipText: {
    fontSize: 13,
    lineHeight: 18,
    color: TEXT_PRIMARY,
  },
  loadingCard: {
    backgroundColor: "rgba(255, 255, 255, 0.84)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.10)",
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 120,
    marginBottom: 20,
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  loadingText: {
    fontSize: 15,
    lineHeight: 20,
    color: TEXT_SECONDARY,
  },
  errorCard: {
    backgroundColor: "#FEF2F2",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 120,
    marginBottom: 20,
  },
  demoNoticeCard: {
    backgroundColor: PRIMARY_LIGHT,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#DDD6FE",
    padding: 16,
    marginBottom: 20,
    gap: 6,
  },
  demoNoticeTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    color: PRIMARY,
  },
  demoNoticeText: {
    fontSize: 13,
    lineHeight: 18,
    color: TEXT_SECONDARY,
  },
  errorTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
    color: ERROR,
  },
  errorText: {
    fontSize: 15,
    lineHeight: 20,
    color: ERROR,
    textAlign: "center",
  },
  chainSection: {
    marginBottom: 20,
  },
  chainHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  chainTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chainIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 99,
    backgroundColor: PRIMARY_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  chainTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    color: TEXT_PRIMARY,
  },
  chainAddress: {
    fontSize: 12,
    lineHeight: 18,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
  chainCount: {
    fontSize: 12,
    lineHeight: 18,
    color: TEXT_SECONDARY,
  },
  chainAssetCard: {
    backgroundColor: "rgba(255, 255, 255, 0.82)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.10)",
    overflow: "hidden",
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  assetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  assetRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EEF0F6",
  },
  assetRowPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.995 }],
  },
  assetMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  assetBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PRIMARY_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  assetIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  assetInfo: {
    flex: 1,
  },
  assetSymbol: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    color: TEXT_PRIMARY,
  },
  assetName: {
    fontSize: 13,
    lineHeight: 18,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
  assetMeta: {
    fontSize: 11,
    lineHeight: 16,
    color: "#8B5CF6",
    marginTop: 4,
  },
  assetValueWrap: {
    alignItems: "flex-end",
    marginLeft: 12,
  },
  assetValue: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  assetBalance: {
    fontSize: 13,
    lineHeight: 18,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
  assetUnitPrice: {
    fontSize: 11,
    lineHeight: 16,
    color: "#8B5CF6",
    marginTop: 4,
  },
  assetRowChevron: {
    marginLeft: 10,
  },
  quickActionGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 18,
  },
  securitySection: {
    marginBottom: 18,
  },
  securityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 18,
    gap: 14,
  },
  securityHeaderRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  securityIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIMARY_LIGHT,
  },
  securityTextWrap: {
    flex: 1,
    gap: 4,
  },
  securityTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  securityDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: TEXT_SECONDARY,
  },
  securityTagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  securityTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: PRIMARY_LIGHT,
  },
  securityTagText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: PRIMARY,
  },
  securityAction: {
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F3FF",
  },
  securityActionText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: PRIMARY,
  },
  quickActionCard: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.10)",
    backgroundColor: "rgba(255,255,255,0.82)",
    padding: 16,
    minHeight: 142,
    shadowColor: "#7C3AED",
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 3,
  },
  quickActionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: PRIMARY_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  quickActionTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  quickActionDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: TEXT_SECONDARY,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  sectionHint: {
    fontSize: 12,
    lineHeight: 18,
    color: TEXT_SECONDARY,
  },
  taskSection: {
    marginBottom: 18,
  },
  taskCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    padding: 16,
    marginBottom: 12,
  },
  taskCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  taskIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  taskCardTitleWrap: {
    flex: 1,
    paddingRight: 12,
  },
  taskCardTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    marginBottom: 6,
  },
  taskCardSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: TEXT_SECONDARY,
  },
  taskStatusPill: {
    minHeight: 30,
    borderRadius: 15,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  taskStatusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  taskMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 14,
  },
  taskMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  taskMetaText: {
    fontSize: 12,
    lineHeight: 18,
    color: TEXT_SECONDARY,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 120,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
    color: TEXT_PRIMARY,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: TEXT_SECONDARY,
    textAlign: "center",
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  emptyDesc: {
    fontSize: 15,
    lineHeight: 20,
    color: TEXT_SECONDARY,
    textAlign: "center",
  },
});
