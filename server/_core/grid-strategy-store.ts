import { promises as fs } from "fs";
import path from "path";

export type GridStrategyLifecycleStatus =
  | "preview"
  | "running"
  | "paused"
  | "stopped"
  | "circuit_breaker"
  | "error";

export type GridStrategyLogLevel = "info" | "warn" | "error";
export type GridStrategyEventType =
  | "create"
  | "amend"
  | "stop"
  | "monitor"
  | "circuit_breaker"
  | "decision"
  | "error";

export type GridStrategyMetrics = {
  totalPnl?: number;
  pnlRatio?: number;
  runtimeMinutes?: number;
  positionCount?: number;
  totalPositionSize?: number;
  totalUnrealizedPnl?: number;
  averageMarginRatio?: number;
  maxDrawdownRatio?: number;
  peakPnlRatio?: number;
  updatedAt: number;
};

export type GridCircuitBreakerState = {
  enabled: boolean;
  thresholdRatio: number;
  triggeredAt?: number;
  reason?: string;
};

export type GridStrategyRecord = {
  strategyId: string;
  algoId?: string;
  algoClOrdId?: string;
  instId: string;
  direction: string;
  budget: number;
  expectedInvestment?: number;
  riskLevel: string;
  status: GridStrategyLifecycleStatus;
  executionMode: "preview" | "live";
  createdAt: number;
  updatedAt: number;
  lastDecision?: "hold" | "amend" | "pause";
  lastDecisionReason?: string;
  lastDecisionAt?: number;
  lastMessage?: string;
  metrics?: GridStrategyMetrics;
  circuitBreaker: GridCircuitBreakerState;
  baseline?: Record<string, unknown>;
  optimized?: Record<string, unknown>;
};

export type GridStrategyLogRecord = {
  id: string;
  strategyId?: string;
  algoId?: string;
  instId?: string;
  eventType: GridStrategyEventType;
  level: GridStrategyLogLevel;
  message: string;
  context?: Record<string, unknown>;
  createdAt: number;
};

type GridStrategyStoreState = {
  strategies: GridStrategyRecord[];
  logs: GridStrategyLogRecord[];
};

const STORE_DIR = path.resolve(process.cwd(), "data");
const STORE_PATH = path.join(STORE_DIR, "grid-strategy-store.json");
const DEFAULT_STATE: GridStrategyStoreState = {
  strategies: [],
  logs: [],
};

async function ensureStoreDir() {
  await fs.mkdir(STORE_DIR, { recursive: true });
}

async function readState(): Promise<GridStrategyStoreState> {
  await ensureStoreDir();

  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as GridStrategyStoreState;
    return {
      strategies: Array.isArray(parsed.strategies) ? parsed.strategies : [],
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      await writeState(DEFAULT_STATE);
      return DEFAULT_STATE;
    }
    throw error;
  }
}

async function writeState(state: GridStrategyStoreState) {
  await ensureStoreDir();
  await fs.writeFile(STORE_PATH, JSON.stringify(state, null, 2), "utf8");
}

function buildId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function appendGridStrategyLog(input: Omit<GridStrategyLogRecord, "id" | "createdAt">) {
  const state = await readState();
  const record: GridStrategyLogRecord = {
    ...input,
    id: buildId("grid-log"),
    createdAt: Date.now(),
  };

  state.logs.unshift(record);
  state.logs = state.logs.slice(0, 500);
  await writeState(state);
  return record;
}

export async function upsertGridStrategy(record: GridStrategyRecord) {
  const state = await readState();
  const index = state.strategies.findIndex(
    (item) => item.strategyId === record.strategyId || (record.algoId && item.algoId === record.algoId),
  );

  if (index >= 0) {
    state.strategies[index] = {
      ...state.strategies[index],
      ...record,
      updatedAt: Date.now(),
    };
  } else {
    state.strategies.unshift({
      ...record,
      updatedAt: record.updatedAt || Date.now(),
    });
  }

  await writeState(state);
  return index >= 0 ? state.strategies[index] : state.strategies[0];
}

export async function createGridStrategyRecord(input: Omit<GridStrategyRecord, "strategyId" | "createdAt" | "updatedAt">) {
  const now = Date.now();
  const record: GridStrategyRecord = {
    ...input,
    strategyId: buildId("grid-strategy"),
    createdAt: now,
    updatedAt: now,
  };

  await upsertGridStrategy(record);
  return record;
}

export async function listGridStrategies() {
  const state = await readState();
  return state.strategies.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function listActiveGridStrategies() {
  const strategies = await listGridStrategies();
  return strategies.filter((item) => ["running", "paused"].includes(item.status));
}

export async function findGridStrategyByAlgoId(algoId: string) {
  const strategies = await listGridStrategies();
  return strategies.find((item) => item.algoId === algoId);
}

export async function findLatestGridStrategy(instId?: string) {
  const strategies = await listGridStrategies();
  return strategies.find((item) => !instId || item.instId === instId);
}

export async function updateGridStrategy(
  strategyId: string,
  updater: (current: GridStrategyRecord) => GridStrategyRecord,
) {
  const state = await readState();
  const index = state.strategies.findIndex((item) => item.strategyId === strategyId);
  if (index < 0) {
    return undefined;
  }

  const nextRecord = {
    ...updater(state.strategies[index]),
    updatedAt: Date.now(),
  };
  state.strategies[index] = nextRecord;
  await writeState(state);
  return nextRecord;
}

export async function updateGridStrategyMetrics(strategyId: string, metrics: GridStrategyMetrics) {
  return updateGridStrategy(strategyId, (current) => ({
    ...current,
    metrics,
  }));
}

export async function markGridCircuitBreaker(strategyId: string, reason: string) {
  return updateGridStrategy(strategyId, (current) => ({
    ...current,
    status: "circuit_breaker",
    circuitBreaker: {
      ...current.circuitBreaker,
      enabled: true,
      triggeredAt: Date.now(),
      reason,
    },
    lastMessage: reason,
  }));
}

export async function markGridStrategyStopped(strategyId: string, message: string) {
  return updateGridStrategy(strategyId, (current) => ({
    ...current,
    status: "stopped",
    lastMessage: message,
  }));
}

export async function markGridStrategyDecision(
  strategyId: string,
  decision: "hold" | "amend" | "pause",
  reason: string,
) {
  return updateGridStrategy(strategyId, (current) => ({
    ...current,
    lastDecision: decision,
    lastDecisionReason: reason,
    lastDecisionAt: Date.now(),
  }));
}

export async function getGridStrategyLogs(strategyId?: string) {
  const state = await readState();
  return state.logs.filter((item) => !strategyId || item.strategyId === strategyId);
}
