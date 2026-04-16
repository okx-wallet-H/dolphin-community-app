import type { VercelRequest, VercelResponse } from '@vercel/node';

import { authenticateRequest, setCors, toErrorMessage } from '../_standalone-auth';
import { sendServerlessUnavailable } from '../_serverless-fallback';

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
    authenticateRequest(req);
    const body = parseBody(req);
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    if (!message) {
      return res.status(400).json({ code: '400', msg: 'message is required', success: false, error: 'MESSAGE_REQUIRED' });
    }

    return sendServerlessUnavailable(res, {
      route: route === 'chat-ai-intent' ? '/api/chat-ai/intent' : '/api/chat/intent',
      feature: 'chat intent analysis',
      requiredEnv: ['OPENAI_API_KEY'],
    });
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
