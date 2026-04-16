import { Express, Request, Response } from 'express';

import { sdk } from './sdk';
import { getChatAiIntent } from './chat-ai';
import {
  createSmartGridStrategy,
  getSmartGridStatus,
  parseGridIntent,
  stopSmartGridStrategy,
} from './grid-strategy';

function getBodyString(body: unknown, key: string) {
  const value = body && typeof body === 'object' ? (body as Record<string, unknown>)[key] : undefined;
  return typeof value === 'string' ? value : '';
}

function getOptionalObject(body: unknown, key: string) {
  const value = body && typeof body === 'object' ? (body as Record<string, unknown>)[key] : undefined;
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

async function requireAuth(req: Request, res: Response) {
  try {
    return await sdk.authenticateRequest(req);
  } catch (error) {
    console.error('[Chat AI] auth failed', error);
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
}

function buildGridPayload(openId: string, result: unknown) {
  return {
    user: { openId },
    success: true,
    mockMode: false,
    mode: 'grid-strategy' as const,
    result,
  };
}

export function registerChatAiRoutes(app: Express) {
  const handler = async (req: Request, res: Response) => {
    const user = await requireAuth(req, res);
    if (!user) return;

    const message = getBodyString(req.body, 'message').trim();
    const wallet = getOptionalObject(req.body, 'wallet');

    if (!message) {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    try {
      const gridIntent = parseGridIntent(message);
      if (gridIntent.action === 'create') {
        const result = await createSmartGridStrategy(message);
        res.json(buildGridPayload(user.openId, result));
        return;
      }

      if (gridIntent.action === 'status') {
        const result = await getSmartGridStatus(message);
        res.json(buildGridPayload(user.openId, result));
        return;
      }

      if (gridIntent.action === 'stop') {
        const result = await stopSmartGridStrategy(message);
        res.json(buildGridPayload(user.openId, result));
        return;
      }

      const result = await getChatAiIntent(message, {
        email: typeof wallet?.email === 'string' ? wallet.email : undefined,
        evmAddress: typeof wallet?.evmAddress === 'string' ? wallet.evmAddress : undefined,
        solanaAddress: typeof wallet?.solanaAddress === 'string' ? wallet.solanaAddress : undefined,
      });

      res.json({
        user: {
          openId: user.openId,
        },
        ...result,
      });
    } catch (error) {
      console.error('[Chat AI] intent failed', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to parse chat intent',
      });
    }
  };

  app.post('/api/chat-ai/intent', handler);
  app.post('/api/chat/intent', handler);
}
