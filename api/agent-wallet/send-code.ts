import type { VercelRequest, VercelResponse } from "@vercel/node";

const OTP_TTL_MS = 10 * 60 * 1000;

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

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const generateCode = () => String(Math.floor(100000 + Math.random() * 900000));

const getRequiredEnv = () => {
  const env = {
    supabaseUrl: process.env.SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
    resendApiKey: process.env.RESEND_API_KEY ?? "",
    mailFrom: process.env.MAIL_FROM ?? "",
    subjectPrefix: process.env.EMAIL_SUBJECT_PREFIX ?? "H Wallet",
  };

  const missing = Object.entries({
    SUPABASE_URL: env.supabaseUrl,
    SUPABASE_ANON_KEY: env.supabaseAnonKey,
    RESEND_API_KEY: env.resendApiKey,
    MAIL_FROM: env.mailFrom,
  })
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return { env, missing };
};

async function supabaseInsertVerificationCode(params: {
  supabaseUrl: string;
  supabaseAnonKey: string;
  email: string;
  code: string;
  expiresAt: string;
}) {
  const response = await fetch(`${params.supabaseUrl}/rest/v1/verification_codes`, {
    method: "POST",
    headers: {
      apikey: params.supabaseAnonKey,
      Authorization: `Bearer ${params.supabaseAnonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify([
      {
        email: params.email,
        code: params.code,
        expires_at: params.expiresAt,
      },
    ]),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase insert failed: ${response.status} ${detail}`);
  }
}

async function sendEmailByResend(params: {
  resendApiKey: string;
  mailFrom: string;
  subjectPrefix: string;
  email: string;
  code: string;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.mailFrom,
      to: [params.email],
      subject: `${params.subjectPrefix} 验证码`,
      text: `你的 H Wallet 验证码是 ${params.code}，10 分钟内有效。`,
      html: `<p>你的 <strong>H Wallet</strong> 验证码是：</p><p style="font-size:24px;font-weight:700;letter-spacing:4px;">${params.code}</p><p>10 分钟内有效。</p>`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend send failed: ${response.status} ${detail}`);
  }

  return response.json();
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

  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: "INVALID_EMAIL" });
  }

  const { env, missing } = getRequiredEnv();
  if (missing.length > 0) {
    console.error("[send-code] missing env:", missing.join(","));
    return res.status(503).json({
      ok: false,
      error: "EMAIL_SERVICE_NOT_CONFIGURED",
      missing,
      message: "邮件发送服务未配置完整",
    });
  }

  const code = generateCode();
  const expiresAtMs = Date.now() + OTP_TTL_MS;
  const expiresAt = new Date(expiresAtMs).toISOString();

  try {
    await supabaseInsertVerificationCode({
      supabaseUrl: env.supabaseUrl,
      supabaseAnonKey: env.supabaseAnonKey,
      email,
      code,
      expiresAt,
    });

    const emailResult = await sendEmailByResend({
      resendApiKey: env.resendApiKey,
      mailFrom: env.mailFrom,
      subjectPrefix: env.subjectPrefix,
      email,
      code,
    });

    console.log("[send-code] email sent", {
      email,
      emailId: (emailResult as { id?: string })?.id ?? null,
    });

    return res.status(200).json({
      ok: true,
      success: true,
      email,
      expiresAt: expiresAtMs,
      mockMode: false,
      message: "Verification code sent",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[send-code] failed:", message);
    return res.status(500).json({
      ok: false,
      error: "SEND_CODE_FAILED",
      message,
    });
  }
}
