import type { VercelRequest, VercelResponse } from '@vercel/node';

import {
  authenticateRequest,
  getSessionToken,
  setCors,
  setSessionCookie,
  toErrorMessage,
  toSuccessEnvelope,
} from '../_standalone-auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ code: '405', msg: 'METHOD_NOT_ALLOWED', success: false, error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const token = getSessionToken(req);
    if (!token) {
      return res.status(400).json({ code: '400', msg: 'Bearer token required', success: false, error: 'BEARER_TOKEN_REQUIRED' });
    }

    const { user } = authenticateRequest(req);
    setSessionCookie(res, token);
    return res.status(200).json(toSuccessEnvelope({ user }));
  } catch (error) {
    return res.status(401).json({
      code: '401',
      msg: 'INVALID_TOKEN',
      success: false,
      error: toErrorMessage(error),
    });
  }
}
