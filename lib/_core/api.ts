import { Platform } from 'react-native';

import { getApiBaseUrl } from '@/constants/oauth';
import * as Auth from './auth';

export type AgentWalletSendOtpResponse = {
  success: true;
  requestId: string;
  maskedEmail: string;
  expiresIn: number;
  mockMode: boolean;
  message: string;
  debugCode?: string;
};

export type AgentWalletVerifyResponse = {
  app_session_id: string;
  user: {
    id: number | null;
    openId: string;
    name: string | null;
    email: string | null;
    loginMethod: string | null;
    lastSignedIn: string;
  };
  wallet: {
    email: string;
    evmAddress: string;
    solanaAddress: string;
  };
  isNewWallet: boolean;
  mockMode: boolean;
};

export type AgentUserResponse = {
  id: number | null;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  lastSignedIn: string;
};

function maskEmail(email: string) {
  const [localPart, domainPart] = email.trim().toLowerCase().split('@');
  if (!localPart || !domainPart) {
    return email;
  }

  if (localPart.length <= 2) {
    return `${localPart[0] ?? '*'}***@${domainPart}`;
  }

  return `${localPart.slice(0, 2)}***@${domainPart}`;
}

function normalizeAgentUser(payload: unknown): AgentUserResponse {
  const candidate =
    payload && typeof payload === 'object' && 'user' in (payload as Record<string, unknown>)
      ? ((payload as Record<string, unknown>).user as Record<string, unknown> | undefined)
      : (payload as Record<string, unknown> | undefined);

  const email = typeof candidate?.email === 'string' ? candidate.email : null;
  const openId = typeof candidate?.openId === 'string' ? candidate.openId : email ? `wallet:${email}` : '';
  const fallbackName = email ? email.split('@')[0] : null;

  return {
    id: typeof candidate?.id === 'number' ? candidate.id : null,
    openId,
    name: typeof candidate?.name === 'string' ? candidate.name : fallbackName,
    email,
    loginMethod: typeof candidate?.loginMethod === 'string' ? candidate.loginMethod : email ? 'email' : null,
    lastSignedIn: typeof candidate?.lastSignedIn === 'string' ? candidate.lastSignedIn : new Date().toISOString(),
  };
}

export async function getMe(): Promise<AgentUserResponse> {
  const payload = (await apiCall('/api/auth/me')) as Record<string, unknown>;
  return normalizeAgentUser(payload);
}

