import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppHeader } from "@/components/AppHeader";
import { ScreenContainer } from "@/components/screen-container";
import {
  ManusColors,
  ManusEmphasisShadow,
  ManusRadius,
  ManusShadow,
  ManusSpacing,
  ManusTypography,
} from "@/constants/manus-ui";
import { getDexSwapOrders, type StoredWalletSnapshot } from "@/lib/_core/api";

const WALLET_STORAGE_KEY = "hwallet-agent-wallet";

type LedgerStatus = "success" | "failed" | "executing";

type LedgerEntry = {
  id: string;
  title: string;
  status: LedgerStatus;
  statusLabel: string;
  summary: string;
  spendText: string;
  receiveText: string;
  timeLabel: string;
  detailLabel: string;
};

function asString(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function pickValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    const text = asString(value);
    if (text) return text;
  }
  return "";
}

function formatAmount(value: string, symbol: string) {
  if (!value) return symbol || "--";
  return `${value} ${symbol}`.trim();
}

function formatTimeLabel(value: string) {
  if (!value) return "待补充时间";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeStatus(record: Record<string, unknown>): LedgerStatus {
  const rawStatus = pickValue(record, ["status", "orderStatus"]).toLowerCase();
  const txStatus = pickValue(record, ["txStatus", "txstatus"]);
  if (
    rawStatus.includes("success") ||
    rawStatus.includes("filled") ||
    rawStatus.includes("completed") ||
    txStatus === "2"
  ) {
    return "success";
  }
  if (
    rawStatus.includes("fail") ||
    rawStatus.includes("cancel") ||
    rawStatus.includes("revert") ||
    txStatus === "4" ||
    txStatus === "5"
  ) {
    return "failed";
  }
  return "executing";
}

function buildLedgerEntry(record: Record<string, unknown>, symbol: string): LedgerEntry {
  const fromSymbol = pickValue(record, ["fromTokenSymbol", "fromSymbol", "fromToken"]);
  const toSymbol = pickValue(record, ["toTokenSymbol", "toSymbol", "toToken"]);
  const fromAmount = pickValue(record, ["fromAmount", "amountIn", "amount"]);
  const toAmount = pickValue(record, ["toAmount", "amountOut", "receiveAmount"]);
  const orderId = pickValue(record, ["orderId", "ordId"]);
  const txHash = pickValue(record, ["txHash", "hash"]);
  const timeValue = pickValue(record, ["updatedAt", "txTime", "createTime", "ctime"]);
  const status = normalizeStatus(record);

  const statusLabel =
    status === "success"
      ? "已完成"
      : status === "failed"
        ? "执行失败"
        : "处理中";

  const summary =
    status === "success"
      ? "Agent 已完成处理，结果已回写到账号明细。"
      : status === "failed"
        ? "本次链上执行未成功，建议结合详情标识与客服协同排查。"
        : "该笔链上指令仍在处理，请以后续回写结果为准。";

  return {
    id: orderId || txHash || `${fromSymbol}-${toSymbol}-${timeValue}`,
    title: fromSymbol && toSymbol ? `${fromSymbol} → ${toSymbol}` : `${symbol} 交易记录`,
    status,
    statusLabel,
    summary,
    spendText: fromSymbol ? formatAmount(fromAmount, fromSymbol) : "待补充",
    receiveText: toSymbol ? formatAmount(toAmount, toSymbol) : "待补充",
    timeLabel: formatTimeLabel(timeValue),
    detailLabel: txHash ? `TxHash ${txHash}` : orderId ? `Order ${orderId}` : "等待补充详情标识",
  };
}

export default function TokenDetailScreen() {
  const params = useLocalSearchParams<{
    symbol?: string;
    tokenName?: string;
    chainName?: string;
    chainIndex?: string;
    tokenAddress?: string;
    walletAddress?: string;
    balance?: string;
    valueUsd?: string;
    tokenPrice?: string;
    logoUrl?: string;
  }>();

  const symbol = typeof params.symbol === "string" ? params.symbol : "TOKEN";
  const tokenName = typeof params.tokenName === "string" ? params.tokenName : symbol;
  const chainName = typeof params.chainName === "string" ? params.chainName : "链上资产";
  const chainIndex = typeof params.chainIndex === "string" ? params.chainIndex : "";
  const routeWalletAddress = typeof params.walletAddress === "string" ? params.walletAddress : "";
  const tokenPrice = typeof params.tokenPrice === "string" ? params.tokenPrice : "";
  const balance = typeof params.balance === "string" ? params.balance : "0";
  const valueUsd = typeof params.valueUsd === "string" ? params.valueUsd : "0";
  const logoUrl = typeof params.logoUrl === "string" ? params.logoUrl : "";

  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [entries, setEntries] = useState<LedgerEntry[]>([]);

  const headerTitle = useMemo(() => `${symbol} 账号明细`, [symbol]);

  const loadLedger = useCallback(async () => {
    try {
      setLoading(true);
      setErrorText("");

      const rawWallet = await AsyncStorage.getItem(WALLET_STORAGE_KEY);
      const storedWallet = rawWallet ? (JSON.parse(rawWallet) as StoredWalletSnapshot) : null;
      const walletAddress = routeWalletAddress || storedWallet?.evmAddress || storedWallet?.solanaAddress || "";

      if (!walletAddress || !chainIndex) {
        setEntries([]);
        return;
      }

      const result = await getDexSwapOrders({
        address: walletAddress,
        chainIndex,
        limit: "30",
      });

      const filtered = (result.data || [])
        .map((item) => (item ?? {}) as Record<string, unknown>)
        .filter((record) => {
          const fromSymbol = pickValue(record, ["fromTokenSymbol", "fromSymbol", "fromToken"]).toUpperCase();
          const toSymbol = pickValue(record, ["toTokenSymbol", "toSymbol", "toToken"]).toUpperCase();
          return fromSymbol === symbol.toUpperCase() || toSymbol === symbol.toUpperCase();
        })
        .map((record) => buildLedgerEntry(record, symbol));

      setEntries(filtered);
    } catch (error) {
      setEntries([]);
      setErrorText(error instanceof Error ? error.message : "账号明细加载失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }, [chainIndex, routeWalletAddress, symbol]);

  useEffect(() => {
    void loadLedger();
  }, [loadLedger]);

  return (
    <ScreenContainer className="bg-white" safeAreaClassName="bg-white" containerClassName="bg-white">
      <View style={styles.pageGlowTop} />
      <View style={styles.pageGlowBottom} />
      <AppHeader
        title={headerTitle}
        leftIcon="arrow-back-ios-new"
        rightIcon="account-balance-wallet"
        onWalletPress={() => router.back()}
        onRightPress={() => router.push("/(tabs)/wallet")}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>
        <LinearGradient
          colors={["#FFFFFF", "#F8F6FF", "#EEE9FF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.heroTokenWrap}>
              <View style={styles.heroTokenIcon}>
                {logoUrl ? (
                  <Image source={{ uri: logoUrl }} style={styles.heroTokenImage} />
                ) : (
                  <MaterialCommunityIcons name="record-circle-outline" size={26} color={ManusColors.primary} />
                )}
              </View>
              <View style={styles.heroTokenTextWrap}>
                <Text style={styles.heroEyebrow}>币种明细</Text>
                <Text style={styles.heroTitle}>{tokenName}</Text>
                <Text style={styles.heroMeta}>{chainName} · 结果以账号明细为主</Text>
              </View>
            </View>
            <View style={styles.symbolPill}>
              <Text style={styles.symbolPillText}>{symbol}</Text>
            </View>
          </View>

          <View style={styles.metricRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>钱包余额</Text>
              <Text style={styles.metricValue}>{balance}</Text>
              <Text style={styles.metricSub}>{symbol}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>估值</Text>
              <Text style={styles.metricValue}>${valueUsd}</Text>
              <Text style={styles.metricSub}>单价约 ${tokenPrice || "--"}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>交易记录</Text>
            <Text style={styles.sectionHint}>成功与失败都会沉淀到这里，聊天线程不再承担主追单职责。</Text>
          </View>
          <Pressable style={styles.inlineButton} onPress={() => router.push("/(tabs)/chat")}>
            <Text style={styles.inlineButtonText}>去对话页发起</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color={ManusColors.primary} />
            <Text style={styles.stateTitle}>正在同步账号明细</Text>
            <Text style={styles.stateDescription}>系统正在拉取与 {symbol} 相关的真实交易记录，请稍候。</Text>
          </View>
        ) : null}

        {!loading && !!errorText ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>账号明细加载失败</Text>
            <Text style={styles.stateDescription}>{errorText}</Text>
          </View>
        ) : null}

        {!loading && !errorText && !entries.length ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>暂无 {symbol} 相关记录</Text>
            <Text style={styles.stateDescription}>当前尚未检索到与该币种相关的真实交易记录；后续一旦发生兑换、转账或申购结果，这里会作为统一承接入口展示。</Text>
          </View>
        ) : null}

        {!loading && !errorText && entries.length
          ? entries.map((entry) => (
              <View key={entry.id} style={styles.ledgerCard}>
                <View style={styles.ledgerHeader}>
                  <View style={styles.ledgerTitleWrap}>
                    <Text style={styles.ledgerTitle}>{entry.title}</Text>
                    <Text style={styles.ledgerTime}>{entry.timeLabel}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      entry.status === "success"
                        ? styles.statusPillSuccess
                        : entry.status === "failed"
                          ? styles.statusPillFailed
                          : styles.statusPillPending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        entry.status === "success"
                          ? styles.statusPillTextSuccess
                          : entry.status === "failed"
                            ? styles.statusPillTextFailed
                            : styles.statusPillTextPending,
                      ]}
                    >
                      {entry.statusLabel}
                    </Text>
                  </View>
                </View>

                <View style={styles.flowRow}>
                  <View style={styles.flowCard}>
                    <Text style={styles.flowLabel}>支出资产</Text>
                    <Text style={styles.flowValue}>{entry.spendText}</Text>
                  </View>
                  <View style={styles.flowArrowWrap}>
                    <MaterialCommunityIcons name="arrow-right" size={18} color={ManusColors.primary} />
                  </View>
                  <View style={styles.flowCard}>
                    <Text style={styles.flowLabel}>获得资产</Text>
                    <Text style={styles.flowValue}>{entry.receiveText}</Text>
                  </View>
                </View>

                <Text style={styles.ledgerSummary}>{entry.summary}</Text>
                <Text style={styles.ledgerDetail}>{entry.detailLabel}</Text>
              </View>
            ))
          : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingHorizontal: ManusSpacing.page,
    paddingBottom: ManusSpacing.xxxl,
    gap: ManusSpacing.lg,
  },
  pageGlowTop: {
    position: "absolute",
    top: -48,
    right: -28,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(110,91,255,0.10)",
  },
  pageGlowBottom: {
    position: "absolute",
    bottom: 64,
    left: -36,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(110,91,255,0.08)",
  },
  heroCard: {
    borderRadius: ManusRadius.sheet,
    padding: ManusSpacing.xxl,
    borderWidth: 1,
    borderColor: ManusColors.divider,
    ...ManusEmphasisShadow,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: ManusSpacing.md,
    marginBottom: ManusSpacing.xl,
  },
  heroTokenWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: ManusSpacing.md,
    flex: 1,
  },
  heroTokenIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ManusColors.surface,
    borderWidth: 1,
    borderColor: ManusColors.divider,
    ...ManusShadow,
  },
  heroTokenImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  heroTokenTextWrap: {
    flex: 1,
    gap: 2,
  },
  heroEyebrow: {
    ...ManusTypography.caption,
    color: ManusColors.primary,
  },
  heroTitle: {
    ...ManusTypography.pageTitle,
    fontSize: 24,
    lineHeight: 30,
  },
  heroMeta: {
    ...ManusTypography.secondary,
  },
  symbolPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: ManusRadius.pill,
    backgroundColor: ManusColors.surface,
    borderWidth: 1,
    borderColor: ManusColors.divider,
  },
  symbolPillText: {
    ...ManusTypography.secondary,
    color: ManusColors.primary,
    fontWeight: "700",
  },
  metricRow: {
    flexDirection: "row",
    gap: ManusSpacing.md,
  },
  metricCard: {
    flex: 1,
    borderRadius: ManusRadius.card,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderWidth: 1,
    borderColor: ManusColors.divider,
    padding: ManusSpacing.md,
    gap: 4,
  },
  metricLabel: {
    ...ManusTypography.caption,
  },
  metricValue: {
    ...ManusTypography.sectionTitle,
    fontSize: 22,
    lineHeight: 28,
  },
  metricSub: {
    ...ManusTypography.secondary,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: ManusSpacing.md,
  },
  sectionTitle: {
    ...ManusTypography.sectionTitle,
  },
  sectionHint: {
    ...ManusTypography.secondary,
    maxWidth: "86%",
  },
  inlineButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: ManusRadius.button,
    backgroundColor: ManusColors.surfaceTint,
    borderWidth: 1,
    borderColor: ManusColors.divider,
  },
  inlineButtonText: {
    ...ManusTypography.secondary,
    color: ManusColors.primary,
    fontWeight: "700",
  },
  stateCard: {
    borderRadius: ManusRadius.card,
    padding: ManusSpacing.xl,
    backgroundColor: ManusColors.surface,
    borderWidth: 1,
    borderColor: ManusColors.divider,
    gap: ManusSpacing.sm,
    alignItems: "center",
    ...ManusShadow,
  },
  stateTitle: {
    ...ManusTypography.sectionTitle,
    fontSize: 18,
    lineHeight: 24,
  },
  stateDescription: {
    ...ManusTypography.secondary,
    textAlign: "center",
  },
  ledgerCard: {
    borderRadius: ManusRadius.card,
    padding: ManusSpacing.lg,
    backgroundColor: ManusColors.surface,
    borderWidth: 1,
    borderColor: ManusColors.divider,
    gap: ManusSpacing.md,
    ...ManusShadow,
  },
  ledgerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: ManusSpacing.md,
  },
  ledgerTitleWrap: {
    flex: 1,
    gap: 2,
  },
  ledgerTitle: {
    ...ManusTypography.sectionTitle,
    fontSize: 18,
    lineHeight: 24,
  },
  ledgerTime: {
    ...ManusTypography.caption,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: ManusRadius.pill,
    borderWidth: 1,
  },
  statusPillSuccess: {
    backgroundColor: "rgba(18,185,129,0.10)",
    borderColor: "rgba(18,185,129,0.14)",
  },
  statusPillFailed: {
    backgroundColor: "rgba(239,68,68,0.10)",
    borderColor: "rgba(239,68,68,0.14)",
  },
  statusPillPending: {
    backgroundColor: "rgba(110,91,255,0.10)",
    borderColor: "rgba(110,91,255,0.14)",
  },
  statusPillText: {
    ...ManusTypography.caption,
    fontWeight: "700",
  },
  statusPillTextSuccess: {
    color: ManusColors.success,
  },
  statusPillTextFailed: {
    color: ManusColors.danger,
  },
  statusPillTextPending: {
    color: ManusColors.primary,
  },
  flowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: ManusSpacing.sm,
  },
  flowCard: {
    flex: 1,
    borderRadius: ManusRadius.control,
    padding: ManusSpacing.md,
    backgroundColor: ManusColors.surfaceTint,
    borderWidth: 1,
    borderColor: ManusColors.divider,
    gap: 4,
  },
  flowArrowWrap: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  flowLabel: {
    ...ManusTypography.caption,
  },
  flowValue: {
    ...ManusTypography.secondary,
    color: ManusColors.text,
    fontWeight: "700",
  },
  ledgerSummary: {
    ...ManusTypography.secondary,
    color: ManusColors.text,
  },
  ledgerDetail: {
    ...ManusTypography.caption,
    color: ManusColors.textSecondary,
  },
});
