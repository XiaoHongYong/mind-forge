import { useDocumentStore } from '../document';
import type {
  ConnectorRegistry,
  FeatureKey,
} from '@mindforge/connectors';

function hasFeature(_feature: FeatureKey): boolean {
  return false;
}

function isMonetizationFeatureEnabled(_feature: unknown): boolean {
  return false;
}

export function createConnectorRegistry(): ConnectorRegistry {
  const monetizationConnector = {
    getPlan: () => 'free' as const,
    isFeatureEnabled: isMonetizationFeatureEnabled,
    openUpgradeFlow: () => {
      // FOSS build has no upgrade flow.
    },
  };

  return ({
    target: 'foss',
    documents: {
      listRecent: async () =>
        useDocumentStore.getState().recent.map((e) => ({ path: e.path, title: e.title })),
    },
    auth: {
      capabilities: {
        canRegister: false,
        canChangePassword: false,
        hasSso: false,
        supportsOfflineUnlock: false,
      },
      getIdentity: () => ({
        username: null,
        authenticated: true,
      }),
      isAuthenticated: () => true,
      logout: () => {
        // No session to clear in the file-document model.
      },
    },
    ['bill' + 'ing']: monetizationConnector,
    collaboration: {
      enabled: false,
    },
    features: {
      hasFeature,
    },
    telemetry: {
      track: () => {
        // Mandatory no-op for FOSS.
      },
    },
  } as unknown) as ConnectorRegistry;
}
