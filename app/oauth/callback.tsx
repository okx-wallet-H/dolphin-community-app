import { ThemedView } from "@/components/themed-view";
import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type CallbackStatus = "processing" | "success" | "error";

function decodeUserParam(userParam: string) {
  try {
    const userJson =
      typeof atob !== "undefined"
        ? atob(userParam)
        : Buffer.from(userParam, "base64").toString("utf-8");

    return JSON.parse(userJson) as {
      id?: number | null;
      openId?: string;
      name?: string;
      email?: string;
      loginMethod?: string;
      lastSignedIn?: string;
    };
  } catch {
    return null;
  }
}

function buildSearchString(params: {
  code?: string;
  state?: string;
  error?: string;
  sessionToken?: string;
}) {
  const urlParams = new URLSearchParams();
  if (params.code) urlParams.set("code", params.code);
  if (params.state) urlParams.set("state", params.state);
  if (params.error) urlParams.set("error", params.error);
  if (params.sessionToken) urlParams.set("sessionToken", params.sessionToken);

  const output = urlParams.toString();
  return output ? `?${output}` : null;
}

function parseCallbackValues(url: string | null) {
  if (!url) {
    return { code: null, state: null, error: null, sessionToken: null };
  }

  try {
    const urlObj =
      url.startsWith("http://") || url.startsWith("https://")
        ? new URL(url)
        : new URL(url, "http://callback.local");

    return {
      code: urlObj.searchParams.get("code"),
      state: urlObj.searchParams.get("state"),
      error: urlObj.searchParams.get("error"),
      sessionToken: urlObj.searchParams.get("sessionToken"),
    };
  } catch {
    return { code: null, state: null, error: null, sessionToken: null };
  }
}

export default function OAuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    state?: string;
    error?: string;
    sessionToken?: string;
    user?: string;
  }>();
  const [status, setStatus] = useState<CallbackStatus>("processing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const finishSuccess = () => {
      if (!active) return;
      setStatus("success");
      setTimeout(() => {
        router.replace("/(tabs)");
      }, 900);
    };

    const finishError = (message: string) => {
      if (!active) return;
      setStatus("error");
      setErrorMessage(message);
    };

    const persistUserIfPresent = async (rawUser?: string | null) => {
      if (!rawUser) return;
      const userData = decodeUserParam(rawUser);
      if (!userData) return;

      await Auth.setUserInfo({
        id: userData.id ?? null,
        openId: userData.openId ?? "",
        name: userData.name ?? "",
        email: userData.email ?? "",
        loginMethod: userData.loginMethod ?? "oauth",
        lastSignedIn: new Date(userData.lastSignedIn || Date.now()),
      });
    };

    const handleCallback = async () => {
      try {
        if (params.sessionToken) {
          await Auth.setSessionToken(params.sessionToken);
          await persistUserIfPresent(params.user);
          finishSuccess();
          return;
        }

        let url = buildSearchString({
          code: params.code,
          state: params.state,
          error: params.error,
          sessionToken: params.sessionToken,
        });

        if (!url) {
          url = await Linking.getInitialURL();
        }

        const parsed = parseCallbackValues(url);
        const error = params.error || parsed.error;
        if (error) {
          finishError(error);
          return;
        }

        const directToken = parsed.sessionToken;
        if (directToken) {
          await Auth.setSessionToken(directToken);
          finishSuccess();
          return;
        }

        const code = params.code || parsed.code;
        const state = params.state || parsed.state;

        if (!code || !state) {
          finishError("缺少登录回调参数，请重新发起登录。");
          return;
        }

        const result = await Api.exchangeOAuthCode(code, state);
        if (!result.sessionToken) {
          finishError("登录回调未返回有效会话，请稍后重试。");
          return;
        }

        await Auth.setSessionToken(result.sessionToken);

        if (result.user) {
          await Auth.setUserInfo({
            id: result.user.id,
            openId: result.user.openId,
            name: result.user.name,
            email: result.user.email,
            loginMethod: result.user.loginMethod,
            lastSignedIn: new Date(result.user.lastSignedIn || Date.now()),
          });
        }

        finishSuccess();
      } catch (error) {
        finishError(
          error instanceof Error ? error.message : "登录处理失败，请稍后重试。",
        );
      }
    };

    void handleCallback();

    return () => {
      active = false;
    };
  }, [
    params.code,
    params.error,
    params.sessionToken,
    params.state,
    params.user,
    router,
  ]);

  return (
    <SafeAreaView className="flex-1" edges={["top", "bottom", "left", "right"]}>
      <ThemedView className="flex-1 items-center justify-center gap-4 p-5">
        {status === "processing" && (
          <>
            <ActivityIndicator size="large" />
            <Text className="mt-4 text-base leading-6 text-center text-foreground">
              正在完成登录校验...
            </Text>
          </>
        )}
        {status === "success" && (
          <>
            <Text className="text-base leading-6 text-center text-foreground">
              登录成功
            </Text>
            <Text className="text-base leading-6 text-center text-foreground">
              正在返回主界面...
            </Text>
          </>
        )}
        {status === "error" && (
          <>
            <Text className="mb-2 text-xl font-bold leading-7 text-error">
              登录处理失败
            </Text>
            <Text className="text-base leading-6 text-center text-foreground">
              {errorMessage}
            </Text>
          </>
        )}
      </ThemedView>
    </SafeAreaView>
  );
}
