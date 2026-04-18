export type AgentChainKind = "evm" | "solana";

export type AgentIntentKind =
  | "swap"
  | "transfer"
  | "price_query"
  | "portfolio_query"
  | "earn_query"
  | "unknown";

export type AgentExecutionMode = "confirm_required" | "direct_query" | "none";

export type AgentIntentSource = "keyword_rule" | "template_rule" | "unknown";

export type AgentSwapIntent = {
  kind: "swap";
  executionMode: "confirm_required";
  source: AgentIntentSource;
  originalText: string;
  payload: {
    amount: string;
    fromSymbol: string;
    toSymbol: string;
    chainKind: AgentChainKind | null;
    verb: "swap" | "buy";
  };
};

export type AgentTransferIntent = {
  kind: "transfer";
  executionMode: "confirm_required";
  source: AgentIntentSource;
  originalText: string;
  payload: {
    amount: string;
    symbol: string;
    address: string;
    chainKind: AgentChainKind;
  };
};

export type AgentPriceQueryIntent = {
  kind: "price_query";
  executionMode: "direct_query";
  source: AgentIntentSource;
  originalText: string;
  payload: {
    symbol: string;
  };
};

export type AgentPortfolioQueryIntent = {
  kind: "portfolio_query";
  executionMode: "direct_query";
  source: AgentIntentSource;
  originalText: string;
};

export type AgentEarnQueryIntent = {
  kind: "earn_query";
  executionMode: "direct_query";
  source: AgentIntentSource;
  originalText: string;
  payload?: {
    symbol?: string;
  };
};

export type AgentUnknownIntent = {
  kind: "unknown";
  executionMode: "none";
  source: "unknown";
  originalText: string;
};

export type AgentIntent =
  | AgentSwapIntent
  | AgentTransferIntent
  | AgentPriceQueryIntent
  | AgentPortfolioQueryIntent
  | AgentEarnQueryIntent
  | AgentUnknownIntent;

export type AgentConfirmCardKind = "swap_confirm" | "transfer_confirm";

export type AgentSwapConfirmCard = {
  kind: "swap_confirm";
  title: string;
  description: string;
  confirmText: string;
  cancelText: string;
  intent: AgentSwapIntent;
  summary: {
    amount: string;
    fromSymbol: string;
    toSymbol: string;
    chainKind: AgentChainKind | null;
  };
};

export type AgentTransferConfirmCard = {
  kind: "transfer_confirm";
  title: string;
  description: string;
  confirmText: string;
  cancelText: string;
  intent: AgentTransferIntent;
  summary: {
    amount: string;
    symbol: string;
    address: string;
    chainKind: AgentChainKind;
  };
};

export type AgentConfirmCard = AgentSwapConfirmCard | AgentTransferConfirmCard;

function normalizeText(input: string) {
  return input.trim().replace(/\s+/g, " ");
}

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

function inferChainKind(text: string): AgentChainKind | null {
  const normalized = text.toUpperCase();
  if (normalized.includes("SOL") || normalized.includes("SOLANA")) {
    return "solana";
  }
  if (normalized.includes("ETH") || normalized.includes("EVM") || normalized.includes("BSC") || normalized.includes("BASE")) {
    return "evm";
  }
  return null;
}

function parseSwapIntent(message: string): AgentSwapIntent | null {
  const normalized = normalizeText(message);
  const patterns: Array<{
    regex: RegExp;
    build: (match: RegExpMatchArray) => AgentSwapIntent["payload"];
    source: AgentIntentSource;
  }> = [
    {
      regex: /(?:把|将)?\s*([0-9]+(?:\.[0-9]+)?)\s*([A-Za-z]{2,12})\s*(?:换成|兑换成|兑换|换为|swap\s+to|to|for)\s*([A-Za-z]{2,12})/i,
      source: "template_rule",
      build: (match) => ({
        amount: match[1],
        fromSymbol: normalizeSymbol(match[2]),
        toSymbol: normalizeSymbol(match[3]),
        chainKind: inferChainKind(normalized),
        verb: "swap",
      }),
    },
    {
      regex: /用\s*([0-9]+(?:\.[0-9]+)?)\s*([A-Za-z]{2,12})\s*(?:买|换|兑换|swap)\s*([A-Za-z]{2,12})/i,
      source: "keyword_rule",
      build: (match) => ({
        amount: match[1],
        fromSymbol: normalizeSymbol(match[2]),
        toSymbol: normalizeSymbol(match[3]),
        chainKind: inferChainKind(normalized),
        verb: "buy",
      }),
    },
    {
      regex: /(?:swap)\s*([0-9]+(?:\.[0-9]+)?)\s*([A-Za-z]{2,12})\s*(?:to|for)\s*([A-Za-z]{2,12})/i,
      source: "keyword_rule",
      build: (match) => ({
        amount: match[1],
        fromSymbol: normalizeSymbol(match[2]),
        toSymbol: normalizeSymbol(match[3]),
        chainKind: inferChainKind(normalized),
        verb: "swap",
      }),
    },
  ];

  for (const pattern of patterns) {
    const matched = normalized.match(pattern.regex);
    if (!matched) continue;
    return {
      kind: "swap",
      executionMode: "confirm_required",
      source: pattern.source,
      originalText: message,
      payload: pattern.build(matched),
    };
  }

  return null;
}

