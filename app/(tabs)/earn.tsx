import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import { ScreenContainer } from "@/components/screen-container";
import {
  ManusColors,
  ManusEmphasisShadow,
  ManusRadius,
  ManusShadow,
  ManusSpacing,
  ManusTypography,
} from "@/constants/manus-ui";
import {
  parseChatAiIntent,
  searchDeFiProductsByMcp,
  type DeFiProductItem,
} from "@/lib/_core/api";
const PRIMARY = ManusColors.primary;
const PRIMARY_LIGHT = ManusColors.surfaceTint;
const PAGE_BG = ManusColors.surface;
const CARD_BG = ManusColors.surface;
const BORDER = ManusColors.divider;
const TEXT_PRIMARY = ManusColors.text;
const TEXT_BODY = ManusColors.text;
const TEXT_SECONDARY = ManusColors.textSecondary;
const SUCCESS = ManusColors.success;
const WARNING = "#B45309";

type StrategyCard = {
  id: string;
  title: string;
  tag: string;
  risk: string;
  apr: number;
  progress: number;
  minAmount: string;
  lockPeriod: string;
  chain: string;
  summary: string;
  actionLabel: string;
};

type ExecutionFeedback = {
  tone: "success" | "warning";
  title: string;
  description: string;
  meta: string;
} | null;

const insightData = [
  { label: "数据来源", value: "OKX OnchainOS" },
  { label: "筛选范围", value: "USDT / ETH" },
  { label: "执行方式", value: "仅展示真实结果" },
] as const;

