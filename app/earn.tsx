import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { parseChatAiIntent, type StoredWalletSnapshot } from '@/lib/_core/api';

const STORAGE_KEY = 'hwallet-agent-wallet';
const AGENT_PLAN_STORAGE_KEY = 'hwallet-agent-plan';
const PRIMARY = '#7C3AED';
const PRIMARY_DARK = '#5B21B6';
const PRIMARY_LIGHT = '#F5F3FF';
const TEXT_PRIMARY = '#1A1A2E';
const TEXT_BODY = '#31324A';
const TEXT_MUTED = '#8A8FA3';
const BORDER = '#ECE7FF';
const SUCCESS = '#16A34A';

const AMOUNT_PRESETS = [300, 1000, 3000, 8000] as const;

type EarnPlanViewModel = {
  amount: number;
  apr: number;
  riskLabel: string;
  description: string;
  providerLabel: string;
  protocolLabel: string;
  statusLabel: string;
  monthlyProfit: number;
  yearlyProfit: number;
  allocation: { label: string; percent: number; tone: string }[];
  steps: string[];
};

type SyncedAgentPlan = {
  amount: number;
  apr: number;
  riskLabel: string;
  providerLabel: string;
  protocolLabel: string;
  statusLabel: string;
  generatedAt: string;
};

function formatUsdt(value: number, fractionDigits = 2) {
  return `${value.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })} USDT`;
}

function fallbackPlan(amount: number): EarnPlanViewModel {
  const apr = 12.8;
  return {
    amount,
    apr,
    riskLabel: '稳健型',
    description: '以稳定币收益池为核心，叠加低波动再平衡与止盈提醒，适合希望兼顾流动性与年化收益的用户。',
    providerLabel: 'AI Earn Engine',
    protocolLabel: 'Morpho / Aave / OKX Onchain 监控',
    statusLabel: '可执行',
    monthlyProfit: (amount * apr) / 12 / 100,
    yearlyProfit: (amount * apr) / 100,
    allocation: [
      { label: '稳定币收益池', percent: 55, tone: '#7C3AED' },
      { label: '链上套利监控仓', percent: 25, tone: '#8B5CF6' },
      { label: '机动现金仓', percent: 20, tone: '#C4B5FD' },
    ],
    steps: ['把资金分成稳健收益仓、机动仓和观察仓。', '优先选择高流动性协议，保留可撤回资金。', '每日根据 OKX 行情与收益率变化自动提醒调仓。'],
  };
}

function normalizeEarnPlan(payload: { amount: number; apr: number; riskLabel: string; description: string; status: string }): EarnPlanViewModel {
  const providerLabel = payload.description.includes('DeFiLlama') ? 'DeFiLlama AI 策略' : 'AI Earn Engine';
  const protocolLabel = payload.description.includes('Morpho')
    ? 'Morpho / Aave / 稳定币收益池'
    : payload.description.includes('Pendle')
      ? 'Pendle / 稳定币增强池'
      : 'Aave / Morpho / OKX Onchain';
  const yearlyProfit = (payload.amount * payload.apr) / 100;
  const monthlyProfit = yearlyProfit / 12;

  return {
    amount: payload.amount,
    apr: payload.apr,
    riskLabel: payload.riskLabel,
    description: payload.description,
    providerLabel,
    protocolLabel,
    statusLabel: payload.status === 'activated' ? '运行中' : '可执行',
    monthlyProfit,
    yearlyProfit,
    allocation: [
      { label: '收益主仓', percent: 60, tone: '#7C3AED' },
      { label: '增强策略仓', percent: 25, tone: '#8B5CF6' },
      { label: '流动性缓冲', percent: 15, tone: '#C4B5FD' },
    ],
    steps: ['识别当前风险标签与资金规模。', '匹配链上收益率更优的稳健协议。', '输出资金分配、预估收益与再平衡建议。'],
  };
}

