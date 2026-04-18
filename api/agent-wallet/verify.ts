import { createHmac } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyWalletOtp } from '../../server/_core/agent-wallet';
import { setCors, setSessionCookie, toErrorMessage } from '../_standalone-auth';

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function parseBody(req: VercelRequest) {
  if (!req.body) return {} as Record<string, unknown>;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {} as Record<string, unknown>;
    }
  }
  return req.body as Record<string, unknown>;
}

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeCode(value: unknown) {
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
}

function base64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signSessionToken(payload: Record<string, unknown>, secret: string) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function getStatusCode(message: string) {
  if (message.includes('请输入')) return 400;
  if (message.includes('未配置完整')) return 503;
  if (message.includes('验证码')) return 400;
  return 502;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED', message: '只支持 POST 请求' });
  }

  const body = parseBody(req);
  const email = normalizeEmail(body.email ?? body.walletEmail ?? body.account);
  const code = normalizeCode(body.code ?? body.otp ?? body.verificationCode);

  try {
    const result = await verifyWalletOtp({ email, code });
    const secret = process.env.JWT_SECRET || 'h-wallet-dev-secret';
    const appId = process.env.VITE_APP_ID || process.env.EXPO_PUBLIC_APP_ID || 'new-h-wallet';
    const now = Date.now();
    const exp = Math.floor((now + ONE_YEAR_MS) / 1000);
    const iat = Math.floor(now / 1000);
    const appSessionId = signSessionToken(
      {
        openId: result.sessionUser.openId,
        appId,
        name: result.sessionUser.name,
        email: result.sessionUser.email,
        iat,
        exp,
      },
      secret,
    );

    setSessionCookie(res, appSessionId);

    const lastSignedIn = new Date(now).toISOString();
    return res.status(200).json({
      ok: true,
      success: true,
      app_session_id: appSessionId,
      user: {
        id: null,
        openId: result.sessionUser.openId,
        name: result.sessionUser.name,
        email: result.sessionUser.email,
        loginMethod: result.sessionUser.loginMethod,
        lastSignedIn,
      },
      wallet: result.wallet,
      isNewWallet: result.isNewWallet,
      mockMode: result.mockMode,
    });
  } catch (error) {
    const message = toErrorMessage(error);
    return res.status(getStatusCode(message)).json({
      ok: false,
      error: message,
      message,
    });
  }
}
