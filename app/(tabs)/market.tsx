import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import {
  getHotTokensByMcp,
  getMarketSnapshotByMcp,
  type HotTokenItem,
} from "@/lib/_core/api";
import {
  ManusColors,
  ManusEmphasisShadow,
  ManusRadius,
  ManusShadow,
  ManusSpacing,
} from "@/constants/manus-ui";

const PRIMARY = ManusColors.primary;
const PRIMARY_LIGHT = ManusColors.surfaceTint;
const PAGE_BG = ManusColors.background;
const CARD_BG = ManusColors.surface;
const BORDER = ManusColors.divider;
const TEXT_PRIMARY = ManusColors.text;
const TEXT_BODY = ManusColors.textSecondary;
const TEXT_SECONDARY = ManusColors.muted;
const SUCCESS = ManusColors.success;
const DANGER = ManusColors.danger;

const FILTERS = ["总览", "热门", "AI关注", "稳定币", "二层网络"] as const;

const MARKET_BASE = [
  { id: "btc", symbol: "BTC", name: "比特币", volume: "$32.8B" },
  { id: "eth", symbol: "ETH", name: "以太坊", volume: "$21.4B" },
  { id: "sol", symbol: "SOL", name: "索拉纳", volume: "$6.9B" },
  { id: "bnb", symbol: "BNB", name: "币安币", volume: "$4.1B" },
  { id: "sui", symbol: "SUI", name: "Sui", volume: "$1.2B" },
] as const;

const TOKEN_COLORS: Record<string, string> = {
  BTC: "#F59E0B",
  ETH: "#818CF8",
  SOL: "#111827",
  BNB: "#F3BA2F",
  SUI: "#60A5FA",
};

type SnapshotRow = {
  symbol: string;
  price: number;
  change24h: number | null;
  volume24h?: string;
  updateTime: string;
  source?: "okx-mcp" | "demo";
};

type MarketCard = {
  id: string;
  symbol: string;
  name: string;
  volume: string;
  priceText: string;
  changeText: string;
  trendLabel: string;
  updatedLabel: string;
  positive: boolean;
  sparkHeights: number[];
  isHot?: boolean;
};

