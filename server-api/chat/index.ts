import type { VercelRequest, VercelResponse } from '@vercel/node';

import { authenticateRequest, setCors, toErrorMessage, toSuccessEnvelope } from '../_standalone-auth';
import { getChatAiIntent } from '../../server/_core/chat-ai';

type WalletSnapshot = {
  email?: string;
  evmAddress?: string;
  solanaAddress?: string;
};

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

function parseWallet(value: unknown): WalletSnapshot | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const payload = value as Record<string, unknown>;
  const email = typeof payload.email === 'string' ? payload.email.trim() : '';
  const evmAddress = typeof payload.evmAddress === 'string' ? payload.evmAddress.trim() : '';
  const solanaAddress = typeof payload.solanaAddress === 'string' ? payload.solanaAddress.trim() : '';

  if (!email && !evmAddress && !solanaAddress) {
    return undefined;
  }

  return {
    email: email || undefined,
    evmAddress: evmAddress || undefined,
    solanaAddress: solanaAddress || undefined,
  };
}

function resolveRoute(req: VercelRequest) {
  const route = typeof req.query.route === 'string' ? req.query.route.trim() : '';
  const pathname = String(req.url ?? '').split('?')[0] ?? '';
  if (route) return route;
  if (pathname.endsWith('/chat-ai/intent')) return 'chat-ai-intent';
  if (pathname.endsWith('/chat/intent') || pathname === '/api/chat' || pathname === '/api/chat/') return 'chat-intent';
  return '';
}

function sendNotFound(res: VercelResponse) {
  return res.status(404).json({ code: '404', msg: 'NOT_FOUND', success: false, error: 'NOT_FOUND' });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res, req);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const route = resolveRoute(req);
  if (!route) {
    return sendNotFound(res);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ code: '405', msg: 'METHOD_NOT_ALLOWED', success: false, error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const { user } = authenticateRequest(req);
    const body = parseBody(req);
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const wallet = parseWallet(body.wallet);

    if (!message) {
      return res.status(400).json({ code: '400', msg: 'message is required', success: false, error: 'MESSAGE_REQUIRED' });
    }

    const intent = await getChatAiIntent(message, wallet);
    return res.status(200).json(
      toSuccessEnvelope({
        user: { openId: user.openId },
        mockMode: intent.mockMode,
        intent,
      }),
    );
  } catch (error) {
    const message = toErrorMessage(error);
    const status = /UNAUTHORIZED|TOKEN/i.test(message) ? 401 : 400;
    return res.status(status).json({
      code: String(status),
      msg: message,
      success: false,
      error: message,
    });
  }
}
