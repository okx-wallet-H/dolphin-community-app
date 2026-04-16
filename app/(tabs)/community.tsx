import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader } from "@/components/AppHeader";
import { TopTabs } from "@/components/TopTabs";
import {
  getStrategyLogs,
  getStrategyPerformance,
  getStrategyPositions,
  getStrategyStatus,
  type StrategyLogsResponse,
  type StrategyPerformanceResponse,
  type StrategyPositionsResponse,
  type StrategyRawToolResult,
  type StrategyStatusResponse,
} from "@/lib/_core/api";

const PRIMARY = "#7C3AED";
const PRIMARY_LIGHT = "#F5F3FF";
const PAGE_BG = "#FCFAFF";

const AGENT_PLAN_STORAGE_KEY = "hwallet-agent-plan";

type SyncedPlan = {
  strategyTitle: string;
  draft: string;
  activatedAt: number;
} | null;

async function loadSyncedPlan(): Promise<SyncedPlan> {
  try {
    const raw = await AsyncStorage.getItem(AGENT_PLAN_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SyncedPlan;
  } catch (storageError) {
    console.warn("[loadSyncedPlan] Failed to load synced plan:", storageError);
    return null;
  }
}
const CARD_BG = "rgba(255,255,255,0.84)";
const BORDER = "rgba(124,58,237,0.10)";
const TEXT_PRIMARY = "#171923";
const TEXT_SECONDARY = "#666C85";
const SUCCESS = "#16A34A";
const DANGER = "#DC2626";
const WARNING = "#EA580C";

type StrategyDashboardState = {
  status: StrategyStatusResponse | null;
  performance: StrategyPerformanceResponse | null;
  positions: StrategyPositionsResponse | null;
  logs: StrategyLogsResponse | null;
};

type RawRecord = Record<string, unknown>;

function toObject(value: unknown): RawRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RawRecord) : {};
}

function toArray(value: unknown): RawRecord[] {
  return Array.isArray(value) ? (value as RawRecord[]) : [];
}

