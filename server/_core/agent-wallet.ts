import crypto from "crypto";

const OTP_TTL_MS = 10 * 60 * 1000;
const MOCK_LOGIN_METHOD = "agent_wallet_email";
const OKX_BASE_URL = "https://www.okx.com";
const SEND_EMAIL_CODE_PATH = "/api/v5/waas/account/send-email-verify-code";
const LOGIN_PATH = "/api/v5/waas/account/login";
const ACCOUNT_WALLETS_PATH = "/api/v5/waas/wallet/account-wallets";

type PendingOtp = {
  code: string;
  expiresAt: number;
  requestId: string;
};

type WalletRecord = {
  evmAddress: string;
  solanaAddress: string;
  createdAt: number;
};

type SendOtpResponse = {
  success: true;
  requestId: string;
  maskedEmail: string;
  expiresIn: number;
  mockMode: boolean;
  message: string;
  debugCode?: string;
};

type VerifyOtpInput = {
  email: string;
  code: string;
};

type VerifyOtpResponse = {
  success: true;
  wallet: {
    email: string;
    evmAddress: string;
    solanaAddress: string;
  };
  isNewWallet: boolean;
  sessionUser: {
    openId: string;
    name: string;
    email: string;
    loginMethod: string;
  };
  mockMode: boolean;
};

type AnyRecord = Record<string, any>;