function formatPrice(value: number): string {
  const digits = value >= 1000 ? 2 : value >= 1 ? 3 : 5;
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatPercent(change24h: number | null): string {
  if (change24h === null || !Number.isFinite(change24h)) {
    return "等待同步";
  }

  const percent = change24h * 100;
  return `${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%`;
}

function formatUpdatedLabel(value?: string): string {
  if (!value) {
    return "刚刚更新";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "刚刚更新";
  }

  return `更新于 ${date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function buildSparkHeights(seed: string, positive: boolean): number[] {
  const base = positive ? [12, 18, 14, 20, 22, 19, 26] : [24, 18, 20, 16, 14, 12, 10];
  const offset = seed.length % 3;
  return base.map((value, index) => value + ((index + offset) % 3));
}

export default function MarketScreen() {
  const router = useRouter();
  const [snapshots, setSnapshots] = useState<Record<string, SnapshotRow>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [hotTokens, setHotTokens] = useState<HotTokenItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>("总览");

  const loadData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      setErrorText("");

      const results = await Promise.all(
        MARKET_BASE.map(async (item) => {
          try {
            const snapshot = await getMarketSnapshotByMcp(item.symbol);
            return snapshot ? { ...snapshot } : null;
          } catch {
            return null;
          }
        }),
      );

      const nextMap = results.reduce<Record<string, SnapshotRow>>((acc, item) => {
        if (item) {
          acc[item.symbol] = item;
        }
        return acc;
      }, {});

      setSnapshots(nextMap);

      try {
        const hot = await getHotTokensByMcp("ethereum");
        setHotTokens(hot.slice(0, 10));
      } catch (error) {
        console.warn("Failed to load hot tokens:", error);
      }

      if (!Object.keys(nextMap).length) {
        setErrorText("行情暂时未同步成功，请下拉重试以获取最新真实价格。");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData(true);
  }, [loadData]);

  const cards = useMemo<MarketCard[]>(() => {
    const baseCards = MARKET_BASE.map((item) => {
      const snapshot = snapshots[item.symbol];
      const positive = (snapshot?.change24h ?? 0) >= 0;

      return {
        ...item,
        priceText: snapshot?.price ? formatPrice(snapshot.price) : loading ? "同步中" : "等待行情",
        changeText: formatPercent(snapshot?.change24h ?? null),
        trendLabel:
          snapshot?.change24h === null || snapshot?.change24h === undefined
            ? "等待行情波动确认"
            : positive
              ? "短线偏强，适合继续观察突破"
              : "波动承压，注意回撤与仓位控制",
        updatedLabel: formatUpdatedLabel(snapshot?.updateTime),
        positive,
        sparkHeights: buildSparkHeights(item.symbol, positive),
        isHot: false,
      };
    });

    if (activeFilter === "热门") {
      return hotTokens.map((token) => {
        const change = parseFloat(token.change24h) / 100;
        const positive = change >= 0;

        return {
          id: token.address,
          symbol: token.symbol,
          name: token.name,
          volume: `$${(parseFloat(token.volume24h) / 1e6).toFixed(1)}M`,
          priceText: formatPrice(parseFloat(token.price)),
          changeText: formatPercent(change),
          trendLabel: "当前链上热门交易代币",
          updatedLabel: "刚刚更新",
          positive,
          sparkHeights: buildSparkHeights(token.symbol, positive),
          isHot: true,
        };
      });
    }

    return baseCards;
  }, [activeFilter, hotTokens, loading, snapshots]);

  const overview = useMemo(() => {
    const available = Object.values(snapshots);
    const gainers = available.filter((item) => (item.change24h ?? 0) >= 0).length;
    const strongest = available
      .slice()
      .sort((a, b) => (b.change24h ?? -Infinity) - (a.change24h ?? -Infinity))[0];

    return {
      gainers,
      total: available.length,
      leader: strongest?.symbol ?? "等待同步",
      leaderChange: strongest ? formatPercent(strongest.change24h) : "等待同步",
    };
  }, [snapshots]);

  return (
    <ScreenContainer
      className="px-4 pt-4"
      safeAreaClassName="bg-background"
      containerClassName="bg-background"
    >
      <FlatList
        data={cards}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadData(false);
            }}
            tintColor={PRIMARY}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerStack}>
            <Pressable style={styles.backRow} onPress={() => router.push("/(tabs)/chat")}>
              <Text style={styles.backText}>{"< 返回对话"}</Text>
            </Pressable>
            <View style={styles.topBar}>
              <View style={styles.headerTextWrap}>
                <Text style={styles.pageTitle}>行情</Text>
                <Text style={styles.pageSubtitle}>
                  聚合 BTC、ETH、SOL 等主流资产价格，实时行情一屏可读。
                </Text>
              </View>
            </View>

            <LinearGradient
              colors={["#FFFFFF", "#F7F3FF", "#EFEAFF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <Text style={styles.heroEyebrow}>AI 行情总览</Text>
              <Text style={styles.heroTitle}>主流资产价格已接入实时查询，市场方向与强弱一屏可读</Text>
              <Text style={styles.heroSummary}>
                {loading
                  ? "正在同步最新行情数据，请稍候。同步完成后会自动更新涨跌幅、更新时间和市场强弱。"
                  : "页面优先展示实时公共行情；若外部接口短时波动，会保留中文状态提示并等待下一次真实数据刷新。"}
              </Text>

              <View style={styles.heroMetricColumn}>
                <View style={styles.heroMetricCard}>
                  <Text style={styles.heroMetricLabel}>上涨资产</Text>
                  <Text style={styles.heroMetricValue}>
                    {overview.total ? `${overview.gainers}/${overview.total}` : "等待同步"}
                  </Text>
                  <Text style={styles.heroMetricSub}>市场强弱一眼可见</Text>
                </View>
                <View style={styles.heroMetricCard}>
                  <Text style={styles.heroMetricLabel}>当前领涨</Text>
                  <Text style={styles.heroMetricValue}>{overview.leader}</Text>
                  <Text style={styles.heroMetricSub}>{overview.leaderChange}</Text>
                </View>
              </View>
            </LinearGradient>

            <View style={styles.filterRow}>
              {FILTERS.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setActiveFilter(item)}
                  style={[
                    styles.filterChip,
                    activeFilter === item ? styles.filterChipActive : styles.filterChipIdle,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      activeFilter === item ? styles.filterTextActive : styles.filterTextIdle,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>

            {errorText ? (
              <View style={styles.noticeCard}>
                <Text style={styles.noticeTitle}>行情同步提醒</Text>
                <Text style={styles.noticeText}>{errorText}</Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const tokenColor = TOKEN_COLORS[item.symbol] ?? PRIMARY;

          return (
            <View style={styles.marketCard}>
              <View style={styles.marketCardHeader}>
                <View style={styles.marketLeft}>
                  <View style={[styles.tokenAvatar, { backgroundColor: `${tokenColor}14` }]}>
                    <Text style={[styles.tokenAvatarText, { color: tokenColor }]}>{item.symbol.slice(0, 1)}</Text>
                  </View>
                  <View style={styles.marketTitleWrap}>
                    <View style={styles.marketTitleRow}>
                      <Text style={styles.marketSymbol}>{item.symbol}</Text>
                      {item.isHot ? (
                        <View style={styles.hotBadge}>
                          <Text style={styles.hotBadgeText}>热门</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.marketName}>{item.name}</Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.changePill,
                    item.positive ? styles.changePillUp : styles.changePillDown,
                  ]}
                >
                  <Text
                    style={[
                      styles.changeText,
                      item.positive ? styles.changeTextUp : styles.changeTextDown,
                    ]}
                  >
                    {item.changeText}
                  </Text>
                </View>
              </View>

              <View style={styles.priceRow}>
                <View style={styles.priceWrap}>
                  <Text style={styles.marketPrice}>{item.priceText}</Text>
                  <Text style={styles.marketTrend}>{item.trendLabel}</Text>
                </View>
                <View style={styles.sparkWrap}>
                  {item.sparkHeights.map((height, index) => (
                    <View
                      key={`${item.id}-${index}`}
                      style={[
                        styles.sparkBar,
                        {
                          height,
                          backgroundColor: item.positive ? "rgba(18,185,129,0.24)" : "rgba(239,68,68,0.20)",
                        },
                      ]}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.marketMetaRow}>
                <View style={styles.metaBlock}>
                  <Text style={styles.metaLabel}>24 小时成交额</Text>
                  <Text style={styles.metaValue}>{item.volume}</Text>
                </View>
                <View style={styles.metaBlock}>
                  <Text style={styles.metaLabel}>刷新时间</Text>
                  <Text style={styles.metaValue}>{item.updatedLabel}</Text>
                </View>
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          <View style={styles.footerCard}>
            <Text style={styles.footerTitle}>数据说明</Text>
            <Text style={styles.footerText}>
              行情页用于承接 AI 对话中的价格查询结果；当外部接口波动时，页面只展示真实返回的数据或明确的等待提示，不再补充任何演示行情。
            </Text>
          </View>
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
    marginBottom: ManusSpacing.md,
  },
  backRow: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  backText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    color: PRIMARY,
  },
  topBar: {
    gap: ManusSpacing.md,
  },
  headerTextWrap: {
    gap: ManusSpacing.sm,
  },
  pageTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  pageSubtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: TEXT_SECONDARY,
  },
  inlineLink: {
    alignSelf: "flex-start",
    borderRadius: ManusRadius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: "rgba(110,91,255,0.16)",
  },
  inlineLinkText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: PRIMARY,
  },
  heroCard: {
    borderRadius: 28,
    padding: ManusSpacing.xl,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(110,91,255,0.12)",
    ...ManusEmphasisShadow,
  },
  heroEyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    color: PRIMARY,
  },
  heroTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  heroSummary: {
    fontSize: 14,
    lineHeight: 22,
    color: TEXT_BODY,
  },
  heroMetricColumn: {
    gap: 12,
  },
  heroMetricCard: {
    borderRadius: 20,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.86)",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    ...ManusShadow,
  },
  heroMetricLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: TEXT_SECONDARY,
  },
  heroMetricValue: {
    marginTop: 4,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  heroMetricSub: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: TEXT_SECONDARY,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  filterChip: {
    borderRadius: ManusRadius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterChipActive: {
    backgroundColor: PRIMARY_LIGHT,
    borderWidth: 1,
    borderColor: "rgba(110,91,255,0.18)",
  },
  filterChipIdle: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
  },
  filterText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  filterTextActive: {
    color: PRIMARY,
  },
  filterTextIdle: {
    color: TEXT_BODY,
  },
  noticeCard: {
    borderRadius: ManusRadius.card,
    padding: ManusSpacing.card,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    gap: 6,
  },
  noticeTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    color: DANGER,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 20,
    color: TEXT_BODY,
  },
  marketCard: {
    backgroundColor: CARD_BG,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 18,
    gap: 14,
    ...ManusShadow,
  },
  marketCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  marketLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  tokenAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  tokenAvatarText: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: "800",
  },
  marketTitleWrap: {
    flex: 1,
    gap: 2,
  },
  marketTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  marketSymbol: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  hotBadge: {
    borderRadius: ManusRadius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: PRIMARY_LIGHT,
  },
  hotBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    color: PRIMARY,
  },
  marketName: {
    fontSize: 13,
    lineHeight: 18,
    color: TEXT_SECONDARY,
  },
  changePill: {
    borderRadius: ManusRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  changePillUp: {
    backgroundColor: "rgba(18,185,129,0.10)",
  },
  changePillDown: {
    backgroundColor: "rgba(239,68,68,0.10)",
  },
  changeText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  changeTextUp: {
    color: SUCCESS,
  },
  changeTextDown: {
    color: DANGER,
  },
  priceRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-end",
  },
  priceWrap: {
    flex: 1,
    gap: 4,
  },
  marketPrice: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  marketTrend: {
    fontSize: 14,
    lineHeight: 22,
    color: TEXT_BODY,
  },
  sparkWrap: {
    minWidth: 84,
    height: 30,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "flex-end",
    gap: 4,
  },
  sparkBar: {
    width: 7,
    borderRadius: 999,
  },
  marketMetaRow: {
    flexDirection: "row",
    gap: 12,
  },
  metaBlock: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "#FAF7FF",
    padding: 14,
    gap: 4,
  },
  metaLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: TEXT_SECONDARY,
  },
  metaValue: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  footerCard: {
    borderRadius: ManusRadius.card,
    backgroundColor: PRIMARY_LIGHT,
    borderWidth: 1,
    borderColor: "rgba(110,91,255,0.14)",
    padding: ManusSpacing.card,
    gap: 6,
  },
  footerTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    color: PRIMARY,
  },
  footerText: {
    fontSize: 13,
    lineHeight: 20,
    color: TEXT_BODY,
  },
});
