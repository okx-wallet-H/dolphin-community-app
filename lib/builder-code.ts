import { Attribution } from "ox/erc8021";

import type { DexChainKind } from "@/lib/_core/api";

export const X_LAYER_CHAIN_INDEX = "196";
export const X_LAYER_CHAIN_KIND = "evm" as const satisfies DexChainKind;
export const X_LAYER_BUILDER_CODE = (
  process.env.EXPO_PUBLIC_XLAYER_BUILDER_CODE ??
  process.env.EXPO_PUBLIC_OKX_XLAYER_BUILDER_CODE ??
  process.env.EXPO_PUBLIC_OKX_CO ??
  process.env.EXPO_PUBLIC_CO ??
  process.env.EXPO_PUBLIC_BUILDER_CODE ??
  ""
).trim();

export type BuilderCodeInjectionMode = "data_suffix";
export type BuilderCodeTargetCapability = "wallet_sendCalls";

export type XLayerBuilderCodePayload = {
  chainIndex: typeof X_LAYER_CHAIN_INDEX;
  chainKind: typeof X_LAYER_CHAIN_KIND;
  builderCode: string;
  injectionMode: BuilderCodeInjectionMode;
  targetCapability: BuilderCodeTargetCapability;
  dataSuffix: `0x${string}`;
  callDataMemo: `0x${string}`;
};

const OKX_SWAP_CALL_DATA_MEMO_HEX_LENGTH = 128;

export function hasXLayerBuilderCode() {
  return Boolean(X_LAYER_BUILDER_CODE);
}

export function shouldUseXLayerBuilderCode(input: { chainIndex?: string; chainKind?: DexChainKind }) {
  return input.chainIndex === X_LAYER_CHAIN_INDEX && input.chainKind === X_LAYER_CHAIN_KIND && hasXLayerBuilderCode();
}

export function getXLayerBuilderCode() {
  return X_LAYER_BUILDER_CODE || undefined;
}

export function getXLayerBuilderCodeDataSuffix(builderCode = X_LAYER_BUILDER_CODE) {
  const normalizedBuilderCode = builderCode.trim();
  if (!normalizedBuilderCode) return undefined;
  return Attribution.toDataSuffix({ codes: [normalizedBuilderCode] });
}

export function toFixedLengthCallDataMemo(dataSuffix: `0x${string}`) {
  const normalized = dataSuffix.slice(2);
  if (normalized.length > OKX_SWAP_CALL_DATA_MEMO_HEX_LENGTH) {
    throw new Error(
      `Builder Code dataSuffix 长度超出 OKX swap callDataMemo 上限：${normalized.length} > ${OKX_SWAP_CALL_DATA_MEMO_HEX_LENGTH}`,
    );
  }

  return `0x${normalized.padStart(OKX_SWAP_CALL_DATA_MEMO_HEX_LENGTH, "0")}` as `0x${string}`;
}

export function getXLayerBuilderCodeCallDataMemo(builderCode = X_LAYER_BUILDER_CODE) {
  const dataSuffix = getXLayerBuilderCodeDataSuffix(builderCode);
  if (!dataSuffix) return undefined;
  return toFixedLengthCallDataMemo(dataSuffix);
}

export function buildXLayerBuilderCodePayload(input: { chainIndex?: string; chainKind?: DexChainKind }) {
  if (!shouldUseXLayerBuilderCode(input)) {
    return null;
  }

  const dataSuffix = getXLayerBuilderCodeDataSuffix(X_LAYER_BUILDER_CODE);
  const callDataMemo = dataSuffix ? toFixedLengthCallDataMemo(dataSuffix) : undefined;
  if (!dataSuffix || !callDataMemo) {
    return null;
  }

  return {
    chainIndex: X_LAYER_CHAIN_INDEX,
    chainKind: X_LAYER_CHAIN_KIND,
    builderCode: X_LAYER_BUILDER_CODE,
    injectionMode: "data_suffix" as const,
    targetCapability: "wallet_sendCalls" as const,
    dataSuffix,
    callDataMemo,
  } satisfies XLayerBuilderCodePayload;
}
