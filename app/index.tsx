import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  clearUserInfo,
  getSessionToken,
  getUserInfo,
  removeSessionToken,
  setSessionToken,
  setUserInfo,
} from "@/lib/_core/auth";
import { getMe, sendAgentWalletOtp, verifyAgentWalletOtp } from "@/lib/_core/api";

const WALLET_STORAGE_KEY = "hwallet-agent-wallet";

/* ── Unified Theme ── */
const T = {
  // Background
  bg1: "#FFFFFF",
  bg2: "#F5F0FF",
  bg3: "#EDE5FF",
  // Card glass
  glass: "rgba(255,255,255,0.92)",
  glassBorder: "rgba(255,255,255,0.95)",
  glassStroke: "rgba(139,103,255,0.10)",
  // Purple gradient
  purple1: "#B794F6",
  purple2: "#8B5CF6",
  purple3: "#7C3AED",
  // Text
  txt1: "#1A1A2E",
  txt2: "#6B6B8D",
  txt3: "#A0A0C0",
  // Accent
  error: "#EF4444",
  ok: "#7C3AED",
  white: "#FFFFFF",
};

type StatusTone = "default" | "success" | "error";

const FEATURES = [
  { key: "ai", icon: "robot-outline" as const, color: "#8B5CF6", bg: "rgba(139,92,246,0.12)", title: "AI 对话钱包" },
  { key: "agent", icon: "rocket-launch-outline" as const, color: "#F59E0B", bg: "rgba(245,158,11,0.12)", title: "Agent 自动任务" },
  { key: "asset", icon: "chart-donut" as const, color: "#10B981", bg: "rgba(16,185,129,0.12)", title: "链上资产总览" },
] as const;

function normErr(msg: string, fb: string): string {
  const u = msg.trim().toUpperCase();
  const map: Record<string, string> = {
    INVALID_EMAIL: "邮箱格式不正确",
    SEND_CODE_FAILED: "验证码发送失败",
    NETWORK_ERROR: "网络连接失败",
    INVALID_CODE: "验证码不正确",
    INVALID_OTP: "验证码不正确",
    INVALID_OR_EXPIRED_CODE: "验证码不正确或已过期",
    CODE_EXPIRED: "验证码已过期",
    UNAUTHORIZED: "登录已过期",
    EMAIL_SERVICE_NOT_CONFIGURED: "邮件服务尚未配置",
    VERIFY_FAILED: "验证码校验失败",
  };
  if (map[u]) return map[u];
  if (/network/i.test(msg)) return "网络连接失败";
  if (/invalid.*code|otp|expired/i.test(msg)) return "验证码不正确或已过期";
  return msg.trim() || fb;
}

