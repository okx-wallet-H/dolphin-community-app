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
  executeOnchainTransfer,
  getOnchainApprovals,
  getOnchainAssets,
  getOnchainExecutionReceipt,
  getOnchainOsConfig,
  previewOnchainSwap,
} from '../../server/_core/onchain-os';
import { validateOnchainExecutionRisk } from '../../server/_core/onchain-execution-guard';
import { buildOnchainIdempotencyKey, shouldBlockDuplicateExecution } from '../../server/_core/onchain-idempotency';
import {
  appendOnchainTxLog,
  createOnchainTxRecord,
  findOnchainTxByIdempotencyKey,
  updateOnchainTx,
  updateOnchainTxByOrderId,
} from '../../server/_core/onchain-tx-store';

function resolveRoute(req: VercelRequest) {
  const route = typeof req.query.route === 'string' ? req.query.route.trim() : '';
  const pathname = String(req.url ?? '').split('?')[0] ?? '';
  if (route) return route;
  if (pathname.endsWith('/onchain/config')) return 'config';
  if (pathname.endsWith('/onchain/assets')) return 'assets';
  if (pathname.endsWith('/onchain/approvals')) return 'approvals';
  if (pathname.endsWith('/onchain/preview')) return 'preview';
  if (pathname.endsWith('/onchain/execute')) return 'execute';
  if (pathname.endsWith('/onchain/receipt')) return 'receipt';
  if (pathname.endsWith('/onchain/transfer')) return 'transfer';
  if (pathname === '/api/onchain' || pathname === '/api/onchain/') return 'config';
  return '';
}

function sendNotFound(res: VercelResponse) {
  return res.status(404).json({ code: '404', msg: 'NOT_FOUND', success: false, error: 'NOT_FOUND' });
}

type OnchainFailureCategory =
  | 'user_cancelled'
  | 'quote_expired'
  | 'insufficient_balance'
  | 'gas_failure'
  | 'slippage_exceeded'
  | 'network_timeout'
  | 'chain_rejected'
  | 'unknown';

/**
 * 将已知错误消息映射为可读原因并分类，用于区分可重试与不可重试失败。
 */
