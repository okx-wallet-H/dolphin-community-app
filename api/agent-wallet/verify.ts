import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHmac } from "node:crypto";

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const setCors = (res: VercelResponse) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
};

const parseBody = (req: VercelRequest) => {
  if (!req.body) return {} as Record<string, unknown>;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {} as Record<string, unknown>;
    }
  }
  return req.body as Record<string, unknown>;
};

const normalizeEmail = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const normalizeCode = (value: unknown) =>
  typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const base64url = (input: string | Buffer) =>
  Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const signSessionToken = (payload: Record<string, unknown>, secret: string) => {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

const getSupabaseEnv = () => ({
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
});

async function supabaseFetchJson(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`Supabase request failed: ${response.status} ${text}`);
  }
  return data;
}

async function getLatestVerificationCode(params: {
  supabaseUrl: string;
  supabaseAnonKey: string;
  email: string;
  code: string;
}) {
  const query = new URLSearchParams({
    select: "id,email,code,expires_at,created_at",
    email: `eq.${params.email}`,
    code: `eq.${params.code}`,
    order: "created_at.desc",
    limit: "1",
  });

  const data = await supabaseFetchJson(`${params.supabaseUrl}/rest/v1/verification_codes?${query.toString()}`, {
    method: "GET",
    headers: {
      apikey: params.supabaseAnonKey,
      Authorization: `Bearer ${params.supabaseAnonKey}`,
      "Content-Type": "application/json",
    },
  });

  return Array.isArray(data) ? data[0] ?? null : null;
}

async function ensureUser(params: { supabaseUrl: string; supabaseAnonKey: string; email: string }) {
  const query = new URLSearchParams({
    select: "id,email",
    email: `eq.${params.email}`,
    limit: "1",
  });

  const users = await supabaseFetchJson(`${params.supabaseUrl}/rest/v1/users?${query.toString()}`, {
    method: "GET",
    headers: {
      apikey: params.supabaseAnonKey,
      Authorization: `Bearer ${params.supabaseAnonKey}`,
      "Content-Type": "application/json",
    },
  });

  if (Array.isArray(users) && users[0]) {
    return users[0];
  }

  const inserted = await supabaseFetchJson(`${params.supabaseUrl}/rest/v1/users`, {
    method: "POST",
    headers: {
      apikey: params.supabaseAnonKey,
      Authorization: `Bearer ${params.supabaseAnonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify([{ email: params.email }]),
  });

  return Array.isArray(inserted) ? inserted[0] ?? null : inserted;
}

async function deleteVerificationCodes(params: { supabaseUrl: string; supabaseAnonKey: string; email: string }) {
  await fetch(`${params.supabaseUrl}/rest/v1/verification_codes?email=eq.${encodeURIComponent(params.email)}`, {
    method: "DELETE",
    headers: {
      apikey: params.supabaseAnonKey,
      Authorization: `Bearer ${params.supabaseAnonKey}`,
    },
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  const body = parseBody(req);
  const email = normalizeEmail(body.email ?? body.walletEmail ?? body.account);
  const code = normalizeCode(body.code ?? body.otp ?? body.verificationCode);

  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: "INVALID_EMAIL" });
  }

  if (!code) {
    return res.status(400).json({ ok: false, error: "INVALID_CODE" });
  }

  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({
      ok: false,
      error: "SUPABASE_NOT_CONFIGURED",
      message: "缺少 Supabase 环境变量",
    });
  }

  try {
    const record = await getLatestVerificationCode({
      supabaseUrl,
      supabaseAnonKey,
      email,
      code,
    });

    if (!record) {
      return res.status(400).json({ ok: false, error: "INVALID_OR_EXPIRED_CODE" });
    }

    if (!record.expires_at || new Date(record.expires_at).getTime() <= Date.now()) {
      return res.status(400).json({ ok: false, error: "INVALID_OR_EXPIRED_CODE" });
    }

    await ensureUser({ supabaseUrl, supabaseAnonKey, email });
    await deleteVerificationCodes({ supabaseUrl, supabaseAnonKey, email });

    const secret = process.env.JWT_SECRET || "h-wallet-dev-secret";
    const appId = process.env.VITE_APP_ID || "new-h-wallet";
    const name = email.split("@")[0] || "wallet-user";
    const openId = `wallet:${email}`;
    const exp = Math.floor((Date.now() + ONE_YEAR_MS) / 1000);
    const app_session_id = signSessionToken({ openId, appId, name, exp }, secret);
    const maxAge = Math.floor(ONE_YEAR_MS / 1000);

    res.setHeader(
      "Set-Cookie",
      `app_session_id=${app_session_id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Secure`,
    );

    return res.status(200).json({
      ok: true,
      success: true,
      app_session_id,
      user: {
        openId,
        name,
        email,
        loginMethod: "email",
      },
      wallet: {
        address: `0x${createHmac("sha256", email).update(email).digest("hex").slice(0, 40)}`,
        chain: "EVM",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[verify] failed:", message);
    return res.status(500).json({
      ok: false,
      error: "VERIFY_FAILED",
      message,
    });
  }
}