export default function EarnScreen() {
  const [wallet, setWallet] = useState<StoredWalletSnapshot | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number>(1000);
  const [plan, setPlan] = useState<EarnPlanViewModel>(fallbackPlan(1000));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [generatedAt, setGeneratedAt] = useState<string>('等待生成');
  const [planLinkedToAgent, setPlanLinkedToAgent] = useState(false);
  const [statusText, setStatusText] = useState('策略结果将可同步到 Chat 与 Agent 任务卡片。');

  const loadWallet = useCallback(async () => {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      setWallet(JSON.parse(stored));
    } else {
      setWallet(null);
    }
  }, []);

  const loadPlan = useCallback(
    async (amount: number, isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setErrorText('');

      try {
        const response = await parseChatAiIntent({
          message: `帮我用${amount}U赚钱，给我一个适合当前钱包的稳健方案`,
          wallet,
        });

        if (response.earnPlan) {
          setPlan(normalizeEarnPlan(response.earnPlan));
          setStatusText('已基于当前输入重新生成策略，可继续同步到 Agent 任务页。');
        } else {
          setPlan(fallbackPlan(amount));
          setErrorText('当前返回的是通用建议，已先展示默认策略模板。');
          setStatusText('当前为本地兜底方案，建议稍后重新刷新以获取在线策略。');
        }
        setGeneratedAt(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
        setPlanLinkedToAgent(false);
      } catch (error) {
        console.error('load earn plan failed', error);
        setPlan(fallbackPlan(amount));
        setErrorText('暂时无法拉取在线策略，已展示本地兜底方案。');
        setGeneratedAt(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
        setPlanLinkedToAgent(false);
        setStatusText('当前展示的是兜底策略，后续仍可同步到 Agent 页面作为手动策略草案。');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [wallet],
  );

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  useEffect(() => {
    loadPlan(selectedAmount);
  }, [loadPlan, selectedAmount]);

  const annualizedLabel = useMemo(() => `${plan.apr.toFixed(2)}%`, [plan.apr]);

  const handleLinkToAgent = async () => {
    const nextGeneratedAt = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const payload: SyncedAgentPlan = {
      amount: plan.amount,
      apr: plan.apr,
      riskLabel: plan.riskLabel,
      providerLabel: plan.providerLabel,
      protocolLabel: plan.protocolLabel,
      statusLabel: plan.statusLabel,
      generatedAt: nextGeneratedAt,
    };

    await AsyncStorage.setItem(AGENT_PLAN_STORAGE_KEY, JSON.stringify(payload));
    setPlanLinkedToAgent(true);
    setGeneratedAt(nextGeneratedAt);
    setStatusText(`已将 ${plan.amount}U 策略同步到 Agent，后续可直接按任务卡片继续执行。`);
    router.push('/(tabs)/community');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadPlan(selectedAmount, true)} tintColor={PRIMARY} />}
      >
        <View style={styles.topBar}>
          <Pressable style={styles.iconButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={TEXT_PRIMARY} />
          </Pressable>
          <View style={styles.topBarCenter}>
            <Text style={styles.topBarTitle}>AI 智能赚币</Text>
            <Text style={styles.topBarSubtitle}>收益策略总览</Text>
          </View>
          <Pressable style={styles.iconButton} onPress={() => router.push('/(tabs)/chat')}>
            <MaterialCommunityIcons name="chat-processing-outline" size={22} color={PRIMARY_DARK} />
          </Pressable>
        </View>

        <LinearGradient colors={['#FFFFFF', '#F7F3FF', '#EFEAFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.heroEyebrow}>AI EARN</Text>
              <Text style={styles.heroTitle}>把钱包闲置资金变成可控收益</Text>
            </View>
            <View style={styles.heroChip}>
              <Text style={styles.heroChipText}>{plan.statusLabel}</Text>
            </View>
          </View>
          <Text style={styles.heroDescription}>{plan.description}</Text>
          <View style={styles.heroMetricRow}>
            <View style={styles.heroMetricBox}>
              <Text style={styles.heroMetricLabel}>预估年化</Text>
              <Text style={styles.heroMetricValue}>{annualizedLabel}</Text>
            </View>
            <View style={styles.heroMetricBox}>
              <Text style={styles.heroMetricLabel}>策略来源</Text>
              <Text style={styles.heroMetricValueSmall}>{plan.providerLabel}</Text>
            </View>
          </View>
          <Text style={styles.heroFootnote}>{wallet?.email ? `当前登录邮箱：${wallet.email}` : '登录后可结合真实钱包状态生成更贴身的赚币方案。'}</Text>
        </LinearGradient>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>投入金额</Text>
          <Text style={styles.sectionHint}>切换金额后会重新生成策略</Text>
        </View>
        <View style={styles.amountPresetRow}>
          {AMOUNT_PRESETS.map((amount) => {
            const selected = amount === selectedAmount;
            return (
              <Pressable
                key={amount}
                style={[styles.amountPreset, selected && styles.amountPresetActive]}
                onPress={() => setSelectedAmount(amount)}
              >
                <Text style={[styles.amountPresetText, selected && styles.amountPresetTextActive]}>{amount}U</Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={PRIMARY} />
            <Text style={styles.loadingText}>正在生成智能赚币方案...</Text>
          </View>
        ) : (
          <>
            {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

            <View style={styles.statusCard}>
              <View style={styles.statusCardHeader}>
                <View>
                  <Text style={styles.statusCardTitle}>策略联调状态</Text>
                  <Text style={styles.statusCardSubtitle}>最近生成时间：{generatedAt}</Text>
                </View>
                <View style={[styles.statusBadge, planLinkedToAgent ? styles.statusBadgeSuccess : styles.statusBadgeIdle]}>
                  <Text style={[styles.statusBadgeText, planLinkedToAgent ? styles.statusBadgeTextSuccess : styles.statusBadgeTextIdle]}>
                    {planLinkedToAgent ? '已同步 Agent' : '待同步'}
                  </Text>
                </View>
              </View>
              <Text style={styles.statusCardBody}>{statusText}</Text>
              <View style={styles.statusActionRow}>
                <Pressable style={styles.statusGhostButton} onPress={() => router.push('/(tabs)/chat')}>
                  <Text style={styles.statusGhostButtonText}>回到对话细聊</Text>
                </Pressable>
                <Pressable style={styles.statusPrimaryButton} onPress={handleLinkToAgent}>
                  <Text style={styles.statusPrimaryButtonText}>{planLinkedToAgent ? '已加入任务清单' : '同步到 Agent'}</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>预计月收益</Text>
                <Text style={styles.metricValueSuccess}>+{formatUsdt(plan.monthlyProfit)}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>预计年收益</Text>
                <Text style={styles.metricValue}>+{formatUsdt(plan.yearlyProfit)}</Text>
              </View>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <Text style={styles.infoTitle}>策略标签</Text>
                <View style={styles.infoTag}>
                  <Text style={styles.infoTagText}>{plan.riskLabel}</Text>
                </View>
              </View>
              <Text style={styles.infoBody}>{plan.protocolLabel}</Text>
              <Text style={styles.infoCaption}>结合 OKX 行情观察、链上收益池与流动性管理建议生成。</Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>资金分配建议</Text>
              <View style={styles.allocationWrap}>
                {plan.allocation.map((item) => (
                  <View key={item.label} style={styles.allocationItem}>
                    <View style={styles.allocationLabelRow}>
                      <View style={[styles.allocationDot, { backgroundColor: item.tone }]} />
                      <Text style={styles.allocationLabel}>{item.label}</Text>
                      <Text style={styles.allocationPercent}>{item.percent}%</Text>
                    </View>
                    <View style={styles.allocationTrack}>
                      <View style={[styles.allocationProgress, { width: `${item.percent}%`, backgroundColor: item.tone }]} />
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>AI 执行步骤</Text>
              <View style={styles.stepList}>
                {plan.steps.map((step, index) => (
                  <View key={step} style={styles.stepRow}>
                    <View style={styles.stepIndex}>
                      <Text style={styles.stepIndexText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>为什么这套方案适合现在</Text>
              <Text style={styles.infoBody}>
                当前页面优先展示稳健型方案：先把资金放在高流动性收益池里，再留出一部分机动资金用于补仓、换仓或响应新的高收益窗口。这样既保留灵活性，也能让收益更稳定。
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable style={styles.bottomGhostButton} onPress={() => router.push('/(tabs)/community')}>
          <Text style={styles.bottomGhostButtonText}>{planLinkedToAgent ? '查看 Agent 任务' : '前往 Agent 页面'}</Text>
        </Pressable>
        <Pressable style={styles.bottomPrimaryButton} onPress={() => loadPlan(selectedAmount, true)}>
          <LinearGradient colors={['#8F7CFF', '#6E5BFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bottomPrimaryButtonGradient}>
            <Text style={styles.bottomPrimaryButtonText}>重新生成策略</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 120,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  topBarCenter: {
    alignItems: 'center',
  },
  topBarTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: TEXT_PRIMARY,
  },
  topBarSubtitle: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 2,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FAF7FF',
    borderWidth: 1,
    borderColor: '#EFE7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    borderRadius: 28,
    padding: 20,
    marginBottom: 22,
    shadowColor: PRIMARY,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 24,
    elevation: 8,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  heroEyebrow: {
    fontSize: 12,
    letterSpacing: 1.4,
    color: PRIMARY,
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    color: TEXT_PRIMARY,
    maxWidth: 250,
  },
  heroChip: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: PRIMARY,
  },
  heroDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: TEXT_MUTED,
    marginBottom: 18,
  },
  heroMetricRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  heroMetricBox: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
    padding: 16,
  },
  heroMetricLabel: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginBottom: 8,
  },
  heroMetricValue: {
    fontSize: 28,
    fontWeight: '900',
    color: TEXT_PRIMARY,
  },
  heroMetricValueSmall: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroFootnote: {
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.72)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  sectionHint: {
    fontSize: 12,
    color: TEXT_MUTED,
  },
  amountPresetRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  amountPreset: {
    flex: 1,
    minHeight: 46,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FFFFFF',
  },
  amountPresetActive: {
    backgroundColor: PRIMARY_LIGHT,
    borderColor: '#D8B4FE',
  },
  amountPresetText: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_BODY,
  },
  amountPresetTextActive: {
    color: PRIMARY_DARK,
  },
  loadingCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FCFAFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: TEXT_MUTED,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#B45309',
    marginBottom: 12,
  },
  statusCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FCFAFF',
    padding: 18,
    marginBottom: 14,
  },
  statusCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 12,
  },
  statusCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  statusCardSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: TEXT_MUTED,
  },
  statusCardBody: {
    fontSize: 14,
    lineHeight: 22,
    color: TEXT_BODY,
    marginBottom: 14,
  },
  statusBadge: {
    minHeight: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadgeIdle: {
    backgroundColor: PRIMARY_LIGHT,
  },
  statusBadgeSuccess: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadgeTextIdle: {
    color: PRIMARY_DARK,
  },
  statusBadgeTextSuccess: {
    color: SUCCESS,
  },
  statusActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statusGhostButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusGhostButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: PRIMARY_DARK,
  },
  statusPrimaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 16,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPrimaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  metricLabel: {
    fontSize: 13,
    color: TEXT_MUTED,
    marginBottom: 10,
  },
  metricValue: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    color: TEXT_PRIMARY,
  },
  metricValueSuccess: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    color: SUCCESS,
  },
  infoCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FFFFFF',
    padding: 18,
    marginBottom: 14,
    shadowColor: '#1A1A2E',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 2,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 10,
  },
  infoTag: {
    minHeight: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: PRIMARY_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: PRIMARY_DARK,
  },
  infoBody: {
    fontSize: 15,
    lineHeight: 24,
    color: TEXT_BODY,
    marginBottom: 8,
  },
  infoCaption: {
    fontSize: 12,
    lineHeight: 18,
    color: TEXT_MUTED,
  },
  allocationWrap: {
    gap: 14,
  },
  allocationItem: {
    gap: 8,
  },
  allocationLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  allocationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  allocationLabel: {
    flex: 1,
    fontSize: 14,
    color: TEXT_BODY,
    fontWeight: '600',
  },
  allocationPercent: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  allocationTrack: {
    width: '100%',
    height: 10,
    borderRadius: 999,
    backgroundColor: '#EFEAFB',
    overflow: 'hidden',
  },
  allocationProgress: {
    height: '100%',
    borderRadius: 999,
  },
  stepList: {
    gap: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PRIMARY_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepIndexText: {
    fontSize: 13,
    fontWeight: '800',
    color: PRIMARY_DARK,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: TEXT_BODY,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderTopWidth: 1,
    borderTopColor: '#F3F0FF',
    flexDirection: 'row',
    gap: 12,
  },
  bottomGhostButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  bottomGhostButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: PRIMARY_DARK,
  },
  bottomPrimaryButton: {
    flex: 1.25,
    minHeight: 52,
    borderRadius: 18,
    overflow: 'hidden',
  },
  bottomPrimaryButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomPrimaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
