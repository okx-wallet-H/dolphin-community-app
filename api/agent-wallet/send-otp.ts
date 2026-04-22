import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCors } from '../_standalone-auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(410).json({
    ok: false,
    error: 'AGENT_WALLET_SEND_OTP_ALIAS_REMOVED',
    message: '旧的 Agent Wallet send-otp 入口已停用，请改用 /api/agent-wallet/send-code。',
  });
}