const pendingOtpStore = new Map<string, PendingOtp>();
const walletStore = new Map<string, WalletRecord>();

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeOtpCode(code: string) {
  return String(code ?? "")
    .trim()
    .replace(/[^0-9A-Za-z]/g, "");
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function maskEmail(email: string) {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return email;
  if (localPart.length <= 2) {
    return `${localPart[0] ?? "*"}***@${domain}`;
  }
  return `${localPart.slice(0, 2)}***${localPart.slice(-1)}@${domain}`;
}

function buildRequestId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function getMockOtpCode() {
  return normalizeOtpCode(process.env.OKX_AGENT_WALLET_MOCK_OTP || "123456");
}

function buildDeterministicWallet(email: string): WalletRecord {
  const evmSeed = crypto.createHash("sha256").update(`evm:${email}`).digest("hex");
  const solSeed = crypto.createHash("sha256").update(`sol:${email}`).digest("hex");

  return {
    evmAddress: `0x${evmSeed.slice(0, 40)}`,
    solanaAddress: `So${solSeed.slice(0, 42)}`,
    createdAt: Date.now(),
  };
}

function buildSessionUser(email: string, remoteId?: string) {
  const normalizedEmail = normalizeEmail(email);
  const openIdSeed = remoteId?.trim()
    ? remoteId.trim()
    : crypto.createHash("sha256").update(`okx-agent-wallet:${normalizedEmail}`).digest("hex");

  return {
    openId: `okx-agent-wallet:${openIdSeed.slice(0, 32)}`,
    name: normalizedEmail.split("@")[0] || "H Wallet User",
    email: normalizedEmail,
    loginMethod: MOCK_LOGIN_METHOD,
  };
}

function getEnv(names: string | string[]) {
  const list = Array.isArray(names) ? names : [names];
  for (const name of list) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function getOkxBaseUrl() {
  return getEnv(["OKX_AGENT_WALLET_BASE_URL", "OKX_BASE_URL"]).replace(/\/$/, "") || OKX_BASE_URL;
}

function getOkxApiKey() {
  return getEnv(["OKX_AGENT_WALLET_API_KEY", "OKX_API_KEY"]);
}

function getOkxSecretKey() {
  return getEnv(["OKX_AGENT_WALLET_SECRET_KEY", "OKX_SECRET_KEY"]);
}

function getOkxPassphrase() {
  return getEnv(["OKX_AGENT_WALLET_PASSPHRASE", "OKX_PASSPHRASE"]);
}

function isRealOkxConfigured() {
  return Boolean(getOkxApiKey() && getOkxSecretKey() && getOkxPassphrase());
}

function buildSignedHeaders(method: string, requestPath: string, body: string) {
  const timestamp = new Date().toISOString();
  const secretKey = getOkxSecretKey();
  const signaturePayload = `${timestamp}${method.toUpperCase()}${requestPath}${body}`;
  const signature = crypto.createHmac("sha256", secretKey).update(signaturePayload).digest("base64");

  return {
    "Content-Type": "application/json",
    "OK-ACCESS-KEY": getOkxApiKey(),
    "OK-ACCESS-PASSPHRASE": getOkxPassphrase(),
    "OK-ACCESS-SIGN": signature,
    "OK-ACCESS-TIMESTAMP": timestamp,
  };
}

async function callOkxApi(method: "GET" | "POST", requestPath: string, payload?: Record<string, unknown>) {
  const baseUrl = getOkxBaseUrl();
  const body = method === "POST" ? JSON.stringify(payload ?? {}) : "";
  const url = `${baseUrl}${requestPath}`;
  const headers = buildSignedHeaders(method, requestPath, body);

  const response = await fetch(url, {
    method,
    headers,
    body: method === "POST" ? body : undefined,
  });

  const text = await response.text();
  let data: AnyRecord = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  const code = typeof data.code === "string" ? data.code : "0";
  if (!response.ok || (code && code !== "0")) {
    throw new Error(
      data.msg || data.message || data.error_message || data.error || `OKX request failed: ${response.status}`,
    );
  }

  return data;
}

function extractFirstString(data: AnyRecord, candidates: string[]) {
  for (const candidate of candidates) {
    const value = candidate.split(".").reduce<any>((acc, key) => (acc ? acc[key] : undefined), data);
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return "";
}

function extractFirstBoolean(data: AnyRecord, candidates: string[]) {
  for (const candidate of candidates) {
    const value = candidate.split(".").reduce<any>((acc, key) => (acc ? acc[key] : undefined), data);
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
    }
  }
  return false;
}

function extractCandidateArrays(data: AnyRecord) {
  const candidates = [
    data?.data,
    data?.data?.[0],
    data?.data?.wallets,
    data?.data?.accountWallets,
    data?.wallets,
    data?.accountWallets,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object") {
      const nestedArrays = Object.values(candidate).filter(Array.isArray);
      if (nestedArrays.length > 0) {
        return nestedArrays[0] as AnyRecord[];
      }
    }
  }

  return [] as AnyRecord[];
}

function classifyWalletAddress(item: AnyRecord) {
  const address = extractFirstString(item, [
    "walletAddress",
    "address",
    "accountAddress",
    "addr",
    "wallet.address",
  ]);

  if (!address) {
    return { chainKind: "", address: "" };
  }

  const chainText = [
    item.chainType,
    item.chainName,
    item.network,
    item.symbol,
    item.walletType,
    item.chain,
    item.coinType,
    item.protocol,
  ]
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();

  if (address.startsWith("0x") || /evm|eth|ethereum|bsc|base|arb|op|polygon|avax/.test(chainText)) {
    return { chainKind: "evm", address };
  }

  if (/sol|solana/.test(chainText) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return { chainKind: "solana", address };
  }

  return { chainKind: "", address };
}

async function sendOtpByOkx(email: string): Promise<SendOtpResponse> {
  const data = await callOkxApi("POST", SEND_EMAIL_CODE_PATH, {
    email,
    codeType: 1,
  });

  const requestId =
    extractFirstString(data, ["msgId", "data.msgId", "requestId", "data.requestId", "traceId"]) ||
    buildRequestId("okxreq");

  return {
    success: true,
    requestId,
    maskedEmail: maskEmail(email),
    expiresIn: 600,
    mockMode: false,
    message: extractFirstString(data, ["msg", "message", "data.message"]) || "验证码已发送，请查收邮箱",
  };
}

async function fetchWalletsByAccountId(accountId: string) {
  const query = new URLSearchParams({ accountId });
  return callOkxApi("GET", `${ACCOUNT_WALLETS_PATH}?${query.toString()}`);
}

async function verifyOtpByOkx({ email, code }: VerifyOtpInput): Promise<VerifyOtpResponse> {
  const loginData = await callOkxApi("POST", LOGIN_PATH, {
    email,
    emailVerifyCode: code,
  });

  const accountId = extractFirstString(loginData, [
    "accountId",
    "data.accountId",
    "data.0.accountId",
    "data.accountInfo.accountId",
    "data.userInfo.accountId",
    "userInfo.accountId",
    "uid",
    "data.uid",
  ]);

  const remoteId =
    accountId ||
    extractFirstString(loginData, ["openId", "data.openId", "userId", "data.userId", "sub", "data.sub"]);

  let evmAddress = extractFirstString(loginData, [
    "evmAddress",
    "data.evmAddress",
    "wallet.evmAddress",
    "data.wallet.evmAddress",
    "addresses.evm",
    "data.addresses.evm",
  ]);
  let solanaAddress = extractFirstString(loginData, [
    "solanaAddress",
    "data.solanaAddress",
    "wallet.solanaAddress",
    "data.wallet.solanaAddress",
    "addresses.solana",
    "data.addresses.solana",
  ]);

  if (accountId) {
    const walletData = await fetchWalletsByAccountId(accountId);
    const items = extractCandidateArrays(walletData);
    for (const item of items) {
      const classified = classifyWalletAddress(item);
      if (classified.chainKind === "evm" && !evmAddress) {
        evmAddress = classified.address;
      }
      if (classified.chainKind === "solana" && !solanaAddress) {
        solanaAddress = classified.address;
      }
    }
  }

  if (!evmAddress || !solanaAddress) {
    throw new Error("OKX Agent Wallet 登录成功，但未返回完整钱包地址");
  }

  return {
    success: true,
    wallet: {
      email,
      evmAddress,
      solanaAddress,
    },
    isNewWallet: extractFirstBoolean(loginData, ["isNewWallet", "data.isNewWallet", "isCreated", "data.isCreated"]),
    sessionUser: buildSessionUser(email, remoteId || email),
    mockMode: false,
  };
}

export function getAgentWalletProviderMode() {
  return isRealOkxConfigured() ? "okx" : "mock";
}

export async function sendWalletOtp(email: string): Promise<SendOtpResponse> {
  const normalizedEmail = normalizeEmail(email);
  if (!validateEmail(normalizedEmail)) {
    throw new Error("请输入有效的邮箱地址");
  }

  if (isRealOkxConfigured()) {
    try {
      return await sendOtpByOkx(normalizedEmail);
    } catch (error) {
      console.warn("[Agent Wallet] sendWalletOtp fallback to mock:", error);
      if (getEnv("OKX_AGENT_WALLET_STRICT") === "1") {
        throw error;
      }
    }
  }

  const code = getMockOtpCode();
  const requestId = buildRequestId("mockotp");
  pendingOtpStore.set(normalizedEmail, {
    code,
    expiresAt: Date.now() + OTP_TTL_MS,
    requestId,
  });

  return {
    success: true,
    requestId,
    maskedEmail: maskEmail(normalizedEmail),
    expiresIn: Math.floor(OTP_TTL_MS / 1000),
    mockMode: true,
    message: "验证码已发送到你的邮箱（当前为演示模式）",
    // 仅在本地开发环境返回debugCode，不在任何远程环境暴露
    debugCode: process.env.NODE_ENV === "development" && process.env.VITE_APP_ENV === "local" ? code : undefined,
  };
}

export async function verifyWalletOtp(input: VerifyOtpInput): Promise<VerifyOtpResponse> {
  const email = normalizeEmail(input.email);
  const code = normalizeOtpCode(input.code);

  if (!validateEmail(email)) {
    throw new Error("请输入有效的邮箱地址");
  }

  if (!code) {
    throw new Error("请输入验证码");
  }

  if (isRealOkxConfigured()) {
    try {
      return await verifyOtpByOkx({ email, code });
    } catch (error) {
      console.warn("[Agent Wallet] verifyWalletOtp fallback to mock:", error);
      if (getEnv("OKX_AGENT_WALLET_STRICT") === "1") {
        throw error;
      }
    }
  }

  const mockCode = getMockOtpCode();
  const pending = pendingOtpStore.get(email);

  if (!pending) {
    if (code !== mockCode) {
      throw new Error("请先获取验证码");
    }
  } else {
    if (pending.expiresAt < Date.now()) {
      pendingOtpStore.delete(email);
      throw new Error("验证码已过期，请重新获取");
    }

    const expectedCode = normalizeOtpCode(pending.code);
    if (code !== expectedCode && code !== mockCode) {
      throw new Error("验证码错误，请重新输入");
    }

    pendingOtpStore.delete(email);
  }

  const existingWallet = walletStore.get(email);
  const wallet = existingWallet ?? buildDeterministicWallet(email);
  if (!existingWallet) {
    walletStore.set(email, wallet);
  }

  return {
    success: true,
    wallet: {
      email,
      evmAddress: wallet.evmAddress,
      solanaAddress: wallet.solanaAddress,
    },
    isNewWallet: !existingWallet,
    sessionUser: buildSessionUser(email),
    mockMode: true,
  };
}
