import { createHmac } from 'crypto';
import { invokeLLM } from './llm';
import { callMcpTool } from './okx-mcp-service';

type ChatIntentAction = 'market' | 'asset' | 'swap' | 'earn' | 'profit' | 'deposit' | 'general';

type EarnPlanSuggestion = {
  amount: number;
  apr: number;
  riskLabel: string;
  description: string;
  status: 'ready' | 'activated';
  protocol: string;
  chain: string;
  symbol: string;
  tvlUsd: number;
  source: 'defillama';
};

type ProfitSnapshot = {
  periodLabel: string;
  totalProfit: number;
  todayProfit: number;
  totalInvested: number;
  points: number[];
  protocol: string;
  chain: string;
  symbol: string;
  apr: number;
  source: 'defillama';
};

type DepositInfo = {
  address: string;
  networkLabel: string;
  copied: boolean;
  chainKind: 'evm' | 'solana';
  source: 'agent_wallet';
};

type ChatAiIntent = {
  action: ChatIntentAction;
  confidence: number;
  reply: string;
  priceSymbol: string;
  priceText: string;
  assetSummary: string;
  swapMessage: string;
  source: 'llm' | 'fallback';
  mockMode: boolean;
};

type WalletSnapshot = {
  email?: string;
  evmAddress?: string;
  solanaAddress?: string;
};

type ActiveEarnPlan = EarnPlanSuggestion & {
  activatedAt: number;
  walletKey: string;
  poolId: string;
};

type DefiLlamaPool = {
  pool?: string;
  project?: string;
  chain?: string;
  symbol?: string;
  apy?: number;
  tvlUsd?: number;
  stablecoin?: boolean;
  exposure?: string;
  poolMeta?: string;
};

const earnPlanStore = new Map<string, ActiveEarnPlan>();

function getWalletKey(wallet?: WalletSnapshot | null) {
  return wallet?.email?.trim().toLowerCase() || wallet?.evmAddress || wallet?.solanaAddress || 'guest';
}

function extractEarnAmount(message: string) {
  const matched = message.match(/(\d+(?:\.\d+)?)/);
  const parsed = matched ? Number(matched[1]) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1000;
}

function isEarnIntent(message: string) {
  return /(赚钱|赚币|理财|稳健收益|收益方案|帮我.*赚|用\d+(?:\.\d+)?\s*(?:u|usdt)?赚钱)/i.test(message);
}

function isProfitIntent(message: string) {
  return /(收益怎么样|查看收益|我的收益|收益数据|查看我的收益|收益情况)/i.test(message);
}

function isDepositIntent(message: string) {
  return /(我要充值|充值|入金|转入|充币)/i.test(message);
}

function normalizeApr(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Number(value.toFixed(2)));
}

function formatUsdCompact(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0';
  return new Intl.NumberFormat('zh-CN', {
    notation: value >= 1000000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 1000000 ? 2 : 0,
  }).format(value);
}

async function fetchDefiLlamaPools() {
  const response = await fetch('https://api.llama.fi/pools');
  const payload = (await response.json()) as Record<string, unknown>;
  const data = Array.isArray(payload.data) ? (payload.data as DefiLlamaPool[]) : [];
  if (!response.ok || data.length === 0) {
    throw new Error(String(payload.message ?? payload.error ?? 'DefiLlama pools request failed'));
  }
  return data;
}

function pickEarnPool(pools: DefiLlamaPool[], preferredSymbol?: string) {
  const targetSymbol = normalizeText(preferredSymbol).toUpperCase();
  const preferred = pools.filter((pool) => {
    const apy = Number(pool.apy ?? NaN);
    const tvlUsd = Number(pool.tvlUsd ?? NaN);
    const symbol = normalizeText(pool.symbol).toUpperCase();
    const chain = normalizeText(pool.chain);
    return Number.isFinite(apy)
      && apy > 1
      && apy < 30
      && Number.isFinite(tvlUsd)
      && tvlUsd > 500000
      && /(Ethereum|Arbitrum|Base|Polygon|Optimism|Solana)/i.test(chain)
      && (!targetSymbol || symbol.includes(targetSymbol));
  });

  const ranked = (preferred.length ? preferred : pools)
    .filter((pool) => Number.isFinite(Number(pool.apy ?? NaN)) && Number.isFinite(Number(pool.tvlUsd ?? NaN)))
    .sort((a, b) => {
      const stableScoreA = a.stablecoin ? 1 : 0;
      const stableScoreB = b.stablecoin ? 1 : 0;
      if (stableScoreA !== stableScoreB) return stableScoreB - stableScoreA;
      return Number(b.tvlUsd ?? 0) - Number(a.tvlUsd ?? 0);
    });

  return ranked[0];
}

