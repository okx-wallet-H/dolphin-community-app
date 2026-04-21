
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
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

import {
  getOnchainTaskFeed,
  getStrategyLogs,
  getStrategyPerformance,
  getStrategyPositions,
  getStrategySignals,
  getStrategyStatus,
  type OnchainTaskFeedResponse,
  type OnchainTaskRecord,
  type StrategyLogsResponse,
  type StrategyPerformanceResponse,
  type StrategyPositionsResponse,
  type StrategyRawToolResult,
  type StrategySignalsResponse,
  type StrategyStatusResponse,
} from "@/lib/_core/api";

const PRIMARY = "#7C3AED";
const PRIMARY_LIGHT = "#F5F3FF";
const PAGE_BG = "#FCFAFF";
const CARD_BG = "rgba(255,255,255,0.92)";
const BORDER = "rgba(124,58,237,0.10)";
const TEXT_PRIMARY = "#171923";
const TEXT_SECONDARY = "#666C85";
const SUCCESS = "#16A34A";
const DANGER = "#DC2626";
const WARNING = "#EA580C";

const AGENT_PLAN_STORAGE_KEY = "hwallet-agent-plan";

type SyncedPlan = {
  strategyTitle: string;
  draft: string;
  activatedAt: number;
} | null;

type StrategyCenterState = {
  status: StrategyStatusResponse | null;
  performance: StrategyPerformanceResponse | null;
  positions: StrategyPositionsResponse | null;
  logs: StrategyLogsResponse | null;
  signals: StrategySignalsResponse | null;
  taskFeed: OnchainTaskFeedResponse | null;
};

type RawRecord = Record<string, unknown>;

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

