import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
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
import {
  getMe,
  sendAgentWalletOtp,
  verifyAgentWalletOtp,
} from "@/lib/_core/api";

const WALLET_STORAGE_KEY = "hwallet-agent-wallet";
const BRAND_GRADIENT = ["#9B6BFF", "#7C3AED", "#6D28D9"] as const;
const PAGE_BG = "#FCFAFF";
const PAGE_SOFT = "#F7F4FF";
const CARD_BG = "#FFFFFF";
const BORDER = "#E8EAF2";
const TEXT_PRIMARY = "#1A1A2E";
const TEXT_BODY = "#31324A";
const TEXT_SECONDARY = "#666C85";
const TEXT_PLACEHOLDER = "#A7ADC0";
const PRIMARY = "#7C3AED";
const ERROR = "#DC2626";
const EMAIL_PLACEHOLDER = "请输入邮箱地址";
const CODE_PLACEHOLDER = "请输入验证码";

const FEATURE_CARDS = [
  {
    key: "ai-wallet",
    title: "智能对话",
    icon: "chat-processing",
  },
  {
    key: "agent-task",
    title: "自动任务",
    icon: "robot-excited-outline",
  },
  {
    key: "asset-overview",
    title: "链上资产总览",
    icon: "chart-pie",
  },
] as const;

type StatusTone = "default" | "success" | "error";

function LoginLogo() {
  return (
    <View style={styles.logoWrap}>
      <Image
        source={require("@/assets/images/hwallet-official-logo.png")}
        style={styles.logoImage}
        resizeMode="contain"
      />
    </View>
  );
}

function FeatureIcon({
  name,
}: {
  name: (typeof FEATURE_CARDS)[number]["icon"];
}) {
  return <MaterialCommunityIcons name={name} size={26} color={PRIMARY} />;
}

function normalizeErrorMessage(message: string, fallback: string): string {
  const normalized = message.trim();
  const upper = normalized.toUpperCase();

  const exactMap: Record<string, string> = {
    INVALID_EMAIL: "邮箱格式不正确",
    SEND_CODE_FAILED: "验证码发送失败",
    NETWORK_ERROR: "网络连接失败，请检查网络",
    INVALID_CODE: "验证码不正确",
    INVALID_OTP: "验证码不正确",
    CODE_EXPIRED: "验证码已过期，请重新获取",
    UNAUTHORIZED: "登录已过期，请重新登录",
  };

  if (exactMap[upper]) {
    return exactMap[upper];
  }
  if (/invalid url/i.test(normalized)) {
    return "服务器地址配置错误";
  }
  if (
    /network error|network request failed|failed to fetch/i.test(normalized)
  ) {
    return "网络连接失败，请检查网络";
  }
  if (/invalid email/i.test(normalized)) {
    return "邮箱格式不正确";
  }
  if (/send code failed/i.test(normalized)) {
    return "验证码发送失败";
  }
  if (/invalid code|invalid otp|verification code/i.test(normalized)) {
    return "验证码不正确";
  }
  if (/expired/i.test(normalized) && /code|otp/i.test(normalized)) {
    return "验证码已过期，请重新获取";
  }
  if (/unauthorized|token/i.test(normalized)) {
    return "登录已过期，请重新登录";
  }

  return normalized || fallback;
}