function buildEarnDescription(pool: DefiLlamaPool, apr: number) {
  const protocol = normalizeText(pool.project, 'Unknown protocol');
  const chain = normalizeText(pool.chain, 'Unknown chain');
  const symbol = normalizeText(pool.symbol, 'USDT');
  const tvlUsd = Number(pool.tvlUsd ?? 0);
  return `已接入 DefiLlama 实时收益池数据，当前优先推荐 ${protocol} · ${chain} 的 ${symbol} 池，最新 APY ${apr.toFixed(2)}%，TVL 约 ${formatUsdCompact(tvlUsd)} 美元。`;
}

async function buildEarnIntentResult(message: string, wallet?: WalletSnapshot | null): Promise<ChatAiResult> {
  const amount = extractEarnAmount(message);
  const targetSymbol = (message.toUpperCase().match(/BTC|ETH|SOL|USDT|USDC|DAI/) || ['USDT'])[0];

  try {
    // 优先使用 MCP 搜索真实收益池
    const mcpRes = await callMcpTool<any>('defi_search', {
      token: targetSymbol,
      chain: 'ethereum',
      product_group: 'SINGLE_EARN'
    });
    
    const mcpPool = mcpRes?.list?.[0];
    if (mcpPool) {
      const apr = Number(mcpPool.rate) * 100;
      const plan: EarnPlanSuggestion = {
        amount,
        apr,
        riskLabel: apr > 10 ? '增强型' : '稳健型',
        description: `已通过 OKX MCP 匹配到真实收益池：${mcpPool.platformName} · ${targetSymbol}，当前 APY ${apr.toFixed(2)}%，TVL 约 ${formatUsdCompact(Number(mcpPool.tvl))} 美元。`,
        status: 'activated',
        protocol: mcpPool.platformName,
        chain: 'Ethereum',
        symbol: targetSymbol,
        tvlUsd: Number(mcpPool.tvl),
        source: 'defillama', // 保持类型兼容
      };

      earnPlanStore.set(getWalletKey(wallet), {
        ...plan,
        activatedAt: Date.now(),
        walletKey: getWalletKey(wallet),
        poolId: String(mcpPool.investmentId),
      });

      return {
        success: true,
        mockMode: false,
        intent: {
          action: 'earn',
          confidence: 0.95,
          reply: `已为你匹配到 OKX 真实赚币方案：投入 ${amount} ${targetSymbol}，当前参考池为 ${plan.protocol} · ${plan.chain}，最新 APY ${apr.toFixed(2)}%。`,
          priceSymbol: '',
          priceText: '',
          assetSummary: '',
          swapMessage: '',
          source: 'fallback',
          mockMode: false,
        },
        earnPlan: plan,
      };
    }

    const pools = await fetchDefiLlamaPools();
    const pool = pickEarnPool(pools, targetSymbol) ?? pickEarnPool(pools);
    if (!pool) {
      throw new Error('No DefiLlama pool matched');
    }

    const apr = normalizeApr(Number(pool.apy ?? 0));
    const plan: EarnPlanSuggestion = {
      amount,
      apr,
      riskLabel: pool.stablecoin ? '稳健型' : '增强型',
      description: buildEarnDescription(pool, apr),
      status: 'activated',
      protocol: normalizeText(pool.project, 'Unknown protocol'),
      chain: normalizeText(pool.chain, 'Unknown chain'),
      symbol: normalizeText(pool.symbol, targetSymbol || 'USDT'),
      tvlUsd: Number(pool.tvlUsd ?? 0),
      source: 'defillama',
    };

    earnPlanStore.set(getWalletKey(wallet), {
      ...plan,
      activatedAt: Date.now(),
      walletKey: getWalletKey(wallet),
      poolId: normalizeText(pool.pool, `${plan.protocol}:${plan.chain}:${plan.symbol}`),
    });

    return {
      success: true,
      mockMode: false,
      intent: {
        action: 'earn',
        confidence: 0.92,
        reply: `已为你生成真实赚币方案：投入 ${amount} USDT，当前参考池为 ${plan.protocol} · ${plan.chain} ${plan.symbol}，最新 APY ${apr.toFixed(2)}%。`,
        priceSymbol: '',
        priceText: '',
        assetSummary: '',
        swapMessage: '',
        source: 'fallback',
        mockMode: false,
      },
      earnPlan: plan,
    };
  } catch (error) {
    console.error('[ChatAI] build earn intent failed', error);
    return {
      success: true,
      mockMode: false,
      intent: {
        action: 'earn',
        confidence: 0.68,
        reply: `暂时无法获取 ${targetSymbol} 的实时赚币池数据，我已记录你的需求，请稍后重试。`,
        priceSymbol: '',
        priceText: '',
        assetSummary: '',
        swapMessage: '',
        source: 'fallback',
        mockMode: false,
      },
    };
  }
}

function buildProfitPoints(totalInvested: number, apr: number) {
  const dailyBase = totalInvested * (apr / 100) / 365;
  return Array.from({ length: 7 }, (_, index) => Number((dailyBase * (0.92 + index * 0.03)).toFixed(2)));
}

