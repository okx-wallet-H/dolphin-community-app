import type { DexChainKind } from "@/lib/_core/api";

export const X_LAYER_CHAIN_INDEX = "196";
export const X_LAYER_CHAIN_KIND: DexChainKind = "evm";
export const X_LAYER_BUILDER_CODE = (
  process.env.EXPO_PUBLIC_XLAYER_BUILDER_CODE ??
  process.env.EXPO_PUBLIC_OKX_XLAYER_BUILDER_CODE ??
  process.env.EXPO_PUBLIC_BUILDER_CODE ??
  ""
).trim();

export function hasXLayerBuilderCode() {
  return Boolean(X_LAYER_BUILDER_CODE);
}

export function shouldUseXLayerBuilderCode(input: { chainIndex?: string; chainKind?: DexChainKind }) {
  return input.chainIndex === X_LAYER_CHAIN_INDEX && input.chainKind === X_LAYER_CHAIN_KIND && hasXLayerBuilderCode();
}

export function getXLayerBuilderCode() {
  return X_LAYER_BUILDER_CODE || undefined;
}

export function buildXLayerBuilderCodePayload(input: { chainIndex?: string; chainKind?: DexChainKind }) {
  if (!shouldUseXLayerBuilderCode(input)) {
    return null;
  }

  return {
    chainIndex: X_LAYER_CHAIN_INDEX,
    chainKind: X_LAYER_CHAIN_KIND,
    builderCode: X_LAYER_BUILDER_CODE,
    injectionMode: "data_suffix" as const,
    targetCapability: "wallet_sendCalls" as const,
  };
}
