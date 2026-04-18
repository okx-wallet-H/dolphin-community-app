import AsyncStorage from "@react-native-async-storage/async-storage";
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
const BRAND_GRADIENT = ["#B790FF", "#8B67FF", "#6D52F6"] as const;
const SEGMENT_BG = "#EEE7FF";
const PAGE_BG = "#FCFBFF";
const CARD_BG = "rgba(255,255,255,0.88)";
const CARD_BORDER = "rgba(141, 110, 255, 0.14)";
const INPUT_BORDER = "rgba(126, 89, 255, 0.42)";
const TEXT_PRIMARY = "#211A3C";
const TEXT_SECONDARY = "#5D5974";
const TEXT_PLACEHOLDER = "#A29BBE";
const ERROR = "#D83A52";
const GLOW_PURPLE = "rgba(139,103,255,0.24)";

type AuthMode = "login" | "register";
type StatusTone = "default" | "success" | "error";

const FEATURE_CARDS = [
  {
    key: "ai-wallet",
    badge: "AI",
    title: "AI 对话钱包",
    cardTint: "rgba(255,255,255,0.72)",
  },
  {
    key: "agent-task",
    badge: "↗",
    title: "Agent 自动任务",
    cardTint: "rgba(255,250,241,0.86)",
  },
  {
    key: "asset-overview",
    badge: "◎",
    title: "链上资产总览",
    cardTint: "rgba(237,255,255,0.92)",
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

  if (exactMap[upper]) {
    return exactMap[upper];
  }

  if (/invalid url/i.test(normalized)) {
    return "服务器地址配置错误";
  }

  if (/network error|network request failed|failed to fetch/i.test(normalized)) {
    return "网络连接失败，请检查网络";
  }

  if (/invalid email/i.test(normalized)) {
    return "邮箱格式不正确";
  }

  if (/invalid code|invalid otp|verification code|expired/i.test(normalized)) {
    return "验证码不正确或已过期";
  }

  if (/email service not configured/i.test(normalized)) {
    return "邮件服务尚未配置完成";
  }

  if (/send code failed/i.test(normalized)) {
    return "验证码发送失败，请稍后重试";
  }

  if (/verify failed/i.test(normalized)) {
    return "验证码校验失败，请稍后重试";
  }

  return normalized || fallback;
}

function buildDefaultStatus(mode: AuthMode) {
  if (mode === "register") {
    return "首次验证成功后会自动创建 H Wallet 账户并初始化钱包。";
  }

  return "请输入邮箱并完成验证码验证，即可继续进入 H Wallet。";
}

function buildPasswordHint(mode: AuthMode) {
  if (mode === "register") {
    return "当前注册主链路采用邮箱验证码完成身份校验，密码能力仍在接入中。";
  }

  return "当前版本以邮箱验证码登录为主，密码输入框用于保留与设计稿一致的交互结构。";
}

function LoginLogo() {
  return (
    <View style={styles.logoRow}>
      <Image
        source={require("@/assets/images/hwallet-official-logo.png")}
        style={styles.logoImage}
        resizeMode="contain"
      />
      <Text style={styles.logoTitle}>H Wallet</Text>
    </View>
  );
}

export default function LoginRoute() {
  const scrollRef = useRef<ScrollView | null>(null);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [statusTone, setStatusTone] = useState<StatusTone>("default");
  const [statusText, setStatusText] = useState(buildDefaultStatus("login"));
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  useEffect(() => {
    setStatusTone("default");
    setStatusText(buildDefaultStatus(mode));
  }, [mode]);

  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        const token = await getSessionToken();
        if (!token) {
          return;
        }

        const cachedUser = await getUserInfo();
        if (cachedUser) {
          router.replace("/(tabs)/wallet");
          return;
        }

        const currentUser = await getMe();
        if (currentUser) {
          await setUserInfo({
            ...currentUser,
            lastSignedIn: new Date(currentUser.lastSignedIn),
          });
          router.replace("/(tabs)/wallet");
          return;
        }

        await removeSessionToken();
        await clearUserInfo();
      } catch {
        await removeSessionToken();
        await clearUserInfo();
      } finally {
        if (mounted) {
          setIsRestoringSession(false);
        }
      }
    };

    restoreSession();

    return () => {
      mounted = false;
    };
  }, []);

  const helperTextColor = useMemo(() => {
    if (statusTone === "error") return ERROR;
    if (statusTone === "success") return "#6D52F6";
    return TEXT_SECONDARY;
  }, [statusTone]);

  const handleFocus = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  };

  const handleSendOtp = async () => {
    if (!email.trim()) {
      setStatusTone("error");
      setStatusText("请先输入邮箱地址。");
      return;
    }

    try {
      setIsSendingOtp(true);
      setStatusTone("default");
      setStatusText("验证码发送中，请稍候...");
      const result = await sendAgentWalletOtp(email.trim());
      setOtpSent(true);
      setMaskedEmail(result.maskedEmail);
      setStatusTone("success");
      setStatusText(
        /verification code sent/i.test(result.message)
          ? "验证码已发送，请前往邮箱查收。"
          : result.message || "验证码已发送，请前往邮箱查收。",
      );
    } catch (error) {
      setStatusTone("error");
      setStatusText(
        error instanceof Error
          ? normalizeErrorMessage(error.message, "验证码发送失败，请稍后重试。")
          : "验证码发送失败，请稍后重试。",
      );
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleSubmit = async () => {
    if (!email.trim()) {
      setStatusTone("error");
      setStatusText("请输入邮箱地址。");
      return;
    }

    if (!code.trim()) {
      setStatusTone("error");
      setStatusText("请输入验证码。");
      return;
    }

    try {
      setIsSubmitting(true);
      setStatusTone("default");
      setStatusText(mode === "register" ? "正在连接 OKX Agent Wallet 并创建钱包..." : "正在验证验证码并恢复 OKX Agent Wallet...");

      const result = await verifyAgentWalletOtp(email.trim(), code.trim().replace(/\s+/g, ""));
      if (!result.app_session_id) {
        throw new Error("UNAUTHORIZED");
      }
      if (result.mockMode) {
        throw new Error("当前返回仍是演示钱包，已阻止登录，请检查 OKX Agent Wallet 配置。");
      }
      if (!result.wallet.evmAddress || !result.wallet.solanaAddress) {
        throw new Error("OKX Agent Wallet 未返回完整的钱包地址，请稍后重试。");
      }

      await setSessionToken(result.app_session_id);
      await setUserInfo({
        ...result.user,
        lastSignedIn: new Date(result.user.lastSignedIn),
      });
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

      setStatusTone("success");
      setStatusText(mode === "register" ? "OKX Agent Wallet 已创建，正在进入钱包首页。" : "OKX Agent Wallet 已恢复，正在进入钱包首页。");
      router.replace("/(tabs)/wallet");
    } catch (error) {
      setStatusTone("error");
      setStatusText(
        error instanceof Error
          ? normalizeErrorMessage(error.message, "登录失败，请稍后重试。")
          : "登录失败，请稍后重试。",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isRestoringSession) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.restoringContainer}>
          <LoginLogo />
          <ActivityIndicator size="large" color="#7C5DFF" />
          <Text style={styles.restoringTitle}>正在恢复登录状态</Text>
          <Text style={styles.restoringSubtitle}>检测到有效会话后将自动进入钱包首页</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.topGlow} />
          <View style={styles.sideGlow} />
          <View style={styles.bottomGlow} />

          <View style={styles.container}>
            <View style={styles.heroSection}>
              <LoginLogo />
              <Text style={styles.subtitle}>对话式 Web3 钱包</Text>
            </View>

            <View style={styles.formCard}>
              <View style={styles.segmentWrap}>
                <View style={styles.segmentBg}>
                  {(["login", "register"] as const).map((item) => {
                    const active = item === mode;
                    return (
                      <Pressable
                        key={item}
                        style={styles.segmentPressable}
                        onPress={() => setMode(item)}
                      >
                        {active ? (
                          <LinearGradient
                            colors={BRAND_GRADIENT}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.segmentActivePill}
                          >
                            <Text style={styles.segmentActiveText}>{item === "login" ? "登录" : "注册"}</Text>
                          </LinearGradient>
                        ) : (
                          <View style={styles.segmentInactivePill}>
                            <Text style={styles.segmentInactiveText}>{item === "login" ? "登录" : "注册"}</Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.fieldStack}>
                <View style={styles.inputShell}>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    onFocus={handleFocus}
                    placeholder="请输入邮箱地址"
                    placeholderTextColor={TEXT_PLACEHOLDER}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="off"
                    importantForAutofill="no"
                  />
                </View>

                <View style={styles.otpShell}>
                  <TextInput
                    style={styles.otpInput}
                    value={code}
                    onChangeText={(value) => setCode(value.replace(/\D/g, ""))}
                    onFocus={handleFocus}
                    placeholder="请输入验证码"
                    placeholderTextColor={TEXT_PLACEHOLDER}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoComplete="off"
                    importantForAutofill="no"
                  />
                  <Pressable
                    style={({ pressed }) => [
                      styles.sendCodeButton,
                      (pressed || isSendingOtp) && styles.buttonPressed,
                      isSendingOtp && styles.buttonDisabled,
                    ]}
                    onPress={handleSendOtp}
                    disabled={isSendingOtp}
                  >
                    <LinearGradient
                      colors={BRAND_GRADIENT}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.sendCodeGradient}
                    >
                      {isSendingOtp ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.sendCodeText}>发送验证码</Text>
                      )}
                    </LinearGradient>
                  </Pressable>
                </View>

                <View style={styles.inputShell}>
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={handleFocus}
                    placeholder="请输入密码"
                    placeholderTextColor={TEXT_PLACEHOLDER}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="off"
                    importantForAutofill="no"
                  />
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  (pressed || isSubmitting) && styles.buttonPressed,
                  isSubmitting && styles.buttonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                <LinearGradient
                  colors={BRAND_GRADIENT}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryButtonGradient}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>继续进入</Text>
                  )}
                </LinearGradient>
              </Pressable>

              <Text style={[styles.statusText, { color: helperTextColor }]}>{statusText}</Text>
              <Text style={styles.passwordHint}>{buildPasswordHint(mode)}</Text>
              {otpSent ? (
                <Text style={styles.otpHint}>验证码已发送至 {maskedEmail || email.trim()}，请查收后输入。</Text>
              ) : null}
            </View>

            <View style={styles.featureRow}>
              {FEATURE_CARDS.map((item) => (
                <View key={item.key} style={[styles.featureCard, { backgroundColor: item.cardTint }]}>
                  <View style={styles.featureBadge}>
                    <Text style={styles.featureBadgeText}>{item.badge}</Text>
                  </View>
                  <Text style={styles.featureTitle}>{item.title}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  topGlow: {
    position: "absolute",
    top: -48,
    right: -14,
    width: 248,
    height: 248,
    borderRadius: 124,
    backgroundColor: "rgba(231,220,255,0.84)",
  },
  sideGlow: {
    position: "absolute",
    top: 220,
    right: -60,
    width: 180,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(246,240,255,0.92)",
  },
  bottomGlow: {
    position: "absolute",
    bottom: -30,
    left: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(245,240,255,0.98)",
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 34,
  },
  heroSection: {
    alignItems: "center",
    marginTop: 20,
    marginBottom: 30,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 58,
    height: 58,
    marginRight: 12,
  },
  logoTitle: {
    fontSize: 38,
    lineHeight: 44,
    fontWeight: "800",
    color: TEXT_PRIMARY,
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 18,
    lineHeight: 24,
    color: TEXT_PRIMARY,
    textAlign: "center",
  },
  formCard: {
    backgroundColor: CARD_BG,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 22,
    shadowColor: "#B28BFF",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 20 },
    shadowRadius: 34,
    elevation: 10,
  },
  segmentWrap: {
    alignItems: "center",
    marginBottom: 22,
  },
  segmentBg: {
    width: 280,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: SEGMENT_BG,
    borderRadius: 999,
    padding: 6,
  },
  segmentPressable: {
    flex: 1,
  },
  segmentActivePill: {
    height: 56,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#8B67FF",
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 5,
  },
  segmentInactivePill: {
    height: 56,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActiveText: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  segmentInactiveText: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "500",
    color: TEXT_SECONDARY,
  },
  fieldStack: {
    gap: 18,
  },
  inputShell: {
    height: 66,
    borderRadius: 999,
    borderWidth: 1.4,
    borderColor: INPUT_BORDER,
    backgroundColor: "rgba(255,255,255,0.98)",
    justifyContent: "center",
    paddingHorizontal: 22,
    shadowColor: GLOW_PURPLE,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 3,
  },
  input: {
    fontSize: 18,
    lineHeight: 24,
    color: TEXT_PRIMARY,
    paddingVertical: 0,
  },
  otpShell: {
    height: 66,
    borderRadius: 999,
    borderWidth: 1.4,
    borderColor: INPUT_BORDER,
    backgroundColor: "rgba(255,255,255,0.98)",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 22,
    paddingRight: 8,
    shadowColor: GLOW_PURPLE,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 3,
  },
  otpInput: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
    color: TEXT_PRIMARY,
    paddingVertical: 0,
    paddingRight: 12,
  },
  sendCodeButton: {
    width: 168,
    height: 48,
    borderRadius: 999,
    overflow: "hidden",
  },
  sendCodeGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  sendCodeText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  primaryButton: {
    marginTop: 26,
    height: 66,
    borderRadius: 999,
    overflow: "hidden",
    shadowColor: "#8A62FF",
    shadowOpacity: 0.26,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 22,
    elevation: 6,
  },
  primaryButtonGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  primaryButtonText: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  buttonPressed: {
    opacity: 0.92,
  },
  buttonDisabled: {
    opacity: 0.72,
  },
  statusText: {
    marginTop: 16,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  passwordHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: TEXT_SECONDARY,
    textAlign: "center",
    opacity: 0.9,
  },
  otpHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: TEXT_SECONDARY,
    textAlign: "center",
  },
  featureRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 26,
  },
  featureCard: {
    flex: 1,
    borderRadius: 22,
    paddingTop: 18,
    paddingBottom: 20,
    paddingHorizontal: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    shadowColor: "rgba(102,74,185,0.20)",
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 3,
  },
  featureBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.78)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: "rgba(139,103,255,0.18)",
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 2,
  },
  featureBadgeText: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "700",
    color: "#835CFF",
  },
  featureTitle: {
    fontSize: 14,
    lineHeight: 19,
    color: TEXT_PRIMARY,
    textAlign: "center",
    fontWeight: "600",
  },
  restoringContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    backgroundColor: PAGE_BG,
  },
  restoringTitle: {
    marginTop: 18,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  restoringSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: TEXT_SECONDARY,
    textAlign: "center",
  },
});