async function buildProfitIntentResult(wallet?: WalletSnapshot | null): Promise<ChatAiResult> {
  const walletKey = getWalletKey(wallet);
  const activePlan = earnPlanStore.get(walletKey);
  if (activePlan) {
    const todayProfit = Number((activePlan.amount * (activePlan.apr / 100) / 365).toFixed(2));
    const totalProfit = Number((todayProfit * 7).toFixed(2));
    const profit: ProfitSnapshot = {
      periodLabel: '最近7天（按实时APY估算）',
      totalProfit,
      todayProfit,
      totalInvested: activePlan.amount,
      points: buildProfitPoints(activePlan.amount, activePlan.apr),
      protocol: activePlan.protocol,
      chain: activePlan.chain,
      symbol: activePlan.symbol,
      apr: activePlan.apr,
      source: 'defillama',
    };

    return {
      success: true,
      mockMode: false,
      intent: {
        action: 'profit',
        confidence: 0.9,
        reply: `你当前的赚币仓位参考 ${activePlan.protocol} · ${activePlan.chain} ${activePlan.symbol}，最新 APY ${activePlan.apr.toFixed(2)}%，今日预计收益 ${todayProfit.toFixed(2)} USDT。`,
        priceSymbol: '',
        priceText: '',
        assetSummary: '',
        swapMessage: '',
        source: 'fallback',
        mockMode: false,
      },
      profit,
    };
  }

  return {
    success: true,
    mockMode: false,
    intent: {
      action: 'profit',
      confidence: 0.82,
      reply: '当前还没有可计算收益的已激活赚币仓位。你可以先让我为你匹配一套真实赚币方案，再回来查看收益。',
      priceSymbol: '',
      priceText: '',
      assetSummary: '',
      swapMessage: '',
      source: 'fallback',
      mockMode: false,
    },
  };
}

function buildDepositIntentResult(wallet?: WalletSnapshot | null): ChatAiResult {
  const address = normalizeText(wallet?.evmAddress) || normalizeText(wallet?.solanaAddress);
  const chainKind = normalizeText(wallet?.evmAddress) ? 'evm' : 'solana';
  const deposit: DepositInfo = {
    address: address || '暂未检测到 Agent Wallet 地址',
    networkLabel: normalizeText(wallet?.evmAddress) ? '请优先充值 EVM 地址（支持 Polygon / Base / Arbitrum）' : '请充值到当前 Agent Wallet 地址',
    copied: false,
    chainKind,
    source: 'agent_wallet',
  };

  return {
    success: true,
    mockMode: !address,
    intent: {
      action: 'deposit',
      confidence: 0.95,
      reply: address ? '已为你返回当前 Agent Wallet 真实充值地址。' : '暂未检测到 Agent Wallet 地址，请先完成登录或创建钱包。',
      priceSymbol: '',
      priceText: '',
      assetSummary: '',
      swapMessage: '',
      source: 'fallback',
      mockMode: !address,
    },
    deposit,
  };
}

function summarizeUserMessage(message: string, limit = 20) {
  const normalized = normalizeText(message).replace(/\s+/g, ' ');
  if (!normalized) return '当前请求';
  return normalized.length > limit ? `${normalized.slice(0, limit)}…` : normalized;
}

function buildIntentReplyDraft(action: ChatIntentAction, message: string, wallet?: WalletSnapshot | null) {
  const summary = summarizeUserMessage(message);

  if (action === 'asset') {
    return '我会先查询你当前 Agent Wallet 的真实资产与持仓情况。';
  }

  if (action === 'swap') {
    return `已识别你的兑换请求（${summary}），我会继续准备兑换报价与路径。`;
  }

  if (action === 'earn') {
    return `已识别你的赚币需求（${summary}），我会结合实时收益池继续给出方案。`;
  }

  if (action === 'profit') {
    return `已开始整理与你当前仓位相关的收益数据（${summary}）。`;
  }

  if (action === 'deposit') {
    return '我会先查询你当前 Agent Wallet 可用的充值地址与网络。';
  }

  return `我是 H Wallet，你可以直接告诉我想查的行情、资产、赚币方案或兑换需求（当前请求：${summary}）。`;
}

function buildGeneralDepositFallback(): DepositInfo {
  return {
    address: '暂未检测到 Agent Wallet 地址',
    networkLabel: '请先完成登录或创建钱包',
    copied: false,
    chainKind: 'evm',
    source: 'agent_wallet',
  };
}

function buildChatResult(intent: ChatAiIntent, extras?: { earnPlan?: EarnPlanSuggestion; profit?: ProfitSnapshot; deposit?: DepositInfo }): ChatAiResult {
  return {
    success: true,
    mockMode: intent.mockMode,
    intent,
    ...extras,
  };
}

type ChatAiResult = {
  success: true;
  mockMode: boolean;
  intent: ChatAiIntent;
  earnPlan?: EarnPlanSuggestion;
  profit?: ProfitSnapshot;
  deposit?: DepositInfo;
};

type OkxCurrentPriceItem = {
  chainIndex?: string;
  tokenContractAddress?: string;
  tokenAddress?: string;
  price?: string;
  time?: string;
};

