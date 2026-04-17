import crypto from "crypto";

import type { OnchainExecutionPhase } from "./onchain-os";

const IDEMPOTENCY_WINDOW_MS = 2 * 60 * 1000;

export type OnchainIdempotencyInput = {
  userId: string;
  chainIndex: string;
  amount: string;
  fromToken: string;
  toToken: string;
  now?: number;
};

export function buildOnchainIdempotencyKey(input: OnchainIdempotencyInput) {
  const now = input.now ?? Date.now();
  const windowBucket = Math.floor(now / IDEMPOTENCY_WINDOW_MS);
  const raw = [
    input.userId.trim(),
    input.chainIndex.trim(),
    input.amount.trim(),
    input.fromToken.trim().toLowerCase(),
    input.toToken.trim().toLowerCase(),
    String(windowBucket),
  ].join(":");

  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function shouldBlockDuplicateExecution(phase: OnchainExecutionPhase) {
  return phase !== "failed";
}

export function getOnchainIdempotencyWindowMs() {
  return IDEMPOTENCY_WINDOW_MS;
}
