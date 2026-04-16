import { ThemedView } from "@/components/themed-view";
import {
  clearPendingSignatureContext,
  decodeSignatureContextId,
  getInitialSignatureCallbackPayload,
  getPendingSignatureContext,
  parseSignatureCallbackUrl,
  type SignatureCallbackStatus,
} from "@/lib/signature-bridge";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type CallbackScreenStatus = "processing" | "success" | "error";

type ParsedParams = {
  ctx: string | null;
  status: SignatureCallbackStatus | null;
  signedTx: string | null;
  jitoSignedTx: string | null;
  txHash: string | null;
  error: string | null;
};

function buildChatDraft(input: {
  flow: "swap" | "transfer";
  status: SignatureCallbackStatus | null;
  hasSignedTx: boolean;
  txHash?: string | null;
  error?: string | null;
}) {
  if (input.status === "cancelled") {
    return input.flow === "swap"
      ? "我刚刚取消了兑换签名，请帮我重新检查风险、报价和执行条件。"
      : "我刚刚取消了转账签名，请帮我重新检查地址、金额和执行条件。";
  }

  if (input.status === "error" || input.error) {
    return input.flow === "swap"
      ? `兑换签名回传失败：${input.error || "未知错误"}。请帮我判断下一步该怎么处理。`
      : `转账签名回传失败：${input.error || "未知错误"}。请帮我判断下一步该怎么处理。`;
  }

  if (input.hasSignedTx) {
    return input.flow === "swap"
      ? `我已经完成兑换签名，请继续处理广播与回执。${input.txHash ? ` 当前回执：${input.txHash}` : ""}`
      : `我已经完成转账签名，请继续处理广播与回执。${input.txHash ? ` 当前回执：${input.txHash}` : ""}`;
  }

  return input.flow === "swap"
    ? "兑换签名流程已经返回应用，请继续检查执行状态。"
    : "转账签名流程已经返回应用，请继续检查执行状态。";
}

function parseParamsFromUrl(url: string | null): ParsedParams {
  const payload = parseSignatureCallbackUrl(url);
  return {
    ctx: payload.ctx ?? null,
    status: payload.status ?? null,
    signedTx: payload.signedTx ?? null,
    jitoSignedTx: payload.jitoSignedTx ?? null,
    txHash: payload.txHash ?? null,
    error: payload.error ?? null,
  };
}