export async function sendAgentWalletOtp(email: string): Promise<AgentWalletSendOtpResponse> {
  const payload = (await apiCall('/api/agent-wallet/send-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })) as Record<string, unknown>;

  const normalizedEmail = typeof payload.email === 'string' ? payload.email : email.trim().toLowerCase();
  const expiresAt = typeof payload.expiresAt === 'string' ? Date.parse(payload.expiresAt) : NaN;

  return {
    success: true,
    requestId: typeof payload.requestId === 'string' ? payload.requestId : normalizedEmail,
    maskedEmail: typeof payload.maskedEmail === 'string' ? payload.maskedEmail : maskEmail(normalizedEmail),
    expiresIn:
      typeof payload.expiresIn === 'number'
        ? payload.expiresIn
        : Number.isFinite(expiresAt)
          ? Math.max(0, Math.round((expiresAt - Date.now()) / 1000))
          : 600,
    mockMode: Boolean(payload.mockMode),
    message: typeof payload.message === 'string' ? payload.message : '验证码已发送，请查收邮箱。',
    debugCode: typeof payload.debugCode === 'string' ? payload.debugCode : undefined,
  };
}

export async function verifyAgentWalletOtp(email: string, code: string): Promise<AgentWalletVerifyResponse> {
  const payload = (await apiCall('/api/agent-wallet/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  })) as Record<string, unknown>;

  const normalizedEmail = email.trim().toLowerCase();
  const rawUser = payload.user && typeof payload.user === 'object' ? (payload.user as Record<string, unknown>) : {};
  const rawWallet = payload.wallet && typeof payload.wallet === 'object' ? (payload.wallet as Record<string, unknown>) : {};
  const walletAddress =
    typeof rawWallet.evmAddress === 'string'
      ? rawWallet.evmAddress
      : typeof rawWallet.address === 'string'
        ? rawWallet.address
        : '';
  const user = normalizeAgentUser({ user: { ...rawUser, email: typeof rawUser.email === 'string' ? rawUser.email : normalizedEmail } });

  return {
    app_session_id: typeof payload.app_session_id === 'string' ? payload.app_session_id : '',
    user,
    wallet: {
      email: user.email ?? normalizedEmail,
      evmAddress: walletAddress,
      solanaAddress: typeof rawWallet.solanaAddress === 'string' ? rawWallet.solanaAddress : '',
    },
    isNewWallet: Boolean(payload.isNewWallet),
    mockMode: Boolean(payload.mockMode),
  };
}

export async function exchangeOAuthCode(
  code: string,
  state: string,
): Promise<AgentWalletVerifyResponse & { sessionToken: string }> {
  const response = (await apiCall('/api/oauth/callback', {
    method: 'POST',
    body: JSON.stringify({ code, state }),
  })) as AgentWalletVerifyResponse;

  return {
    ...response,
    sessionToken: response.app_session_id,
  };
}

export async function logout(): Promise<void> {
  await apiCall('/api/auth/logout', {
    method: 'POST',
  });
}

export type DexChainKind = 'evm' | 'solana';

export type DexConfigResponse = {
  success: true;
  user: {
    openId: string;
    email: string | null;
  };
  dex: {
    providerMode: 'okx' | 'mock';
    referrerAddress: string;
    evmFeePercent: string;
    solanaFeePercent: string;
    defaultSlippagePercent: string;
  };
};

export type DexIntentResponse = {
  success: true;
  user: {
    openId: string;
  };
  intent: {
    action: 'swap' | 'unknown';
    amount: string;
    fromSymbol: string;
    toSymbol: string;
    chainKind: DexChainKind | null;
    confidence: number;
    source: 'openai' | 'regex';
    mockMode: boolean;
    originalMessage: string;
  };
};

export type GridStructuredCard = {
  kind: 'grid-create' | 'grid-status' | 'grid-explanation' | 'grid-log';
  title: string;
  data: Record<string, unknown>;
};

export type GridIntentAction = 'create' | 'status' | 'stop';

export type GridIntentResult = {
  success: true;
  action: GridIntentAction;
  strategyId?: string;
  algoId?: string;
  message: string;
  execution: Record<string, unknown>;
  cards: GridStructuredCard[];
  mockMode?: boolean;
  analysis?: Record<string, unknown>;
  order?: unknown;
  pendingOrders?: unknown[];
  stopResult?: unknown;
};

export type ChatAiIntentResponse =
  | {
      success: true;
      user: {
        openId: string;
      };
      mockMode: boolean;
      intent: {
        action: 'market' | 'asset' | 'swap' | 'earn' | 'profit' | 'deposit' | 'general';
        confidence: number;
        reply: string;
        priceSymbol: string;
        priceText: string;
        assetSummary: string;
        swapMessage: string;
        source: 'openai' | 'fallback';
        mockMode: boolean;
      };
      earnPlan?: {
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
      profit?: {
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
      deposit?: {
        address: string;
        networkLabel: string;
        copied: boolean;
        chainKind: 'evm' | 'solana';
        source: 'agent_wallet';
      };
      swapQuote?: {
        chainKind: DexChainKind;
        chainIndex: string;
        fromTokenSymbol: string;
        toTokenSymbol: string;
        fromTokenAddress: string;
        toTokenAddress: string;
        userWalletAddress: string;
        fromDecimals: number;
        toDecimals: number;
        rawAmount: string;
        displayAmount: string;
        toAmount: string;
        minReceived: string;
        platformFeeAmount: string;
        feePercent: string;
        referrerAddress: string;
        approvalRequired: boolean;
        providerMode: 'okx' | 'mock';
        mockMode: boolean;
      };
      mode?: undefined;
      result?: undefined;
    }
  | {
      success: true;
      user: {
        openId: string;
      };
      mockMode: boolean;
      mode: 'grid-strategy';
      result: GridIntentResult;
      intent?: undefined;
      swapQuote?: undefined;
      earnPlan?: undefined;
      profit?: undefined;
      deposit?: undefined;
    };

export type DexQuoteResponse = {
  success: true;
  user: {
    openId: string;
  };
  providerMode: 'okx' | 'mock';
  mockMode: boolean;
  chainKind: DexChainKind;
  feePercent: string;
  referrerAddress: string;
  approvalRequired: boolean;
  quote: {
    fromAmount: string;
    toAmount: string;
    minReceived: string;
    platformFeeAmount: string;
    fromTokenSymbol: string;
    toTokenSymbol: string;
  };
  approvalTransaction: Record<string, unknown> | null;
  gas: Record<string, unknown> | null;
  raw: {
    quote?: unknown;
    approve?: unknown;
    gas?: unknown;
  };
};

export type DexExecuteResponse = {
  success: true;
  user: {
    openId: string;
  };
  providerMode: 'okx' | 'mock';
  mockMode: boolean;
  chainKind: DexChainKind;
  feePercent: string;
  referrerAddress: string;
  status: 'prepared' | 'broadcasted' | 'success';
  requiresSignature: boolean;
  orderId: string;
  txHash: string;
  progress: {
    key: string;
    label: string;
    status: 'done' | 'pending';
  }[];
  builderCodeContext?: {
    builderCode: string;
    injectionMode: 'data_suffix';
    targetCapability: 'wallet_sendCalls';
    dataSuffix: `0x${string}`;
    callDataMemo: `0x${string}`;
    appliedToSwapQuery: boolean;
    appliedToPreparedTransaction: boolean;
  } | null;
  swapTransaction: Record<string, unknown> | null;
  order: Record<string, unknown> | null;
  raw: {
    swap?: unknown;
    broadcast?: unknown;
    orders?: unknown;
  };
};

export type DexOrdersResponse = {
  success: true;
  user: {
    openId: string;
  };
  providerMode: 'okx' | 'mock';
  mockMode: boolean;
  cursor?: string;
  data: Record<string, unknown>[];
  raw?: unknown;
};

export type OnchainOsConfigResponse = {
  success: true;
  user: {
    openId: string;
    email: string | null;
  };
  onchainOs: {
    providerMode: 'okx' | 'mock';
    executionModel: 'agent_wallet';
    authMode: 'api_key' | 'mock';
    baseUrl: string;
    endpoints: {
      onchainBaseUrl: string;
      agentWalletBaseUrl: string;
    };
    projectIdConfigured: boolean;
    builderCodeConfigured: boolean;
    referrerAddress: string;
    evmFeePercent: string;
    solanaFeePercent: string;
    defaultSlippagePercent: string;
    capabilities: {
      walletEmailLogin: boolean;
      preview: boolean;
      execute: boolean;
      receipt: boolean;
      assets: boolean;
      simulate: boolean;
      broadcast: boolean;
    };
    compatibility: {
      legacyDexRoutesAvailable: boolean;
      legacySignatureBridgeRetained: boolean;
    };
  };
};

export type OnchainTxPhase = 'preview' | 'awaiting_confirmation' | 'executing' | 'success' | 'failed';

export type OnchainPreviewResponse = DexQuoteResponse & {
  executionModel: 'agent_wallet';
  phase: 'preview';
  progress: {
    key: string;
    label: string;
    status: 'done' | 'pending';
  }[];
};

export type OnchainExecuteResponse = Omit<DexExecuteResponse, 'status' | 'requiresSignature'> & {
  executionModel: 'agent_wallet';
  phase: OnchainTxPhase;
  progress: {
    key: string;
    label: string;
    status: 'done' | 'pending';
  }[];
};

export type OnchainExecutionReceiptResponse = DexOrdersResponse & {
  executionModel: 'agent_wallet';
  phase: Extract<OnchainTxPhase, 'executing' | 'success' | 'failed'>;
};

export type OnchainAssetsResponse = {
  success: true;
  user: {
    openId: string;
  };
  executionModel: 'agent_wallet';
  source: 'okx-onchain' | 'mock';
  mockMode: boolean;
  totalAssetValue: string;
  walletAddresses: {
    chainIndex: string;
    chainName: string;
    address: string;
    assets: WalletAssetItem[];
  }[];
  updatedAt: string;
};

export type StoredWalletSnapshot = {
  email?: string;
  evmAddress?: string;
  solanaAddress?: string;
  updatedAt?: string;
  mockMode?: boolean;
} | null;

export type WalletAssetItem = {
  chainIndex: string;
  chainName: string;
  tokenAddress: string;
  address: string;
  symbol: string;
  tokenName: string;
  balance: string;
  tokenPrice: string;
  valueUsd: string;
  isRiskToken: boolean;
  logoUrl?: string;
  priceSource?: 'okx-onchain' | 'okx-market' | 'coingecko';
  priceUpdatedAt?: string;
};

export type AgentWalletAssetsResponse = {
  success: true;
  mockMode: boolean;
  source: 'okx-mcp' | 'public-chain' | 'demo-fallback';
  totalAssetValue: string;
  walletAddresses: {
    chainIndex: string;
    chainName: string;
    address: string;
    assets: WalletAssetItem[];
  }[];
  updatedAt: string;
};

export type MarketSnapshot = {
  symbol: string;
  price: number;
  change24h: number | null;
  volume24h?: string;
  updateTime: string;
  source: 'okx-mcp' | 'demo';
};

export type HotTokenItem = {
  symbol: string;
  name: string;
  address: string;
  chain: string;
  price: string;
  change24h: string;
  volume24h: string;
};

export type DeFiProductItem = {
  id: string;
  name: string;
  platform: string;
  apr: number;
  tvl: string;
  chain: string;
  productGroup: string;
  depositTokenSymbol: string;
};

export type SmartMoneyWalletItem = {
  walletAddress: string;
  realizedPnlUsd: string;
  realizedPnlPercent: string;
  winRatePercent: string;
  txs: string;
  txVolume: string;
  avgBuyValueUsd: string;
  lastActiveTimestamp: string;
  topPnlTokenList: Array<{
    tokenSymbol: string;
    tokenContractAddress: string;
    tokenPnLUsd: string;
    tokenPnLPercent: string;
  }>;
};

export type MemeScanTokenItem = {
  tokenContractAddress: string;
  tokenSymbol: string;
  chainIndex: string;
  marketCap?: string;
  liquidity?: string;
  holders?: string;
  volume24h?: string;
  priceChange24h?: string;
  smartMoneyBuys?: string;
};

type DexQuotePayload = {
  chainIndex: string;
  amount: string;
  fromTokenAddress: string;
  toTokenAddress: string;
  userWalletAddress: string;
  fromTokenSymbol?: string;
  toTokenSymbol?: string;
  displayAmount?: string;
  chainKind?: DexChainKind;
};

type DexExecutePayload = DexQuotePayload & {
  slippagePercent?: string;
  signedTx?: string;
  jitoSignedTx?: string;
  broadcastAddress?: string;
  builderCode?: string;
  builderCodeDataSuffix?: `0x${string}`;
  builderCodeCallDataMemo?: `0x${string}`;
};

type RequestHeaders = Record<string, string>;

export type OkxOnchainTokenDetailApiResponse = {
  code: string;
  msg: string;
  data?: {
    chainIndex: string;
    tokenAddress: string;
    symbol: string;
    name: string;
    logoUrl: string;
    officialWebsite: string;
    socialUrls: string[];
    decimals: number;
    circulatingSupply: string;
    maxSupply: string;
    totalSupply: string;
    volume24h: string;
    marketCap: string;
  }[];
};

export type OkxOnchainMarketTickerApiResponse = {
  code: string;
  msg: string;
  data?: {
    chainIndex: string;
    tokenContractAddress?: string;
    tokenAddress?: string;
    price: string;
    time: string;
  }[];
};

function isAbsoluteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function buildRequestUrl(endpoint: string): string {
  return isAbsoluteUrl(endpoint) ? endpoint : `${getApiBaseUrl()}${endpoint}`;
}

export async function getOkxOnchainMarketTicker(
  chainIndex: string,
  tokenContractAddress: string,
): Promise<OkxOnchainMarketTickerApiResponse> {
  return (await apiCall('/api/okx/onchain/price', {
    method: 'POST',
    body: JSON.stringify([{ chainIndex, tokenAddress: tokenContractAddress }]),
  })) as OkxOnchainMarketTickerApiResponse;
}

export async function getOkxOnchainTokenDetail(chainIndex: string, tokenAddress: string): Promise<OkxOnchainTokenDetailApiResponse> {
  return (await apiCall(
    `/api/okx/onchain/token-detail?chainIndex=${encodeURIComponent(chainIndex)}&tokenAddress=${encodeURIComponent(tokenAddress)}`,
  )) as OkxOnchainTokenDetailApiResponse;
}



type RpcJsonResponse<T> = {
  result?: T;
  error?: {
    message?: string;
  };
};

type EvmTrackedToken = {
  address: string;
  symbol: string;
  tokenName: string;
  decimals: number;
  coingeckoId: string;
};

type EvmChainConfig = {
  chainIndex: string;
  chainName: string;
  rpcUrl: string;
  nativeSymbol: string;
  nativeTokenName: string;
  nativeCoingeckoId: string;
  tokens: EvmTrackedToken[];
};

type SolanaTrackedToken = {
  mint: string;
  symbol: string;
  tokenName: string;
  decimals: number;
  coingeckoId: string;
};

type SolanaTokenAccountInfo = {
  mint: string;
  amount: string;
  decimals: number;
  uiAmount: number;
};

const COINGECKO_SIMPLE_PRICE_URL = 'https://api.coingecko.com/api/v3/simple/price';
const JUPITER_TOKEN_LIST_URL = 'https://raw.githubusercontent.com/jup-ag/token-list/main/validated-tokens.csv';
const SOLANA_TOKEN_PROGRAM_IDS = [
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
] as const;

const EVM_CHAIN_CONFIGS: EvmChainConfig[] = [
  {
    chainIndex: '1',
    chainName: 'Ethereum',
    rpcUrl: 'https://ethereum-rpc.publicnode.com',
    nativeSymbol: 'ETH',
    nativeTokenName: 'Ethereum',
    nativeCoingeckoId: 'ethereum',
    tokens: [
      {
        address: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        symbol: 'USDC',
        tokenName: 'USD Coin',
        decimals: 6,
        coingeckoId: 'usd-coin',
      },
      {
        address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        symbol: 'USDT',
        tokenName: 'Tether USD',
        decimals: 6,
        coingeckoId: 'tether',
      },
      {
        address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        symbol: 'DAI',
        tokenName: 'Dai',
        decimals: 18,
        coingeckoId: 'dai',
      },
      {
        address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        symbol: 'WETH',
        tokenName: 'Wrapped Ether',
        decimals: 18,
        coingeckoId: 'weth',
      },
      {
        address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
        symbol: 'WBTC',
        tokenName: 'Wrapped BTC',
        decimals: 8,
        coingeckoId: 'wrapped-bitcoin',
      },
    ],
  },
  {
    chainIndex: '8453',
    chainName: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    nativeSymbol: 'ETH',
    nativeTokenName: 'Ethereum',
    nativeCoingeckoId: 'ethereum',
    tokens: [
      {
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        symbol: 'USDC',
        tokenName: 'USD Coin',
        decimals: 6,
        coingeckoId: 'usd-coin',
      },
      {
        address: '0x4200000000000000000000000000000000000006',
        symbol: 'WETH',
        tokenName: 'Wrapped Ether',
        decimals: 18,
        coingeckoId: 'weth',
      },
      {
        address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
        symbol: 'DAI',
        tokenName: 'Dai',
        decimals: 18,
        coingeckoId: 'dai',
      },
      {
        address: '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf',
        symbol: 'cbBTC',
        tokenName: 'Coinbase Wrapped BTC',
        decimals: 8,
        coingeckoId: 'coinbase-wrapped-btc',
      },
    ],
  },
  {
    chainIndex: '137',
    chainName: 'Polygon',
    rpcUrl: 'https://polygon-rpc.com',
    nativeSymbol: 'POL',
    nativeTokenName: 'Polygon Ecosystem Token',
    nativeCoingeckoId: 'polygon-ecosystem-token',
    tokens: [
      {
        address: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
        symbol: 'USDC',
        tokenName: 'USD Coin',
        decimals: 6,
        coingeckoId: 'usd-coin',
      },
      {
        address: '0xc2132D05D31c914A87C6611C10748AEb04B58e8F',
        symbol: 'USDT',
        tokenName: 'Tether USD',
        decimals: 6,
        coingeckoId: 'tether',
      },
      {
        address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
        symbol: 'DAI',
        tokenName: 'Dai',
        decimals: 18,
        coingeckoId: 'dai',
      },
      {
        address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
        symbol: 'WETH',
        tokenName: 'Wrapped Ether',
        decimals: 18,
        coingeckoId: 'weth',
      },
      {
        address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
        symbol: 'WBTC',
        tokenName: 'Wrapped BTC',
        decimals: 8,
        coingeckoId: 'wrapped-bitcoin',
      },
    ],
  },
];

const SOLANA_SYMBOL_PRICE_ID_MAP: Record<string, string> = {
  USDC: 'usd-coin',
  USDT: 'tether',
  JUP: 'jupiter-exchange-solana',
  BONK: 'bonk',
};

let solanaTokenMetadataPromise: Promise<Record<string, SolanaTrackedToken>> | null = null;

const OKX_TICKER_URL = 'https://www.okx.com/api/v5/market/ticker';
const SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com';

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
};

const MARKET_PRICE_TARGET_MAP: Record<string, { chainIndex: string; tokenContractAddress: string }> = {
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
};

const MARKET_OKX_INST_ID_MAP: Record<string, string> = {
  BTC: 'BTC-USDT',
  ETH: 'ETH-USDT',
  SOL: 'SOL-USDT',
};

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatFiat(value: number, digits = 2): string {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatTokenAmount(value: number): string {
  if (value >= 1000) {
    return formatFiat(value, 2);
  }
  if (value >= 1) {
    return new Intl.NumberFormat('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(value);
  }
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(value);
}

function formatPrice(value: number): string {
  if (value >= 1) {
    return formatFiat(value, 2);
  }
  if (value >= 0.0001) {
    return new Intl.NumberFormat('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(value);
  }
  if (value === 0) {
    return '0.00';
  }

  const exponential = value.toExponential(2);
  const [mantissa, exponent] = exponential.split('e');
  const supExponent = exponent.replace('-', '⁻').replace(/[0-9]/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(c)]);

  return `${Number(mantissa).toFixed(2)}×10${supExponent}`;
}

function buildWalletAssetItem(data: {
  chainIndex: string;
  chainName: string;
  address: string;
  tokenAddress: string;
  symbol: string;
  tokenName: string;
  balance: number | string;
  tokenPrice: number;
  logoUrl?: string;
  priceSource?: 'okx-onchain' | 'okx-market' | 'coingecko';
  priceUpdatedAt?: string;
}): WalletAssetItem {
  const balanceNum = toNumber(data.balance);
  const valueUsd = balanceNum * data.tokenPrice;

  return {
    ...data,
    balance: formatTokenAmount(balanceNum),
    tokenPrice: formatPrice(data.tokenPrice),
    valueUsd: formatFiat(valueUsd),
    isRiskToken: false,
  };
}

function buildDemoAccountAssets(wallet: StoredWalletSnapshot): AgentWalletAssetsResponse {
  const updatedAt = new Date().toISOString();
  const evmAddress = wallet?.evmAddress || '0xDemoWalletAddress0000000000000000000000000000';
  const solanaAddress = wallet?.solanaAddress || 'SoDemoWalletAddress111111111111111111111111111';

  const walletAddresses = [
    {
      chainIndex: '1',
      chainName: 'Ethereum',
      address: evmAddress,
      assets: [
        buildWalletAssetItem({
          chainIndex: '1',
          chainName: 'Ethereum',
          address: evmAddress,
          tokenAddress: '-',
          symbol: 'ETH',
          tokenName: 'Ethereum',
          balance: 0.8245,
          tokenPrice: 1895.42,
          logoUrl: 'https://www.okx.com/cdn/assets/imgs/221/Ethereum.png',
          priceSource: 'okx-market',
          priceUpdatedAt: updatedAt,
        }),
        buildWalletAssetItem({
          chainIndex: '1',
          chainName: 'Ethereum',
          address: evmAddress,
          tokenAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
          symbol: 'USDT',
          tokenName: 'Tether USD',
          balance: 1280,
          tokenPrice: 1,
          logoUrl: 'https://www.okx.com/cdn/assets/imgs/221/5B313E8F4E9A8A4C.png',
          priceSource: 'okx-market',
          priceUpdatedAt: updatedAt,
        }),
      ],
    },
    {
      chainIndex: '101',
      chainName: 'Solana',
      address: solanaAddress,
      assets: [
        buildWalletAssetItem({
          chainIndex: '101',
          chainName: 'Solana',
          address: solanaAddress,
          tokenAddress: '-',
          symbol: 'SOL',
          tokenName: 'Solana',
          balance: 18.42,
          tokenPrice: 132.8,
          logoUrl: 'https://www.okx.com/cdn/assets/imgs/221/61088B116630C60C.png',
          priceSource: 'okx-market',
          priceUpdatedAt: updatedAt,
        }),
      ],
    },
  ];

  const totalAssetValue = walletAddresses
    .flatMap((chain) => chain.assets)
    .reduce((sum, asset) => sum + toNumber(asset.valueUsd), 0);

  return {
    success: true,
    mockMode: true,
    source: 'demo-fallback',
    totalAssetValue: totalAssetValue.toString(),
    walletAddresses,
    updatedAt,
  };
}

const apiCall = async (
  endpoint: string,
  options: {
    method?: 'GET' | 'POST';
    headers?: RequestHeaders;
    body?: string;
  } = {},
): Promise<any> => {
  const requestUrl = buildRequestUrl(endpoint);
  const isOkxApi = /^https?:\/\/(?:web3\.)?okx\.com\//i.test(requestUrl);
  const authToken = await Auth.getSessionToken();
  const headers: RequestHeaders = {
    'Content-Type': 'application/json',
    'X-App-Session-Id': authToken || '',
    'X-App-Platform': Platform.OS,
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...options.headers,
  };

  const response = await fetch(requestUrl, {
    method: options.method || 'GET',
    headers,
    body: options.body,
  });

  const rawText = await response.text();
  let json: Record<string, unknown> = {};

  if (rawText) {
    try {
      json = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      if (!response.ok) {
        throw new Error(`网络请求失败: ${response.status} ${rawText}`);
      }
      return rawText;
    }
  }

  if (!response.ok) {
    const message =
      (typeof json.msg === 'string' && json.msg) ||
      (typeof json.message === 'string' && json.message) ||
      (typeof json.error === 'string' && json.error) ||
      rawText ||
      `HTTP_${response.status}`;
    throw new Error(message);
  }

  const code = typeof json.code === 'string' ? json.code : undefined;
  if (isOkxApi && code && code !== '0') {
    throw new Error(
      (typeof json.msg === 'string' && json.msg) ||
        (typeof json.message === 'string' && json.message) ||
        'OKX 服务返回了错误',
    );
  }

  if (!isOkxApi && json.success !== true && json.ok !== true && typeof json.error === 'string' && json.error) {
    throw new Error(json.error);
  }

  return json;
};

type OkxMcpToolResponse = {
  jsonrpc?: string;
  id?: string | number | null;
  result?: {
    content?: {
      type?: string;
      text?: string;
    }[];
    isError?: boolean;
  };
  error?: {
    code?: number;
    message?: string;
  };
};

type OkxMcpPortfolioBalanceItem = {
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

const OKX_MCP_EVM_CHAINS = 'ethereum,base,arbitrum,polygon,bsc';
const OKX_MCP_SOLANA_CHAINS = 'solana';

function getOkxMcpChainName(chainIndex: string) {
  switch (chainIndex) {
    case '1':
      return 'Ethereum';
    case '56':
      return 'BSC';
    case '137':
      return 'Polygon';
    case '42161':
      return 'Arbitrum';
    case '8453':
      return 'Base';
    case '501':
    case '101':
      return 'Solana';
    default:
      return `链 ${chainIndex}`;
  }
}

function parseOkxMcpTextResult(payload: OkxMcpToolResponse): string {
  const textBlock = payload.result?.content?.find((item) => item?.type === 'text');
  return typeof textBlock?.text === 'string' ? textBlock.text : '';
}

async function callOkxMcpTool<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const payload = (await apiCall('/api/okx/mcp', {
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: `${name}-${Date.now()}`,
      method: 'tools/call',
      params: {
        name,
        arguments: args,
      },
    }),
  })) as OkxMcpToolResponse;

  if (payload.error?.message) {
    throw new Error(payload.error.message);
  }

  const textResult = parseOkxMcpTextResult(payload);
  if (payload.result?.isError) {
    throw new Error(textResult || `${name} 调用失败`);
  }

  if (!textResult) {
    throw new Error(`${name} 未返回可解析的数据`);
  }

  try {
    return JSON.parse(textResult) as T;
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `${name} 返回解析失败：${error.message}`
        : `${name} 返回解析失败`,
    );
  }
}

function normalizeOkxMcpAsset(item: OkxMcpPortfolioBalanceItem): WalletAssetItem | null {
  const balance = toNumber(item.balance);
  const tokenPrice = toNumber(item.tokenPrice);
  if (balance <= 0) {
    return null;
  }

  const valueUsd = balance * tokenPrice;
  const chainIndex = item.chainIndex || '1';
  const symbol = typeof item.symbol === 'string' && item.symbol.trim() ? item.symbol.trim() : 'TOKEN';

  return {
    chainIndex,
    chainName: getOkxMcpChainName(chainIndex),
    tokenAddress: item.tokenContractAddress || '-',
    address: item.address || '',
    symbol,
    tokenName: typeof item.tokenName === 'string' && item.tokenName.trim() ? item.tokenName.trim() : symbol,
    balance: balance.toString(),
    tokenPrice: tokenPrice.toString(),
    valueUsd: valueUsd.toString(),
    isRiskToken: Boolean(item.isRiskToken),
    logoUrl: item.tokenLogoUrl,
    priceSource: 'okx-market',
    priceUpdatedAt: new Date().toISOString(),
  };
}

async function getWalletAssetsByMcp(address: string, chains: string): Promise<WalletAssetItem[]> {
  const balances = await callOkxMcpTool<OkxMcpPortfolioBalanceItem[]>('portfolio_all_balances', {
    address,
    chains,
    filter: '0',
    exclude_risk: '0',
  });

  return balances
    .map((item) => normalizeOkxMcpAsset(item))
    .filter((item): item is WalletAssetItem => Boolean(item))
    .sort((left, right) => toNumber(right.valueUsd) - toNumber(left.valueUsd));
}

type OkxMcpTokenPriceInfo = {
  price?: string;
  change24h?: string;
  volume24h?: string;
  lastUpdated?: string;
};

export async function getMarketSnapshotByMcp(symbol: string): Promise<MarketSnapshot> {
  // 映射主流币地址
  const symbolToAddress: Record<string, { address: string; chain: string }> = {
    BTC: { address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', chain: 'ethereum' }, // WBTC as proxy
    ETH: { address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', chain: 'ethereum' },
    SOL: { address: 'So11111111111111111111111111111111111111112', chain: 'solana' },
    BNB: { address: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', chain: 'bsc' },
    SUI: { address: '0x2::sui::SUI', chain: 'sui' },
  };

  const normalizedSymbol = symbol.toUpperCase();
  const target = symbolToAddress[normalizedSymbol];
  if (!target) {
    throw new Error(`暂不支持查询 ${normalizedSymbol} 的实时价格`);
  }

  const info = await callOkxMcpTool<OkxMcpTokenPriceInfo>('token_price_info', {
    address: target.address,
    chain: target.chain,
  });

  return {
    symbol: normalizedSymbol,
    price: toNumber(info.price),
    change24h: info.change24h ? toNumber(info.change24h) / 100 : null,
    volume24h: info.volume24h,
    updateTime: new Date().toISOString(),
    source: 'okx-mcp',
  };
}

export async function getHotTokensByMcp(chain = 'ethereum'): Promise<HotTokenItem[]> {
  try {
    const tokens = await callOkxMcpTool<any[]>('token_hot_tokens', {
      chain,
    });

    return tokens.map((t) => ({
      symbol: t.symbol || 'UNKNOWN',
      name: t.name || t.symbol || 'Unknown Token',
      address: t.address || '',
      chain: t.chain || chain,
      price: t.price || '0',
      change24h: t.change24h || '0',
      volume24h: t.volume24h || '0',
    }));
  } catch (error) {
    console.warn('getHotTokensByMcp failed:', error);
    return [];
  }
}

export async function searchDeFiProductsByMcp(
  token: string,
  chain = 'ethereum',
  productGroup = 'SINGLE_EARN'
): Promise<DeFiProductItem[]> {
  const response = await callOkxMcpTool<any>('defi_search', {
    token,
    chain,
    product_group: productGroup,
  });

  const list = Array.isArray(response?.list) ? response.list : [];
  return list.map((item: any) => ({
    id: String(item.investmentId),
    name: item.name,
    platform: item.platformName,
    apr: toNumber(item.rate) * 100,
    tvl: item.tvl,
    chain: chain,
    productGroup: item.productGroup,
    depositTokenSymbol:
      String(
        item.depositTokenSymbol ||
          item.investTokenSymbol ||
          item.investToken ||
          item.currency ||
          item.currencyName ||
          token
      )
        .trim()
        .toUpperCase() || token.toUpperCase(),
  }));
}

export async function getSmartMoneyLeaderboardByMcp(chain = 'solana'): Promise<SmartMoneyWalletItem[]> {
  const response = await callOkxMcpTool<{ code?: string; data?: SmartMoneyWalletItem[] }>('smart_money_leaderboard_list', {
    chain,
  });

  return Array.isArray(response?.data) ? response.data : [];
}

export async function getMemeScanListByMcp(chain = 'solana'): Promise<MemeScanTokenItem[]> {
  const response = await callOkxMcpTool<{ code?: string; data?: any[] }>('meme_scan_list', {
    chain,
    stage: 'new',
    limit: '20',
  });

  const list = Array.isArray(response?.data) ? response.data : [];
  return list.map((item: any) => ({
    tokenContractAddress: item.tokenAddress || '',
    tokenSymbol: item.symbol || item.name || 'MEME',
    chainIndex: item.chainIndex || '501',
    marketCap: item.market?.marketCapUsd,
    liquidity: item.bondingPercent,
    holders: item.tags?.totalHolders,
    volume24h: item.market?.volumeUsd1h,
    priceChange24h: undefined,
    smartMoneyBuys: item.market?.buyTxCount1h,
  }));
}

async function postRpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`RPC请求失败: ${response.status} ${errorText}`);
  }

  const json = (await response.json()) as RpcJsonResponse<T>;
  if (json.error) {
    throw new Error(`RPC错误: ${json.error.message}`);
  }
  if (json.result === undefined) {
    throw new Error('RPC响应缺少result字段');
  }

  return json.result;
}

function hexToDecimalString(hex: string): string {
  const normalizedHex = hex.startsWith('0x') ? hex.substring(2) : hex;
  if (!/^[0-9a-fA-F]+$/.test(normalizedHex)) {
    throw new Error('无效的十六进制余额数据');
  }
  return BigInt(`0x${normalizedHex}`).toString();
}

function decimalStringToNumber(decimal: string, decimals: number): number {
  const divisor = 10 ** decimals;
  return Number(decimal) / divisor;
}

function encodeErc20BalanceOf(address: string): string {
  const functionHash = '0x70a08231';
  const addressPadded = address.substring(2).padStart(64, '0');
  return `${functionHash}${addressPadded}`;
}

async function getAssetPriceMap(coinIds: string[]): Promise<Record<string, number>> {
  const uniqueIds = [...new Set(coinIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return {};
  }

  const url = `${COINGECKO_SIMPLE_PRICE_URL}?ids=${uniqueIds.join(',')}&vs_currencies=usd`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`获取资产价格失败: ${response.status}`);
  }

  const data = await response.json();
  const priceMap: Record<string, number> = {};
  for (const id of uniqueIds) {
    if (data[id]) {
      priceMap[id] = data[id].usd;
    }
  }
  return priceMap;
}

async function getSolanaTokenMetadataMap(): Promise<Record<string, SolanaTrackedToken>> {
  if (solanaTokenMetadataPromise) {
    return solanaTokenMetadataPromise;
  }

  solanaTokenMetadataPromise = (async () => {
    const response = await fetch(JUPITER_TOKEN_LIST_URL);
    if (!response.ok) {
      throw new Error(`获取Solana代币列表失败: ${response.status}`);
    }

    const csv = await response.text();
    const lines = csv.split('\n').slice(1);
    const metadataMap: Record<string, SolanaTrackedToken> = {};

    for (const line of lines) {
      const [mint, symbol, tokenName, decimalsStr] = line.split(',');
      if (mint && symbol && tokenName && decimalsStr) {
        const decimals = parseInt(decimalsStr, 10);
        const coingeckoId = SOLANA_SYMBOL_PRICE_ID_MAP[symbol] || '';
        metadataMap[mint] = { mint, symbol, tokenName, decimals, coingeckoId };
      }
    }
    return metadataMap;
  })();

  return solanaTokenMetadataPromise;
}

export async function getDexConfig(): Promise<DexConfigResponse> {
  return (await apiCall('/api/dex/config')) as DexConfigResponse;
}

export async function getOnchainOsConfig(): Promise<OnchainOsConfigResponse> {
  return (await apiCall('/api/onchain/config')) as OnchainOsConfigResponse;
}

export async function getOnchainAssets(params: {
  address: string;
  chains?: string;
  filter?: string;
  excludeRiskToken?: string;
}): Promise<OnchainAssetsResponse> {
  const query = new URLSearchParams();
  query.append('address', params.address);
  if (params.chains) {
    query.append('chains', params.chains);
  }
  if (params.filter) {
    query.append('filter', params.filter);
  }
  if (params.excludeRiskToken) {
    query.append('excludeRiskToken', params.excludeRiskToken);
  }
  return (await apiCall(`/api/onchain/assets?${query.toString()}`)) as OnchainAssetsResponse;
}

async function getOkxPublicTickerPrice(symbol: string): Promise<{ price: number; updateTime: string } | null> {
  const instId = MARKET_OKX_INST_ID_MAP[symbol];
  if (!instId) {
    return null;
  }

  const response = await fetch(`${OKX_TICKER_URL}?instId=${encodeURIComponent(instId)}`);
  if (!response.ok) {
    throw new Error(`OKX public ticker request failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    code?: string;
    msg?: string;
    data?: { last?: string; ts?: string }[];
  };
  const ticker = Array.isArray(payload.data) ? payload.data[0] : undefined;
  const price = Number(ticker?.last ?? NaN);

  if (payload.code !== '0' || !Number.isFinite(price) || price <= 0) {
    throw new Error(String(payload.msg ?? 'OKX public ticker returned empty price'));
  }

  const updateTime = ticker?.ts ? new Date(Number(ticker.ts)).toISOString() : '';
  return { price, updateTime };
}

export async function getPublicMarketSnapshot(symbol: string): Promise<{
  symbol: string;
  price: number;
  change24h: number | null;
  updateTime: string;
} | null> {
  const normalizedSymbol = MARKET_SYMBOL_ALIAS[symbol.toUpperCase()] || symbol.toUpperCase();
  const instId = MARKET_OKX_INST_ID_MAP[normalizedSymbol];
  if (!instId) {
    return null;
  }

  const response = await fetch(`${OKX_TICKER_URL}?instId=${encodeURIComponent(instId)}`);
  if (!response.ok) {
    throw new Error(`OKX public ticker request failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    code?: string;
    msg?: string;
    data?: { last?: string; open24h?: string; ts?: string }[];
  };
  const ticker = Array.isArray(payload.data) ? payload.data[0] : undefined;
  const price = Number(ticker?.last ?? NaN);
  const open24h = Number(ticker?.open24h ?? NaN);
  const change24h = Number.isFinite(price) && Number.isFinite(open24h) && open24h > 0 ? (price - open24h) / open24h : null;

  if (payload.code !== '0' || !Number.isFinite(price) || price <= 0) {
    throw new Error(String(payload.msg ?? 'OKX public ticker returned empty price'));
  }

  return {
    symbol: normalizedSymbol,
    price,
    change24h,
    updateTime: ticker?.ts ? new Date(Number(ticker.ts)).toISOString() : '',
  };
}

type AssetResolvedPrice = {
  price: number;
  source: 'okx-onchain' | 'okx-market' | 'coingecko';
  updatedAt: string;
};

function normalizePriceUpdateTime(raw?: string | number): string {
  if (raw === undefined || raw === null || raw === '') {
    return new Date().toISOString();
  }

  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) {
    return new Date(numeric).toISOString();
  }

  const parsed = new Date(String(raw));
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

async function resolveWalletAssetPrice(params: {
  chainIndex: string;
  tokenAddress: string;
  symbol: string;
  fallbackPrice: number;
}): Promise<AssetResolvedPrice> {
  const { chainIndex, tokenAddress, symbol, fallbackPrice } = params;

  if (tokenAddress && tokenAddress !== '-') {
    try {
      const onchainTicker = await getOkxOnchainMarketTicker(chainIndex, tokenAddress);
      const ticker = onchainTicker.data?.[0];
      const price = Number(ticker?.price ?? NaN);
      if (onchainTicker.code === '0' && Number.isFinite(price) && price > 0) {
        return {
          price,
          source: 'okx-onchain',
          updatedAt: normalizePriceUpdateTime(ticker?.time),
        };
      }
    } catch (error) {
      console.warn(`OKX onchain price fallback for ${symbol}:`, error);
    }
  }

  try {
    const marketTicker = await getOkxPublicTickerPrice(symbol);
    if (marketTicker && Number.isFinite(marketTicker.price) && marketTicker.price > 0) {
      return {
        price: marketTicker.price,
        source: 'okx-market',
        updatedAt: normalizePriceUpdateTime(marketTicker.updateTime),
      };
    }
  } catch (error) {
    console.warn(`OKX market price fallback for ${symbol}:`, error);
  }

  return {
    price: fallbackPrice,
    source: 'coingecko',
    updatedAt: new Date().toISOString(),
  };
}

export async function getRealtimeMarketSnapshot(symbol: string): Promise<string> {
  const normalizedSymbol = MARKET_SYMBOL_ALIAS[symbol.toUpperCase()] || symbol.toUpperCase();
  const priceTarget = MARKET_PRICE_TARGET_MAP[normalizedSymbol];

  if (!priceTarget) {
    return `暂不支持查询 ${symbol} 的行情。`;
  }

  try {
    const response = await getOkxOnchainMarketTicker(priceTarget.chainIndex, priceTarget.tokenContractAddress);
    const ticker = response.data?.[0];

    if (ticker?.price) {
      const price = parseFloat(ticker.price);
      const updateTime = ticker.time ? new Date(Number(ticker.time)).toLocaleString('zh-CN', { hour12: false }) : '';
      return `${normalizedSymbol} 最新价: ${formatPrice(price)} USDT${updateTime ? `，更新时间: ${updateTime}` : ''}`;
    }
  } catch (error) {
    console.error(`获取 ${symbol} 链上行情失败，改用 OKX 公共行情兜底:`, error);
  }

  try {
    const ticker = await getOkxPublicTickerPrice(normalizedSymbol);
    if (ticker) {
      return `${normalizedSymbol} 最新价: ${formatPrice(ticker.price)} USDT${ticker.updateTime ? `，更新时间: ${ticker.updateTime}` : ''}`;
    }
    return `无法获取 ${symbol} 的行情数据。`;
  } catch (error) {
    console.error(`获取 ${symbol} 行情失败:`, error);
    return `抱歉，查询 ${symbol} 行情时遇到网络问题。`;
  }
}

async function getEvmWalletAssets(
  walletAddress: string,
  { chainIndex, chainName, rpcUrl, nativeSymbol, nativeTokenName, nativeCoingeckoId, tokens }: EvmChainConfig,
  priceMap: Record<string, number>,
): Promise<WalletAssetItem[]> {
  const assets: WalletAssetItem[] = [];

  try {
    const balanceHex = await postRpc<string>(rpcUrl, 'eth_getBalance', [walletAddress, 'latest']);
    const balance = decimalStringToNumber(hexToDecimalString(balanceHex), 18);
    if (balance > 0) {
      const resolvedPrice = await resolveWalletAssetPrice({
        chainIndex,
        tokenAddress: '-',
        symbol: nativeSymbol,
        fallbackPrice: toNumber(priceMap[nativeCoingeckoId]),
      });
      assets.push(
        buildWalletAssetItem({
          chainIndex,
          chainName,
          address: walletAddress,
          tokenAddress: '-',
          symbol: nativeSymbol,
          tokenName: nativeTokenName,
          balance,
          tokenPrice: resolvedPrice.price,
          priceSource: resolvedPrice.source,
          priceUpdatedAt: resolvedPrice.updatedAt,
        }),
      );
    }
  } catch (err) {
    console.error(`Failed to fetch native balance for ${chainName}:`, err);
  }

  for (const token of tokens) {
    try {
      const balanceHex = await postRpc<string>(rpcUrl, 'eth_call', [
        { to: token.address, data: encodeErc20BalanceOf(walletAddress) },
        'latest',
      ]);
      const balance = decimalStringToNumber(hexToDecimalString(balanceHex), token.decimals);
      if (balance > 0) {
        const tokenDetailResponse = await getOkxOnchainTokenDetail(chainIndex, token.address);
        const logoUrl = tokenDetailResponse.data?.[0]?.logoUrl;
        const resolvedPrice = await resolveWalletAssetPrice({
          chainIndex,
          tokenAddress: token.address,
          symbol: token.symbol,
          fallbackPrice: toNumber(priceMap[token.coingeckoId]),
        });
        assets.push(
          buildWalletAssetItem({
            chainIndex,
            chainName,
            address: walletAddress,
            tokenAddress: token.address,
            symbol: token.symbol,
            tokenName: token.tokenName,
            balance,
            tokenPrice: resolvedPrice.price,
            logoUrl,
            priceSource: resolvedPrice.source,
            priceUpdatedAt: resolvedPrice.updatedAt,
          }),
        );
      }
    } catch (err) {
      console.error(`Failed to fetch token balance for ${token.symbol} on ${chainName}:`, err);
    }
  }

  return assets;
}

async function getSolanaWalletAssets(
  walletAddress: string,
  priceMap: Record<string, number>,
): Promise<WalletAssetItem[]> {
  const assets: WalletAssetItem[] = [];
  const metadataMap = await getSolanaTokenMetadataMap();

  try {
    const balanceLamports = await postRpc<number>(SOLANA_RPC_URL, 'getBalance', [walletAddress]);
    const balance = balanceLamports / 1e9;
    if (balance > 0) {
      const resolvedPrice = await resolveWalletAssetPrice({
        chainIndex: '101',
        tokenAddress: '-',
        symbol: 'SOL',
        fallbackPrice: toNumber(priceMap.solana),
      });
      assets.push(
        buildWalletAssetItem({
          chainIndex: '101',
          chainName: 'Solana',
          address: walletAddress,
          tokenAddress: '-',
          symbol: 'SOL',
          tokenName: 'Solana',
          balance,
          tokenPrice: resolvedPrice.price,
          logoUrl: 'https://www.okx.com/cdn/assets/imgs/221/61088B116630C60C.png',
          priceSource: resolvedPrice.source,
          priceUpdatedAt: resolvedPrice.updatedAt,
        }),
      );
    }
  } catch (err) {
    console.error('Failed to fetch Solana native balance:', err);
  }

  try {
    const tokenAccounts = await postRpc<{
      value: { pubkey: string; account: { data: [string, string]; space: number } }[];
    }>(SOLANA_RPC_URL, 'getTokenAccountsByOwner', [
      walletAddress,
      { programId: SOLANA_TOKEN_PROGRAM_IDS[0] },
      { encoding: 'jsonParsed' },
    ]);

    for (const item of tokenAccounts.value) {
      const info = item.account.data[0] as unknown as { parsed?: { info?: SolanaTokenAccountInfo } };
      const tokenInfo = info.parsed?.info;
      if (!tokenInfo || !metadataMap[tokenInfo.mint]) {
        continue;
      }
      const metadata = metadataMap[tokenInfo.mint];
      const tokenDetailResponse = await getOkxOnchainTokenDetail(
        '101', // Solana chainIndex
        metadata.mint,
      );
      const resolvedPrice = await resolveWalletAssetPrice({
        chainIndex: '101',
        tokenAddress: metadata.mint,
        symbol: metadata.symbol,
        fallbackPrice: toNumber(priceMap[metadata.coingeckoId]),
      });
      assets.push(
        buildWalletAssetItem({
          chainIndex: '101',
          chainName: 'Solana',
          address: walletAddress,
          tokenAddress: metadata.mint,
          symbol: metadata.symbol,
          tokenName: metadata.tokenName,
          balance: tokenInfo.uiAmount,
          tokenPrice: resolvedPrice.price,
          logoUrl: tokenDetailResponse.data?.[0]?.logoUrl,
          priceSource: resolvedPrice.source,
          priceUpdatedAt: resolvedPrice.updatedAt,
        }),
      );
    }
  } catch (err) {
    console.error('Failed to fetch Solana token balances:', err);
  }

  return assets;
}

export async function getAccountAssets(wallet: StoredWalletSnapshot): Promise<AgentWalletAssetsResponse> {
  if (!wallet?.evmAddress || !wallet.solanaAddress) {
    throw new Error('钱包地址不存在，请先登录并创建 Agent Wallet');
  }

  if (wallet.mockMode) {
    throw new Error('当前钱包仍是演示模式，无法查询真实链上资产');
  }

  // 直接通过 OKX onchainos-skills MCP 获取真实链上余额与持仓。
  const [evmAssets, solanaAssets] = await Promise.all([
    getWalletAssetsByMcp(wallet.evmAddress, OKX_MCP_EVM_CHAINS),
    getWalletAssetsByMcp(wallet.solanaAddress, OKX_MCP_SOLANA_CHAINS),
  ]);

  const allAssets = [...evmAssets, ...solanaAssets].sort(
    (left, right) => toNumber(right.valueUsd) - toNumber(left.valueUsd),
  );

  const walletAddresses = allAssets.reduce<
    { chainIndex: string; chainName: string; address: string; assets: WalletAssetItem[] }[]
  >((acc, asset) => {
    let chain = acc.find((item) => item.chainIndex === asset.chainIndex);
    if (!chain) {
      chain = {
        chainIndex: asset.chainIndex,
        chainName: asset.chainName,
        address: asset.address,
        assets: [],
      };
      acc.push(chain);
    }
    chain.assets.push(asset);
    return acc;
  }, []);

  if (!walletAddresses.find((item) => item.address === wallet.evmAddress)) {
    walletAddresses.unshift({
      chainIndex: '1',
      chainName: 'Ethereum',
      address: wallet.evmAddress,
      assets: [],
    });
  }

  if (!walletAddresses.find((item) => item.address === wallet.solanaAddress)) {
    walletAddresses.push({
      chainIndex: '501',
      chainName: 'Solana',
      address: wallet.solanaAddress,
      assets: [],
    });
  }

  const totalAssetValue = allAssets.reduce((sum, asset) => sum + toNumber(asset.valueUsd), 0);

  return {
    success: true,
    mockMode: false,
    source: 'okx-mcp',
    totalAssetValue: totalAssetValue.toString(),
    walletAddresses,
    updatedAt: new Date().toISOString(),
  };
}

export async function parseDexSwapIntent(message: string): Promise<DexIntentResponse> {
  return (await apiCall('/api/dex/intent', {
    method: 'POST',
    body: JSON.stringify({ message }),
  })) as DexIntentResponse;
}

export async function parseChatAiIntent(params: { message: string; wallet?: StoredWalletSnapshot }): Promise<ChatAiIntentResponse> {
  return (await apiCall('/api/chat/intent', {
    method: 'POST',
    body: JSON.stringify(params),
  })) as ChatAiIntentResponse;
}

export async function getDexSwapQuote(payload: DexQuotePayload): Promise<DexQuoteResponse> {
  return (await apiCall('/api/dex/quote', {
    method: 'POST',
    body: JSON.stringify(payload),
  })) as DexQuoteResponse;
}

export async function previewOnchainSwap(payload: DexQuotePayload): Promise<OnchainPreviewResponse> {
  return (await apiCall('/api/onchain/preview', {
    method: 'POST',
    body: JSON.stringify(payload),
  })) as OnchainPreviewResponse;
}

export async function executeDexSwap(payload: DexExecutePayload): Promise<DexExecuteResponse> {
  return (await apiCall('/api/dex/execute', {
    method: 'POST',
    body: JSON.stringify(payload),
  })) as DexExecuteResponse;
}

export async function executeOnchainSwap(payload: DexExecutePayload): Promise<OnchainExecuteResponse> {
  return (await apiCall('/api/onchain/execute', {
    method: 'POST',
    body: JSON.stringify(payload),
  })) as OnchainExecuteResponse;
}

export async function getDexSwapOrders(params: { address: string; chainIndex: string; orderId?: string; limit?: string }): Promise<DexOrdersResponse> {
  const query = new URLSearchParams();
  query.append("address", params.address);
  query.append("chainIndex", params.chainIndex);
  if (params.orderId) {
    query.append("orderId", params.orderId);
  }
  if (params.limit) {
    query.append("limit", params.limit);
  }
  return (await apiCall(`/api/dex/orders?${query.toString()}`)) as DexOrdersResponse;
}

export async function getOnchainExecutionReceipt(params: {
  address: string;
  chainIndex: string;
  orderId?: string;
  txStatus?: string;
  limit?: string;
}): Promise<OnchainExecutionReceiptResponse> {
  const query = new URLSearchParams();
  query.append('address', params.address);
  query.append('chainIndex', params.chainIndex);
  if (params.orderId) {
    query.append('orderId', params.orderId);
  }
  if (params.txStatus) {
    query.append('txStatus', params.txStatus);
  }
  if (params.limit) {
    query.append('limit', params.limit);
  }
  return (await apiCall(`/api/onchain/receipt?${query.toString()}`)) as OnchainExecutionReceiptResponse;
}

export type StrategyRawToolResult = Record<string, unknown>;

export type StrategyStatusResponse = {
  gridSpotActive: StrategyRawToolResult;
  gridContractActive: StrategyRawToolResult;
  dcaSpotActive: StrategyRawToolResult;
  dcaContractActive: StrategyRawToolResult;
  toolList: StrategyRawToolResult;
};

export type StrategyPerformanceResponse = {
  balance: StrategyRawToolResult;
  bills: StrategyRawToolResult;
  swapPositionsHistory: StrategyRawToolResult;
  futuresPositionsHistory: StrategyRawToolResult;
};

export type StrategyPositionsResponse = {
  positions: StrategyRawToolResult;
  balance: StrategyRawToolResult;
};

export type StrategyLogsResponse = {
  spotFills: StrategyRawToolResult;
  swapFills: StrategyRawToolResult;
  futuresFills: StrategyRawToolResult;
  spotOrders: StrategyRawToolResult;
  swapOrders: StrategyRawToolResult;
  futuresOrders: StrategyRawToolResult;
  tradeHistory: StrategyRawToolResult;
};

export async function getStrategyStatus(): Promise<StrategyStatusResponse> {
  return (await apiCall('/api/strategy/status')) as StrategyStatusResponse;
}

export async function getStrategyPerformance(): Promise<StrategyPerformanceResponse> {
  return (await apiCall('/api/strategy/performance')) as StrategyPerformanceResponse;
}

export async function getStrategyPositions(): Promise<StrategyPositionsResponse> {
  return (await apiCall('/api/strategy/positions')) as StrategyPositionsResponse;
}

export async function getStrategyLogs(): Promise<StrategyLogsResponse> {
  return (await apiCall('/api/strategy/logs')) as StrategyLogsResponse;
}
