import type { VercelRequest, VercelResponse } from '@vercel/node';

import {
  getBodyString,
  getOptionalBodyString,
  getQueryString,
  handleOptions,
  parseBody,
  requireAuth,
  sendError,
  sendMethodNotAllowed,
  sendSuccess,
} from '../dex/_shared';
import {
  executeOnchainSwap,
  getOnchainAssets,
  getOnchainExecutionReceipt,
  getOnchainOsConfig,
  previewOnchainSwap,
} from '../../server/_core/onchain-os';

function resolveRoute(req: VercelRequest) {
  const route = typeof req.query.route === 'string' ? req.query.route.trim() : '';
  const pathname = String(req.url ?? '').split('?')[0] ?? '';
  if (route) return route;
  if (pathname.endsWith('/onchain/config')) return 'config';
  if (pathname.endsWith('/onchain/assets')) return 'assets';
  if (pathname.endsWith('/onchain/preview')) return 'preview';
  if (pathname.endsWith('/onchain/execute')) return 'execute';
  if (pathname.endsWith('/onchain/receipt')) return 'receipt';
  if (pathname === '/api/onchain' || pathname === '/api/onchain/') return 'config';
  return '';
}

function sendNotFound(res: VercelResponse) {
  return res.status(404).json({ code: '404', msg: 'NOT_FOUND', success: false, error: 'NOT_FOUND' });
}

function parseChainKind(body: Record<string, unknown>) {
  const raw = getOptionalBodyString(body, 'chainKind');
  if (raw === 'solana' || raw === 'evm') {
    return raw;
  }
  return undefined;
}

function validateSwapPayload(body: Record<string, unknown>, res: VercelResponse) {
  const chainIndex = getBodyString(body, 'chainIndex');
  const amount = getBodyString(body, 'amount');
  const fromTokenAddress = getBodyString(body, 'fromTokenAddress');
  const toTokenAddress = getBodyString(body, 'toTokenAddress');
  const userWalletAddress = getBodyString(body, 'userWalletAddress');

  if (!chainIndex || !amount || !fromTokenAddress || !toTokenAddress || !userWalletAddress) {
    res.status(400).json({
      code: '400',
      msg: 'chainIndex, amount, fromTokenAddress, toTokenAddress and userWalletAddress are required',
      success: false,
      error: 'chainIndex, amount, fromTokenAddress, toTokenAddress and userWalletAddress are required',
    });
    return null;
  }

  return {
    chainIndex,
    amount,
    fromTokenAddress,
    toTokenAddress,
    userWalletAddress,
  };
}

async function handleConfig(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res);
  }

  const user = requireAuth(req);
  return sendSuccess(res, {
    user: {
      openId: user.openId,
      email: user.email ?? null,
    },
    onchainOs: getOnchainOsConfig(),
  });
}

async function handleAssets(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res);
  }

  const user = requireAuth(req);
  const address = getQueryString(req, 'address');
  if (!address) {
    return res.status(400).json({
      code: '400',
      msg: 'address is required',
      success: false,
      error: 'address is required',
    });
  }

  const result = await getOnchainAssets({
    address,
    chains: getQueryString(req, 'chains') || undefined,
    filter: getQueryString(req, 'filter') || undefined,
    excludeRiskToken: getQueryString(req, 'excludeRiskToken') || undefined,
  });

  return sendSuccess(res, {
    user: {
      openId: user.openId,
    },
    ...result,
  });
}

async function handlePreview(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res);
  }

  const user = requireAuth(req);
  const body = parseBody(req);
  const payload = validateSwapPayload(body, res);
  if (!payload) return;

  const result = await previewOnchainSwap({
    ...payload,
    fromTokenSymbol: getOptionalBodyString(body, 'fromTokenSymbol'),
    toTokenSymbol: getOptionalBodyString(body, 'toTokenSymbol'),
    displayAmount: getOptionalBodyString(body, 'displayAmount'),
    chainKind: parseChainKind(body),
  });

  return sendSuccess(res, {
    user: {
      openId: user.openId,
    },
    ...result,
  });
}

async function handleExecute(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res);
  }

  const user = requireAuth(req);
  const body = parseBody(req);
  const payload = validateSwapPayload(body, res);
  if (!payload) return;

  const result = await executeOnchainSwap({
    ...payload,
    fromTokenSymbol: getOptionalBodyString(body, 'fromTokenSymbol'),
    toTokenSymbol: getOptionalBodyString(body, 'toTokenSymbol'),
    displayAmount: getOptionalBodyString(body, 'displayAmount'),
    slippagePercent: getOptionalBodyString(body, 'slippagePercent'),
    signedTx: getOptionalBodyString(body, 'signedTx'),
    jitoSignedTx: getOptionalBodyString(body, 'jitoSignedTx'),
    broadcastAddress: getOptionalBodyString(body, 'broadcastAddress'),
    chainKind: parseChainKind(body),
  });

  return sendSuccess(res, {
    user: {
      openId: user.openId,
    },
    ...result,
  });
}

async function handleReceipt(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res);
  }

  const user = requireAuth(req);
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

  const result = await getOnchainExecutionReceipt({
    address,
    chainIndex,
    orderId: getQueryString(req, 'orderId') || undefined,
    txStatus: getQueryString(req, 'txStatus') || undefined,
    cursor: getQueryString(req, 'cursor') || undefined,
    limit: getQueryString(req, 'limit') || undefined,
  });

  return sendSuccess(res, {
    user: {
      openId: user.openId,
    },
    ...result,
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
        return await handleConfig(req, res);
      case 'assets':
        return await handleAssets(req, res);
      case 'preview':
        return await handlePreview(req, res);
      case 'execute':
        return await handleExecute(req, res);
      case 'receipt':
        return await handleReceipt(req, res);
      default:
        return sendNotFound(res);
    }
  } catch (error) {
    return sendError(res, error);
  }
}