function formatCompactTime(value?: string | number) {
  if (!value) {
    return "--";
  }
  const asNumber = Number(value);
  const date = Number.isFinite(asNumber) && asNumber > 0 ? new Date(asNumber) : new Date(String(value));
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
  return "待触发";
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

function getPhaseTone(phase: OnchainTaskRecord["phase"]) {
  if (phase === "success") return { label: "已完成", color: SUCCESS, bg: `${SUCCESS}16` };
  if (phase === "failed") return { label: "失败", color: DANGER, bg: `${DANGER}14` };
  if (phase === "executing") return { label: "执行中", color: WARNING, bg: `${WARNING}16` };
  if (phase === "awaiting_confirmation") return { label: "待确认", color: PRIMARY, bg: `${PRIMARY}16` };
  return { label: "预览", color: TEXT_SECONDARY, bg: `${TEXT_SECONDARY}14` };
}

function maskMiddle(value: string, left = 6, right = 4) {
  if (!value) return "--";
  if (value.length <= left + right + 3) return value;
  return `${value.slice(0, left)}...${value.slice(-right)}`;
}

function PerformanceBars({ items }: { items: Array<{ id: string; time: string; value: number }> }) {
  const maxAbs = Math.max(...items.map((item) => Math.abs(item.value)), 1);

  if (items.length === 0) {
    return (
      <View style={styles.emptyChart}>
        <Text style={styles.emptyChartText}>当前尚未返回可图形化的账单波动，后续会随着真实交易与收益沉淀逐步丰富。</Text>
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
  const [searchText, setSearchText] = useState("");
  const [data, setData] = useState<StrategyCenterState>({
    status: null,
    performance: null,
    positions: null,
    logs: null,
    signals: null,
    taskFeed: null,
  });

  const loadDashboard = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setErrorMessage("");
      const [status, performance, positions, logs, signals, taskFeed, plan] = await Promise.allSettled([
        getStrategyStatus(),
        getStrategyPerformance(),
        getStrategyPositions(),
        getStrategyLogs(),
        getStrategySignals(),
        getOnchainTaskFeed({ limit: "8" }),
        loadSyncedPlan(),
      ]);

      const nextData: StrategyCenterState = {
        status: status.status === "fulfilled" ? status.value : null,
        performance: performance.status === "fulfilled" ? performance.value : null,
        positions: positions.status === "fulfilled" ? positions.value : null,
        logs: logs.status === "fulfilled" ? logs.value : null,
        signals: signals.status === "fulfilled" ? signals.value : null,
        taskFeed: taskFeed.status === "fulfilled" ? taskFeed.value : null,
      };
      setData(nextData);

      const resolvedPlan = plan.status === "fulfilled" ? plan.value : null;
      setSyncedPlan(resolvedPlan);
      if (resolvedPlan) {
        setFlashMessage(`已同步策略：${resolvedPlan.strategyTitle}`);
      } else if ((nextData.taskFeed?.summary.total ?? 0) > 0) {
        setFlashMessage(`最近 ${nextData.taskFeed?.summary.total ?? 0} 条自动执行记录已载入策略中心`);
      } else {
        setFlashMessage(null);
      }

      const failedBlocks = [status, performance, positions, logs, signals, taskFeed].filter((item) => item.status === "rejected").length;
      if (failedBlocks > 0) {
        setErrorMessage(`部分数据暂时不可用，已先展示可获取到的策略、信号与执行信息。`);
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
  const taskSummary = data.taskFeed?.summary;
  const taskList = data.taskFeed?.tasks ?? [];
  const marketPulse = data.signals?.marketPulse ?? [];
  const smartSignals = data.signals?.smartMoneySignals ?? [];

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
          <Pressable style={styles.backRow} onPress={() => router.push("/(tabs)/chat") }>
            <MaterialCommunityIcons name="arrow-left" size={20} color={TEXT_PRIMARY} />
            <Text style={styles.backText}>返回对话</Text>
          </Pressable>
        </View>

        <View style={styles.searchHeader}>
          <View style={styles.searchBox}>
            <MaterialCommunityIcons name="magnify" size={20} color={TEXT_SECONDARY} />
            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder="一句话描述策略、目标价或追踪地址"
              placeholderTextColor="#8B90A7"
              style={styles.searchInput}
              returnKeyType="search"
              onSubmitEditing={() => {
                const keyword = searchText.trim();
                if (!keyword) return;
                router.push({ pathname: "/(tabs)/chat", params: { q: keyword, source: "strategy-center" } });
              }}
            />
            {searchText ? (
              <Pressable style={styles.searchAction} onPress={() => setSearchText("")}>
                <MaterialCommunityIcons name="close-circle" size={18} color={TEXT_SECONDARY} />
              </Pressable>
            ) : (
              <View style={styles.searchAction}>
                <MaterialCommunityIcons name="robot-outline" size={18} color={PRIMARY} />
              </View>
            )}
          </View>
          <Text style={styles.searchHint}>这里是策略中心：你可以直接交代交易目标、收益诉求或信号条件，再回到对话执行。</Text>
        </View>

        <LinearGradient colors={["rgba(255,255,255,0.98)", "rgba(246,247,250,0.98)", "rgba(239,242,247,0.96)"]} style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.heroEyebrow}>AI 策略中心</Text>
              <Text style={styles.heroTitle}>让 Agent 发现机会、触发信号并自动推进交易流程</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusBadgeText, { color: statusColor }]}>{getStatusLabel(activeCount)}</Text>
            </View>
          </View>
          <Text style={styles.heroDesc}>
            当前页面不再只是看板，而是统一承接三层信息：真实策略运行状态、市场/聪明钱信号、以及链上自动执行时间线。你后续看到的收益与任务回流，都会先汇总在这里。
          </Text>
          <View style={styles.metricRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{activeCount}</Text>
              <Text style={styles.metricLabel}>运行策略数</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{taskSummary?.runningCount ?? 0}</Text>
              <Text style={styles.metricLabel}>自动执行中</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>${formatCurrency(balanceRoot.totalEq ?? 0)}</Text>
              <Text style={styles.metricLabel}>账户总权益</Text>
            </View>
          </View>
        </LinearGradient>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={styles.loadingText}>正在同步策略状态、执行时间线与信号数据…</Text>
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
          <View style={styles.syncedPlanCard}>
            <Text style={styles.syncedPlanTitle}>{syncedPlan.strategyTitle}</Text>
            <Text style={styles.syncedPlanMeta}>策略草案已同步进策略中心，后续将与自动执行时间线一起追踪。</Text>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>自动策略总览</Text>
          <Text style={styles.sectionMeta}>策略工具数 {toolCount}</Text>
        </View>
        <View style={styles.panelGrid}>
          <View style={styles.panelCard}>
            <Text style={styles.panelTitle}>运行状态</Text>
            <Text style={[styles.panelBigValue, { color: statusColor }]}>{getStatusLabel(activeCount)}</Text>
            <Text style={styles.panelHint}>运行中策略 {activeCount}</Text>
          </View>
          <View style={styles.panelCard}>
            <Text style={styles.panelTitle}>网格 / 定投</Text>
            <Text style={styles.panelBigValue}>{gridSpotCount + gridContractCount + dcaSpotCount + dcaContractCount}</Text>
            <Text style={styles.panelHint}>网格 {gridSpotCount + gridContractCount} · 定投 {dcaSpotCount + dcaContractCount}</Text>
          </View>
          <View style={styles.panelCard}>
            <Text style={styles.panelTitle}>Onchain 任务</Text>
            <Text style={styles.panelBigValue}>{taskSummary?.total ?? 0}</Text>
            <Text style={styles.panelHint}>成功 {taskSummary?.successCount ?? 0} · 失败 {taskSummary?.failedCount ?? 0}</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>AI 信号追踪</Text>
          <Text style={styles.sectionMeta}>Market + Smart Money</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>市场脉搏</Text>
          <View style={styles.signalPulseRow}>
            {marketPulse.map((item) => (
              <View key={item.symbol} style={styles.signalPulseCard}>
                <Text style={styles.signalPulseSymbol}>{item.symbol}</Text>
                <Text style={styles.signalPulsePrice}>{item.price ? `$${item.price}` : "--"}</Text>
                <Text style={styles.signalPulseMeta}>{item.error ? "价格暂不可用" : `更新 ${formatCompactTime(item.timestamp)}`}</Text>
              </View>
            ))}
          </View>
          <View style={styles.signalDivider} />
          <Text style={styles.cardTitle}>聪明钱异动</Text>
          {smartSignals.map((item) => {
            const positive = item.side.toLowerCase().includes("buy");
            return (
              <View key={item.id} style={styles.signalRow}>
                <View style={[styles.signalBadge, { backgroundColor: positive ? `${SUCCESS}16` : `${WARNING}16` }]}>
                  <Text style={[styles.signalBadgeText, { color: positive ? SUCCESS : WARNING }]}>{positive ? "买入" : item.side || "信号"}</Text>
                </View>
                <View style={styles.signalMain}>
                  <Text style={styles.signalTitle}>{item.tokenSymbol}</Text>
                  <Text style={styles.signalMeta}>地址 {maskMiddle(item.walletAddress)} · {formatCompactTime(item.timestamp)}</Text>
                </View>
                <Text style={styles.signalValue}>{item.amountUsd ? `$${item.amountUsd}` : "--"}</Text>
              </View>
            );
          })}
          {smartSignals.length === 0 ? <Text style={styles.emptyText}>当前没有返回可展示的聪明钱异动，信号模块会继续沿用真实 OKX 数据刷新。</Text> : null}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>自动执行时间线</Text>
          <Text style={styles.sectionMeta}>Onchain Task Feed</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardSubtitle}>这里会回流一句话交易生成的链上任务，展示其预览、执行、回执与失败日志。</Text>
          {taskList.map((task) => {
            const tone = getPhaseTone(task.phase);
            return (
              <View key={task.txId} style={styles.taskCard}>
                <View style={styles.taskHeader}>
                  <View>
                    <Text style={styles.taskTitle}>{task.fromToken ?? "FROM"} → {task.toToken ?? "TO"}</Text>
                    <Text style={styles.taskMeta}>{task.amount} · 链 {task.chainIndex} · {formatCompactTime(task.updatedAt)}</Text>
                  </View>
                  <View style={[styles.taskPhaseBadge, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.taskPhaseText, { color: tone.color }]}>{tone.label}</Text>
                  </View>
                </View>
                <Text style={styles.taskSubMeta}>钱包 {maskMiddle(task.userWalletAddress)} · 任务 {maskMiddle(task.txId, 8, 6)}</Text>
                {task.logs.slice(0, 4).map((log) => (
                  <View key={log.id} style={styles.taskLogRow}>
                    <View style={[styles.taskLogDot, { backgroundColor: log.level === "error" ? DANGER : log.level === "warn" ? WARNING : PRIMARY }]} />
                    <View style={styles.taskLogContent}>
                      <Text style={styles.taskLogTitle}>{log.message}</Text>
                      <Text style={styles.taskLogMeta}>{log.eventType} · {formatCompactTime(log.createdAt)}</Text>
                    </View>
                  </View>
                ))}
                {task.lastError ? <Text style={styles.taskError}>最近错误：{task.lastError}</Text> : null}
              </View>
            );
          })}
          {taskList.length === 0 ? <Text style={styles.emptyText}>当前还没有链上自动执行任务。完成一句话交易后，这里会出现完整动态流程。</Text> : null}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>收益判断依据</Text>
          <Text style={styles.sectionMeta}>Balance / Bills</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.performanceHeader}>
            <View>
              <Text style={styles.cardTitle}>账户收益概览</Text>
              <Text style={styles.cardSubtitle}>总权益、可用权益与未实现盈亏直接来自 OKX 能力层原始返回。</Text>
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
          <Text style={styles.sectionMeta}>Balance / Positions</Text>
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
          <Text style={styles.sectionTitle}>近期真实成交</Text>
          <Text style={styles.sectionMeta}>Fills</Text>
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
          <Text style={styles.sectionTitle}>策略执行日志</Text>
          <Text style={styles.sectionMeta}>Trade History / Orders</Text>
        </View>
        <View style={styles.card}>
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
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 2,
    alignSelf: "flex-start",
  },
  backText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    color: TEXT_PRIMARY,
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
    backgroundColor: CARD_BG,
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
  flashCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  flashText: {
    flex: 1,
    color: SUCCESS,
    fontSize: 13,
    lineHeight: 18,
  },
  syncedPlanCard: {
    backgroundColor: PRIMARY_LIGHT,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 6,
  },
  syncedPlanTitle: {
    fontSize: 16,
    color: TEXT_PRIMARY,
    fontWeight: "800",
  },
  syncedPlanMeta: {
    fontSize: 12,
    lineHeight: 18,
    color: TEXT_SECONDARY,
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
    backgroundColor: CARD_BG,
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
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  cardSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: TEXT_SECONDARY,
  },
  signalPulseRow: {
    flexDirection: "row",
    gap: 10,
  },
  signalPulseCard: {
    flex: 1,
    backgroundColor: "rgba(124,58,237,0.06)",
    borderRadius: 16,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.08)",
  },
  signalPulseSymbol: {
    fontSize: 13,
    fontWeight: "700",
    color: TEXT_SECONDARY,
  },
  signalPulsePrice: {
    fontSize: 18,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  signalPulseMeta: {
    fontSize: 12,
    lineHeight: 18,
    color: TEXT_SECONDARY,
  },
  signalDivider: {
    height: 1,
    backgroundColor: "rgba(15,23,42,0.06)",
    marginVertical: 2,
  },
  signalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  signalBadge: {
    minWidth: 56,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: "center",
  },
  signalBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  signalMain: {
    flex: 1,
    gap: 3,
  },
  signalTitle: {
    fontSize: 14,
    color: TEXT_PRIMARY,
    fontWeight: "700",
  },
  signalMeta: {
    fontSize: 12,
    lineHeight: 18,
    color: TEXT_SECONDARY,
  },
  signalValue: {
    fontSize: 13,
    color: TEXT_PRIMARY,
    fontWeight: "700",
  },
  taskCard: {
    borderRadius: 18,
    padding: 14,
    gap: 10,
    backgroundColor: "rgba(124,58,237,0.04)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.08)",
  },
  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  taskTitle: {
    fontSize: 15,
    color: TEXT_PRIMARY,
    fontWeight: "800",
  },
  taskMeta: {
    fontSize: 12,
    lineHeight: 18,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
  taskSubMeta: {
    fontSize: 12,
    lineHeight: 18,
    color: TEXT_SECONDARY,
  },
  taskPhaseBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  taskPhaseText: {
    fontSize: 12,
    fontWeight: "700",
  },
  taskLogRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  taskLogDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    marginTop: 6,
  },
  taskLogContent: {
    flex: 1,
    gap: 2,
  },
  taskLogTitle: {
    fontSize: 13,
    lineHeight: 18,
    color: TEXT_PRIMARY,
    fontWeight: "600",
  },
  taskLogMeta: {
    fontSize: 12,
    lineHeight: 18,
    color: TEXT_SECONDARY,
  },
  taskError: {
    fontSize: 12,
    lineHeight: 18,
    color: DANGER,
  },
  performanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  performanceMetricsRow: {
    flexDirection: "row",
    gap: 10,
  },
  performanceMetricItem: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.03)",
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
    marginTop: 4,
    gap: 10,
  },
  chartBaseline: {
    height: 1,
    backgroundColor: "rgba(15,23,42,0.08)",
  },
  chartBarsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    minHeight: 128,
  },
  chartBarSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  chartBar: {
    width: "100%",
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
    borderRadius: 16,
    padding: 14,
    backgroundColor: "rgba(15,23,42,0.03)",
  },
  emptyChartText: {
    fontSize: 12,
    lineHeight: 18,
    color: TEXT_SECONDARY,
  },
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  listLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  listRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  assetIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(124,58,237,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  assetIconText: {
    fontSize: 12,
    fontWeight: "800",
    color: PRIMARY,
  },
  listTitle: {
    fontSize: 14,
    color: TEXT_PRIMARY,
    fontWeight: "700",
  },
  listSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: TEXT_SECONDARY,
  },
  listValue: {
    fontSize: 14,
    color: TEXT_PRIMARY,
    fontWeight: "700",
  },
  listSecondary: {
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
  tradeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  tradeBadge: {
    minWidth: 52,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: "center",
  },
  tradeBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  tradeMain: {
    flex: 1,
    gap: 3,
  },
  tradeTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  tradeRight: {
    alignItems: "flex-end",
    gap: 3,
  },
  tradeValue: {
    fontSize: 14,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  tradeSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: TEXT_SECONDARY,
  },
  logRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  logBullet: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginTop: 6,
    backgroundColor: PRIMARY,
  },
  logContent: {
    flex: 1,
    gap: 4,
  },
  logTitle: {
    fontSize: 13,
    color: TEXT_PRIMARY,
    fontWeight: "700",
  },
  logText: {
    fontSize: 12,
    lineHeight: 18,
    color: TEXT_SECONDARY,
  },
  emptyText: {
    fontSize: 12,
    lineHeight: 18,
    color: TEXT_SECONDARY,
  },
});
