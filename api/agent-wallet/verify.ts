import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyWalletOtp } from '../../server/_core/agent-wallet';
import { sdk } from '../../server/_core/sdk';
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
  const requestId =
    typeof body.requestId === 'string'
      ? body.requestId.trim()
      : typeof body.flowId === 'string'
        ? body.flowId.trim()
        : '';

  try {
    const result = await verifyWalletOtp({ email, code, requestId });
    const now = Date.now();
    const appSessionId = await sdk.createSessionToken(result.sessionUser.openId, {
      name: result.sessionUser.name,
      expiresInMs: ONE_YEAR_MS,
      wallet: {
        email: result.wallet.email,
        evmAddress: result.wallet.evmAddress,
        solanaAddress: result.wallet.solanaAddress,
      },
    });

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