function toNumber(value: unknown) {
  const num = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function getToolData(result?: StrategyRawToolResult | null) {
  return toArray(toObject(result).data);
}

function getBalanceRoot(performance: StrategyPerformanceResponse | null, positions: StrategyPositionsResponse | null) {
  const performanceBalance = getToolData(performance?.balance)[0];
  if (performanceBalance) {
    return toObject(performanceBalance);
  }
  const positionsBalance = getToolData(positions?.balance)[0];
  return toObject(positionsBalance);
}

function getBalanceDetails(balanceRoot: RawRecord) {
  return toArray(balanceRoot.details)
    .filter((item) => toNumber(item.eqUsd ?? item.eq ?? item.cashBal) > 0)
    .sort((left, right) => toNumber(right.eqUsd ?? right.eq ?? right.cashBal) - toNumber(left.eqUsd ?? left.eq ?? left.cashBal));
}

function formatCurrency(value: unknown, digits = 2) {
  const numberValue = toNumber(value);
  return numberValue.toLocaleString("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatCompactTime(value?: string) {
  if (!value) {
    return "--";
  }
  const asNumber = Number(value);
  const date = Number.isFinite(asNumber) && asNumber > 0 ? new Date(asNumber) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function countRunningStrategies(status: StrategyStatusResponse | null) {
  return (
    getToolData(status?.gridSpotActive).length +
    getToolData(status?.gridContractActive).length +
    getToolData(status?.dcaSpotActive).length +
    getToolData(status?.dcaContractActive).length
  );
}

function getStatusLabel(activeCount: number) {
  if (activeCount > 0) {
    return "运行中";
  }
  return "暂无运行策略";
}

function getStatusColor(activeCount: number) {
  return activeCount > 0 ? SUCCESS : TEXT_SECONDARY;
}

function extractPerformanceBars(performance: StrategyPerformanceResponse | null) {
  return getToolData(performance?.bills)
    .slice(0, 18)
    .map((item, index) => ({
      id: String(item.billId ?? item.ts ?? index),
      time: String(item.ts ?? ""),
      value: toNumber(item.pnl ?? item.balChg ?? item.sz),
    }))
    .reverse();
}

function extractRecentTrades(logs: StrategyLogsResponse | null) {
  return [
    ...getToolData(logs?.spotFills),
    ...getToolData(logs?.swapFills),
    ...getToolData(logs?.futuresFills),
  ]
    .sort((left, right) => toNumber(right.fillTime ?? right.ts) - toNumber(left.fillTime ?? left.ts))
    .slice(0, 8);
}

function extractRecentLogs(logs: StrategyLogsResponse | null) {
  const tradeHistory = getToolData(logs?.tradeHistory);
  if (tradeHistory.length > 0) {
    return tradeHistory.slice(0, 8);
  }
  return [
    ...getToolData(logs?.spotOrders),
    ...getToolData(logs?.swapOrders),
    ...getToolData(logs?.futuresOrders),
  ].slice(0, 8);
}

function PerformanceBars({ items }: { items: Array<{ id: string; time: string; value: number }> }) {
  const maxAbs = Math.max(...items.map((item) => Math.abs(item.value)), 1);

  if (items.length === 0) {
    return (
      <View style={styles.emptyChart}>
        <Text style={styles.emptyChartText}>当前按 MCP 原始账单数据展示，暂未返回可用于图形化的账单记录。</Text>
      </View>
    );
  }

  return (
    <View style={styles.chartWrapper}>
      <View style={styles.chartBaseline} />
      <View style={styles.chartBarsRow}>
        {items.map((item) => {
          const ratio = Math.max(Math.abs(item.value) / maxAbs, 0.08);
          const height = 26 + ratio * 86;
          const positive = item.value >= 0;
          return (
            <View key={item.id} style={styles.chartBarSlot}>
              <View
                style={[
                  styles.chartBar,
                  {
                    height,
                    backgroundColor: positive ? PRIMARY : WARNING,
                    opacity: positive ? 0.92 : 0.7,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.chartLabelsRow}>
        <Text style={styles.chartLabelText}>{formatCompactTime(items[0]?.time)}</Text>
        <Text style={styles.chartLabelText}>{formatCompactTime(items[items.length - 1]?.time)}</Text>
      </View>
    </View>
  );
}

export default function CommunityRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [syncedPlan, setSyncedPlan] = useState<SyncedPlan>(null);
  const [data, setData] = useState<StrategyDashboardState>({
    status: null,
    performance: null,
    positions: null,
    logs: null,
  });
  const [searchText, setSearchText] = useState("");

  const loadDashboard = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setErrorMessage("");
      const [status, performance, positions, logs, plan] = await Promise.all([
        getStrategyStatus(),
        getStrategyPerformance(),
        getStrategyPositions(),
        getStrategyLogs(),
        loadSyncedPlan(),
      ]);
      setData({ status, performance, positions, logs });
      setSyncedPlan(plan);
      if (plan) {
        setFlashMessage(`已同步赚币策略：${plan.strategyTitle}`);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "策略数据加载失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard]),
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboard(true);
  }, [loadDashboard]);

  const activeCount = useMemo(() => countRunningStrategies(data.status), [data.status]);
  const statusColor = useMemo(() => getStatusColor(activeCount), [activeCount]);
  const balanceRoot = useMemo(() => getBalanceRoot(data.performance, data.positions), [data.performance, data.positions]);
  const balanceDetails = useMemo(() => getBalanceDetails(balanceRoot).slice(0, 6), [balanceRoot]);
  const openPositions = useMemo(() => getToolData(data.positions?.positions).slice(0, 6), [data.positions]);
  const performanceBars = useMemo(() => extractPerformanceBars(data.performance), [data.performance]);
  const recentTrades = useMemo(() => extractRecentTrades(data.logs), [data.logs]);
  const recentLogs = useMemo(() => extractRecentLogs(data.logs), [data.logs]);

  const gridSpotCount = getToolData(data.status?.gridSpotActive).length;
  const gridContractCount = getToolData(data.status?.gridContractActive).length;
  const dcaSpotCount = getToolData(data.status?.dcaSpotActive).length;
  const dcaContractCount = getToolData(data.status?.dcaContractActive).length;
  const toolCount = toArray(toObject(data.status?.toolList).tools).length;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={PRIMARY} />}
      >
        <View style={styles.fixedHeaderWrap}>
          <AppHeader
            onWalletPress={() => router.push("/(tabs)/wallet")}
            onRightPress={() => router.push("/(tabs)/profile")}
            centerContent={
              <TopTabs
                activeTab="community"
                onChange={(tab) => {
                  if (tab === "chat") {
                    router.push("/(tabs)/chat");
                  }
                }}
              />
            }
          />
        </View>

        <View style={styles.searchHeader}>
          <View style={styles.searchBox}>
            <MaterialCommunityIcons name="magnify" size={20} color={TEXT_SECONDARY} />
            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder="搜索代币、合约、地址"
              placeholderTextColor="#8B90A7"
              style={styles.searchInput}
            />
            {searchText ? (
              <Pressable style={styles.searchAction} onPress={() => setSearchText("")}>
                <MaterialCommunityIcons name="close-circle" size={18} color={TEXT_SECONDARY} />
              </Pressable>
            ) : (
              <View style={styles.searchAction}>
                <MaterialCommunityIcons name="line-scan" size={18} color={PRIMARY} />
              </View>
            )}
          </View>
          <Text style={styles.searchHint}>搜代币、合约、地址，社区页顶部统一入口已切换为搜索框。</Text>
        </View>

        <LinearGradient colors={["rgba(255,255,255,0.98)", "rgba(246,247,250,0.98)", "rgba(239,242,247,0.96)"]} style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.heroEyebrow}>社区对话入口</Text>
              <Text style={styles.heroTitle}>在发现策略之前，先让 Agent 理解你的目标</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusBadgeText, { color: statusColor }]}>{getStatusLabel(activeCount)}</Text>
            </View>
          </View>
          <Text style={styles.heroDesc}>
            社区页不再只是检索入口，而是承接“发现机会、理解策略、进入对话执行”的前置场景，下方继续保留真实策略与交易数据卡片作为判断依据。
          </Text>
          <View style={styles.metricRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{activeCount}</Text>
              <Text style={styles.metricLabel}>运行策略数</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>${formatCurrency(balanceRoot.totalEq ?? 0)}</Text>
              <Text style={styles.metricLabel}>账户总权益</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{recentTrades.length}</Text>
              <Text style={styles.metricLabel}>最近成交数</Text>
            </View>
          </View>
        </LinearGradient>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={styles.loadingText}>正在拉取 OKX Agent Trade Kit 数据…</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorCard}>
            <MaterialCommunityIcons name="alert-circle-outline" size={18} color={DANGER} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {flashMessage ? (
          <View style={styles.flashCard}>
            <MaterialCommunityIcons name="check-circle-outline" size={16} color={SUCCESS} />
            <Text style={styles.flashText}>{flashMessage}</Text>
          </View>
        ) : null}

        {syncedPlan ? (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>自动任务回执</Text>
          </View>
        ) : null}
        {syncedPlan ? (
          <View style={styles.syncedPlanCard}>
            <Text style={styles.syncedPlanTitle}>{syncedPlan.strategyTitle}</Text>
            <Text style={styles.syncedPlanMeta}>稳定币收益巡航 · 已同步到自动任务</Text>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>策略运行概览</Text>
          <Text style={styles.sectionMeta}>MCP 工具数 {toolCount}</Text>
        </View>
        <View style={styles.panelGrid}>
          <View style={styles.panelCard}>
            <Text style={styles.panelTitle}>运行状态</Text>
            <Text style={[styles.panelBigValue, { color: statusColor }]}>{getStatusLabel(activeCount)}</Text>
            <Text style={styles.panelHint}>运行中策略数 {activeCount}</Text>
          </View>
          <View style={styles.panelCard}>
            <Text style={styles.panelTitle}>网格策略</Text>
            <Text style={styles.panelBigValue}>{gridSpotCount + gridContractCount}</Text>
            <Text style={styles.panelHint}>现货 {gridSpotCount} / 合约 {gridContractCount}</Text>
          </View>
          <View style={styles.panelCard}>
            <Text style={styles.panelTitle}>定投策略</Text>
            <Text style={styles.panelBigValue}>{dcaSpotCount + dcaContractCount}</Text>
            <Text style={styles.panelHint}>现货 {dcaSpotCount} / 合约 {dcaContractCount}</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>收益判断依据</Text>
          <Text style={styles.sectionMeta}>直接来自 balance / bills 原始结果</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.performanceHeader}>
            <View>
              <Text style={styles.cardTitle}>账户收益概览</Text>
              <Text style={styles.cardSubtitle}>前端从 MCP 原始返回中读取 totalEq、availEq、upl 与账单数组。</Text>
            </View>
            <MaterialCommunityIcons name="chart-line" size={22} color={PRIMARY} />
          </View>
          <View style={styles.performanceMetricsRow}>
            <View style={styles.performanceMetricItem}>
              <Text style={styles.performanceMetricLabel}>总权益</Text>
              <Text style={styles.performanceMetricValue}>${formatCurrency(balanceRoot.totalEq ?? 0)}</Text>
            </View>
            <View style={styles.performanceMetricItem}>
              <Text style={styles.performanceMetricLabel}>可用权益</Text>
              <Text style={styles.performanceMetricValue}>${formatCurrency(balanceRoot.availEq ?? 0)}</Text>
            </View>
            <View style={styles.performanceMetricItem}>
              <Text style={styles.performanceMetricLabel}>未实现盈亏</Text>
              <Text style={[styles.performanceMetricValue, { color: toNumber(balanceRoot.upl) >= 0 ? SUCCESS : DANGER }]}>
                ${formatCurrency(balanceRoot.upl ?? 0)}
              </Text>
            </View>
          </View>
          <PerformanceBars items={performanceBars} />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>仓位与资产判断</Text>
          <Text style={styles.sectionMeta}>优先展示 balance.details，其次展示 positions.data</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>账户资产分布</Text>
          {(balanceDetails.length > 0 ? balanceDetails : openPositions).map((item, index) => (
            <View key={String(item.ccy ?? item.instId ?? index)} style={styles.listRow}>
              <View style={styles.listLeft}>
                <View style={styles.assetIconWrap}>
                  <Text style={styles.assetIconText}>{String(item.ccy ?? item.instId ?? "--").slice(0, 3).toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={styles.listTitle}>{String(item.ccy ?? item.instId ?? "未知资产")}</Text>
                  <Text style={styles.listSubtitle}>
                    {item.posSide ? `方向 ${String(item.posSide)}` : `可用 ${String(item.availBal ?? item.availPos ?? item.cashBal ?? "--")}`}
                  </Text>
                </View>
              </View>
              <View style={styles.listRight}>
                <Text style={styles.listValue}>${formatCurrency(item.eqUsd ?? item.notionalUsd ?? item.notionalUsdForSwap ?? item.eq ?? 0)}</Text>
                <Text style={styles.listSecondary}>{String(item.eq ?? item.pos ?? item.cashBal ?? "--")}</Text>
              </View>
            </View>
          ))}
          {balanceDetails.length === 0 && openPositions.length === 0 ? <Text style={styles.emptyText}>当前未返回持仓或资产余额数据。</Text> : null}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>近期交易线索</Text>
          <Text style={styles.sectionMeta}>直接来自 fills 原始结果</Text>
        </View>
        <View style={styles.card}>
          {recentTrades.map((item, index) => {
            const side = String(item.side ?? item.execType ?? "trade");
            const isBuy = side.toLowerCase().includes("buy");
            return (
              <View key={String(item.tradeId ?? item.billId ?? item.ordId ?? index)} style={styles.tradeRow}>
                <View style={[styles.tradeBadge, { backgroundColor: isBuy ? `${SUCCESS}18` : `${WARNING}18` }]}>
                  <Text style={[styles.tradeBadgeText, { color: isBuy ? SUCCESS : WARNING }]}>{isBuy ? "买入" : "卖出"}</Text>
                </View>
                <View style={styles.tradeMain}>
                  <Text style={styles.tradeTitle}>{String(item.instId ?? item.ccy ?? "未知标的")}</Text>
                  <Text style={styles.tradeSubtitle}>时间 {formatCompactTime(String(item.fillTime ?? item.ts ?? ""))}</Text>
                </View>
                <View style={styles.tradeRight}>
                  <Text style={styles.tradeValue}>{String(item.fillSz ?? item.sz ?? "--")}</Text>
                  <Text style={styles.tradeSubtitle}>价格 {String(item.fillPx ?? item.avgPx ?? item.px ?? "--")}</Text>
                </View>
              </View>
            );
          })}
          {recentTrades.length === 0 ? <Text style={styles.emptyText}>当前没有可展示的成交记录。</Text> : null}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>策略执行线索</Text>
          <Text style={styles.sectionMeta}>优先展示 tradeHistory，否则展示 orders 原始结果</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardSubtitle}>该区块直接消费 MCP 原始 JSON，仅做展示格式化。</Text>
          {recentLogs.map((item, index) => (
            <View key={String(item.id ?? item.ordId ?? item.billId ?? index)} style={styles.logRow}>
              <View style={styles.logBullet} />
              <View style={styles.logContent}>
                <Text style={styles.logTitle}>{String(item.tool ?? item.instId ?? item.clOrdId ?? "策略事件")}</Text>
                <Text style={styles.logText} numberOfLines={3}>
                  {JSON.stringify(item)}
                </Text>
              </View>
            </View>
          ))}
          {recentLogs.length === 0 ? <Text style={styles.emptyText}>当前没有可展示的策略日志。</Text> : null}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>交易排名参考</Text>
          <Text style={styles.sectionMeta}>当前后端未加工该字段</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.rankingHeader}>
            <MaterialCommunityIcons name="trophy-outline" size={22} color={PRIMARY} />
            <Text style={styles.cardTitle}>OKX 交易赛排名</Text>
          </View>
          <Text style={styles.emptyText}>当前 strategy 接口仅纯透传已接入的 MCP 工具结果，未包含官方排名数据。</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  fixedHeaderWrap: {
    marginBottom: 2,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 14,
  },
  searchHeader: {
    gap: 10,
    marginBottom: 6,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    backgroundColor: "rgba(255,255,255,0.9)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    color: TEXT_PRIMARY,
    paddingVertical: 0,
  },
  searchAction: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.05)",
  },
  searchHint: {
    fontSize: 12,
    lineHeight: 18,
    color: TEXT_SECONDARY,
    paddingHorizontal: 4,
  },
  heroCard: {
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    gap: 14,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 22,
    elevation: 4,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  heroEyebrow: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "700",
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 24,
    color: TEXT_PRIMARY,
    fontWeight: "800",
    lineHeight: 31,
    maxWidth: 250,
  },
  heroDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: TEXT_SECONDARY,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  metricRow: {
    flexDirection: "row",
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    gap: 6,
  },
  metricValue: {
    fontSize: 20,
    color: TEXT_PRIMARY,
    fontWeight: "800",
  },
  metricLabel: {
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
  loadingCard: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  loadingText: {
    color: TEXT_SECONDARY,
    fontSize: 13,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    flex: 1,
    color: DANGER,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 17,
    color: TEXT_PRIMARY,
    fontWeight: "800",
  },
  sectionMeta: {
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
  panelGrid: {
    flexDirection: "row",
    gap: 10,
  },
  panelCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  panelTitle: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    fontWeight: "600",
  },
  panelBigValue: {
    fontSize: 24,
    color: TEXT_PRIMARY,
    fontWeight: "800",
  },
  panelHint: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    lineHeight: 18,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    borderRadius: 20,
    padding: 16,
    gap: 14,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    color: TEXT_PRIMARY,
    fontWeight: "800",
  },
  cardSubtitle: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    lineHeight: 18,
  },
  performanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  performanceMetricsRow: {
    flexDirection: "row",
    gap: 10,
  },
  performanceMetricItem: {
    flex: 1,
    backgroundColor: PRIMARY_LIGHT,
    borderRadius: 16,
    padding: 12,
    gap: 6,
  },
  performanceMetricLabel: {
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
  performanceMetricValue: {
    fontSize: 18,
    color: TEXT_PRIMARY,
    fontWeight: "800",
  },
  chartWrapper: {
    borderRadius: 18,
    backgroundColor: "#FBFAFF",
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#EEE7FF",
    gap: 10,
  },
  chartBaseline: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 78,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  chartBarsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 130,
  },
  chartBarSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  chartBar: {
    width: 10,
    borderRadius: 999,
  },
  chartLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  chartLabelText: {
    fontSize: 11,
    color: TEXT_SECONDARY,
  },
  emptyChart: {
    backgroundColor: "#FBFAFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EEE7FF",
    padding: 18,
  },
  emptyChartText: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 18,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  listLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  listRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  assetIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: PRIMARY_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  assetIconText: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: "800",
  },
  listTitle: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "700",
  },
  listSubtitle: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    marginTop: 2,
  },
  listValue: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "700",
  },
  listSecondary: {
    color: TEXT_SECONDARY,
    fontSize: 12,
  },
  tradeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tradeBadge: {
    minWidth: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tradeBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  tradeMain: {
    flex: 1,
    gap: 4,
  },
  tradeRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  tradeTitle: {
    fontSize: 14,
    color: TEXT_PRIMARY,
    fontWeight: "700",
  },
  tradeSubtitle: {
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
  tradeValue: {
    fontSize: 14,
    color: TEXT_PRIMARY,
    fontWeight: "700",
  },
  logRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  logBullet: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: PRIMARY,
    marginTop: 5,
  },
  logContent: {
    flex: 1,
    gap: 4,
  },
  logTitle: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "700",
  },
  logText: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 18,
  },
  rankingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  emptyText: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 18,
  },
  flashCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0FFF4",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  flashText: {
    color: SUCCESS,
    fontSize: 13,
    flex: 1,
  },
  syncedPlanCard: {
    backgroundColor: "#F7F3FF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  syncedPlanTitle: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  syncedPlanMeta: {
    color: TEXT_SECONDARY,
    fontSize: 12,
  },
});
