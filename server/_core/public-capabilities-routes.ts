import type { Express, Request, Response } from 'express';

import { getAgentWalletProviderMode } from './agent-wallet';
import { getOnchainOsConfig } from './onchain-os';

export function registerPublicCapabilitiesRoutes(app: Express) {
  app.get('/api/public/capabilities', (_req: Request, res: Response) => {
    try {
      const agentWalletProviderMode = getAgentWalletProviderMode();
      const onchainOs = getOnchainOsConfig();

      res.json({
        success: true,
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
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      });
    }
  });
}