export default function EarnScreen() {
  const router = useRouter();
  const [mcpProducts, setMcpProducts] = useState<DeFiProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ExecutionFeedback>(null);

  const loadDeFiData = useCallback(async () => {
    try {
      setLoading(true);
      const [usdtProducts, ethProducts] = await Promise.all([
        searchDeFiProductsByMcp('USDT', 'ethereum'),
        searchDeFiProductsByMcp('ETH', 'ethereum'),
      ]);
      
      const combined = [...usdtProducts.slice(0, 2), ...ethProducts.slice(0, 1)];
      setMcpProducts(combined);
      if (combined.length > 0) {
        setSelectedStrategyId(combined[0].id);
      } else {
        setSelectedStrategyId(null);
      }
    } catch (e) {
      console.warn('Failed to load DeFi products:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDeFiData();
  }, [loadDeFiData]);

  const displayStrategies = useMemo<StrategyCard[]>(() => {
    if (mcpProducts.length === 0) return [];

    const maxTvl = Math.max(
      ...mcpProducts.map((item) => {
        const tvl = Number(item.tvl || 0);
        return Number.isFinite(tvl) ? tvl : 0;
      }),
      1,
    );

    return mcpProducts.map((p) => {
      const tvlValue = Number(p.tvl || 0);
      const normalizedTvl = Number.isFinite(tvlValue) ? tvlValue : 0;
      const minAmountLabel = p.depositTokenSymbol
        ? `${p.depositTokenSymbol.trim().toUpperCase()} 可申购`
        : "以协议要求为准";
      return {
        id: p.id,
        title: `${p.name} · ${p.platform}`,
        tag: p.apr > 10 ? "优选机会" : "真实产品",
        risk: p.apr > 10 ? "中等风险" : "低风险",
        apr: p.apr,
        progress: Math.max(12, Math.round((normalizedTvl / maxTvl) * 100)),
        minAmount: minAmountLabel,
        lockPeriod: "申购前先确认钱包余额",
        chain: p.chain === "ethereum" ? "以太坊" : p.chain,
        summary: `当前产品组 ${p.productGroup}，参考 TVL ${normalizedTvl > 0 ? `$${(normalizedTvl / 1e6).toFixed(2)}M` : "--"}，点击后会把真实产品意图交给 Agent 承接，结果统一回到账号明细。`,
        actionLabel: "交给 Agent 处理",
      };
    });
  }, [mcpProducts]);

  const totalApy = useMemo(() => {
    const data = displayStrategies;
    if (!data.length) {
      return "--";
    }
    const sum = data.reduce((acc, item) => acc + item.apr, 0);
    return `${(sum / data.length).toFixed(1)}%`;
  }, [displayStrategies]);

  const handleActivateStrategy = useCallback((strategy: StrategyCard) => {
    setSelectedStrategyId(strategy.id);
    const draft = `帮我确认申购 ${strategy.title}，申购代币使用 ${strategy.minAmount}，所在链路是 ${strategy.chain}，参考 APR ${strategy.apr.toFixed(1)}%。`;
    const draftKey = `${strategy.id}-${Date.now()}`;
    setFeedback({
      tone: "success",
      title: "自动赚币已开启",
      description: `${strategy.title}\n我已把该策略的申购上下文带到 AI 对话页，你可以继续确认资金安排、风险偏好和后续执行条件。`,
      meta: "当前没有使用 mock 数据；点击按钮后会直接把真实产品信息带入对话流程。",
    });
    router.push({
      pathname: "/(tabs)/chat",
      params: {
        draft,
        draftKey,
      },
    });
  }, [router]);

  return (
    <ScreenContainer
      className="px-4 pt-4 bg-white"
      safeAreaClassName="bg-white"
      containerClassName="bg-white"
    >
      <FlatList
        data={displayStrategies}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
        ListHeaderComponent={
          <View style={styles.headerStack}>
            <View style={styles.topBar}>
              <Text style={styles.pageTitle}>AI 智能赚币</Text>
              <Pressable
                style={styles.inlineLink}
                onPress={() => router.push("/(tabs)/wallet")}
              >
                <Text style={styles.inlineLinkText}>返回钱包</Text>
              </Pressable>
            </View>

              <Text style={styles.pageSubtitle}>
                赚币页只展示真实投资产品；如果当前没有真实结果，页面将直接显示空状态。
              </Text>


            <LinearGradient
              colors={["#FFFFFF", "#F7F3FF", "#EEE7FF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <Text style={styles.heroEyebrow}>自动化收益编排</Text>
              <Text style={styles.heroTitle}>
                当前更适合“核心资产稳健配置 + 低波动垫层”的组合
              </Text>
              <Text style={styles.heroSummary}>
                当前卡片全部来自真实 DeFi 搜索结果；执行结果统一回到账号明细，不再展示演示型兜底内容。
              </Text>

              <View style={styles.heroMetricRow}>
                <View style={styles.heroMetricCard}>
                  <Text style={styles.heroMetricLabel}>策略池平均 APR</Text>
                  <Text style={styles.heroMetricValue}>{totalApy}</Text>
                  <Text style={styles.heroMetricSub}>基于当前可选策略测算</Text>
                </View>
                <View style={styles.heroMetricCard}>
                  <Text style={styles.heroMetricLabel}>执行原则</Text>
                  <Text style={styles.heroMetricValue}>真实优先</Text>
                  <Text style={styles.heroMetricSub}>无结果时直接显示空状态</Text>
                </View>
              </View>
            </LinearGradient>

            <View style={styles.insightRow}>
              {insightData.map((item) => (
                <View key={item.label} style={styles.insightCard}>
                  <Text style={styles.insightLabel}>{item.label}</Text>
                  <Text style={styles.insightValue}>{item.value}</Text>
                </View>
              ))}
            </View>

            <View style={styles.quickActionRow}>
              <Pressable
                style={styles.quickActionCard}
                onPress={() => router.push("/(tabs)/chat")}
              >
                <Text style={styles.quickActionTitle}>前往 AI 对话</Text>
                <Text style={styles.quickActionDesc}>
                  继续查询价格、发起转账、识别兑换意图或追问策略细节。
                </Text>
              </Pressable>
              <Pressable
                style={styles.quickActionCard}
                onPress={() => router.push("/(tabs)/community")}
              >
                <Text style={styles.quickActionTitle}>查看自动任务</Text>
                <Text style={styles.quickActionDesc}>
                  已支持把当前策略上下文带入 AI 对话，继续确认申购条件与后续执行步骤。
                </Text>
              </Pressable>
            </View>

            {feedback ? (
              <View
                style={[
                  styles.feedbackCard,
                  feedback.tone === "success"
                    ? styles.feedbackSuccess
                    : styles.feedbackWarning,
                ]}
              >
                <Text style={styles.feedbackTitle}>{feedback.title}</Text>
                <Text style={styles.feedbackDescription}>
                  {feedback.description}
                </Text>
                <Text style={styles.feedbackMeta}>{feedback.meta}</Text>
              </View>
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>真实投资产品</Text>
              <Text style={styles.sectionHint}>仅展示当前可执行的真实检索结果</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const isSelected = selectedStrategyId === item.id;
          const progressWidth = `${item.progress}%` as const;

          return (
            <View
              style={[
                styles.strategyCard,
                isSelected && styles.strategyCardSelected,
              ]}
            >
              <View style={styles.strategyHeader}>
                <View style={styles.strategyTitleWrap}>
                  <View style={styles.badgeRow}>
                    <Text style={styles.strategyTitle}>{item.title}</Text>
                    <View style={styles.tagPill}>
                      <Text style={styles.tagText}>{item.tag}</Text>
                    </View>
                  </View>
                  <Text style={styles.strategySummary}>{item.summary}</Text>
                </View>
                <View style={styles.riskPill}>
                  <Text style={styles.riskText}>{item.risk}</Text>
                </View>
              </View>

              <View style={styles.metricRow}>
                <View style={styles.metricBlock}>
                  <Text style={styles.metricLabel}>参考 APR</Text>
                  <Text style={styles.metricValue}>{item.apr.toFixed(1)}%</Text>
                </View>
                <View style={styles.metricBlock}>
                  <Text style={styles.metricLabel}>门槛</Text>
                  <Text style={styles.metricPlain}>{item.minAmount}</Text>
                </View>
                <View style={styles.metricBlock}>
                  <Text style={styles.metricLabel}>流动性</Text>
                  <Text style={styles.metricPlain}>{item.lockPeriod}</Text>
                </View>
              </View>

              <View style={styles.chainRow}>
                <View style={styles.chainMeta}>
                  <Text style={styles.chainMetaLabel}>链路</Text>
                  <Text style={styles.chainMetaValue}>{item.chain}</Text>
                </View>
                <View style={styles.chainMeta}>
                  <Text style={styles.chainMetaLabel}>TVL 热度</Text>
                  <Text style={styles.chainMetaValue}>{item.progress}%</Text>
                </View>
              </View>

              <View style={styles.progressTrack}>
                <View style={[styles.progressBar, { width: progressWidth }]} />
              </View>

              <Text style={styles.cardFooterText}>
                当前卡片基于真实 DeFi 搜索结果生成；点击后会把所选产品、链路与 APR 一并交给 Agent 承接，结果统一进入账号明细。
              </Text>

              <Pressable
                onPress={() => handleActivateStrategy(item)}
                style={({ pressed }) => [
                  styles.primaryButtonWrap,
                  pressed && styles.primaryButtonPressed,
                ]}
              >
                <LinearGradient
                  colors={["#B58CFF", "#7C3AED"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryButtonText}>{item.actionLabel}</Text>
                </LinearGradient>
              </Pressable>
            </View>
          );
        }}
        ListFooterComponent={
          !loading && !displayStrategies.length ? (
            <View style={styles.emptyStateCard}>
              <Text style={styles.emptyStateTitle}>暂无可用投资产品</Text>
              <Text style={styles.emptyStateDesc}>
                当前未检索到可执行的真实投资产品，页面不会展示演示卡片或空壳策略面板。
              </Text>
            </View>
          ) : (
            <View style={styles.autoTaskSection}>
              <Text style={styles.autoTaskLabel}>自动任务卡片</Text>
              <Text style={styles.autoTaskHint}>
                开启策略后可前往社区页查看自动任务执行状态。
              </Text>
            </View>
          )
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingBottom: 148,
    gap: ManusSpacing.lg,
    backgroundColor: PAGE_BG,
  },
  headerStack: {
    gap: ManusSpacing.lg,
    marginBottom: 10,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  pageTitle: {
    ...ManusTypography.brandTitle,
    color: TEXT_PRIMARY,
  },
  inlineLink: {
    borderRadius: ManusRadius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: PRIMARY_LIGHT,
    borderWidth: 1,
    borderColor: BORDER,
  },
  inlineLinkText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: PRIMARY,
  },
  pageSubtitle: {
    ...ManusTypography.secondary,
    lineHeight: 22,
    color: TEXT_SECONDARY,
  },
  heroCard: {
    borderRadius: ManusRadius.sheet,
    padding: ManusSpacing.xl,
    gap: ManusSpacing.md,
    borderWidth: 1,
    borderColor: "#E9DDFF",
    backgroundColor: CARD_BG,
    ...ManusEmphasisShadow,
  },
  heroEyebrow: {
    ...ManusTypography.caption,
    fontWeight: "700",
    color: TEXT_SECONDARY,
  },
  heroTitle: {
    ...ManusTypography.pageTitle,
    fontSize: 24,
    lineHeight: 30,
    color: TEXT_PRIMARY,
  },
  heroSummary: {
    ...ManusTypography.secondary,
    lineHeight: 22,
    color: TEXT_BODY,
  },
  heroMetricRow: {
    flexDirection: "column",
    gap: 12,
    width: "100%",
  },
  heroMetricCard: {
    width: "100%",
    minWidth: 0,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "#E9DDFF",
    gap: 4,
  },
  heroMetricLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: TEXT_SECONDARY,
  },
  heroMetricValue: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
    color: PRIMARY,
  },
  heroMetricSub: {
    fontSize: 12,
    lineHeight: 18,
    color: TEXT_SECONDARY,
  },
  insightRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    width: "100%",
  },
  insightCard: {
    flexGrow: 1,
    flexBasis: 110,
    minWidth: 0,
    borderRadius: ManusRadius.control,
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(232, 234, 242, 0.5)",
    padding: 14,
    gap: 4,
  },
  insightLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: TEXT_SECONDARY,
  },
  insightValue: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  quickActionRow: {
    flexDirection: "column",
    gap: 12,
    width: "100%",
  },
  quickActionCard: {
    width: "100%",
    minWidth: 0,
    borderRadius: ManusRadius.card,
    padding: 15,
    backgroundColor: PRIMARY_LIGHT,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 6,
  },
  quickActionTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  quickActionDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: TEXT_SECONDARY,
  },
  feedbackCard: {
    borderRadius: 22,
    padding: 16,
    gap: 6,
    borderWidth: 1,
  },
  feedbackSuccess: {
    backgroundColor: "#ECFDF5",
    borderColor: "#BBF7D0",
  },
  feedbackWarning: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FED7AA",
  },
  feedbackTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  feedbackDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: TEXT_BODY,
  },
  feedbackMeta: {
    fontSize: 12,
    lineHeight: 18,
    color: TEXT_SECONDARY,
  },
  emptyStateCard: {
    borderRadius: ManusRadius.card,
    padding: 18,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 8,
    ...ManusShadow,
  },
  emptyStateTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  emptyStateDesc: {
    fontSize: 14,
    lineHeight: 22,
    color: TEXT_SECONDARY,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    ...ManusTypography.sectionTitle,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  sectionHint: {
    fontSize: 13,
    lineHeight: 18,
    color: TEXT_SECONDARY,
  },
  strategyCard: {
    borderRadius: ManusRadius.sheet,
    padding: 18,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(232, 234, 242, 0.5)",
    gap: 14,
    ...ManusShadow,
  },
  strategyCardSelected: {
    borderColor: "#C4B5FD",
    shadowColor: "rgba(124,58,237,0.16)",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  strategyHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  strategyTitleWrap: {
    flex: 1,
    gap: 8,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  strategyTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  tagPill: {
    borderRadius: 999,
    backgroundColor: PRIMARY_LIGHT,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    color: PRIMARY,
  },
  strategySummary: {
    fontSize: 13,
    lineHeight: 20,
    color: TEXT_BODY,
  },
  riskPill: {
    borderRadius: 999,
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  riskText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    color: PRIMARY,
  },
  metricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    width: "100%",
  },
  metricBlock: {
    flexGrow: 1,
    flexBasis: 120,
    minWidth: 0,
    borderRadius: 18,
    backgroundColor: "#FAF7FF",
    padding: 14,
    gap: 4,
  },
  metricLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: TEXT_SECONDARY,
  },
  metricValue: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    color: PRIMARY,
  },
  metricPlain: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  chainRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    width: "100%",
  },
  chainMeta: {
    flexGrow: 1,
    flexBasis: 140,
    minWidth: 0,
    gap: 4,
  },
  chainMetaLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: TEXT_SECONDARY,
  },
  chainMetaValue: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#EDE9FE",
    overflow: "hidden",
  },
  progressBar: {
    height: 8,
    borderRadius: 999,
    backgroundColor: PRIMARY,
  },
  cardFooterText: {
    fontSize: 13,
    lineHeight: 20,
    color: TEXT_SECONDARY,
  },
  primaryButtonWrap: {
    borderRadius: 20,
    overflow: "hidden",
  },
  primaryButtonPressed: {
    opacity: 0.92,
  },
  primaryButton: {
    borderRadius: 20,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  autoTaskSection: {
    paddingVertical: 16,
    paddingHorizontal: 4,
    gap: 4,
  },
  autoTaskLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  autoTaskHint: {
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
});