export default function SignCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    ctx?: string;
    status?: SignatureCallbackStatus;
    signedTx?: string;
    jitoSignedTx?: string;
    txHash?: string;
    error?: string;
  }>();
  const [status, setStatus] = useState<CallbackScreenStatus>("processing");
  const [message, setMessage] = useState("正在接收签名结果...");

  useEffect(() => {
    let active = true;

    const finishError = (text: string) => {
      if (!active) return;
      setStatus("error");
      setMessage(text);
    };

    const finishSuccess = (
      text: string,
      draft: string,
      draftKey: string,
      signatureParams: {
        sigContextId: string;
        sigFlow: "swap" | "transfer";
        sigStatus: string;
        sigSignedTx?: string | null;
        sigJitoSignedTx?: string | null;
        sigTxHash?: string | null;
        sigError?: string | null;
      },
    ) => {
      if (!active) return;
      setStatus("success");
      setMessage(text);
      setTimeout(() => {
        router.replace({
          pathname: "/(tabs)/chat",
          params: {
            draft,
            draftKey,
            source: "signature-callback",
            sigContextId: signatureParams.sigContextId,
            sigFlow: signatureParams.sigFlow,
            sigStatus: signatureParams.sigStatus,
            sigSignedTx: signatureParams.sigSignedTx ?? undefined,
            sigJitoSignedTx: signatureParams.sigJitoSignedTx ?? undefined,
            sigTxHash: signatureParams.sigTxHash ?? undefined,
            sigError: signatureParams.sigError ?? undefined,
          },
        });
      }, 900);
    };

    const resolvePayload = async (): Promise<ParsedParams> => {
      const direct = {
        ctx: typeof params.ctx === "string" ? params.ctx : null,
        status: typeof params.status === "string" ? (params.status as SignatureCallbackStatus) : null,
        signedTx: typeof params.signedTx === "string" ? params.signedTx : null,
        jitoSignedTx: typeof params.jitoSignedTx === "string" ? params.jitoSignedTx : null,
        txHash: typeof params.txHash === "string" ? params.txHash : null,
        error: typeof params.error === "string" ? params.error : null,
      } satisfies ParsedParams;

      if (direct.ctx || direct.status || direct.signedTx || direct.jitoSignedTx || direct.error) {
        return direct;
      }

      const initial = await getInitialSignatureCallbackPayload();
      if (initial.ctx || initial.status || initial.signedTx || initial.jitoSignedTx || initial.error) {
        return {
          ctx: initial.ctx ?? null,
          status: initial.status ?? null,
          signedTx: initial.signedTx ?? null,
          jitoSignedTx: initial.jitoSignedTx ?? null,
          txHash: initial.txHash ?? null,
          error: initial.error ?? null,
        } satisfies ParsedParams;
      }

      const currentUrl = await Linking.getInitialURL();
      return parseParamsFromUrl(currentUrl);
    };

    const handleCallback = async () => {
      try {
        const payload = await resolvePayload();
        const pending = await getPendingSignatureContext();

        if (!pending) {
          finishError("当前没有可恢复的待签名上下文，请返回对话页重新发起操作。");
          return;
        }

        const incomingContextId = decodeSignatureContextId(payload.ctx);
        if (incomingContextId && incomingContextId !== pending.id) {
          finishError("签名回调上下文与当前待执行任务不一致，请返回对话页重新确认。\n");
          return;
        }

        const draft = buildChatDraft({
          flow: pending.flow,
          status: payload.status,
          hasSignedTx: Boolean(payload.signedTx || payload.jitoSignedTx),
          txHash: payload.txHash,
          error: payload.error,
        });

        const draftKey = `signature:${pending.id}:${payload.status || "returned"}`;
        const shouldClearPendingContext =
          payload.status === "cancelled" || payload.status === "error" || Boolean(payload.error);
        if (shouldClearPendingContext) {
          await clearPendingSignatureContext();
        }

        finishSuccess(
          payload.status === "cancelled"
            ? "已返回应用，正在恢复对话上下文..."
            : payload.status === "error" || payload.error
              ? "签名回传已记录，正在带你回到对话主线程..."
              : "签名结果已接收，正在恢复对话主线程...",
          draft,
          draftKey,
          {
            sigContextId: pending.id,
            sigFlow: pending.flow,
            sigStatus: payload.status || "returned",
            sigSignedTx: payload.signedTx,
            sigJitoSignedTx: payload.jitoSignedTx,
            sigTxHash: payload.txHash,
            sigError: payload.error,
          },
        );
      } catch (error) {
        finishError(error instanceof Error ? error.message : "签名回调处理失败，请返回聊天页重试。");
      }
    };

    void handleCallback();

    return () => {
      active = false;
    };
  }, [params.ctx, params.error, params.jitoSignedTx, params.signedTx, params.status, params.txHash, router]);

  return (
    <SafeAreaView className="flex-1" edges={["top", "bottom", "left", "right"]}>
      <ThemedView className="flex-1 items-center justify-center gap-4 p-5">
        {status === "processing" && (
          <>
            <ActivityIndicator size="large" />
            <Text className="mt-4 text-base leading-6 text-center text-foreground">{message}</Text>
          </>
        )}

        {status === "success" && (
          <>
            <Text className="text-base leading-6 text-center text-foreground">{message}</Text>
            <Text className="text-base leading-6 text-center text-foreground">正在返回对话主线程...</Text>
          </>
        )}

        {status === "error" && (
          <>
            <Text className="mb-2 text-xl font-bold leading-7 text-error">签名回调处理失败</Text>
            <Text className="text-base leading-6 text-center text-foreground">{message}</Text>
          </>
        )}
      </ThemedView>
    </SafeAreaView>
  );
}
