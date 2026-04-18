import crypto from "node:crypto";

const OTP_TTL_MS = 10 * 60 * 1000;
const LOGIN_METHOD = "agent_wallet_email";
const OKX_BASE_URL = "https://web3.okx.com";
const AUTH_INIT_PATH = "/priapi/v5/wallet/agentic/auth/init";
const AUTH_VERIFY_PATH = "/priapi/v5/wallet/agentic/auth/verify";
const ACCOUNT_CREATE_PATH = "/priapi/v5/wallet/agentic/account/create";
const ACCOUNT_LIST_PATH = "/priapi/v5/wallet/agentic/account/list";
const ACCOUNT_ADDRESS_LIST_PATH = "/priapi/v5/wallet/agentic/account/address/list";
const OKX_CLIENT_VERSION = process.env.OKX_CLIENT_VERSION?.trim() || "1.0.0";

type PendingOtp = {
  flowId: string;
  tempPubKey: string;
  expiresAt: number;
};

type SendOtpResponse = {
  success: true;
  requestId: string;
  maskedEmail: string;
  expiresIn: number;
  mockMode: boolean;
  message: string;
};

type VerifyOtpInput = {
  email: string;
  code: string;
  requestId?: string;
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

type RequestState = {
  email: string;
  flowId: string;
  tempPubKey: string;
  issuedAt: number;
};

const pendingOtpStore = new Map<string, PendingOtp>();

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

function buildSessionUser(email: string, remoteId?: string) {
  const normalizedEmail = normalizeEmail(email);
  const openIdSeed = remoteId?.trim()
    ? remoteId.trim()
    : crypto.createHash("sha256").update(`okx-agent-wallet:${normalizedEmail}`).digest("hex");

  return {
    openId: `okx-agent-wallet:${openIdSeed.slice(0, 32)}`,
    name: normalizedEmail.split("@")[0] || "H Wallet User",
    email: normalizedEmail,
    loginMethod: LOGIN_METHOD,
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

function getOkxProjectId() {
  return getEnv(["OKX_AGENT_WALLET_PROJECT_ID", "OKX_PROJECT_ID", "OKX_ACCESS_PROJECT"]);
}

function isRealOkxConfigured() {
  return Boolean(getOkxProjectId());
}

function assertRealOkxConfigured() {
  const missing = [["OKX_AGENT_WALLET_PROJECT_ID / OKX_PROJECT_ID / OKX_ACCESS_PROJECT", getOkxProjectId()]]
    .filter(([, value]) => !value)
    .map(([label]) => label);

  if (missing.length > 0) {
    throw new Error(`OKX Agent Wallet 未配置完整，缺少：${missing.join("、")}`);
  }
}

function buildAnonymousHeaders() {
  return {
    "Content-Type": "application/json",
    "ok-client-version": OKX_CLIENT_VERSION,
    "Ok-Access-Client-type": "agent-cli",
  } as Record<string, string>;
}

function buildJwtHeaders(accessToken: string) {
  return {
    ...buildAnonymousHeaders(),
    Authorization: `Bearer ${accessToken}`,
  } as Record<string, string>;
}

async function parseOkxResponse(response: Response) {
  const text = await response.text();
  let body: AnyRecord = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  const codeValue = body?.code;
  const code = typeof codeValue === "number" ? String(codeValue) : typeof codeValue === "string" ? codeValue : "";
  if (!response.ok || (code && code !== "0")) {
    throw new Error(
      body?.msg || body?.message || body?.error_message || body?.error || `OKX request failed: ${response.status}`,
    );
  }

  return body?.data;
}

async function callOkxPublicPost(requestPath: string, payload: Record<string, unknown>) {
  const url = `${getOkxBaseUrl()}${requestPath}`;
  const response = await fetch(url, {
    method: "POST",
    headers: buildAnonymousHeaders(),
    body: JSON.stringify(payload ?? {}),
  });
  return parseOkxResponse(response);
}

async function callOkxJwtPost(requestPath: string, accessToken: string, payload: Record<string, unknown>) {
  const url = `${getOkxBaseUrl()}${requestPath}`;
  const response = await fetch(url, {
    method: "POST",
    headers: buildJwtHeaders(accessToken),
    body: JSON.stringify(payload ?? {}),
  });
  return parseOkxResponse(response);
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
    if (typeof value === "number") {
      return value !== 0;
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true" || normalized === "1") return true;
      if (normalized === "false" || normalized === "0") return false;
    }
  }
  return false;
}

function getFirstDataItem(data: unknown) {
  if (Array.isArray(data)) {
    return (data[0] ?? {}) as AnyRecord;
  }
  if (data && typeof data === "object") {
    return data as AnyRecord;
  }
  return {} as AnyRecord;
}

function classifyWalletAddress(item: AnyRecord) {
  const address = extractFirstString(item, [
    "address",
    "walletAddress",
    "accountAddress",
    "addr",
  ]);

  if (!address) {
    return { chainKind: "", address: "" };
  }

  const chainText = [
    item.chainName,
    item.chainPath,
    item.addressType,
    item.walletType,
    item.network,
    item.symbol,
    item.protocol,
    item.chainType,
    item.chain,
    item.chainIndex,
  ]
    .filter((value) => typeof value === "string" || typeof value === "number")
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

function collectAddresses(items: AnyRecord[]) {
  let evmAddress = "";
  let solanaAddress = "";

  for (const item of items) {
    const classified = classifyWalletAddress(item);
    if (classified.chainKind === "evm" && !evmAddress) {
      evmAddress = classified.address;
    }
    if (classified.chainKind === "solana" && !solanaAddress) {
      solanaAddress = classified.address;
    }
  }

  return { evmAddress, solanaAddress };
}

function buildEncodedRequestId(state: RequestState) {
  return Buffer.from(JSON.stringify(state)).toString("base64url");
}

function parseRequestState(requestId: string, email: string) {
  try {
    const parsed = JSON.parse(Buffer.from(requestId, "base64url").toString("utf8")) as Partial<RequestState>;
    if (
      parsed &&
      normalizeEmail(parsed.email || "") === normalizeEmail(email) &&
      typeof parsed.flowId === "string" &&
      parsed.flowId.trim() &&
      typeof parsed.tempPubKey === "string" &&
      parsed.tempPubKey.trim()
    ) {
      return {
        email: normalizeEmail(typeof parsed.email === "string" ? parsed.email : email),
        flowId: parsed.flowId.trim(),
        tempPubKey: parsed.tempPubKey.trim(),
        issuedAt: Number(parsed.issuedAt || Date.now()),
      } as RequestState;
    }
  } catch {
    return null;
  }
  return null;
}

function generateTempPubKey() {
  const { publicKey } = crypto.generateKeyPairSync("x25519");
  const publicDer = publicKey.export({ format: "der", type: "spki" });
  const rawPublicKey = Buffer.from(publicDer).subarray(-32);
  return rawPublicKey.toString("base64");
}

async function ensureAccountAddresses(accessToken: string, projectId: string, accountIdHint?: string) {
  const accountListData = await callOkxJwtPost(ACCOUNT_LIST_PATH, accessToken, {
    projectId,
  });

  let accountList = Array.isArray(accountListData) ? (accountListData as AnyRecord[]) : [];
  if (accountIdHint) {
    const matched = accountList.filter((item) => extractFirstString(item, ["accountId"]) === accountIdHint);
    if (matched.length > 0) {
      accountList = matched;
    }
  }

  if (accountList.length === 0) {
    const createData = await callOkxJwtPost(ACCOUNT_CREATE_PATH, accessToken, {
      projectId,
    });
    const created = getFirstDataItem(createData);
    const directAddresses = Array.isArray(created.addressList) ? created.addressList : [];
    if (directAddresses.length > 0) {
      return directAddresses as AnyRecord[];
    }
    const createdAccountId = extractFirstString(created, ["accountId"]);
    if (createdAccountId) {
      accountList = [{ accountId: createdAccountId }];
    }
  }

  const accountIds = accountList
    .map((item) => extractFirstString(item, ["accountId"]))
    .filter(Boolean);

  if (accountIds.length === 0) {
    return [] as AnyRecord[];
  }

  const addressData = await callOkxJwtPost(ACCOUNT_ADDRESS_LIST_PATH, accessToken, {
    accountIds,
  });

  const root = getFirstDataItem(addressData);
  const accounts = Array.isArray(root.accounts) ? root.accounts : [];
  return accounts.flatMap((account) => (Array.isArray(account.addresses) ? account.addresses : []));
}

async function sendOtpByOkx(email: string): Promise<SendOtpResponse> {
  const tempPubKey = generateTempPubKey();
  const data = await callOkxPublicPost(AUTH_INIT_PATH, {
    email,
    locale: "en-US",
  });

  const item = getFirstDataItem(data);
  const flowId = extractFirstString(item, ["flowId", "flow_id"]);
  if (!flowId) {
    throw new Error("OKX Agent Wallet 未返回 flowId，无法继续验证码校验");
  }

  const requestState: RequestState = {
    email,
    flowId,
    tempPubKey,
    issuedAt: Date.now(),
  };

  pendingOtpStore.set(email, {
    flowId,
    tempPubKey,
    expiresAt: Date.now() + OTP_TTL_MS,
  });

  return {
    success: true,
    requestId: buildEncodedRequestId(requestState),
    maskedEmail: maskEmail(email),
    expiresIn: 600,
    mockMode: false,
    message: "验证码已发送，请查收邮箱",
  };
}

async function verifyOtpByOkx({ email, code, requestId }: VerifyOtpInput): Promise<VerifyOtpResponse> {
  const requestState =
    (requestId ? parseRequestState(requestId, email) : null) ||
    (() => {
      const cached = pendingOtpStore.get(email);
      if (cached && cached.expiresAt > Date.now()) {
        return {
          email,
          flowId: cached.flowId,
          tempPubKey: cached.tempPubKey,
          issuedAt: Date.now(),
        } as RequestState;
      }
      return null;
    })();

  if (!requestState?.flowId || !requestState?.tempPubKey) {
    throw new Error("验证码会话已失效，请重新获取验证码");
  }

  const verifyData = await callOkxPublicPost(AUTH_VERIFY_PATH, {
    email,
    flowId: requestState.flowId,
    otp: code,
    tempPubKey: requestState.tempPubKey,
  });

  const verifyItem = getFirstDataItem(verifyData);
  const accessToken = extractFirstString(verifyItem, ["accessToken", "access_token"]);
  const accountId = extractFirstString(verifyItem, ["accountId", "account_id"]);
  const remoteId = accountId || extractFirstString(verifyItem, ["projectId", "project_id", "accountName"]);
  const projectId = extractFirstString(verifyItem, ["projectId", "project_id"]) || getOkxProjectId();

  let addressItems = Array.isArray(verifyItem.addressList) ? (verifyItem.addressList as AnyRecord[]) : [];
  if ((!addressItems || addressItems.length === 0) && accessToken && projectId) {
    addressItems = await ensureAccountAddresses(accessToken, projectId, accountId);
  }

  const { evmAddress, solanaAddress } = collectAddresses(addressItems);
  if (!evmAddress || !solanaAddress) {
    throw new Error("OKX Agent Wallet 登录成功，但未返回完整的钱包地址");
  }

  pendingOtpStore.delete(email);

  return {
    success: true,
    wallet: {
      email,
      evmAddress,
      solanaAddress,
    },
    isNewWallet: extractFirstBoolean(verifyItem, ["isNew", "is_new"]),
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

  assertRealOkxConfigured();
  return sendOtpByOkx(normalizedEmail);
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

  assertRealOkxConfigured();
  return verifyOtpByOkx({ email, code, requestId: input.requestId });
}
