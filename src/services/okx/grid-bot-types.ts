export type OkxGridAlgoOrdType = "grid" | "contract_grid";
export type OkxGridDirection = "long" | "short" | "neutral";
export type OkxGridRunType = "1" | "2";
export type OkxGridStopType = "1" | "2";
export type OkxGridTriggerStrategy = "instant" | "price" | "rsi";
export type OkxGridTriggerAction = "start" | "stop";

export type OkxGridAiParamRaw = {
  algoOrdType: OkxGridAlgoOrdType;
  annualizedRate: string;
  ccy?: string;
  direction?: string;
  duration?: string;
  gridNum: string;
  instId: string;
  lever?: string;
  maxPx: string;
  minInvestment?: string;
  minPx: string;
  perGridProfitRatio?: string;
  perMaxProfitRate?: string;
  perMinProfitRate?: string;
  runType: OkxGridRunType;
  sourceCcy?: string;
};

export type OkxGridQuantityRaw = {
  maxGridQty?: string;
  maxGridNum?: string;
  minGridNum?: string;
};

export type OkxGridMinInvestmentRaw = {
  minInvestmentData?: Array<{
    amt?: string;
    ccy?: string;
  }>;
  singleAmt?: string;
};

export type OkxGridAlgoSummaryRaw = {
  algoId: string;
  algoClOrdId?: string;
  algoOrdType: OkxGridAlgoOrdType;
  instId: string;
  instType?: string;
  state?: string;
  direction?: string;
  maxPx?: string;
  minPx?: string;
  gridNum?: string;
  lever?: string;
  actualLever?: string;
  totalPnl?: string;
  pnlRatio?: string;
  gridProfit?: string;
  floatProfit?: string;
  fee?: string;
  fundingFee?: string;
  liqPx?: string;
  availEq?: string;
  cTime?: string;
  uTime?: string;
  triggerParams?: string;
};

export type OkxGridPositionRaw = {
  algoId?: string;
  instId: string;
  avgPx?: string;
  liqPx?: string;
  markPx?: string;
  mgnRatio?: string;
  notionalUsd?: string;
  upl?: string;
  uplRatio?: string;
  pos?: string;
  posSide?: string;
  lever?: string;
};

export type OkxGridSubOrderRaw = {
  algoId?: string;
  ordId?: string;
  side?: string;
  state?: string;
  px?: string;
  sz?: string;
  avgPx?: string;
  accFillSz?: string;
  cTime?: string;
  uTime?: string;
};

export type OkxGridTriggerParam = {
  triggerAction: OkxGridTriggerAction;
  triggerStrategy: OkxGridTriggerStrategy;
  stopTriggerCondition?: string;
  stopTriggerPx?: string;
  triggerCond?: string;
  triggerPx?: string;
  timeframe?: string;
  timePeriod?: string;
  thold?: string;
};

export type OkxGridAiParam = {
  instId: string;
  algoOrdType: OkxGridAlgoOrdType;
  direction?: OkxGridDirection;
  duration?: string;
  gridNum: number;
  maxPx: number;
  minPx: number;
  lever: number;
  runType: OkxGridRunType;
  annualizedRate?: number;
  minInvestment?: number;
  perGridProfitRatio?: number;
  perMaxProfitRate?: number;
  perMinProfitRate?: number;
  ccy?: string;
  sourceCcy?: string;
};

export type OkxGridQuantity = {
  gridNum: number;
  maxGridNum?: number;
  minGridNum?: number;
};

export type OkxGridMinInvestment = {
  minInvestment: number;
  ccy?: string;
};

export type OkxGridCreateRequest = {
  instId: string;
  algoOrdType: OkxGridAlgoOrdType;
  direction?: OkxGridDirection;
  maxPx: string;
  minPx: string;
  gridNum: string;
  runType?: OkxGridRunType;
  lever?: string;
  sz?: string;
  quoteSz?: string;
  baseSz?: string;
  basePos?: boolean;
  tpTriggerPx?: string;
  slTriggerPx?: string;
  tpRatio?: string;
  slRatio?: string;
  algoClOrdId?: string;
  triggerParams?: OkxGridTriggerParam[];
};

export type OkxGridInstantTriggerRequest = {
  algoId: string;
  instId: string;
  algoOrdType: OkxGridAlgoOrdType;
};

export type OkxGridAmendBasicRequest = {
  algoId: string;
  instId: string;
  algoOrdType: OkxGridAlgoOrdType;
  maxPx?: string;
  minPx?: string;
  gridNum?: string;
  topupAmount?: string;
};

export type OkxGridAmendOrderRequest = {
  algoId: string;
  instId: string;
  algoOrdType: OkxGridAlgoOrdType;
  tpTriggerPx?: string;
  slTriggerPx?: string;
  tpRatio?: string;
  slRatio?: string;
  triggerParams?: OkxGridTriggerParam[];
};

export type OkxGridStopRequestItem = {
  algoId: string;
  instId: string;
  algoOrdType: OkxGridAlgoOrdType;
  stopType: OkxGridStopType;
};

export type OkxGridPendingQuery = {
  algoOrdType: OkxGridAlgoOrdType;
  instId?: string;
  after?: string;
  before?: string;
  limit?: string;
};

export type OkxGridHistoryQuery = OkxGridPendingQuery & {
  state?: string;
};

export type OkxGridDetailsQuery = {
  algoOrdType: OkxGridAlgoOrdType;
  algoId: string;
  instId: string;
};

export type OkxGridSubOrdersQuery = {
  algoOrdType: OkxGridAlgoOrdType;
  algoId: string;
  type?: "filled" | "live";
  groupId?: string;
  after?: string;
  before?: string;
  limit?: string;
};

export type OkxGridPositionsQuery = {
  algoOrdType: OkxGridAlgoOrdType;
  algoId: string;
  instId?: string;
};

export type OkxGridAlgoSummary = {
  algoId: string;
  instId: string;
  algoOrdType: OkxGridAlgoOrdType;
  state?: string;
  direction?: string;
  maxPx?: number;
  minPx?: number;
  gridNum?: number;
  lever?: number;
  actualLever?: number;
  totalPnl?: number;
  pnlRatio?: number;
  gridProfit?: number;
  floatProfit?: number;
  fee?: number;
  fundingFee?: number;
  liqPx?: number;
  availEq?: number;
  createdAt?: number;
  updatedAt?: number;
  triggerParams?: string;
};

export type OkxGridPosition = {
  instId: string;
  avgPx?: number;
  liqPx?: number;
  markPx?: number;
  mgnRatio?: number;
  notionalUsd?: number;
  upl?: number;
  uplRatio?: number;
  pos?: number;
  posSide?: string;
  lever?: number;
};

export type OkxGridSubOrder = {
  ordId?: string;
  side?: string;
  state?: string;
  px?: number;
  sz?: number;
  avgPx?: number;
  accFillSz?: number;
  createdAt?: number;
  updatedAt?: number;
};
