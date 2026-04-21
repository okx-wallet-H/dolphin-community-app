import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  clearUserInfo,
  getSessionToken,
  getUserInfo,
  removeSessionToken,
  setSessionToken,
  setUserInfo,
} from '@/lib/_core/auth';
import {
  getMe,
  getPublicCapabilityStatus,
  sendAgentWalletOtp,
  type PublicCapabilityStatusResponse,
  verifyAgentWalletOtp,
} from '@/lib/_core/api';

const WALLET_STORAGE_KEY = 'hwallet-agent-wallet';
const DEFAULT_STATUS = '请输入邮箱验证码，完成当前已验证通过的 OKX Agent Wallet 登录链路。';

const T = {
  bg1: '#FFFFFF',
  bg2: '#F5F0FF',
  bg3: '#EDE5FF',
  glass: 'rgba(255,255,255,0.92)',
  glassBorder: 'rgba(255,255,255,0.95)',
  glassStroke: 'rgba(139,103,255,0.10)',
  purple1: '#B794F6',
  purple2: '#8B5CF6',
  purple3: '#7C3AED',
  txt1: '#1A1A2E',
  txt2: '#6B6B8D',
  txt3: '#A0A0C0',
  error: '#EF4444',
  warning: '#D97706',
  ok: '#7C3AED',
  successBg: 'rgba(124,58,237,0.10)',
  warningBg: 'rgba(217,119,6,0.12)',
  errorBg: 'rgba(239,68,68,0.10)',
  white: '#FFFFFF',
};

type StatusTone = 'default' | 'success' | 'error';

type CapabilityTone = 'ready' | 'warning' | 'error';

