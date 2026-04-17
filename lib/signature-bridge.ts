import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { Platform } from "react-native";

import type { DexChainKind } from "@/lib/_core/api";

export const PENDING_SIGNATURE_CONTEXT_KEY = "hwallet-pending-signature-context";

export type SignatureFlowKind = "swap" | "transfer";
export type SignatureCallbackStatus = "signed" | "cancelled" | "error";

export type SignatureProgressStep = {
  key: string;
  label: string;
  status: "done" | "pending";
};

export type PendingSignatureContext = {
  id: string;
  flow: SignatureFlowKind;
  chainKind: DexChainKind;
  createdAt: string;
  source: "chat";
  draftPrompt?: string;
  orderId?: string;
  txHash?: string;
  progress?: SignatureProgressStep[];
  swap?: {
    chainIndex: string;
    amount: string;
    fromTokenAddress: string;
    toTokenAddress: string;
    userWalletAddress: string;
    fromTokenSymbol?: string;
    toTokenSymbol?: string;
    slippagePercent?: string;
    broadcastAddress?: string;
    routeLabel?: string;
    displayAmount?: string;
    builderCode?: string;
    builderCodeInjectionMode?: "data_suffix";
    builderCodeTargetCapability?: "wallet_sendCalls";
    swapTransaction?: Record<string, unknown> | null;
  };
  transfer?: {
    amount: string;
    symbol: string;
    fromAddress: string;
    toAddress: string;
  };
};

export type SignatureCallbackPayload = {
  ctx?: string | null;
  status?: SignatureCallbackStatus | null;
  signedTx?: string | null;
  jitoSignedTx?: string | null;
  txHash?: string | null;
  error?: string | null;
};

export async function savePendingSignatureContext(context: PendingSignatureContext): Promise<void> {
  await AsyncStorage.setItem(PENDING_SIGNATURE_CONTEXT_KEY, JSON.stringify(context));
}

export async function getPendingSignatureContext(): Promise<PendingSignatureContext | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_SIGNATURE_CONTEXT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingSignatureContext;
  } catch {
    return null;
  }
}

export async function clearPendingSignatureContext(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_SIGNATURE_CONTEXT_KEY);
  } catch {
    // 忽略本地清理失败，避免阻断主线程继续恢复。
  }
}

export function getSignatureCallbackPath() {
  return "/sign/callback";
}

export function getSignatureCallbackUrl() {
  return Linking.createURL(getSignatureCallbackPath());
}

export function buildSignatureCallbackUrl(payload: SignatureCallbackPayload) {
  const params = new URLSearchParams();

  if (payload.ctx) params.set("ctx", payload.ctx);
  if (payload.status) params.set("status", payload.status);
  if (payload.signedTx) params.set("signedTx", payload.signedTx);
  if (payload.jitoSignedTx) params.set("jitoSignedTx", payload.jitoSignedTx);
  if (payload.txHash) params.set("txHash", payload.txHash);
  if (payload.error) params.set("error", payload.error);

  const query = params.toString();
  return `${getSignatureCallbackUrl()}${query ? `?${query}` : ""}`;
}

export function encodeSignatureContextId(value: string) {
  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(value);
  }

  const BufferImpl = (globalThis as Record<string, unknown>).Buffer as
    | { from(input: string, encoding?: string): { toString(encoding: string): string } }
    | undefined;

  if (BufferImpl) {
    return BufferImpl.from(value, "utf-8").toString("base64");
  }

  return value;
}

export function decodeSignatureContextId(value: string | null | undefined) {
  if (!value) return "";

  try {
    if (typeof globalThis.atob === "function") {
      return globalThis.atob(value);
    }

    const BufferImpl = (globalThis as Record<string, unknown>).Buffer as
      | { from(input: string, encoding?: string): { toString(encoding: string): string } }
      | undefined;

    if (BufferImpl) {
      return BufferImpl.from(value, "base64").toString("utf-8");
    }
  } catch {
    return value;
  }

  return value;
}

export function parseSignatureCallbackUrl(url: string | null) {
  if (!url) {
    return {
      ctx: null,
      status: null,
      signedTx: null,
      jitoSignedTx: null,
      txHash: null,
      error: null,
    } satisfies SignatureCallbackPayload;
  }

  try {
    const urlObj =
      url.startsWith("http://") || url.startsWith("https://")
        ? new URL(url)
        : new URL(url, "http://callback.local");

    return {
      ctx: urlObj.searchParams.get("ctx"),
      status: (urlObj.searchParams.get("status") as SignatureCallbackStatus | null) ?? null,
      signedTx: urlObj.searchParams.get("signedTx"),
      jitoSignedTx: urlObj.searchParams.get("jitoSignedTx"),
      txHash: urlObj.searchParams.get("txHash"),
      error: urlObj.searchParams.get("error"),
    } satisfies SignatureCallbackPayload;
  } catch {
    return {
      ctx: null,
      status: null,
      signedTx: null,
      jitoSignedTx: null,
      txHash: null,
      error: null,
    } satisfies SignatureCallbackPayload;
  }
}

export async function getInitialSignatureCallbackPayload() {
  if (Platform.OS === "web") {
    return parseSignatureCallbackUrl(typeof window !== "undefined" ? window.location.href : null);
  }

  const initialUrl = await Linking.getInitialURL();
  return parseSignatureCallbackUrl(initialUrl);
}