function parseTransferIntent(message: string): AgentTransferIntent | null {
  const normalized = normalizeText(message);
  const matched = normalized.match(
    /(?:转账|转|发送|打给|send)\s*([0-9]+(?:\.[0-9]+)?)\s*([A-Za-z]{2,12})\s*(?:到|给|to)\s*([A-Za-z0-9]{24,})/i,
  );

  if (!matched) {
    return null;
  }

  const address = matched[3];
  return {
    kind: "transfer",
    executionMode: "confirm_required",
    source: "template_rule",
    originalText: message,
    payload: {
      amount: matched[1],
      symbol: normalizeSymbol(matched[2]),
      address,
      chainKind: address.startsWith("0x") ? "evm" : "solana",
    },
  };
}

function parsePriceQueryIntent(message: string): AgentPriceQueryIntent | null {
  const normalized = normalizeText(message);
  const matched = normalized.match(/(?:查|查看|看|问下|查询)?.*?([A-Za-z]{2,12})\s*(?:价格|行情|报价)/i)
    ?? normalized.match(/(?:价格|行情|报价).+?([A-Za-z]{2,12})/i)
    ?? normalized.match(/([A-Za-z]{2,12})\s*(?:多少钱|涨跌|现价)/i);

  if (!matched) {
    return null;
  }

  return {
    kind: "price_query",
    executionMode: "direct_query",
    source: "keyword_rule",
    originalText: message,
    payload: {
      symbol: normalizeSymbol(matched[1]),
    },
  };
}

function parsePortfolioQueryIntent(message: string): AgentPortfolioQueryIntent | null {
  const normalized = normalizeText(message);
  if (!/(我的资产|看看我的资产|钱包资产|我的钱包|我的余额|资产情况|持仓)/i.test(normalized)) {
    return null;
  }

  return {
    kind: "portfolio_query",
    executionMode: "direct_query",
    source: "keyword_rule",
    originalText: message,
  };
}

function parseEarnQueryIntent(message: string): AgentEarnQueryIntent | null {
  const normalized = normalizeText(message);
  if (!/(赚币|理财|收益|earn|defi)/i.test(normalized)) {
    return null;
  }

  const symbolMatch = normalized.match(/([A-Za-z]{2,12})\s*(?:赚币|理财|收益)/i);
  return {
    kind: "earn_query",
    executionMode: "direct_query",
    source: "keyword_rule",
    originalText: message,
    payload: symbolMatch
      ? {
          symbol: normalizeSymbol(symbolMatch[1]),
        }
      : undefined,
  };
}

export function detectAgentIntent(message: string): AgentIntent {
  const normalized = normalizeText(message);
  if (!normalized) {
    return {
      kind: "unknown",
      executionMode: "none",
      source: "unknown",
      originalText: message,
    };
  }

  return (
    parseSwapIntent(normalized) ??
    parseTransferIntent(normalized) ??
    parsePriceQueryIntent(normalized) ??
    parsePortfolioQueryIntent(normalized) ??
    parseEarnQueryIntent(normalized) ?? {
      kind: "unknown",
      executionMode: "none",
      source: "unknown",
      originalText: message,
    }
  );
}

export function buildConfirmCard(intent: AgentIntent): AgentConfirmCard | null {
  if (intent.kind === "swap") {
    return {
      kind: "swap_confirm",
      title: "交易确认",
      description: `准备将 ${intent.payload.amount} ${intent.payload.fromSymbol} 兑换为 ${intent.payload.toSymbol}。确认后才会调用 OKX Skill 执行。`,
      confirmText: "确认交易",
      cancelText: "取消",
      intent,
      summary: {
        amount: intent.payload.amount,
        fromSymbol: intent.payload.fromSymbol,
        toSymbol: intent.payload.toSymbol,
        chainKind: intent.payload.chainKind,
      },
    };
  }

  if (intent.kind === "transfer") {
    return {
      kind: "transfer_confirm",
      title: "转账确认",
      description: `准备向 ${intent.payload.address} 转出 ${intent.payload.amount} ${intent.payload.symbol}。确认后才会调用 OKX Skill 执行。`,
      confirmText: "确认转账",
      cancelText: "取消",
      intent,
      summary: {
        amount: intent.payload.amount,
        symbol: intent.payload.symbol,
        address: intent.payload.address,
        chainKind: intent.payload.chainKind,
      },
    };
  }

  return null;
}
