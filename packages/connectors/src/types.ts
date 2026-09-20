export const CONNECTOR_API_VERSION = '0.2.0';

export type DeploymentTarget = 'foss' | 'server' | 'saas' | 'enterprise';

export type FeatureKey =
  | 'realtime-collaboration'
  | 'cloud-version-history'
  | 'public-share-links'
  | 'billing-upgrade'
  | 'admin-controls';

export type BillingFeatureKey =
  | 'large-exports'
  | 'advanced-attachments'
  | 'team-collaboration'
  | 'admin-controls';

/** Thin document IO surface for FOSS / hosted shells. */
export interface DocumentConnector {
  /** Absolute paths the host can re-open (desktop). */
  listRecent?(): Promise<Array<{ path: string; title: string }>>;
}

export interface UserIdentity {
  username: string | null;
  authenticated: boolean;
}

export interface AuthCapabilities {
  canRegister: boolean;
  canChangePassword: boolean;
  hasSso: boolean;
  supportsOfflineUnlock: boolean;
}

export interface AuthConnector {
  capabilities: AuthCapabilities;
  getIdentity(): UserIdentity;
  isAuthenticated(): boolean;
  logout(): void;
}

export interface BillingConnector {
  getPlan(): 'free' | 'paid' | 'enterprise';
  isFeatureEnabled(feature: BillingFeatureKey): boolean;
  openUpgradeFlow(): void;
}

export interface CollaborationConnector {
  enabled: boolean;
}

export interface FeatureFlagConnector {
  hasFeature(feature: FeatureKey): boolean;
}

export interface TelemetryConnector {
  track(event: string, payload?: Record<string, unknown>): void;
}

export interface ConnectorRegistry {
  target: DeploymentTarget;
  documents: DocumentConnector;
  auth: AuthConnector;
  billing: BillingConnector;
  collaboration: CollaborationConnector;
  features: FeatureFlagConnector;
  telemetry: TelemetryConnector;
}
