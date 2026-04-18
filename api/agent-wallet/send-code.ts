import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendWalletOtp } from '../../server/_core/agent-wallet';
import { setCors, toErrorMessage } from '../_standalone-auth';

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

function getStatusCode(message: string) {
  if (message.includes('请输入')) return 400;
  if (message.includes('未配置完整')) return 503;
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
  const email =
    typeof body.email === 'string'
      ? body.email
      : typeof body.walletEmail === 'string'
        ? body.walletEmail
        : typeof body.account === 'string'
          ? body.account
          : '';

  try {
    const result = await sendWalletOtp(email);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    const message = toErrorMessage(error);
    return res.status(getStatusCode(message)).json({
      ok: false,
      error: message,
      message,
    });
  }
}
