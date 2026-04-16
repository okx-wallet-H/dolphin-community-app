import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { ScreenContainer } from "@/components/screen-container";
import { getMarketSnapshotByMcp, getPublicMarketSnapshot, getHotTokensByMcp, type HotTokenItem } from "@/lib/_core/api";

const PRIMARY = "#7C3AED";
const PRIMARY_LIGHT = "#F5F3FF";
const PAGE_BG = "#FFFFFF";
const CARD_BG = "#FFFFFF";
const BORDER = "#E8EAF2";
const TEXT_PRIMARY = "#1A1A2E";
const TEXT_BODY = "#31324A";
const TEXT_SECONDARY = "#666C85";
const SUCCESS = "#16A34A";
const DANGER = "#DC2626";

const FILTERS = ["总览", "热门", "AI关注", "稳定币", "二层网络"] as const;

const MARKET_BASE = [
  { id: "btc", symbol: "BTC", name: "比特币", volume: "$32.8B" },
  { id: "eth", symbol: "ETH", name: "以太坊", volume: "$21.4B" },
  { id: "sol", symbol: "SOL", name: "索拉纳", volume: "$6.9B" },
  { id: "bnb", symbol: "BNB", name: "币安币", volume: "$4.1B" },
  { id: "sui", symbol: "SUI", name: "Sui", volume: "$1.2B" },
] as const;

type SnapshotRow = {
  symbol: string;
  price: number;
  change24h: number | null;
  volume24h?: string;
  updateTime: string;
  source?: 'okx-mcp' | 'demo';
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

  return `更新于 ${date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function MarketScreen() {
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
      
      // 1. 获取主流币行情
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

      // 2. 获取热门代币
      try {
        const hot = await getHotTokensByMcp('ethereum');
        setHotTokens(hot.slice(0, 10));
      } catch (e) {
        console.warn('Failed to load hot tokens:', e);
      }

      if (!Object.keys(nextMap).length) {
        setErrorText("行情暂时未同步成功，页面已保留可演示的资产结构，请下拉重试。");
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
        trendLabel: snapshot?.change24h === null || snapshot?.change24h === undefined
          ? "等待行情波动确认"
          : positive
            ? "短线偏强，适合继续观察突破"
            : "波动承压，注意回撤与仓位控制",
        updatedLabel: formatUpdatedLabel(snapshot?.updateTime),
        positive,
        isHot: false,
      };
    });

    if (activeFilter === "热门") {
      const hotCards = hotTokens.map((t) => {
        const change = parseFloat(t.change24h) / 100;
        const positive = change >= 0;
        return {
          id: t.address,
          symbol: t.symbol,
          name: t.name,
          volume: `$${(parseFloat(t.volume24h) / 1e6).toFixed(1)}M`,
          priceText: formatPrice(parseFloat(t.price)),
          changeText: formatPercent(change),
          trendLabel: "当前链上热门交易代币",
          updatedLabel: "刚刚更新",
          positive,
          isHot: true,
        };
      });
      return hotCards;
    }

    return baseCards;
  }, [loading, snapshots, hotTokens, activeFilter]);

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
    <ScreenContainer className="px-4 pt-4" safeAreaClassName="bg-background" containerClassName="bg-background">
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
            <View style={styles.headerTextWrap}>
              <Text style={styles.pageTitle}>行情</Text>
              <Text style={styles.pageSubtitle}>聚合 BTC、ETH、SOL 等主流资产价格，帮助投资人快速理解产品的实时行情能力与资产观察视角。</Text>
            </View>

            <LinearGradient colors={["#B58CFF", "#7C3AED", "#6D28D9"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
              <Text style={styles.heroEyebrow}>AI 行情总览</Text>
              <Text style={styles.heroTitle}>主流资产价格已接入实时查询，市场方向与强弱一屏可读</Text>
              <Text style={styles.heroSummary}>
                {loading
                  ? "正在同步最新行情数据，请稍候。同步完成后会自动更新涨跌幅、更新时间和市场强弱。"
                  : "页面优先展示实时公共行情；若外部接口短时波动，仍保留专业的结构与中文提示，保证融资演示不断链。"}
              </Text>

              <View style={styles.heroMetricRow}>
                <View style={styles.heroMetricCard}>
                  <Text style={styles.heroMetricLabel}>上涨资产</Text>
                  <Text style={styles.heroMetricValue}>{overview.total ? `${overview.gainers}/${overview.total}` : "等待同步"}</Text>
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
                  style={[styles.filterChip, activeFilter === item ? styles.filterChipActive : styles.filterChipIdle]}
                >
                  <Text style={[styles.filterText, activeFilter === item ? styles.filterTextActive : styles.filterTextIdle]}>{item}</Text>
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
        renderItem={({ item }) => (
          <View style={styles.marketCard}>
            <View style={styles.marketCardHeader}>
              <View>
                <Text style={styles.marketSymbol}>{item.symbol}</Text>
                <Text style={styles.marketName}>{item.name}</Text>
              </View>
              <View style={[styles.changePill, item.positive ? styles.changePillUp : styles.changePillDown]}>
                <Text style={[styles.changeText, item.positive ? styles.changeTextUp : styles.changeTextDown]}>{item.changeText}</Text>
              </View>
            </View>

            <Text style={styles.marketPrice}>{item.priceText}</Text>
            <Text style={styles.marketTrend}>{item.trendLabel}</Text>

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
        )}
        ListFooterComponent={
          <View style={styles.footerCard}>
            <Text style={styles.footerTitle}>演示说明</Text>
            <Text style={styles.footerText}>行情页用于承接 AI 对话里的“现在 BTC 价格多少”等查询结果。即使在网络波动时，页面也会保留中文状态说明，避免白屏、空白或不专业的英文占位。</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingBottom: 148,
    gap: 16,
  },
  headerStack: {
    gap: 16,
    marginBottom: 16,
  },
  headerTextWrap: {
    gap: 8,
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
  heroCard: {
    borderRadius: 28,
    padding: 20,
    gap: 12,
  },
  heroEyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    color: "rgba(255,255,255,0.78)",
  },
  heroTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  heroSummary: {
    fontSize: 14,
    lineHeight: 22,
    color: "rgba(255,255,255,0.88)",
  },
  heroMetricRow: {
    flexDirection: "row",
    gap: 12,
  },
  heroMetricCard: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.16)",
    gap: 4,
  },
  heroMetricLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: "rgba(255,255,255,0.78)",
  },
  heroMetricValue: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  heroMetricSub: {
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.82)",
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterChipActive: {
    backgroundColor: PRIMARY,
  },
  filterChipIdle: {
    backgroundColor: PRIMARY_LIGHT,
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  filterText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  filterTextIdle: {
    color: PRIMARY,
  },
  noticeCard: {
    borderRadius: 20,
    padding: 16,
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
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 18,
    gap: 12,
    shadowColor: "rgba(124,58,237,0.10)",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  marketCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  marketSymbol: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  marketName: {
    fontSize: 13,
    lineHeight: 18,
    color: TEXT_SECONDARY,
  },
  changePill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  changePillUp: {
    backgroundColor: "rgba(22,163,74,0.10)",
  },
  changePillDown: {
    backgroundColor: "rgba(220,38,38,0.10)",
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
  marketPrice: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  marketTrend: {
    fontSize: 14,
    lineHeight: 22,
    color: TEXT_BODY,
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
    borderRadius: 22,
    backgroundColor: PRIMARY_LIGHT,
    borderWidth: 1,
    borderColor: "#DDD6FE",
    padding: 16,
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
