import type { VercelRequest, VercelResponse } from '@vercel/node';

import { getAgentWalletProviderMode } from '../../server/_core/agent-wallet';
import { getOnchainOsConfig } from '../../server/_core/onchain-os';
import { setCors, toErrorMessage, toSuccessEnvelope } from '../_standalone-auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res, req);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    res.status(405).json({ success: false, error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  try {
    const agentWalletProviderMode = getAgentWalletProviderMode();
    const onchainOs = getOnchainOsConfig();

    res.status(200).json(
      toSuccessEnvelope({
        agentWallet: {
          providerMode: agentWalletProviderMode,
          walletEmailLogin: agentWalletProviderMode === 'okx',
        },
        onchainOs: {
          providerMode: onchainOs.providerMode,
          authMode: onchainOs.authMode,
          executionModel: onchainOs.executionModel,
          projectIdConfigured: onchainOs.projectIdConfigured,
          builderCodeConfigured: onchainOs.builderCodeConfigured,
        },
      }),
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      error: toErrorMessage(error),
    });
  }
}
