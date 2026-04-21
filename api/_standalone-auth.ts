import { createHmac } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const COOKIE_NAME = 'app_session_id';

type SessionUser = {
  id: number | null;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  lastSignedIn: string;
};

type SessionPayload = {
  openId?: string;
  appId?: string;
  name?: string;
  email?: string;
  evmAddress?: string;
  solanaAddress?: string;
  exp?: number;
  iat?: number;
};

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

function readCookie(req: VercelRequest, name: string) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return '';
  }

  const cookies = cookieHeader.split(';').map((item: string) => item.trim());
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.split('=');
    if (key === name) {
      return rest.join('=').trim();
    }
  }

  return '';
}

export function setCors(res: VercelResponse, req?: VercelRequest) {
  const origin = typeof req?.headers.origin === 'string' ? req.headers.origin : '*';
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-App-Session-Id, X-App-Platform');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export function getSessionToken(req: VercelRequest) {
  const authorization = req.headers.authorization;
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }

  const sessionHeader = req.headers['x-app-session-id'];
  if (typeof sessionHeader === 'string' && sessionHeader.trim()) {
    return sessionHeader.trim();
  }

  if (Array.isArray(sessionHeader) && sessionHeader[0]?.trim()) {
    return sessionHeader[0].trim();
  }

  return readCookie(req, COOKIE_NAME);
}

function verifyToken(token: string): SessionPayload {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error('INVALID_TOKEN');
  }

  const secret = process.env.JWT_SECRET || 'h-wallet-dev-secret';
  const expectedSignature = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (expectedSignature !== encodedSignature) {
    throw new Error('INVALID_SIGNATURE');
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
  if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
    throw new Error('TOKEN_EXPIRED');
  }

  return payload;
}

export function authenticateRequest(req: VercelRequest) {
  const token = getSessionToken(req);
  if (!token) {
    throw new Error('UNAUTHORIZED');
  }

  const payload = verifyToken(token);
  const email = typeof payload.email === 'string' && payload.email ? payload.email : typeof payload.openId === 'string' && payload.openId.startsWith('wallet:') ? payload.openId.slice('wallet:'.length) : null;
  const openId = typeof payload.openId === 'string' && payload.openId ? payload.openId : email ? `wallet:${email}` : '';
  const name = typeof payload.name === 'string' && payload.name ? payload.name : email ? email.split('@')[0] : null;

  const user: SessionUser = {
    id: null,
    openId,
    name,
    email,
    loginMethod: email ? 'email' : null,
    lastSignedIn: new Date().toISOString(),
  };

  return { token, payload, user };
}

export function setSessionCookie(res: VercelResponse, token: string) {
  const maxAge = Math.floor(ONE_YEAR_MS / 1000);
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Secure`);
}

export function toSuccessEnvelope<T extends Record<string, unknown>>(payload: T) {
  return {
    code: '0',
    msg: 'success',
    success: true,
    ...payload,
  };
}

export function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'UNKNOWN_ERROR';
}