export default function LoginRoute() {
  const scrollRef = useRef<ScrollView | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [statusText, setStatusText] = useState(
    "输入邮箱并获取验证码，即可进入 H Wallet。首次登录会自动创建智能钱包。",
  );
  const [statusTone, setStatusTone] = useState<StatusTone>("default");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  useEffect(() => {
    setEmail("");
    setCode("");
  }, []);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        // Web 端继续走现有登录页流程，原生端在启动时尝试恢复本地会话。
        if (Platform.OS === "web") {
          return;
        }

        const sessionToken = await getSessionToken();
        if (!sessionToken) {
          return;
        }

        const cachedUser = await getUserInfo();
        if (cachedUser) {
          router.replace("/(tabs)/chat");
          return;
        }

        // 只有 token 没有用户缓存时，主动向服务端补一次用户信息并恢复登录态。
        const currentUser = await getMe();
        if (currentUser) {
          await setUserInfo({
            ...currentUser,
            lastSignedIn: new Date(currentUser.lastSignedIn),
          });
          router.replace("/(tabs)/chat");
          return;
        }

        await removeSessionToken();
        await clearUserInfo();
      } catch {
        await removeSessionToken();
        await clearUserInfo();
      } finally {
        if (isMounted) {
          setIsRestoringSession(false);
        }
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const helperTextColor = useMemo(() => {
    if (statusTone === "error") return ERROR;
    if (statusTone === "success") return PRIMARY;
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
      setStatusText(result.message || "验证码已发送，请查收邮箱。");
    } catch (error) {
      setStatusTone("error");
      const msg =
        error instanceof Error
          ? normalizeErrorMessage(error.message, "验证码发送失败，请稍后重试。")
          : "验证码发送失败，请稍后重试。";
      setStatusText(msg);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleAuthAction = async () => {
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
      const normalizedCode = code.trim().replace(/\s+/g, "");
      setIsVerifying(true);
      setStatusTone("default");
      setStatusText("正在验证验证码并进入首页...");
      const result = await verifyAgentWalletOtp(email.trim(), normalizedCode);

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
      setStatusText(
        result.mockMode
          ? "演示模式验证成功，正在进入首页。"
          : "验证成功，正在进入首页。",
      );
      router.replace("/(tabs)/chat");
    } catch (error) {
      setStatusTone("error");
      const fallback = "验证码登录失败，请稍后重试。";
      const msg =
        error instanceof Error
          ? normalizeErrorMessage(error.message, fallback)
          : fallback;
      setStatusText(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  if (isRestoringSession) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={["top", "left", "right", "bottom"]}
      >
        <View style={styles.restoringContainer}>
          <LoginLogo />
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.restoringTitle}>正在恢复登录状态</Text>
          <Text style={styles.restoringSubtitle}>
            检测到本地会话后会自动进入主界面
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "left", "right", "bottom"]}
    >
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
          <View style={styles.pageGlowTop} />
          <View style={styles.pageGlowBottom} />

          <View style={styles.container}>
            <View style={styles.heroBlock}>
              <LoginLogo />
              <Text style={styles.brandTitle}>H Wallet</Text>
              <Text style={styles.heroSubtitle}>
                对话式 Web3 钱包
              </Text>
            </View>

            <View style={styles.formCard}>
              <View style={styles.otpNotice}>
                <View style={styles.otpNoticeBadge}>
                  <Text style={styles.otpNoticeBadgeText}>纯验证码登录</Text>
                </View>
                <Text style={styles.otpNoticeTitle}>无需密码，验证即进入</Text>
                <Text style={styles.otpNoticeDesc}>
                  输入邮箱获取验证码，完成验证后自动登录；如果是首次登录，会同时创建你的智能钱包。
                </Text>
              </View>

              <View style={styles.fieldGroup}>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={handleFocus}
                  placeholder={EMAIL_PLACEHOLDER}
                  defaultValue=""
                  placeholderTextColor={TEXT_PLACEHOLDER}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  importantForAutofill="no"
                />
              </View>

              <View style={styles.fieldGroup}>
                <View style={styles.otpRow}>
                  <TextInput
                    style={[styles.input, styles.otpInput]}
                    value={code}
                    onChangeText={(value) => setCode(value.replace(/\D/g, ""))}
                    onFocus={handleFocus}
                    placeholder={CODE_PLACEHOLDER}
                    defaultValue=""
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
                        <Text style={styles.sendCodeText}>获取验证码</Text>
                      )}
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.loginButton,
                  (pressed || isVerifying) && styles.buttonPressed,
                  isVerifying && styles.buttonDisabled,
                ]}
                onPress={handleAuthAction}
                disabled={isVerifying}
              >
                <LinearGradient
                  colors={BRAND_GRADIENT}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.loginButtonGradient}
                >
                  {isVerifying ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.loginButtonText}>立即登录</Text>
                  )}
                </LinearGradient>
              </Pressable>

              <Text style={[styles.helperText, { color: helperTextColor }]}>
                {statusText}
              </Text>
              {otpSent ? (
                <Text style={styles.tipText}>
                  验证码已发送至 {maskedEmail || email.trim()}，输入后将直接登录。
                </Text>
              ) : null}
            </View>

            <View style={styles.featureSection}>
              {FEATURE_CARDS.map((item) => (
                <View key={item.key} style={styles.featureCard}>
                  <View style={styles.featureIconWrap}>
                    <FeatureIcon name={item.icon} />
                  </View>
                  <Text style={styles.featureTitle}>{item.title}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.footerText}>
              安全托管您的会话，重启应用后自动恢复登录状态。
            </Text>
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
  pageGlowTop: {
    position: "absolute",
    top: -118,
    right: -28,
    width: 276,
    height: 276,
    borderRadius: 138,
    backgroundColor: "#E9DDFF",
    opacity: 0.72,
  },
  pageGlowBottom: {
    position: "absolute",
    bottom: -132,
    left: -64,
    width: 316,
    height: 316,
    borderRadius: 158,
    backgroundColor: "#F3EDFF",
    opacity: 0.96,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 36,
  },
  heroBlock: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 28,
  },
  logoWrap: {
    width: 132,
    height: 132,
    borderRadius: 34,
    backgroundColor: "#F6F1FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  logoImage: {
    width: 108,
    height: 108,
  },
  brandTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    color: TEXT_PRIMARY,
    letterSpacing: 0.2,
  },
  heroSubtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 23,
    color: TEXT_SECONDARY,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  formCard: {
    backgroundColor: "rgba(255, 255, 255, 0.82)",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.12)",
    padding: 22,
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.10,
    shadowRadius: 28,
    elevation: 6,
  },
  otpNotice: {
    backgroundColor: "rgba(245,243,255,0.72)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.10)",
    padding: 16,
    marginBottom: 18,
    gap: 8,
  },
  otpNoticeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(124,58,237,0.12)",
  },
  otpNoticeBadgeText: {
    color: PRIMARY,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  otpNoticeTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    color: TEXT_PRIMARY,
  },
  otpNoticeDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: TEXT_SECONDARY,
  },
  fieldGroup: {
    marginTop: 12,
  },
  input: {
    height: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.12)",
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 16,
    fontSize: 16,
    lineHeight: 22,
    color: TEXT_BODY,
  },
  otpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  otpInput: {
    flex: 1,
  },
  sendCodeButton: {
    width: 120,
    height: 52,
    borderRadius: 16,
    overflow: "hidden",
  },
  sendCodeGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  sendCodeText: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  loginButton: {
    marginTop: 18,
    height: 52,
    borderRadius: 16,
    overflow: "hidden",
  },
  loginButtonGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  loginButtonText: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  helperText: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  tipText: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    color: TEXT_SECONDARY,
    textAlign: "center",
  },
  featureSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 28,
    gap: 12,
  },
  featureCard: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.10)",
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: "center",
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  featureIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "rgba(245, 239, 255, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    textAlign: "center",
  },
  footerText: {
    marginTop: 26,
    fontSize: 13,
    lineHeight: 20,
    color: TEXT_SECONDARY,
    textAlign: "center",
    opacity: 0.9,
  },
  restoringContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    backgroundColor: PAGE_BG,
  },
  restoringTitle: {
    marginTop: 20,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "700",
    color: TEXT_PRIMARY,
  },
  restoringSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: TEXT_SECONDARY,
    textAlign: "center",
  },
});