type MarketReply = {
  priceSymbol: string;
  priceText: string;
  reply: string;
  mockMode: boolean;
};

const OKX_BASE_URL = 'https://web3.okx.com';
const OKX_CURRENT_PRICE_PATH = '/api/v5/wallet/token/real-time-price';
const OKX_PUBLIC_TICKER_URL = 'https://www.okx.com/api/v5/market/ticker';

type PortfolioBalanceItem = {
  address?: string;
  balance?: string;
  chainIndex?: string;
  symbol?: string;
  tokenName?: string;
  tokenContractAddress?: string;
  tokenPrice?: string;
  tokenLogoUrl?: string;
  isRiskToken?: boolean;
};


const MARKET_SYMBOL_ALIAS: Record<string, string> = {
  BTC: 'BTC',
  比特币: 'BTC',
  比特幣: 'BTC',
  BITCOIN: 'BTC',
  ETH: 'ETH',
  以太坊: 'ETH',
  以太幣: 'ETH',
  ETHEREUM: 'ETH',
  SOL: 'SOL',
  SOLANA: 'SOL',
  索拉纳: 'SOL',
  索拉納: 'SOL',
  USDT: 'USDT',
  泰达币: 'USDT',
  泰達幣: 'USDT',
  OKB: 'OKB',
  欧易平台币: 'OKB',
  歐易平台幣: 'OKB',
  OKX平台币: 'OKB',
  OKX平台幣: 'OKB',
};

const MARKET_TOKEN_MAP: Record<string, { chainIndex: string; tokenContractAddress: string }> = {
  BTC: {
    chainIndex: '1',
    tokenContractAddress: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  },
  ETH: {
    chainIndex: '1',
    tokenContractAddress: '',
  },
  SOL: {
    chainIndex: '501',
    tokenContractAddress: '',
  },
  USDT: {
    chainIndex: '1',
    tokenContractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  },
  OKB: {
    chainIndex: '1',
    tokenContractAddress: '0x75231F58b43240C9718Dd58B4967c5114342a86c',
  },
};

const MARKET_OKX_INST_ID_MAP: Record<string, string> = {
  BTC: 'BTC-USDT',
  ETH: 'ETH-USDT',
  SOL: 'SOL-USDT',
  OKB: 'OKB-USDT',
};

// 安全的环境变量读取函数，防止敏感信息泄露
function getEnv(name: 'OPENAI_API_KEY' | 'OKX_ONCHAIN_API_KEY' | 'OKX_API_KEY' | 'OKX_ONCHAIN_SECRET_KEY' | 'OKX_SECRET_KEY' | 'OKX_ONCHAIN_PASSPHRASE' | 'OKX_PASSPHRASE') {
  const value = (() => {
    switch (name) {
      case 'OPENAI_API_KEY':
        return process.env.OPENAI_API_KEY?.trim() ?? '';
      case 'OKX_ONCHAIN_API_KEY':
        return process.env.OKX_ONCHAIN_API_KEY?.trim() ?? '';
      case 'OKX_API_KEY':
        return process.env.OKX_API_KEY?.trim() ?? '';
      case 'OKX_ONCHAIN_SECRET_KEY':
        return process.env.OKX_ONCHAIN_SECRET_KEY?.trim() ?? '';
      case 'OKX_SECRET_KEY':
        return process.env.OKX_SECRET_KEY?.trim() ?? '';
      case 'OKX_ONCHAIN_PASSPHRASE':
        return process.env.OKX_ONCHAIN_PASSPHRASE?.trim() ?? '';
      case 'OKX_PASSPHRASE':
        return process.env.OKX_PASSPHRASE?.trim() ?? '';
      default:
        return '';
    }
  })();
  
  // 在生产环境中，如果敏感环境变量缺失则记录警告（不暴露具体值）
  if (process.env.NODE_ENV === 'production' && !value && name.includes('SECRET')) {
    console.warn(`[Chat AI] 缺失必要的环境变量：${name}`);
  }
  
  return value;
}

function getOkxApiKey() {
  return getEnv('OKX_ONCHAIN_API_KEY') || getEnv('OKX_API_KEY');
}

function getOkxSecretKey() {
  return getEnv('OKX_ONCHAIN_SECRET_KEY') || getEnv('OKX_SECRET_KEY');
}

function getOkxPassphrase() {
  return getEnv('OKX_ONCHAIN_PASSPHRASE') || getEnv('OKX_PASSPHRASE');
}

function isRealOkxConfigured() {
  return Boolean(getOkxApiKey() && getOkxSecretKey() && getOkxPassphrase());
}

function buildSignedHeaders(method: 'POST', requestPath: string, body: string) {
  const timestamp = new Date().toISOString();
  const signaturePayload = `${timestamp}${method}${requestPath}${body}`;
  const signature = createHmac('sha256', getOkxSecretKey()).update(signaturePayload).digest('base64');

  return {
    'Content-Type': 'application/json',
    'OK-ACCESS-KEY': getOkxApiKey(),
    'OK-ACCESS-PASSPHRASE': getOkxPassphrase(),
    'OK-ACCESS-SIGN': signature,
    'OK-ACCESS-TIMESTAMP': timestamp,
  };
}

