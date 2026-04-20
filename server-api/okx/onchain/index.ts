import crypto from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const OKX_BASE = 'https://web3.okx.com';
const PRICE_PATH = '/api/v5/wallet/token/real-time-price';
const DETAIL_PATH = '/api/v5/wallet/token/token-detail';

function setCors(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function resolveRoute(req: VercelRequest) {
  const route = typeof req.query.route === 'string' ? req.query.route.trim() : '';
  const pathname = String(req.url ?? '').split('?')[0] ?? '';
  if (route) return route;
  if (pathname.endsWith('/okx/onchain/price')) return 'price';
  if (pathname.endsWith('/okx/onchain/token-detail')) return 'token-detail';
  return '';
}

function buildSignedHeaders(method: string, path: string, body = '') {
  const apiKey = process.env.OKX_ONCHAIN_API_KEY ?? '';
  const secret = process.env.OKX_ONCHAIN_SECRET_KEY ?? '';
  const pass = process.env.OKX_ONCHAIN_PASSPHRASE ?? '';
  const ts = new Date().toISOString();
  const sig = crypto.createHmac('sha256', secret).update(`${ts}${method}${path}${body}`).digest('base64');
  return {
    'Content-Type': 'application/json',
    'OK-ACCESS-KEY': apiKey,
    'OK-ACCESS-PASSPHRASE': pass,
    'OK-ACCESS-SIGN': sig,
    'OK-ACCESS-TIMESTAMP': ts,
  };
}

function sendNotFound(res: VercelResponse) {
  return res.status(404).json({ error: 'Not found' });
}

async function handlePrice(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = JSON.stringify(req.body);
  const response = await fetch(`${OKX_BASE}${PRICE_PATH}`, {
    method: 'POST',
    headers: buildSignedHeaders('POST', PRICE_PATH, body),
    body,
  });
  const text = await response.text();
  return res.status(response.status).setHeader('Content-Type', 'application/json').send(text);
}

async function handleTokenDetail(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const chainIndex = String(req.query.chainIndex ?? '').trim();
  const tokenAddress = String(req.query.tokenAddress ?? '').trim();
  if (!chainIndex || !tokenAddress) {
    return res.status(400).json({ error: 'chainIndex and tokenAddress required' });
  }

  const query = `chainIndex=${encodeURIComponent(chainIndex)}&tokenAddress=${encodeURIComponent(tokenAddress)}`;
  const requestPath = `${DETAIL_PATH}?${query}`;
  const response = await fetch(`${OKX_BASE}${requestPath}`, {
    headers: buildSignedHeaders('GET', requestPath),
  });
  const text = await response.text();
  return res.status(response.status).setHeader('Content-Type', 'application/json').send(text);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const route = resolveRoute(req);
  if (!route) {
    return sendNotFound(res);
  }

  try {
    if (route === 'price') {
      return await handlePrice(req, res);
    }
    if (route === 'token-detail') {
      return await handleTokenDetail(req, res);
    }
    return sendNotFound(res);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'proxy failed' });
  }
}