export default function LoginRoute() {
  const scrollRef = useRef<ScrollView | null>(null);
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [tone, setTone] = useState<StatusTone>("default");
  const [status, setStatus] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [reqId, setReqId] = useState("");
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let m = true;
    (async () => {
      try {
        const tk = await getSessionToken();
        if (!tk) return;
        const cu = await getUserInfo();
        if (cu) { router.replace("/(tabs)/chat"); return; }
        const me = await getMe();
        if (me) { await setUserInfo({ ...me, lastSignedIn: new Date(me.lastSignedIn) }); router.replace("/(tabs)/chat"); return; }
        await removeSessionToken(); await clearUserInfo();
      } catch { await removeSessionToken(); await clearUserInfo(); }
      finally { if (m) setRestoring(false); }
    })();
    return () => { m = false; };
  }, []);

  const helperColor = useMemo(() => tone === "error" ? T.error : tone === "success" ? T.ok : T.txt2, [tone]);

  const handleSendOtp = async () => {
    if (!email.trim()) { setTone("error"); setStatus("请先输入邮箱地址"); return; }
    try {
      setSendingOtp(true); setTone("default"); setStatus("验证码发送中...");
      const r = await sendAgentWalletOtp(email.trim());
      setOtpSent(true); setReqId(r.requestId || "");
      setTone("success"); setStatus("验证码已发送，请查收邮箱");
    } catch (e) {
      setTone("error"); setStatus(e instanceof Error ? normErr(e.message, "验证码发送失败") : "验证码发送失败");
    } finally { setSendingOtp(false); }
  };

  const handleSubmit = async () => {
    if (!email.trim()) { setTone("error"); setStatus("请输入邮箱地址"); return; }
    if (!code.trim()) { setTone("error"); setStatus("请输入验证码"); return; }
    try {
      setSubmitting(true); setTone("default"); setStatus("正在验证...");
      const r = await verifyAgentWalletOtp(email.trim(), code.trim().replace(/\s+/g, ""), reqId);
      if (!r.app_session_id) throw new Error("UNAUTHORIZED");
      if (r.mockMode) throw new Error("当前为演示模式，请检查配置");
      if (!r.wallet.evmAddress || !r.wallet.solanaAddress) throw new Error("钱包地址不完整");
      await setSessionToken(r.app_session_id);
      await setUserInfo({ ...r.user, lastSignedIn: new Date(r.user.lastSignedIn) });
      await AsyncStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify({
        email: r.wallet.email, evmAddress: r.wallet.evmAddress,
        solanaAddress: r.wallet.solanaAddress, updatedAt: new Date().toISOString(), mockMode: r.mockMode,
      }));
      setTone("success"); setStatus("验证成功");
      router.replace("/(tabs)/chat");
    } catch (e) {
      setTone("error"); setStatus(e instanceof Error ? normErr(e.message, "登录失败") : "登录失败");
    } finally { setSubmitting(false); }
  };

  if (restoring) {
    return (
      <View style={s.loadingRoot}>
        <LinearGradient colors={[T.bg1, T.bg2, T.bg3]} style={StyleSheet.absoluteFill} />
        <Image source={require("@/assets/images/hwallet-official-logo.png")} style={s.loadingLogo} resizeMode="contain" />
        <Text style={s.loadingBrand}>H Wallet</Text>
        <ActivityIndicator size="large" color={T.purple3} style={{ marginTop: 24 }} />
        <Text style={s.loadingTip}>正在恢复登录状态...</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <LinearGradient colors={[T.bg1, T.bg2, T.bg3]} style={StyleSheet.absoluteFill} />
      {/* Decorative glow orbs */}
      <View style={s.orb1} />
      <View style={s.orb2} />

      <SafeAreaView style={s.safe} edges={["top", "left", "right", "bottom"]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* ── Logo Section ── */}
            <View style={s.logoArea}>
              <View style={s.logoGlow}>
                <Image source={require("@/assets/images/hwallet-official-logo.png")} style={s.logo} resizeMode="contain" />
              </View>
              <Text style={s.brand}>H Wallet</Text>
              <Text style={s.subtitle}>对话式 Web3 钱包</Text>
              <Text style={s.slogan}>一句话就可以构建任意交易策略</Text>
            </View>

            {/* ── Form Card (glass morphism) ── */}
            <View style={s.card}>
              {/* White border highlight */}
              <View style={s.cardInner}>
                {/* Tab Switcher */}
                <View style={s.tabWrap}>
                  <View style={s.tabBg}>
                    {(["login", "register"] as const).map((t) => (
                      <Pressable key={t} style={s.tabItem} onPress={() => setTab(t)}>
                        {tab === t ? (
                          <LinearGradient colors={[T.purple1, T.purple3]} style={s.tabOn}>
                            <Text style={s.tabOnTxt}>{t === "login" ? "登录" : "注册"}</Text>
                          </LinearGradient>
                        ) : (
                          <View style={s.tabOff}>
                            <Text style={s.tabOffTxt}>{t === "login" ? "登录" : "注册"}</Text>
                          </View>
                        )}
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Email */}
                <View style={s.field}>
                  <TextInput style={s.input} value={email} onChangeText={setEmail}
                    placeholder="请输入邮箱地址" placeholderTextColor={T.txt3}
                    keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
                </View>

                {/* Verify code */}
                <View style={s.codeRow}>
                  <TextInput style={s.codeInput} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ""))}
                    placeholder="请输入验证码" placeholderTextColor={T.txt3}
                    keyboardType="number-pad" maxLength={6} />
                  <Pressable onPress={handleSendOtp} disabled={sendingOtp} style={s.sendBtn}>
                    <LinearGradient colors={[T.purple1, T.purple3]} style={s.sendGrad}>
                      {sendingOtp ? <ActivityIndicator color={T.white} size="small" /> : <Text style={s.sendTxt}>发送验证码</Text>}
                    </LinearGradient>
                  </Pressable>
                </View>

                {/* Submit */}
                <Pressable onPress={handleSubmit} disabled={submitting} style={s.submitWrap}>
                  <LinearGradient colors={[T.purple1, T.purple3]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.submitGrad}>
                    {submitting ? <ActivityIndicator color={T.white} size="small" /> : <Text style={s.submitTxt}>继续进入</Text>}
                  </LinearGradient>
                </Pressable>

                {status ? <Text style={[s.statusTxt, { color: helperColor }]}>{status}</Text> : null}
              </View>
            </View>

            {/* ── Feature Cards ── */}
            <View style={s.featRow}>
              {FEATURES.map((f) => (
                <View key={f.key} style={s.featCard}>
                  <View style={[s.featIcon, { backgroundColor: f.bg }]}>
                    <MaterialCommunityIcons name={f.icon} size={26} color={f.color} />
                  </View>
                  <Text style={s.featLabel}>{f.title}</Text>
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

  // Glow orbs
  orb1: { position: "absolute", top: -60, right: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(139,92,246,0.10)" },
  orb2: { position: "absolute", bottom: -100, left: -80, width: 280, height: 280, borderRadius: 140, backgroundColor: "rgba(167,139,250,0.08)" },

  // Loading
  loadingRoot: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingLogo: { width: 80, height: 80 },
  loadingBrand: { fontSize: 28, fontWeight: "800", color: T.txt1, marginTop: 12 },
  loadingTip: { fontSize: 14, color: T.txt2, marginTop: 12 },

  // Logo
  logoArea: { alignItems: "center", marginTop: 32, marginBottom: 28 },
  logoGlow: {
    width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(139,92,246,0.08)",
    shadowColor: "#8B5CF6", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 16,
  },
  logo: { width: 56, height: 56 },
  brand: { fontSize: 34, fontWeight: "900", color: T.txt1, marginTop: 12, letterSpacing: 0.5 },
  subtitle: { fontSize: 16, fontWeight: "500", color: T.txt2, marginTop: 4 },
  slogan: { fontSize: 13, color: T.purple2, marginTop: 8, fontWeight: "600", letterSpacing: 0.3 },

  // Card - glass morphism with white border
  card: {
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.9)",
    backgroundColor: T.glass,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 10,
  },
  cardInner: { padding: 24 },

  // Tabs
  tabWrap: { alignItems: "center", marginBottom: 24 },
  tabBg: { flexDirection: "row", backgroundColor: "rgba(139,92,246,0.08)", borderRadius: 28, padding: 4 },
  tabItem: { flex: 1 },
  tabOn: { paddingVertical: 14, borderRadius: 24, alignItems: "center" },
  tabOnTxt: { fontSize: 16, fontWeight: "700", color: T.white },
  tabOff: { paddingVertical: 14, borderRadius: 24, alignItems: "center" },
  tabOffTxt: { fontSize: 16, fontWeight: "500", color: T.txt2 },

  // Fields
  field: {
    borderWidth: 1.5, borderColor: "rgba(139,92,246,0.2)", borderRadius: 28,
    marginBottom: 16, backgroundColor: T.white,
  },
  input: { height: 54, paddingHorizontal: 20, fontSize: 16, color: T.txt1 },
  codeRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderColor: "rgba(139,92,246,0.2)", borderRadius: 28,
    marginBottom: 24, backgroundColor: T.white, paddingRight: 6,
  },
  codeInput: { flex: 1, height: 54, paddingHorizontal: 20, fontSize: 16, color: T.txt1 },
  sendBtn: { borderRadius: 22, overflow: "hidden" },
  sendGrad: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 22 },
  sendTxt: { fontSize: 13, fontWeight: "700", color: T.white },

  // Submit
  submitWrap: { borderRadius: 28, overflow: "hidden" },
  submitGrad: { height: 54, alignItems: "center", justifyContent: "center", borderRadius: 28 },
  submitTxt: { fontSize: 18, fontWeight: "800", color: T.white, letterSpacing: 0.5 },

  statusTxt: { textAlign: "center", fontSize: 14, marginTop: 16 },

  // Features
  featRow: { flexDirection: "row", gap: 12, marginTop: 28 },
  featCard: {
    flex: 1, alignItems: "center", paddingVertical: 20, paddingHorizontal: 8,
    backgroundColor: "rgba(255,255,255,0.88)", borderRadius: 22,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.95)",
    shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 4,
  },
  featIcon: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  featLabel: { fontSize: 12, fontWeight: "700", color: T.txt1, textAlign: "center" },
});