function classifyOnchainError(error: unknown): {
  category: OnchainFailureCategory;
  userMessage: string;
} {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (msg.includes('cancel') || msg.includes('取消') || msg.includes('user denied')) {
    return { category: 'user_cancelled', userMessage: '用户取消了交易' };
  }
  if (msg.includes('quote') && (msg.includes('expir') || msg.includes('stale') || msg.includes('过期'))) {
    return { category: 'quote_expired', userMessage: '报价已过期，请重新获取' };
  }
  if (msg.includes('insufficient') || msg.includes('余额不足') || msg.includes('balance')) {
    return { category: 'insufficient_balance', userMessage: '余额不足，无法完成交易' };
  }
  if (msg.includes('gas') || msg.includes('fee')) {
    return { category: 'gas_failure', userMessage: 'Gas 费用不足或 Gas 估算失败' };
  }
  if (msg.includes('slippage') || msg.includes('滑点')) {
    return { category: 'slippage_exceeded', userMessage: '滑点超出限制，请调低滑点或重新报价' };
  }
  if (msg.includes('timeout') || msg.includes('network') || msg.includes('超时')) {
    return { category: 'network_timeout', userMessage: '网络超时，请稍后重试' };
  }
  if (msg.includes('revert') || msg.includes('execution reverted')) {
    return { category: 'chain_rejected', userMessage: '链上合约执行失败（revert）' };
  }
  return { category: 'unknown', userMessage: error instanceof Error ? error.message : '交易执行失败，请重试' };
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

async function handleApprovals(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res);
  }

  const user = requireAuth(req);
  const chainIndex = getQueryString(req, 'chainIndex');
  const address = getQueryString(req, 'address');
  if (!chainIndex || !address) {
    return res.status(400).json({
      code: '400',
      msg: 'chainIndex and address are required',
      success: false,
      error: 'chainIndex and address are required',
    });
  }

  const result = await getOnchainApprovals({
    chainIndex,
    address,
    limit: getQueryString(req, 'limit') || undefined,
    cursor: getQueryString(req, 'cursor') || undefined,
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

  const displayAmount = getOptionalBodyString(body, 'displayAmount');
  const slippagePercent = getOptionalBodyString(body, 'slippagePercent');
  const riskError = validateOnchainExecutionRisk({
    chainIndex: payload.chainIndex,
    displayAmount,
    slippagePercent,
  });
  if (riskError) {
    return res.status(400).json({
      code: riskError.code,
      msg: riskError.message,
      success: false,
      error: riskError.message,
    });
  }

  const fromTokenSymbol = getOptionalBodyString(body, 'fromTokenSymbol');
  const toTokenSymbol = getOptionalBodyString(body, 'toTokenSymbol');
  const broadcastAddress = getOptionalBodyString(body, 'broadcastAddress');
  const idempotencyKey = buildOnchainIdempotencyKey({
    userId: user.openId,
    chainIndex: payload.chainIndex,
    amount: payload.amount,
    fromToken: fromTokenSymbol ?? payload.fromTokenAddress,
    toToken: toTokenSymbol ?? payload.toTokenAddress,
  });
  const existingTx = await findOnchainTxByIdempotencyKey(idempotencyKey);
  if (existingTx && shouldBlockDuplicateExecution(existingTx.phase)) {
    await appendOnchainTxLog({
      txId: existingTx.txId,
      userId: user.openId,
      eventType: 'duplicate',
      level: 'warn',
      message: 'Duplicate Onchain execution request blocked by idempotency guard',
      context: {
        idempotencyKey,
        phase: existingTx.phase,
      },
    });

    return sendSuccess(res, {
      user: {
        openId: user.openId,
      },
      txId: existingTx.txId,
      idempotent: true,
      ...(existingTx.lastResponse ?? {
        executionModel: 'agent_wallet',
        phase: existingTx.phase,
        orderId: existingTx.orderId,
        txHash: existingTx.txHash,
        progress: [],
      }),
    });
  }

  const txRecord = await createOnchainTxRecord({
    userId: user.openId,
    type: 'swap',
    phase: 'preview',
    chainIndex: payload.chainIndex,
    userWalletAddress: payload.userWalletAddress,
    broadcastAddress,
    fromToken: fromTokenSymbol ?? payload.fromTokenAddress,
    toToken: toTokenSymbol ?? payload.toTokenAddress,
    amount: payload.amount,
    slippagePercent,
    idempotencyKey,
    retryCount: 0,
  });

  await appendOnchainTxLog({
    txId: txRecord.txId,
    userId: user.openId,
    eventType: 'create',
    level: 'info',
    message: 'Onchain swap execution task created',
    context: {
      chainIndex: payload.chainIndex,
      fromTokenAddress: payload.fromTokenAddress,
      toTokenAddress: payload.toTokenAddress,
      amount: payload.amount,
    },
  });

  try {
    const result = await executeOnchainSwap({
      ...payload,
      fromTokenSymbol,
      toTokenSymbol,
      displayAmount,
      slippagePercent,
      signedTx: getOptionalBodyString(body, 'signedTx'),
      jitoSignedTx: getOptionalBodyString(body, 'jitoSignedTx'),
      broadcastAddress,
      chainKind: parseChainKind(body),
    });

    await updateOnchainTx(txRecord.txId, (current) => ({
      ...current,
      phase: result.phase,
      orderId: result.orderId ?? current.orderId,
      txHash: result.txHash ?? current.txHash,
      lastResponse: result as Record<string, unknown>,
    }));

    await appendOnchainTxLog({
      txId: txRecord.txId,
      userId: user.openId,
      eventType: 'execute',
      level: result.phase === 'failed' ? 'error' : 'info',
      message: `Onchain swap execution moved to ${result.phase}`,
      context: {
        orderId: result.orderId,
        txHash: result.txHash,
        phase: result.phase,
      },
    });

    return sendSuccess(res, {
      user: {
        openId: user.openId,
      },
      txId: txRecord.txId,
      ...result,
    });
  } catch (error) {
    const { category, userMessage } = classifyOnchainError(error);
    await updateOnchainTx(txRecord.txId, (current) => ({
      ...current,
      phase: 'failed',
      lastError: JSON.stringify({ category, userMessage, raw: error instanceof Error ? error.message : String(error) }),
      lastResponse: {
        executionModel: 'agent_wallet',
        phase: 'failed',
        progress: [],
        error: userMessage,
      },
    }));

    await appendOnchainTxLog({
      txId: txRecord.txId,
      userId: user.openId,
      eventType: 'failure',
      level: 'error',
      message: 'Onchain swap execution failed',
      context: {
        error: error instanceof Error ? error.message : String(error),
        failureCategory: category,
      },
    });

    throw error;
  }
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
    txHash: getQueryString(req, 'txHash') || undefined,
    txStatus: getQueryString(req, 'txStatus') || undefined,
    cursor: getQueryString(req, 'cursor') || undefined,
    limit: getQueryString(req, 'limit') || undefined,
  });

  // 与 Express 路由同步：将回执结果写回 tx store，保持 Vercel 线上环境任务状态一致
  const orderId = getQueryString(req, 'orderId') || undefined;
  if (orderId) {
    const firstOrder = (result.data?.[0] ?? null) as Record<string, unknown> | null;
    const txHash = typeof firstOrder?.txHash === 'string' ? firstOrder.txHash : undefined;
    await updateOnchainTxByOrderId(orderId, (current) => ({
      ...current,
      phase: result.phase,
      txHash: txHash ?? current.txHash,
    }));
    await appendOnchainTxLog({
      txId: undefined,
      userId: user.openId,
      eventType: 'receipt',
      level: result.phase === 'failed' ? 'error' : 'info',
      message: `Onchain receipt synced with phase ${result.phase}`,
      context: { orderId, txHash, chainIndex: getQueryString(req, 'chainIndex'), phase: result.phase },
    });
  }

  return sendSuccess(res, {
    user: {
      openId: user.openId,
    },
    ...result,
  });
}

