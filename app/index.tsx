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

// Design system colors - matching the mockup exactly
const COLORS = {
  bgGradientStart: "#FFFFFF",
  bgGradientMid: "#F8F5FF",
  bgGradientEnd: "#F0EBFF",
  cardBg: "rgba(255,255,255,0.95)",
  cardBorder: "rgba(139,103,255,0.12)",
  inputBorder: "rgba(139,103,255,0.35)",
  inputBorderFocus: "rgba(139,103,255,0.6)",
  primaryGradientStart: "#A78BFA",
  primaryGradientEnd: "#7C3AED",
  textPrimary: "#1F1F3D",
  textSecondary: "#6B6B8D",
  textPlaceholder: "#A0A0C0",
  error: "#EF4444",
  success: "#7C3AED",
  white: "#FFFFFF",
  segmentBg: "#F3EEFF",
  segmentActive: "#7C3AED",
};

type StatusTone = "default" | "success" | "error";

const FEATURE_CARDS = [
  {
    key: "ai-wallet",
    icon: "robot-outline" as const,
    iconBg: "rgba(139,103,255,0.15)",
    title: "AI 对话钱包",
  },
  {
    key: "agent-task",
    icon: "rocket-launch-outline" as const,
    iconBg: "rgba(251,191,36,0.15)",
    title: "Agent 自动任务",
  },
  {
    key: "asset-overview",
    icon: "database-outline" as const,
    iconBg: "rgba(16,185,129,0.15)",
    title: "链上资产总览",
  },
] as const;

function normalizeErrorMessage(message: string, fallback: string): string {
  const normalized = message.trim();
  const upper = normalized.toUpperCase();

  const exactMap: Record<string, string> = {
    INVALID_EMAIL: "邮箱格式不正确",
    SEND_CODE_FAILED: "验证码发送失败",
    NETWORK_ERROR: "网络连接失败，请检查网络",
    INVALID_CODE: "验证码不正确",
    INVALID_OTP: "验证码不正确",
    INVALID_OR_EXPIRED_CODE: "验证码不正确或已过期",
    CODE_EXPIRED: "验证码已过期，请重新获取",
    UNAUTHORIZED: "登录已过期，请重新登录",
    EMAIL_SERVICE_NOT_CONFIGURED: "邮件服务尚未配置完成",
    VERIFY_FAILED: "验证码校验失败，请稍后重试",
  };

  if (exactMap[upper]) return exactMap[upper];
  if (/network error|network request failed|failed to fetch/i.test(normalized)) return "网络连接失败，请检查网络";
  if (/invalid email/i.test(normalized)) return "邮箱格式不正确";
  if (/invalid code|invalid otp|verification code|expired/i.test(normalized)) return "验证码不正确或已过期";
  return normalized || fallback;
}

