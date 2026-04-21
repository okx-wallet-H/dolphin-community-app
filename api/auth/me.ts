import type { VercelRequest, VercelResponse } from '@vercel/node';

import { authenticateRequest, setCors, toErrorMessage, toSuccessEnvelope } from '../_standalone-auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ code: '405', msg: 'METHOD_NOT_ALLOWED', success: false, error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const { user, payload } = authenticateRequest(req);
    const wallet = {
      email: user.email,
      evmAddress: typeof payload.evmAddress === 'string' ? payload.evmAddress : '',
      solanaAddress: typeof payload.solanaAddress === 'string' ? payload.solanaAddress : '',
    };
    return res.status(200).json(toSuccessEnvelope({ user, wallet }));
  } catch (error) {
    return res.status(401).json({
      code: '401',
      msg: 'UNAUTHORIZED',
      success: false,
      error: toErrorMessage(error),
      user: null,
    });
  }
}
