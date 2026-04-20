import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, setCors, toErrorMessage, toSuccessEnvelope } from '../_standalone-auth';

export function handleOptions(req: VercelRequest, res: VercelResponse) {
  setCors(res, req);
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

export function parseBody(req: VercelRequest) {
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

export function getBodyString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === 'string' ? value : '';
}

export function getOptionalBodyString(body: Record<string, unknown>, key: string) {
  const value = body[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export function getQueryString(req: VercelRequest, key: string) {
  const value = req.query[key];
  return typeof value === 'string' ? value.trim() : Array.isArray(value) ? (value[0] ?? '').trim() : '';
}

export function requireAuth(req: VercelRequest) {
  return authenticateRequest(req).user;
}

export function sendMethodNotAllowed(res: VercelResponse) {
  return res.status(405).json({
    code: '405',
    msg: 'METHOD_NOT_ALLOWED',
    success: false,
    error: 'METHOD_NOT_ALLOWED',
  });
}

export function sendError(res: VercelResponse, error: unknown, fallbackStatus = 400) {
  const message = toErrorMessage(error);
  const status = /UNAUTHORIZED|TOKEN/i.test(message) ? 401 : fallbackStatus;
  return res.status(status).json({
    code: String(status),
    msg: message,
    success: false,
    error: message,
  });
}

export function sendSuccess<T extends Record<string, unknown>>(res: VercelResponse, payload: T) {
  return res.status(200).json(toSuccessEnvelope(payload));
}