export default function LoginRoute() {
  const scrollRef = useRef<ScrollView | null>(null);
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [statusTone, setStatusTone] = useState<StatusTone>("default");
  const [statusText, setStatusText] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpRequestId, setOtpRequestId] = useState("");
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  useEffect(() => {
    let mounted = true;
    const restoreSession = async () => {
      try {
        const token = await getSessionToken();
        if (!token) return;
        const cachedUser = await getUserInfo();
        if (cachedUser) { router.replace("/(tabs)/chat"); return; }
        const currentUser = await getMe();
        if (currentUser) {
          await setUserInfo({ ...currentUser, lastSignedIn: new Date(currentUser.lastSignedIn) });
          router.replace("/(tabs)/chat");
          return;
        }
        await removeSessionToken();
        await clearUserInfo();
      } catch {
        await removeSessionToken();
        await clearUserInfo();
      } finally {
        if (mounted) setIsRestoringSession(false);
      }
    };
    restoreSession();
    return () => { mounted = false; };
  }, []);

  const helperTextColor = useMemo(() => {
    if (statusTone === "error") return COLORS.error;
    if (statusTone === "success") return COLORS.success;
    return COLORS.textSecondary;
  }, [statusTone]);

  const handleSendOtp = async () => {
    if (!email.trim()) {
      setStatusTone("error");
      setStatusText("请先输入邮箱地址");
      return;
    }
    try {
      setIsSendingOtp(true);
      setStatusTone("default");
      setStatusText("验证码发送中...");
      const result = await sendAgentWalletOtp(email.trim());
      setOtpSent(true);
      setOtpRequestId(result.requestId || "");
      setStatusTone("success");
      setStatusText("验证码已发送，请查收邮箱");
    } catch (error) {
      setStatusTone("error");
      setStatusText(error instanceof Error ? normalizeErrorMessage(error.message, "验证码发送失败") : "验证码发送失败");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleSubmit = async () => {
    if (!email.trim()) { setStatusTone("error"); setStatusText("请输入邮箱地址"); return; }
    if (!code.trim()) { setStatusTone("error"); setStatusText("请输入验证码"); return; }
    try {
      setIsSubmitting(true);
      setStatusTone("default");
      setStatusText("正在验证...");
      const result = await verifyAgentWalletOtp(email.trim(), code.trim().replace(/\s+/g, ""), otpRequestId);
      if (!result.app_session_id) throw new Error("UNAUTHORIZED");
      if (result.mockMode) throw new Error("当前为演示模式，请检查 OKX Agent Wallet 配置");
      if (!result.wallet.evmAddress || !result.wallet.solanaAddress) throw new Error("钱包地址不完整");

      await setSessionToken(result.app_session_id);
      await setUserInfo({ ...result.user, lastSignedIn: new Date(result.user.lastSignedIn) });
      await AsyncStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify({
        email: result.wallet.email,
        evmAddress: result.wallet.evmAddress,
        solanaAddress: result.wallet.solanaAddress,
        updatedAt: new Date().toISOString(),
        mockMode: result.mockMode,
      }));
      setStatusTone("success");
      setStatusText("验证成功");
      router.replace("/(tabs)/wallet");
    } catch (error) {
      setStatusTone("error");
      setStatusText(error instanceof Error ? normalizeErrorMessage(error.message, "登录失败") : "登录失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isRestoringSession) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={[COLORS.bgGradientStart, COLORS.bgGradientMid, COLORS.bgGradientEnd]} style={StyleSheet.absoluteFill} />
        <Image source={require("@/assets/images/hwallet-official-logo.png")} style={styles.loadingLogo} resizeMode="contain" />
        <Text style={styles.loadingTitle}>H Wallet</Text>
        <ActivityIndicator size="large" color={COLORS.primaryGradientEnd} style={{ marginTop: 24 }} />
        <Text style={styles.loadingText}>正在恢复登录状态...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.bgGradientStart, COLORS.bgGradientMid, COLORS.bgGradientEnd]} style={StyleSheet.absoluteFill} />
      
      {/* Rainbow glow effects */}
      <View style={styles.glowTopRight} />
      <View style={styles.glowBottomLeft} />

      <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Logo */}
            <View style={styles.logoSection}>
              <View style={styles.logoRow}>
                <Image source={require("@/assets/images/hwallet-official-logo.png")} style={styles.logoImage} resizeMode="contain" />
                <Text style={styles.logoTitle}>H Wallet</Text>
              </View>
              <Text style={styles.subtitle}>对话式 Web3 钱包</Text>
            </View>

            {/* Form Card */}
            <View style={styles.formCard}>
              {/* Tab Switcher */}
              <View style={styles.tabContainer}>
                <View style={styles.tabBg}>
                  <Pressable style={styles.tabItem} onPress={() => setActiveTab("login")}>
                    {activeTab === "login" ? (
                      <LinearGradient colors={[COLORS.primaryGradientStart, COLORS.primaryGradientEnd]} style={styles.tabActive}>
                        <Text style={styles.tabActiveText}>登录</Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.tabInactive}>
                        <Text style={styles.tabInactiveText}>登录</Text>
                      </View>
                    )}
                  </Pressable>
                  <Pressable style={styles.tabItem} onPress={() => setActiveTab("register")}>
                    {activeTab === "register" ? (
                      <LinearGradient colors={[COLORS.primaryGradientStart, COLORS.primaryGradientEnd]} style={styles.tabActive}>
                        <Text style={styles.tabActiveText}>注册</Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.tabInactive}>
                        <Text style={styles.tabInactiveText}>注册</Text>
                      </View>
                    )}
                  </Pressable>
                </View>
              </View>

              {/* Email Input */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="请输入邮箱地址"
                  placeholderTextColor={COLORS.textPlaceholder}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Code Input with Send Button */}
              <View style={styles.codeContainer}>
                <TextInput
                  style={styles.codeInput}
                  value={code}
                  onChangeText={(v) => setCode(v.replace(/\D/g, ""))}
                  placeholder="请输入验证码"
                  placeholderTextColor={COLORS.textPlaceholder}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <Pressable style={styles.sendCodeBtn} onPress={handleSendOtp} disabled={isSendingOtp}>
                  <LinearGradient colors={[COLORS.primaryGradientStart, COLORS.primaryGradientEnd]} style={styles.sendCodeGradient}>
                    {isSendingOtp ? (
                      <ActivityIndicator color={COLORS.white} size="small" />
                    ) : (
                      <Text style={styles.sendCodeText}>发送验证码</Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>

              {/* Submit Button */}
              <Pressable style={styles.submitBtn} onPress={handleSubmit} disabled={isSubmitting}>
                <LinearGradient colors={[COLORS.primaryGradientStart, COLORS.primaryGradientEnd]} style={styles.submitGradient}>
                  {isSubmitting ? (
                    <ActivityIndicator color={COLORS.white} size="small" />
                  ) : (
                    <Text style={styles.submitText}>继续进入</Text>
                  )}
                </LinearGradient>
              </Pressable>

              {/* Status Text */}
              {statusText ? <Text style={[styles.statusText, { color: helperTextColor }]}>{statusText}</Text> : null}
            </View>

            {/* Feature Cards */}
            <View style={styles.featureRow}>
              {FEATURE_CARDS.map((item) => (
                <View key={item.key} style={styles.featureCard}>
                  <View style={[styles.featureIconWrap, { backgroundColor: item.iconBg }]}>
                    <MaterialCommunityIcons name={item.icon} size={24} color={COLORS.primaryGradientEnd} />
                  </View>
                  <Text style={styles.featureTitle}>{item.title}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },

  // Glow effects
  glowTopRight: {
    position: "absolute",
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(167,139,250,0.15)",
  },
  glowBottomLeft: {
    position: "absolute",
    bottom: -80,
    left: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "rgba(139,103,255,0.1)",
  },

  // Loading
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingLogo: { width: 80, height: 80 },
  loadingTitle: { fontSize: 28, fontWeight: "800", color: COLORS.textPrimary, marginTop: 12 },
  loadingText: { fontSize: 14, color: COLORS.textSecondary, marginTop: 12 },

  // Logo
  logoSection: { alignItems: "center", marginTop: 40, marginBottom: 32 },
  logoRow: { flexDirection: "row", alignItems: "center" },
  logoImage: { width: 52, height: 52, marginRight: 12 },
  logoTitle: { fontSize: 32, fontWeight: "800", color: COLORS.textPrimary },
  subtitle: { fontSize: 16, color: COLORS.textSecondary, marginTop: 8 },

  // Form Card
  formCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },

  // Tabs
  tabContainer: { alignItems: "center", marginBottom: 24 },
  tabBg: {
    flexDirection: "row",
    backgroundColor: COLORS.segmentBg,
    borderRadius: 28,
    padding: 4,
  },
  tabItem: { flex: 1 },
  tabActive: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 24,
    alignItems: "center",
  },
  tabActiveText: { fontSize: 16, fontWeight: "700", color: COLORS.white },
  tabInactive: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 24,
    alignItems: "center",
  },
  tabInactiveText: { fontSize: 16, fontWeight: "500", color: COLORS.textSecondary },

  // Inputs
  inputContainer: {
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: 28,
    marginBottom: 16,
    backgroundColor: COLORS.white,
  },
  input: {
    height: 56,
    paddingHorizontal: 20,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  codeContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: 28,
    marginBottom: 16,
    backgroundColor: COLORS.white,
    paddingRight: 6,
  },
  codeInput: {
    flex: 1,
    height: 56,
    paddingHorizontal: 20,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  sendCodeBtn: { borderRadius: 22, overflow: "hidden" },
  sendCodeGradient: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 22,
  },
  sendCodeText: { fontSize: 14, fontWeight: "600", color: COLORS.white },

  // Submit
  submitBtn: { borderRadius: 28, overflow: "hidden", marginTop: 8 },
  submitGradient: {
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
  },
  submitText: { fontSize: 18, fontWeight: "700", color: COLORS.white },

  // Status
  statusText: { textAlign: "center", fontSize: 14, marginTop: 16 },

  // Features
  featureRow: { flexDirection: "row", gap: 12, marginTop: 28 },
  featureCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  featureIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  featureTitle: { fontSize: 13, fontWeight: "600", color: COLORS.textPrimary, textAlign: "center" },
});
