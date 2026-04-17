import fs from "fs/promises";
import path from "path";

import type { OnchainExecutionPhase } from "./onchain-os";

export type OnchainTxType = "swap" | "transfer";

export type OnchainTxRecord = {
  txId: string;
  userId: string;
  type: OnchainTxType;
  phase: OnchainExecutionPhase;
  chainIndex: string;
  userWalletAddress: string;
  broadcastAddress?: string;
  fromToken?: string;
  toToken?: string;
  amount: string;
  slippagePercent?: string;
  orderId?: string;
  txHash?: string;
  idempotencyKey?: string;
  retryCount: number;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
};

export type OnchainTxLogLevel = "info" | "warn" | "error";
export type OnchainTxEventType =
  | "create"
  | "execute"
  | "receipt"
  | "retry"
  | "idempotency"
  | "failure";

export type OnchainTxLogRecord = {
  id: string;
  txId?: string;
  userId: string;
  eventType: OnchainTxEventType;
  level: OnchainTxLogLevel;
  message: string;
  context?: Record<string, unknown>;
  createdAt: number;
};

type OnchainTxStoreState = {
  transactions: OnchainTxRecord[];
  logs: OnchainTxLogRecord[];
};

const STORE_DIR = path.resolve(process.cwd(), "data");
const STORE_PATH = path.join(STORE_DIR, "onchain-tx-store.json");
const DEFAULT_STATE: OnchainTxStoreState = {
  transactions: [],
  logs: [],
};

async function ensureStoreDir() {
  await fs.mkdir(STORE_DIR, { recursive: true });
}

async function readState(): Promise<OnchainTxStoreState> {
  await ensureStoreDir();

  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as OnchainTxStoreState;
    return {
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
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

async function writeState(state: OnchainTxStoreState) {
  await ensureStoreDir();
  await fs.writeFile(STORE_PATH, JSON.stringify(state, null, 2), "utf8");
}

function buildId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function appendOnchainTxLog(input: Omit<OnchainTxLogRecord, "id" | "createdAt">) {
  const state = await readState();
  const record: OnchainTxLogRecord = {
    ...input,
    id: buildId("onchain-log"),
    createdAt: Date.now(),
  };

  state.logs.unshift(record);
  state.logs = state.logs.slice(0, 1000);
  await writeState(state);
  return record;
}

export async function upsertOnchainTx(record: OnchainTxRecord) {
  const state = await readState();
  const index = state.transactions.findIndex(
    (item) =>
      item.txId === record.txId ||
      Boolean(record.orderId && item.orderId === record.orderId) ||
      Boolean(record.idempotencyKey && item.idempotencyKey === record.idempotencyKey),
  );

  if (index >= 0) {
    state.transactions[index] = {
      ...state.transactions[index],
      ...record,
      updatedAt: Date.now(),
    };
  } else {
    state.transactions.unshift({
      ...record,
      updatedAt: record.updatedAt || Date.now(),
    });
  }

  await writeState(state);
  return index >= 0 ? state.transactions[index] : state.transactions[0];
}

export async function createOnchainTxRecord(input: Omit<OnchainTxRecord, "txId" | "createdAt" | "updatedAt">) {
  const now = Date.now();
  const record: OnchainTxRecord = {
    ...input,
    txId: buildId("onchain-tx"),
    createdAt: now,
    updatedAt: now,
  };

  await upsertOnchainTx(record);
  return record;
}

export async function listOnchainTxs(userId?: string) {
  const state = await readState();
  return state.transactions
    .filter((item) => !userId || item.userId === userId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function findOnchainTxById(txId: string) {
  const records = await listOnchainTxs();
  return records.find((item) => item.txId === txId);
}

export async function findOnchainTxByOrderId(orderId: string) {
  const records = await listOnchainTxs();
  return records.find((item) => item.orderId === orderId);
}

export async function findOnchainTxByIdempotencyKey(idempotencyKey: string) {
  const records = await listOnchainTxs();
  return records.find((item) => item.idempotencyKey === idempotencyKey);
}

export async function updateOnchainTx(
  txId: string,
  updater: (current: OnchainTxRecord) => OnchainTxRecord,
) {
  const state = await readState();
  const index = state.transactions.findIndex((item) => item.txId === txId);
  if (index < 0) {
    return undefined;
  }

  const nextRecord = {
    ...updater(state.transactions[index]),
    updatedAt: Date.now(),
  };
  state.transactions[index] = nextRecord;
  await writeState(state);
  return nextRecord;
}

export async function updateOnchainTxByOrderId(
  orderId: string,
  updater: (current: OnchainTxRecord) => OnchainTxRecord,
) {
  const state = await readState();
  const index = state.transactions.findIndex((item) => item.orderId === orderId);
  if (index < 0) {
    return undefined;
  }

  const nextRecord = {
    ...updater(state.transactions[index]),
    updatedAt: Date.now(),
  };
  state.transactions[index] = nextRecord;
  await writeState(state);
  return nextRecord;
}

export async function markOnchainTxPhase(
  txId: string,
  phase: OnchainExecutionPhase,
  extras?: Partial<Pick<OnchainTxRecord, "orderId" | "txHash" | "retryCount" | "lastError">>,
) {
  return updateOnchainTx(txId, (current) => ({
    ...current,
    phase,
    orderId: extras?.orderId ?? current.orderId,
    txHash: extras?.txHash ?? current.txHash,
    retryCount: extras?.retryCount ?? current.retryCount,
    lastError: extras?.lastError,
  }));
}

export async function getOnchainTxLogs(txId?: string) {
  const state = await readState();
  return state.logs.filter((item) => !txId || item.txId === txId);
}
