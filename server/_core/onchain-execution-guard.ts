const ALLOWED_CHAIN_INDICES = new Set(["1", "56", "196", "501"]);
const MAX_DISPLAY_AMOUNT_USD = 10000;
const MAX_SLIPPAGE_PERCENT = 5;

export type OnchainExecutionRiskInput = {
  chainIndex: string;
  displayAmount?: string;
  slippagePercent?: string;
};

function parseFiniteNumber(raw?: string) {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().replace(/,/g, "");
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function normalizeChainIndex(chainIndex: string) {
  const value = chainIndex.trim();
  if (value === "101") return "501";
  return value;
}

export function validateOnchainExecutionRisk(input: OnchainExecutionRiskInput) {
  const normalizedChainIndex = normalizeChainIndex(input.chainIndex);
  if (!ALLOWED_CHAIN_INDICES.has(normalizedChainIndex)) {
    return {
      code: "CHAIN_NOT_ALLOWED",
      message: "Only Ethereum, BSC, Solana and X Layer are allowed for live execution",
    };
  }

  const displayAmount = parseFiniteNumber(input.displayAmount);
  if (displayAmount === null || displayAmount <= 0) {
    return {
      code: "DISPLAY_AMOUNT_REQUIRED",
      message: "displayAmount is required for execution risk checks and must be a positive number",
    };
  }

  if (displayAmount > MAX_DISPLAY_AMOUNT_USD) {
    return {
      code: "AMOUNT_LIMIT_EXCEEDED",
      message: `Single execution exceeds the $${MAX_DISPLAY_AMOUNT_USD} limit`,
    };
  }

  const slippagePercent = parseFiniteNumber(input.slippagePercent);
  if (slippagePercent !== null && slippagePercent > MAX_SLIPPAGE_PERCENT) {
    return {
      code: "SLIPPAGE_TOO_HIGH",
      message: `slippagePercent cannot exceed ${MAX_SLIPPAGE_PERCENT}%`,
    };
  }

  return null;
}