const FEATURES = [
  { key: 'ai', icon: 'robot-outline' as const, color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', title: '自然语言钱包入口' },
  { key: 'wallet', icon: 'wallet-outline' as const, color: '#10B981', bg: 'rgba(16,185,129,0.12)', title: '真实钱包地址校验' },
  { key: 'onchain', icon: 'swap-horizontal' as const, color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', title: '链上执行能力检测' },
] as const;

function normErr(msg: string, fallback: string): string {
  const upper = msg.trim().toUpperCase();
  const exactMap: Record<string, string> = {
    INVALID_EMAIL: '邮箱格式不正确',
    SEND_CODE_FAILED: '验证码发送失败',
    NETWORK_ERROR: '网络连接失败',
    INVALID_CODE: '验证码不正确',
    INVALID_OTP: '验证码不正确',
    INVALID_OR_EXPIRED_CODE: '验证码不正确或已过期',
    CODE_EXPIRED: '验证码已过期',
    UNAUTHORIZED: '登录已过期',
    EMAIL_SERVICE_NOT_CONFIGURED: '邮件服务尚未配置',
    VERIFY_FAILED: '验证码校验失败',
  };

  if (exactMap[upper]) {
    return exactMap[upper];
  }
  if (/network/i.test(msg)) return '网络连接失败';
  if (/invalid.*code|otp|expired/i.test(msg)) return '验证码不正确或已过期';
  return msg.trim() || fallback;
}

function buildCapabilityHint(capabilities: PublicCapabilityStatusResponse | null): string {
  if (!capabilities) {
    return '正在检测当前部署是否已启用真实 Agent Wallet 与链上执行能力。';
  }

  if (capabilities.agentWallet.providerMode !== 'okx') {
    return '当前部署尚未完成 OKX Agent Wallet 登录配置，验证码入口会被阻止，请先补齐服务端配置。';
  }

  if (capabilities.onchainOs.providerMode !== 'okx') {
    return '当前已启用真实 Agent Wallet 登录，但链上兑换与执行尚未启用；要达到完整功能，还需补齐 OKX DEX / Onchain 凭证。';
  }

  return '当前部署已启用真实 Agent Wallet 登录与链上执行能力。';
}

function buildCapabilityTone(capabilities: PublicCapabilityStatusResponse | null): CapabilityTone {
  if (!capabilities) {
    return 'warning';
  }
  if (capabilities.agentWallet.providerMode !== 'okx') {
    return 'error';
  }
  if (capabilities.onchainOs.providerMode !== 'okx') {
    return 'warning';
  }
  return 'ready';
}

function capabilityColors(tone: CapabilityTone) {
  if (tone === 'ready') {
    return { text: T.ok, bg: T.successBg, border: 'rgba(124,58,237,0.16)' };
  }
  if (tone === 'error') {
    return { text: T.error, bg: T.errorBg, border: 'rgba(239,68,68,0.18)' };
  }
  return { text: T.warning, bg: T.warningBg, border: 'rgba(217,119,6,0.18)' };
}

function buildCapabilityRows(capabilities: PublicCapabilityStatusResponse | null) {
  if (!capabilities) {
    return [
      { label: 'Agent Wallet 登录', value: '检测中', tone: 'warning' as CapabilityTone },
      { label: '链上执行能力', value: '检测中', tone: 'warning' as CapabilityTone },
    ];
  }

  return [
    {
      label: 'Agent Wallet 登录',
      value: capabilities.agentWallet.providerMode === 'okx' ? '真实模式已启用' : '尚未配置',
      tone: capabilities.agentWallet.providerMode === 'okx' ? ('ready' as CapabilityTone) : ('error' as CapabilityTone),
    },
    {
      label: '链上执行能力',
      value: capabilities.onchainOs.providerMode === 'okx' ? '真实模式已启用' : '尚未启用',
      tone: capabilities.onchainOs.providerMode === 'okx' ? ('ready' as CapabilityTone) : ('warning' as CapabilityTone),
    },
  ];
}

export default function LoginRoute() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [tone, setTone] = useState<StatusTone>('default');
  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reqId, setReqId] = useState('');
  const [restoring, setRestoring] = useState(true);
  const [capabilities, setCapabilities] = useState<PublicCapabilityStatusResponse | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const result = await getPublicCapabilityStatus();
        if (!mounted) return;
        setCapabilities(result);
      } catch {
        if (!mounted) return;
        setCapabilities(null);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const token = await getSessionToken();
        if (!token) return;

        const currentUser = await getUserInfo();
        const storedWalletRaw = await AsyncStorage.getItem(WALLET_STORAGE_KEY);
        const storedWallet = storedWalletRaw ? JSON.parse(storedWalletRaw) : null;
        const me = await getMe();

        if (me) {
          await setUserInfo({
            id: me.id,
            openId: me.openId,
            name: me.name,
            email: me.email,
            loginMethod: me.loginMethod,
            lastSignedIn: new Date(me.lastSignedIn),
          });

          const restoredWallet =
            me.wallet?.evmAddress || me.wallet?.solanaAddress
              ? {
                  email: me.wallet.email ?? me.email ?? '',
                  evmAddress: me.wallet.evmAddress ?? '',
                  solanaAddress: me.wallet.solanaAddress ?? '',
                  updatedAt: new Date().toISOString(),
                  mockMode: false,
                }
              : storedWallet;

          if (restoredWallet) {
            await AsyncStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(restoredWallet));
            router.replace('/(tabs)/chat');
            return;
          }
        }

        if (currentUser && storedWallet) {
          router.replace('/(tabs)/chat');
          return;
        }

        await removeSessionToken();
        await clearUserInfo();
        await AsyncStorage.removeItem(WALLET_STORAGE_KEY);
      } catch {
        await removeSessionToken();
        await clearUserInfo();
        await AsyncStorage.removeItem(WALLET_STORAGE_KEY);
      } finally {
        if (mounted) {
          setRestoring(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const helperColor = useMemo(() => {
    if (tone === 'error') return T.error;
    if (tone === 'success') return T.ok;
    return T.txt2;
  }, [tone]);

  const capabilityTone = buildCapabilityTone(capabilities);
  const capabilityTheme = capabilityColors(capabilityTone);
  const capabilityRows = buildCapabilityRows(capabilities);
  const agentWalletReady = capabilities ? capabilities.agentWallet.providerMode === 'okx' : true;

  const handleSendOtp = async () => {
    if (!agentWalletReady) {
      setTone('error');
      setStatus('当前部署尚未启用真实 Agent Wallet 登录，请先完成 OKX Agent Wallet 配置。');
      return;
    }

    if (!email.trim()) {
      setTone('error');
      setStatus('请先输入邮箱地址');
      return;
    }

    try {
      setSendingOtp(true);
      setTone('default');
      setStatus('验证码发送中...');
      const result = await sendAgentWalletOtp(email.trim());
      setReqId(result.requestId || '');
      setTone('success');
      setStatus('验证码已发送，请查收邮箱并继续验证。');
    } catch (error) {
      setTone('error');
      setStatus(error instanceof Error ? normErr(error.message, '验证码发送失败') : '验证码发送失败');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSubmit = async () => {
    if (!agentWalletReady) {
      setTone('error');
      setStatus('当前部署尚未启用真实 Agent Wallet 登录，请先完成服务端配置。');
      return;
    }

    if (!email.trim()) {
      setTone('error');
      setStatus('请输入邮箱地址');
      return;
    }
    if (!code.trim()) {
      setTone('error');
      setStatus('请输入验证码');
      return;
    }

    try {
      setSubmitting(true);
      setTone('default');
      setStatus('正在验证...');
      const result = await verifyAgentWalletOtp(email.trim(), code.trim().replace(/\s+/g, ''), reqId);
      if (!result.app_session_id) throw new Error('UNAUTHORIZED');
      if (result.mockMode) throw new Error('当前链路未返回真实钱包结果，请检查配置');
      if (!result.wallet.evmAddress || !result.wallet.solanaAddress) throw new Error('钱包地址不完整');

      await setSessionToken(result.app_session_id);
      await setUserInfo({ ...result.user, lastSignedIn: new Date(result.user.lastSignedIn) });
      await AsyncStorage.setItem(
        WALLET_STORAGE_KEY,
        JSON.stringify({
          email: result.wallet.email,
          evmAddress: result.wallet.evmAddress,
          solanaAddress: result.wallet.solanaAddress,
          updatedAt: new Date().toISOString(),
          mockMode: result.mockMode,
        }),
      );

      setTone('success');
      setStatus('验证成功，正在进入 H Wallet...');
      router.replace('/(tabs)/chat');
    } catch (error) {
      setTone('error');
      setStatus(error instanceof Error ? normErr(error.message, '登录失败') : '登录失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (restoring) {
    return (
      <View style={s.loadingRoot}>
        <LinearGradient colors={[T.bg1, T.bg2, T.bg3]} style={StyleSheet.absoluteFill} />
        <Image source={require('@/assets/images/hwallet-official-logo.png')} style={s.loadingLogo} resizeMode="contain" />
        <Text style={s.loadingBrand}>H Wallet</Text>
        <ActivityIndicator size="large" color={T.purple3} style={{ marginTop: 24 }} />
        <Text style={s.loadingTip}>正在恢复登录状态...</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <LinearGradient colors={[T.bg1, T.bg2, T.bg3]} style={StyleSheet.absoluteFill} />
      <View style={s.orb1} />
      <View style={s.orb2} />

      <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={s.logoArea}>
              <View style={s.logoGlow}>
                <Image source={require('@/assets/images/hwallet-official-logo.png')} style={s.logo} resizeMode="contain" />
              </View>
              <Text style={s.brand}>H Wallet</Text>
              <Text style={s.subtitle}>已验证的 OKX Agent Wallet 入口</Text>
              <Text style={s.slogan}>仅保留邮箱验证码这一条真实登录链路</Text>
            </View>

            <View style={s.card}>
              <View style={s.cardInner}>
                <Text style={s.cardTitle}>继续进入 H Wallet</Text>
                <Text style={s.cardLead}>输入邮箱并完成验证码验证后，系统会校验真实钱包地址，再进入对话式钱包主页。</Text>

                <View style={[s.capabilityCard, { backgroundColor: capabilityTheme.bg, borderColor: capabilityTheme.border }]}> 
                  <View style={s.capabilityHeader}>
                    <MaterialCommunityIcons name="shield-check-outline" size={18} color={capabilityTheme.text} />
                    <Text style={[s.capabilityTitle, { color: capabilityTheme.text }]}>当前部署能力状态</Text>
                  </View>
                  <Text style={s.capabilityHint}>{buildCapabilityHint(capabilities)}</Text>
                  {capabilityRows.map((item) => {
                    const rowTheme = capabilityColors(item.tone);
                    return (
                      <View key={item.label} style={s.capabilityRow}>
                        <Text style={s.capabilityLabel}>{item.label}</Text>
                        <View style={[s.badge, { backgroundColor: rowTheme.bg, borderColor: rowTheme.border }]}>
                          <Text style={[s.badgeText, { color: rowTheme.text }]}>{item.value}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>

                <View style={s.field}>
                  <TextInput
                    style={s.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="请输入邮箱地址"
                    placeholderTextColor={T.txt3}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={s.codeRow}>
                  <TextInput
                    style={s.codeInput}
                    value={code}
                    onChangeText={(value) => setCode(value.replace(/\D/g, ''))}
                    placeholder="请输入验证码"
                    placeholderTextColor={T.txt3}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <Pressable onPress={handleSendOtp} disabled={sendingOtp || !agentWalletReady} style={s.sendBtn}>
                    <LinearGradient colors={[T.purple1, T.purple3]} style={[s.sendGrad, !agentWalletReady && s.disabledGrad]}>
                      {sendingOtp ? <ActivityIndicator color={T.white} size="small" /> : <Text style={s.sendTxt}>{agentWalletReady ? '发送验证码' : '等待配置'}</Text>}
                    </LinearGradient>
                  </Pressable>
                </View>

                <Pressable onPress={handleSubmit} disabled={submitting || !agentWalletReady} style={s.submitWrap}>
                  <LinearGradient colors={[T.purple1, T.purple3]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.submitGrad, !agentWalletReady && s.disabledGrad]}>
                    {submitting ? <ActivityIndicator color={T.white} size="small" /> : <Text style={s.submitTxt}>继续进入</Text>}
                  </LinearGradient>
                </Pressable>

                <Text style={[s.statusTxt, { color: helperColor }]}>{status}</Text>
              </View>
            </View>

            <View style={s.featRow}>
              {FEATURES.map((feature) => (
                <View key={feature.key} style={s.featCard}>
                  <View style={[s.featIcon, { backgroundColor: feature.bg }]}>
                    <MaterialCommunityIcons name={feature.icon} size={24} color={feature.color} />
                  </View>
                  <Text style={s.featLabel}>{feature.title}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },

  orb1: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(139,92,246,0.10)',
  },
  orb2: {
    position: 'absolute',
    bottom: -100,
    left: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(167,139,250,0.08)',
  },

  loadingRoot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingLogo: { width: 80, height: 80 },
  loadingBrand: { fontSize: 28, fontWeight: '800', color: T.txt1, marginTop: 12 },
  loadingTip: { fontSize: 14, color: T.txt2, marginTop: 12 },

  logoArea: { alignItems: 'center', marginTop: 32, marginBottom: 28 },
  logoGlow: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.08)',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  logo: { width: 56, height: 56 },
  brand: { fontSize: 34, fontWeight: '900', color: T.txt1, marginTop: 12, letterSpacing: 0.5 },
  subtitle: { fontSize: 16, fontWeight: '600', color: T.txt2, marginTop: 4 },
  slogan: { fontSize: 13, color: T.purple2, marginTop: 8, fontWeight: '600', letterSpacing: 0.3 },

  card: {
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: T.glassBorder,
    backgroundColor: T.glass,
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  cardInner: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: T.glassStroke,
    padding: 22,
    gap: 16,
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: T.txt1 },
  cardLead: { fontSize: 14, lineHeight: 21, color: T.txt2 },

  capabilityCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  capabilityHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  capabilityTitle: { fontSize: 14, fontWeight: '800' },
  capabilityHint: { fontSize: 13, lineHeight: 20, color: T.txt2 },
  capabilityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  capabilityLabel: { flex: 1, fontSize: 13, color: T.txt1, fontWeight: '600' },

  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },

  field: { marginTop: 4 },
  input: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139,103,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.88)',
    paddingHorizontal: 16,
    color: T.txt1,
    fontSize: 15,
  },
  codeRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  codeInput: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139,103,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.88)',
    paddingHorizontal: 16,
    color: T.txt1,
    fontSize: 15,
  },
  sendBtn: { width: 124 },
  sendGrad: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendTxt: { color: T.white, fontSize: 14, fontWeight: '800' },
  submitWrap: { marginTop: 4 },
  submitGrad: {
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitTxt: { color: T.white, fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  disabledGrad: { opacity: 0.45 },
  statusTxt: { fontSize: 13, lineHeight: 20 },

  featRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  featCard: {
    flex: 1,
    minHeight: 112,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 16,
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  featIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  featLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: T.txt1,
    textAlign: 'center',
  },
});