function clampConfidence(value: unknown, fallback = 0.6) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(1, parsed));
}

function normalizeAction(value: unknown): ChatIntentAction {
  return value === 'market' || value === 'asset' || value === 'swap' || value === 'earn' || value === 'profit' || value === 'deposit'
    ? value
    : 'general';
}

function normalizeText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeMarketSymbol(symbol: string, fallback = '') {
  return MARKET_SYMBOL_ALIAS[normalizeText(symbol).toUpperCase()] || fallback;
}

function findMarketSymbolFromMessage(message: string, fallback = '') {
  const normalized = normalizeText(message);
  if (!normalized) return fallback;

  const aliases = Object.keys(MARKET_SYMBOL_ALIAS).sort((a, b) => b.length - a.length);
  const matchedAlias = aliases.find((alias) => normalized.toUpperCase().includes(alias.toUpperCase()));
  return matchedAlias ? MARKET_SYMBOL_ALIAS[matchedAlias] : fallback;
}

function extractJsonContent(payload: Record<string, unknown>) {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const first = choices[0] as Record<string, unknown> | undefined;
  const message = first && typeof first === 'object' ? (first.message as Record<string, unknown> | undefined) : undefined;
  const content = message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const textPart = content.find((part) => part && typeof part === 'object' && (part as Record<string, unknown>).type === 'text') as Record<string, unknown> | undefined;
    if (textPart && typeof textPart.text === 'string') return textPart.text;
  }
  return '';
}

function formatPrice(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0.00';
  if (value >= 1000) {
    return new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  }
  if (value >= 1) {
    return new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value);
  }
  return new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 4, maximumFractionDigits: 6 }).format(value);
}