/**
 * 处理 /api/onchain/transfer 路由：转账任务创建与执行，包含风控、幂等保护和持久化。
 */
async function handleTransfer(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res);
  }

  const user = requireAuth(req);
  const body = parseBody(req);

  const fromAddress = getBodyString(body, 'fromAddress');
  const toAddress = getBodyString(body, 'toAddress');
  const amount = getBodyString(body, 'amount');
  const symbol = getBodyString(body, 'symbol');
  const chainIndex = getBodyString(body, 'chainIndex');

  if (!fromAddress || !toAddress || !amount || !symbol || !chainIndex) {
    return res.status(400).json({
      code: '400',
      msg: 'fromAddress, toAddress, amount, symbol and chainIndex are required',
      success: false,
      error: 'fromAddress, toAddress, amount, symbol and chainIndex are required',
    });
  }

  const displayAmount = getOptionalBodyString(body, 'displayAmount');
  const slippagePercent = getOptionalBodyString(body, 'slippagePercent');
  const riskError = validateOnchainExecutionRisk({
    chainIndex,
    displayAmount: displayAmount ?? amount,
    slippagePercent,
  });
  if (riskError) {
    return res.status(400).json({
      code: riskError.code,
      msg: riskError.message,
      success: false,
      error: riskError.message,
    });
  }

  const idempotencyKey = buildOnchainIdempotencyKey({
    userId: user.openId,
    chainIndex,
    amount,
    fromToken: `${symbol}:${fromAddress}`,
    toToken: toAddress,
  });
  const existingTx = await findOnchainTxByIdempotencyKey(idempotencyKey);
  if (existingTx && shouldBlockDuplicateExecution(existingTx.phase)) {
    await appendOnchainTxLog({
      txId: existingTx.txId,
      userId: user.openId,
      eventType: 'duplicate',
      level: 'warn',
      message: 'Duplicate Onchain transfer request blocked by idempotency guard',
      context: { idempotencyKey, phase: existingTx.phase },
    });

    return sendSuccess(res, {
      user: { openId: user.openId },
      txId: existingTx.txId,
      idempotent: true,
      ...(existingTx.lastResponse ?? {
        executionModel: 'agent_wallet',
        phase: existingTx.phase,
        orderId: existingTx.orderId,
        txHash: existingTx.txHash,
        progress: [],
      }),
    });
  }

  const txRecord = await createOnchainTxRecord({
    userId: user.openId,
    type: 'transfer',
    phase: 'preview',
    chainIndex,
    userWalletAddress: fromAddress,
    fromToken: symbol,
    toToken: toAddress,
    amount,
    idempotencyKey,
    retryCount: 0,
  });

  await appendOnchainTxLog({
    txId: txRecord.txId,
    userId: user.openId,
    eventType: 'create',
    level: 'info',
    message: 'Onchain transfer task created',
    context: { chainIndex, fromAddress, toAddress, amount, symbol },
  });

  try {
    const result = await executeOnchainTransfer({
      chainIndex,
      amount,
      symbol,
      fromAddress,
      toAddress,
      signedTx: getOptionalBodyString(body, 'signedTx'),
    });

    await updateOnchainTx(txRecord.txId, (current) => ({
      ...current,
      phase: result.phase,
      orderId: result.orderId ?? current.orderId,
      txHash: result.txHash ?? current.txHash,
      lastResponse: result as Record<string, unknown>,
    }));

    await appendOnchainTxLog({
      txId: txRecord.txId,
      userId: user.openId,
      eventType: 'execute',
      level: result.phase === 'failed' ? 'error' : 'info',
      message: `Onchain transfer execution moved to ${result.phase}`,
      context: { orderId: result.orderId, txHash: result.txHash, phase: result.phase },
    });

    return sendSuccess(res, {
      user: { openId: user.openId },
      txId: txRecord.txId,
      ...result,
    });
  } catch (error) {
    const { category, userMessage } = classifyOnchainError(error);
    await updateOnchainTx(txRecord.txId, (current) => ({
      ...current,
      phase: 'failed',
      lastError: JSON.stringify({ category, userMessage, raw: error instanceof Error ? error.message : String(error) }),
      lastResponse: {
        executionModel: 'agent_wallet',
        phase: 'failed',
        progress: [],
        error: userMessage,
      },
    }));

    await appendOnchainTxLog({
      txId: txRecord.txId,
      userId: user.openId,
      eventType: 'failure',
      level: 'error',
      message: 'Onchain transfer execution failed',
      context: { error: error instanceof Error ? error.message : String(error), failureCategory: category },
    });

    throw error;
  }
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
        await handleConfig(req, res);
        return;
      case 'assets':
        await handleAssets(req, res);
        return;
      case 'approvals':
        await handleApprovals(req, res);
        return;
      case 'preview':
        return await handlePreview(req, res);
      case 'execute':
        return await handleExecute(req, res);
      case 'receipt':
        return await handleReceipt(req, res);
      case 'transfer':
        return await handleTransfer(req, res);
      default:
        return sendNotFound(res);
    }
  } catch (error) {
    return sendError(res, error);
  }
}
