import { ENV } from "./env";

export type GridMutationAction = "create" | "amend" | "stop";

const DEFAULT_ALLOWED_INSTRUMENTS = ["BTC-USDT-SWAP", "ETH-USDT-SWAP"];

function normalizeBudgetLimit(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 3000;
}

export function hasOkxPrivateCredentials() {
  return Boolean(ENV.okxApiKey && ENV.okxApiSecret && ENV.okxApiPassphrase);
}

export function canRunLiveGridTrading() {
  return hasOkxPrivateCredentials() && ENV.okxEnableLiveGridTrading;
}

export function canSendGridMutation(action: GridMutationAction) {
  if (action === "stop") {
    return hasOkxPrivateCredentials() && (ENV.okxEnableLiveGridTrading || ENV.okxAllowEmergencyStop);
  }

  return canRunLiveGridTrading();
}

export function getAllowedGridInstIds() {
  return ENV.okxGridAllowedInstIds.length > 0 ? ENV.okxGridAllowedInstIds : DEFAULT_ALLOWED_INSTRUMENTS;
}

export function getGridMaxBudgetUsdt() {
  return normalizeBudgetLimit(ENV.okxGridMaxBudgetUsdt);
}

export function buildGridControlSummary() {
  return {
    hasPrivateCredentials: hasOkxPrivateCredentials(),
    liveTradingEnabled: ENV.okxEnableLiveGridTrading,
    allowEmergencyStop: ENV.okxAllowEmergencyStop,
    allowedInstIds: getAllowedGridInstIds(),
    maxBudgetUsdt: getGridMaxBudgetUsdt(),
  };
}

export function assertGridCreateAllowed(params: { instId: string; budget: number }) {
  if (!hasOkxPrivateCredentials()) {
    throw new Error("当前未配置 OKX 实盘密钥，请先设置 OKX_API_KEY、OKX_API_SECRET、OKX_API_PASSPHRASE");
  }

  if (!ENV.okxEnableLiveGridTrading) {
    throw new Error("当前灰度开关未开启，系统仅返回参数建议，不允许真实创建或改参");
  }

  if (!getAllowedGridInstIds().includes(params.instId)) {
    throw new Error(`当前灰度环境仅允许交易 ${getAllowedGridInstIds().join("、")}`);
  }

  if (params.budget > getGridMaxBudgetUsdt()) {
    throw new Error(`当前灰度环境单策略预算上限为 ${getGridMaxBudgetUsdt()} USDT`);
  }
}

export function assertGridAmendAllowed(instId: string) {
  if (!hasOkxPrivateCredentials()) {
    throw new Error("当前未配置 OKX 实盘密钥，无法执行真实改参");
  }

  if (!ENV.okxEnableLiveGridTrading) {
    throw new Error("当前灰度开关未开启，系统不允许真实改参");
  }

  if (!getAllowedGridInstIds().includes(instId)) {
    throw new Error(`当前灰度环境仅允许操作 ${getAllowedGridInstIds().join("、")}`);
  }
}

export function assertGridStopAllowed() {
  if (!hasOkxPrivateCredentials()) {
    throw new Error("当前未配置 OKX 实盘密钥，无法执行真实停策略");
  }

  if (!canSendGridMutation("stop")) {
    throw new Error("当前未开放真实停策略权限");
  }
}