function formatMarketTime(timestamp: string) {
  const value = Number(timestamp);
  if (!Number.isFinite(value) || value <= 0) return '';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function formatUsd(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0';
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: value >= 100 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function buildWalletLabel(wallet?: WalletSnapshot | null) {
  if (!wallet?.evmAddress && !wallet?.solanaAddress) {
    return '当前未检测到完整钱包地址。';
  }

  const labels = [] as string[];
  if (wallet?.evmAddress) {
    labels.push(`EVM ${wallet.evmAddress.slice(0, 6)}...${wallet.evmAddress.slice(-4)}`);
  }
  if (wallet?.solanaAddress) {
    labels.push(`Solana ${wallet.solanaAddress.slice(0, 6)}...${wallet.solanaAddress.slice(-4)}`);
  }
  return `已关联钱包：${labels.join('；')}`;
}

async function buildAssetSummary(wallet?: WalletSnapshot | null) {
  if (!wallet?.evmAddress && !wallet?.solanaAddress) {
    return '暂未检测到 Agent Wallet 地址，请先完成登录后再查询资产。';
  }

  const requests = [
    wallet?.evmAddress
      ? callMcpTool<PortfolioBalanceItem[]>('portfolio_all_balances', {
          address: wallet.evmAddress,
          chains: '1,137,42161,8453,10',
          filter: '0',
        }).catch(() => [])
      : Promise.resolve([] as PortfolioBalanceItem[]),
    wallet?.solanaAddress
      ? callMcpTool<PortfolioBalanceItem[]>('portfolio_all_balances', {
          address: wallet.solanaAddress,
          chains: '501',
          filter: '0',
        }).catch(() => [])
      : Promise.resolve([] as PortfolioBalanceItem[]),
  ];

  const [evmAssets, solanaAssets] = await Promise.all(requests);
  const merged = [...evmAssets, ...solanaAssets]
    .map((item) => {
      const balance = Number(item.balance ?? 0);
      const price = Number(item.tokenPrice ?? 0);
      const valueUsd = Number.isFinite(balance * price) ? balance * price : 0;
      return {
        symbol: normalizeText(item.symbol, normalizeText(item.tokenName, 'Unknown')),
        balance,
        valueUsd,
      };
    })
    .filter((item) => item.symbol && (item.balance > 0 || item.valueUsd > 0))
    .sort((left, right) => right.valueUsd - left.valueUsd);

  const totalUsd = merged.reduce((sum, item) => sum + item.valueUsd, 0);
  const topHoldings = merged
    .slice(0, 3)
    .map((item) => `${item.symbol} ${item.balance >= 1 ? item.balance.toFixed(2) : item.balance.toFixed(6)}`)
    .join('，');

  if (!merged.length) {
    return `${buildWalletLabel(wallet)} 当前暂未查询到可展示的链上资产，可能是余额尚未同步或该地址还没有可识别代币。`;
  }

  return `当前钱包总资产约为 ${formatUsd(totalUsd)} USDT，主要持仓包括 ${topHoldings}。${buildWalletLabel(wallet)}`;
}

async function fetchOkxRealtimePrice(symbol: string) {
  if (!isRealOkxConfigured()) {
    return null;
  }

  const normalized = normalizeMarketSymbol(symbol);
  const locator = MARKET_TOKEN_MAP[normalized] ?? MARKET_TOKEN_MAP.BTC;
  const body = JSON.stringify([
    {
      chainIndex: locator.chainIndex,
      tokenAddress: locator.tokenContractAddress,
    },
  ]);

  const response = await fetch(`${OKX_BASE_URL}${OKX_CURRENT_PRICE_PATH}`, {
    method: 'POST',
    headers: buildSignedHeaders('POST', OKX_CURRENT_PRICE_PATH, body),
    body,
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok || String(payload.code ?? '') !== '0') {
    throw new Error(String(payload.msg ?? payload.message ?? 'OKX current price request failed'));
  }

  const data = Array.isArray(payload.data) ? (payload.data as OkxCurrentPriceItem[]) : [];
  const first = data[0];
  if (!first?.price) {
    throw new Error(`No current price returned for ${normalized}`);
  }

  return {
    symbol: normalized,
    price: Number(first.price),
    time: String(first.time ?? ''),
  };
}

async function fetchOkxPublicTickerPrice(symbol: string) {
  const instId = MARKET_OKX_INST_ID_MAP[symbol];
  if (!instId) {
    return null;
  }

  const response = await fetch(`${OKX_PUBLIC_TICKER_URL}?instId=${encodeURIComponent(instId)}`);
  const payload = (await response.json()) as Record<string, unknown>;
  const data = Array.isArray(payload.data) ? (payload.data as Record<string, unknown>[]) : [];
  const first = data[0];
  const price = Number(first?.last ?? NaN);

  if (!response.ok || String(payload.code ?? '') !== '0' || !Number.isFinite(price) || price <= 0) {
    throw new Error(String(payload.msg ?? payload.message ?? 'OKX public ticker request failed'));
  }

  return {
    symbol,
    price,
    time: String(first?.ts ?? ''),
  };
}

async function buildMarketReply(symbol: string): Promise<MarketReply> {
  const normalized = normalizeMarketSymbol(symbol);

  try {
    // 优先使用 MCP 获取价格
    const symbolToAddress: Record<string, { address: string; chain: string }> = {
      BTC: { address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', chain: 'ethereum' },
      ETH: { address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', chain: 'ethereum' },
      SOL: { address: 'So11111111111111111111111111111111111111112', chain: 'solana' },
      OKB: { address: '0x75231f58b43240c9718dd58b4967c5114342a86c', chain: 'ethereum' },
    };
    const target = symbolToAddress[normalized];
    if (target) {
      const info = await callMcpTool<any>('token_price_info', { address: target.address, chain: target.chain });
      if (info?.price) {
        return {
          priceSymbol: normalized,
          priceText: `${formatPrice(Number(info.price))} USDT`,
          reply: `${normalized} 当前价格约为 ${formatPrice(Number(info.price))} USDT，数据来自 OKX MCP。`,
          mockMode: false,
        };
      }
    }
  } catch (e) {
    console.warn('[ChatAI] MCP price fetch failed, fallback to legacy', e);
  }

  try {
    const market = await fetchOkxRealtimePrice(normalized);
    if (market && Number.isFinite(market.price)) {
      const marketTime = formatMarketTime(market.time);
      const timeSuffix = marketTime ? `，更新时间 ${marketTime}` : '';
      return {
        priceSymbol: market.symbol,
        priceText: `${formatPrice(market.price)} USDT`,
        reply: `${market.symbol} 当前价格约为 ${formatPrice(market.price)} USDT${timeSuffix}。`,
        mockMode: false,
      };
    }
  } catch (error) {
    console.error('[ChatAI] fetch realtime price failed', error);
  }

  try {
    const market = await fetchOkxPublicTickerPrice(normalized);
    if (market && Number.isFinite(market.price)) {
      const marketTime = formatMarketTime(market.time);
      const timeSuffix = marketTime ? `，更新时间 ${marketTime}` : '';
      return {
        priceSymbol: market.symbol,
        priceText: `${formatPrice(market.price)} USDT`,
        reply: `${market.symbol} 当前价格约为 ${formatPrice(market.price)} USDT${timeSuffix}。`,
        mockMode: false,
      };
    }
  } catch (error) {
    console.error('[ChatAI] fetch public ticker failed', error);
  }

  return {
    priceSymbol: normalized,
    priceText: '',
    reply: `${normalized} 的实时价格暂时不可用，请稍后重试。`,
    mockMode: false,
  };
}

async function buildFallbackIntent(message: string, wallet?: WalletSnapshot | null): Promise<ChatAiIntent> {
  const normalized = message.trim();
  const matchedMarketSymbol = findMarketSymbolFromMessage(normalized);

  if (matchedMarketSymbol && /(多少|价格|行情|涨|跌|price)/i.test(normalized)) {
    const market = await buildMarketReply(matchedMarketSymbol);
    return {
      action: 'market',
      confidence: 0.78,
      reply: market.reply,
      priceSymbol: market.priceSymbol,
      priceText: market.priceText,
      assetSummary: '',
      swapMessage: '',
      source: 'fallback',
      mockMode: market.mockMode,
    };
  }

  if (/(余额|资产|多少钱|持仓)/.test(normalized)) {
    const assetSummary = await buildAssetSummary(wallet).catch(() => '暂时无法读取钱包资产，请稍后重试。');
    return {
      action: 'asset',
      confidence: 0.82,
      reply: assetSummary,
      priceSymbol: '',
      priceText: '',
      assetSummary,
      swapMessage: '',
      source: 'fallback',
      mockMode: false,
    };
  }

  if (/(换成|兑换|swap|换币)/i.test(normalized)) {
    return {
      action: 'swap',
      confidence: 0.86,
      reply: buildIntentReplyDraft('swap', normalized, wallet),
      priceSymbol: '',
      priceText: '',
      assetSummary: '',
      swapMessage: normalized,
      source: 'fallback',
      mockMode: !isRealOkxConfigured(),
    };
  }

  if (isEarnIntent(normalized)) {
    return {
      action: 'earn',
      confidence: 0.8,
      reply: buildIntentReplyDraft('earn', normalized, wallet),
      priceSymbol: '',
      priceText: '',
      assetSummary: '',
      swapMessage: '',
      source: 'fallback',
      mockMode: false,
    };
  }

  if (isProfitIntent(normalized)) {
    return {
      action: 'profit',
      confidence: 0.82,
      reply: buildIntentReplyDraft('profit', normalized, wallet),
      priceSymbol: '',
      priceText: '',
      assetSummary: '',
      swapMessage: '',
      source: 'fallback',
      mockMode: false,
    };
  }

  if (isDepositIntent(normalized)) {
    return {
      action: 'deposit',
      confidence: 0.9,
      reply: buildIntentReplyDraft('deposit', normalized, wallet),
      priceSymbol: '',
      priceText: '',
      assetSummary: '',
      swapMessage: '',
      source: 'fallback',
      mockMode: false,
    };
  }

  return {
    action: 'general',
    confidence: 0.66,
    reply: buildIntentReplyDraft('general', normalized, wallet),
    priceSymbol: '',
    priceText: '',
    assetSummary: '',
    swapMessage: '',
    source: 'fallback',
    mockMode: false,
  };
}

async function callPrimaryLlmChatIntent(message: string, wallet?: WalletSnapshot | null): Promise<ChatAiIntent> {
  const walletHint = wallet
    ? JSON.stringify({
        hasEvmWallet: Boolean(wallet.evmAddress),
        hasSolanaWallet: Boolean(wallet.solanaAddress),
      })
    : '{"hasEvmWallet":false,"hasSolanaWallet":false}';

  const payload = await invokeLLM({
    temperature: 0.2,
    responseFormat: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          '你是 H Wallet 的 AI 驱动钱包助手。你需要识别用户消息属于 market、asset、swap、earn、profit、deposit、general 哪一种意图，并只返回 JSON。JSON 字段必须包含 action, confidence, reply, priceSymbol, priceText, assetSummary, swapMessage。若是查行情，只需识别 symbol 并给出简短自然语言答复草稿，最终实时价格会由系统补齐；若是查资产，reply 与 assetSummary 给出资产总结；若是 swap，reply 简短说明将进入兑换流程，swapMessage 返回原始兑换描述；若是 earn、profit、deposit，只需给出简短草稿回复，具体卡片数据由系统补齐；若是 general，reply 给出友好回答。不要返回 Markdown。',
      },
      {
        role: 'user',
        content: `wallet=${walletHint}\nmessage=${message}`,
      },
    ],
  });

  const content = extractJsonContent(payload as unknown as Record<string, unknown>);
  if (!content) {
    throw new Error('Chat AI returned empty content');
  }

  const parsed = JSON.parse(content) as Record<string, unknown>;
  const action = normalizeAction(parsed.action);
  const inferredPriceSymbol = findMarketSymbolFromMessage(message);
  const priceSymbol = normalizeMarketSymbol(normalizeText(parsed.priceSymbol), inferredPriceSymbol);
  const assetSummary = action === 'asset'
    ? (normalizeText(parsed.assetSummary) || await buildAssetSummary(wallet).catch(() => '暂时无法读取钱包资产，请稍后重试。'))
    : '';
  const swapMessage = normalizeText(parsed.swapMessage) || (action === 'swap' ? message.trim() : '');
  let reply = normalizeText(parsed.reply);

  if (action === 'market') {
    const market = await buildMarketReply(priceSymbol || inferredPriceSymbol || 'BTC');
    reply = market.reply || reply;
    return {
      action,
      confidence: clampConfidence(parsed.confidence, 0.84),
      reply,
      priceSymbol: market.priceSymbol,
      priceText: market.priceText,
      assetSummary: '',
      swapMessage: '',
      source: 'llm',
      mockMode: market.mockMode,
    };
  }

  if (action === 'asset') {
    reply = reply || assetSummary || '暂时无法读取钱包资产，请稍后重试。';
    return {
      action,
      confidence: clampConfidence(parsed.confidence, 0.85),
      reply,
      priceSymbol: '',
      priceText: '',
      assetSummary,
      swapMessage: '',
      source: 'llm',
      mockMode: false,
    };
  }

  if (action === 'swap') {
    return {
      action,
      confidence: clampConfidence(parsed.confidence, 0.9),
      reply: reply || buildIntentReplyDraft('swap', 'swap', undefined),
      priceSymbol: '',
      priceText: '',
      assetSummary: '',
      swapMessage,
      source: 'llm',
      mockMode: !isRealOkxConfigured(),
    };
  }

  if (action === 'earn') {
    return {
      action,
      confidence: clampConfidence(parsed.confidence, 0.84),
      reply: reply || buildIntentReplyDraft('earn', 'earn', undefined),
      priceSymbol: '',
      priceText: '',
      assetSummary: '',
      swapMessage: '',
      source: 'llm',
      mockMode: false,
    };
  }

  if (action === 'profit') {
    return {
      action,
      confidence: clampConfidence(parsed.confidence, 0.84),
      reply: reply || buildIntentReplyDraft('profit', 'profit', undefined),
      priceSymbol: '',
      priceText: '',
      assetSummary: '',
      swapMessage: '',
      source: 'llm',
      mockMode: false,
    };
  }

  if (action === 'deposit') {
    return {
      action,
      confidence: clampConfidence(parsed.confidence, 0.9),
      reply: reply || buildIntentReplyDraft('deposit', 'deposit', undefined),
      priceSymbol: '',
      priceText: '',
      assetSummary: '',
      swapMessage: '',
      source: 'llm',
      mockMode: false,
    };
  }

  return {
    action: 'general',
    confidence: clampConfidence(parsed.confidence, 0.72),
    reply: reply || buildIntentReplyDraft('general', 'general', undefined),
    priceSymbol: '',
    priceText: '',
    assetSummary: '',
    swapMessage: '',
    source: 'llm',
    mockMode: false,
  };
}

export async function getChatAiIntent(message: string, wallet?: WalletSnapshot | null): Promise<ChatAiResult> {
  const normalized = message.trim();
  if (!normalized) {
    throw new Error('message is required');
  }

  const fastIntent = await buildFallbackIntent(normalized, wallet);
  if (fastIntent.action !== 'general') {
    if (fastIntent.action === 'earn') {
      return buildEarnIntentResult(normalized, wallet);
    }

    if (fastIntent.action === 'profit') {
      return buildProfitIntentResult(wallet);
    }

    if (fastIntent.action === 'deposit') {
      const depositResult = buildDepositIntentResult(wallet);
      return buildChatResult(depositResult.intent, { deposit: depositResult.deposit });
    }

    return buildChatResult(fastIntent);
  }

  try {
    const intent = await callPrimaryLlmChatIntent(normalized, wallet);

    if (intent.action === 'earn') {
      const earnResult = await buildEarnIntentResult(normalized, wallet);
      return buildChatResult(
        {
          ...earnResult.intent,
          reply: earnResult.intent.reply || intent.reply,
          confidence: Math.max(intent.confidence, earnResult.intent.confidence),
          source: 'llm',
        },
        earnResult.earnPlan ? { earnPlan: earnResult.earnPlan } : undefined,
      );
    }

    if (intent.action === 'profit') {
      const profitResult = await buildProfitIntentResult(wallet);
      return buildChatResult(
        {
          ...profitResult.intent,
          reply: profitResult.intent.reply || intent.reply,
          confidence: Math.max(intent.confidence, profitResult.intent.confidence),
          source: 'llm',
        },
        profitResult.profit ? { profit: profitResult.profit } : undefined,
      );
    }

    if (intent.action === 'deposit') {
      const depositResult = buildDepositIntentResult(wallet);
      return buildChatResult(
        {
          ...depositResult.intent,
          reply: depositResult.intent.reply || intent.reply,
          confidence: Math.max(intent.confidence, depositResult.intent.confidence),
          source: 'llm',
        },
        { deposit: depositResult.deposit },
      );
    }

    return buildChatResult(intent);
  } catch (error) {
    console.warn('[Chat AI] fallback intent parser:', error);
    const intent = await buildFallbackIntent(normalized, wallet);

    if (intent.action === 'earn') {
      return buildEarnIntentResult(normalized, wallet);
    }

    if (intent.action === 'profit') {
      return buildProfitIntentResult(wallet);
    }

    if (intent.action === 'deposit') {
      return buildChatResult(intent, { deposit: buildGeneralDepositFallback() });
    }

    return buildChatResult(intent);
  }
}
