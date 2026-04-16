import type { VercelRequest, VercelResponse } from '@vercel/node';

import { sendServerlessUnavailable } from '../_serverless-fallback';
import { getBodyString, getQueryString, handleOptions, parseBody, requireAuth, sendError, sendMethodNotAllowed, sendSuccess } from './_shared';

function resolveRoute(req: VercelRequest) {
  const route = typeof req.query.route === 'string' ? req.query.route.trim() : '';
  const pathname = String(req.url ?? '').split('?')[0] ?? '';
  if (route) return route;
  if (pathname.endsWith('/dex/config')) return 'config';
  if (pathname.endsWith('/dex/intent')) return 'intent';
  if (pathname.endsWith('/dex/quote')) return 'quote';
  if (pathname.endsWith('/dex/execute')) return 'execute';
  if (pathname.endsWith('/dex/orders')) return 'orders';
  if (pathname === '/api/dex' || pathname === '/api/dex/') return 'config';
  return '';
}

function sendNotFound(res: VercelResponse) {
  return res.status(404).json({ code: '404', msg: 'NOT_FOUND', success: false, error: 'NOT_FOUND' });
}

function getDexConfigSnapshot() {
  const provider = process.env.OKX_DEX_API_KEY ? 'okx' : 'mock';
  return {
    provider,
    mode: 'standalone-serverless',
    okxBaseUrl: process.env.OKX_BASE_URL ?? process.env.OKX_AGENT_WALLET_BASE_URL ?? 'https://www.okx.com',
    hasApiKey: Boolean(process.env.OKX_DEX_API_KEY || process.env.OKX_API_KEY),
    hasSecretKey: Boolean(process.env.OKX_DEX_SECRET_KEY || process.env.OKX_API_SECRET || process.env.OKX_SECRET_KEY),
    hasPassphrase: Boolean(process.env.OKX_DEX_PASSPHRASE || process.env.OKX_API_PASSPHRASE || process.env.OKX_PASSPHRASE),
    hasProjectId: Boolean(process.env.OKX_DEX_PROJECT_ID || process.env.OKX_PROJECT_ID),
  };
}

function handleConfig(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res);
  }

  const user = requireAuth(req);
  return sendSuccess(res, {
    user: {
      openId: user.openId,
      email: user.email ?? null,
    },
    dex: getDexConfigSnapshot(),
  });
}

function handleIntent(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res);
  }

  requireAuth(req);
  const body = parseBody(req);
  const message = getBodyString(body, 'message');

  if (!message) {
    return res.status(400).json({
      code: '400',
      msg: 'message is required',
      success: false,
      error: 'message is required',
    });
  }

  return sendServerlessUnavailable(res, {
    route: '/api/dex/intent',
    feature: 'dex intent parsing',
    requiredEnv: ['OPENAI_API_KEY'],
  });
}

function handleQuote(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res);
  }

  requireAuth(req);
  const body = parseBody(req);
  const chainIndex = getBodyString(body, 'chainIndex');
  const amount = getBodyString(body, 'amount');
  const fromTokenAddress = getBodyString(body, 'fromTokenAddress');
  const toTokenAddress = getBodyString(body, 'toTokenAddress');
  const userWalletAddress = getBodyString(body, 'userWalletAddress');

  if (!chainIndex || !amount || !fromTokenAddress || !toTokenAddress || !userWalletAddress) {
    return res.status(400).json({
      code: '400',
      msg: 'chainIndex, amount, fromTokenAddress, toTokenAddress and userWalletAddress are required',
      success: false,
      error: 'chainIndex, amount, fromTokenAddress, toTokenAddress and userWalletAddress are required',
    });
  }

  return sendServerlessUnavailable(res, {
    route: '/api/dex/quote',
    feature: 'dex quote',
    requiredEnv: ['OKX_DEX_API_KEY', 'OKX_DEX_SECRET_KEY', 'OKX_DEX_PASSPHRASE'],
  });
}

function handleExecute(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res);
  }

  requireAuth(req);
  const body = parseBody(req);
  const chainIndex = getBodyString(body, 'chainIndex');
  const amount = getBodyString(body, 'amount');
  const fromTokenAddress = getBodyString(body, 'fromTokenAddress');
  const toTokenAddress = getBodyString(body, 'toTokenAddress');
  const userWalletAddress = getBodyString(body, 'userWalletAddress');

  if (!chainIndex || !amount || !fromTokenAddress || !toTokenAddress || !userWalletAddress) {
    return res.status(400).json({
      code: '400',
      msg: 'chainIndex, amount, fromTokenAddress, toTokenAddress and userWalletAddress are required',
      success: false,
      error: 'chainIndex, amount, fromTokenAddress, toTokenAddress and userWalletAddress are required',
    });
  }

  return sendServerlessUnavailable(res, {
    route: '/api/dex/execute',
    feature: 'dex execution',
    requiredEnv: ['OKX_DEX_API_KEY', 'OKX_DEX_SECRET_KEY', 'OKX_DEX_PASSPHRASE'],
  });
}

function handleOrders(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res);
  }

  requireAuth(req);
  const address = getQueryString(req, 'address');
  const chainIndex = getQueryString(req, 'chainIndex');

  if (!address || !chainIndex) {
    return res.status(400).json({
      code: '400',
      msg: 'address and chainIndex are required',
      success: false,
      error: 'address and chainIndex are required',
    });
  }

  return sendServerlessUnavailable(res, {
    route: '/api/dex/orders',
    feature: 'dex order query',
    requiredEnv: ['OKX_DEX_API_KEY', 'OKX_DEX_SECRET_KEY', 'OKX_DEX_PASSPHRASE'],
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) {
    return;
  }

  const route = resolveRoute(req);
  if (!route) {
    return sendNotFound(res);
  }

  try {
    switch (route) {
      case 'config':
        return handleConfig(req, res);
      case 'intent':
        return handleIntent(req, res);
      case 'quote':
        return handleQuote(req, res);
      case 'execute':
        return handleExecute(req, res);
      case 'orders':
        return handleOrders(req, res);
      default:
        return sendNotFound(res);
    }
  } catch (error) {
    return sendError(res, error);
  }
}
