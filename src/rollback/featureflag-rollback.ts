/**
 * Phase 7 Feature Flag Rollback (Unleash)
 *
 * Restores feature flag state from a pre-deployment snapshot into Unleash and
 * verifies the restored state matches the snapshot. Snapshot registry and
 * Unleash client are injected so this component can be composed with the
 * real Phase 5 snapshot store and Unleash SDK at Phase 7 wiring time (T7).
 */

export interface FlagState {
  name: string;
  enabled: boolean;
  strategies: Array<{ name: string; parameters?: Record<string, string> }>;
  variants?: Array<{ name: string; weight: number }>;
}

export interface FeatureFlagSnapshot {
  proposalId: string;
  variantId: string;
  flags: Record<string, FlagState>;
  timestamp: number;
}

export interface HealthCheckResult {
  passed: boolean;
  reason?: string;
  check_timestamp: number;
}

export interface RollbackResult {
  success: boolean;
  reason?: string;
}

/** Injected snapshot registry: keyed by `proposal:${proposalId}:${variantId}:flags`. */
export interface SnapshotRegistry {
  get(key: string): FeatureFlagSnapshot | undefined;
}

/** Injected Unleash client: performs flag updates + reads. */
export interface UnleashClient {
  updateFlag(flagName: string, flagState: FlagState): Promise<void>;
  getFlag(flagName: string): Promise<FlagState | undefined>;
}

const LATENCY_LIMIT_MS = 5000;

function flagStatesMatch(expected: FlagState, actual: FlagState | undefined): boolean {
  if (!actual) return false;
  if (expected.enabled !== actual.enabled) return false;

  if (JSON.stringify(expected.strategies) !== JSON.stringify(actual.strategies)) {
    return false;
  }

  if (JSON.stringify(expected.variants) !== JSON.stringify(actual.variants)) {
    return false;
  }

  return true;
}

export class Phase7FeatureFlagRollback {
  constructor(
    private snapshotRegistry: SnapshotRegistry,
    private unleashClient: UnleashClient
  ) {}

  private snapshotKey(proposalId: string, variantId: string): string {
    return `proposal:${proposalId}:${variantId}:flags`;
  }

  async restoreFeatureFlagSnapshot(
    proposalId: string,
    variantId: string
  ): Promise<RollbackResult> {
    const key = this.snapshotKey(proposalId, variantId);
    const snapshot = this.snapshotRegistry.get(key);

    if (!snapshot) {
      return { success: false, reason: 'snapshot_missing' };
    }

    for (const flagName of Object.keys(snapshot.flags)) {
      const flagState = snapshot.flags[flagName];
      try {
        await this.unleashClient.updateFlag(flagName, flagState);
      } catch {
        return { success: false, reason: 'flag_restore_failed' };
      }
    }

    const consistency = await this.checkFeatureFlagConsistency(proposalId, variantId);
    if (!consistency.passed) {
      return { success: false, reason: consistency.reason };
    }

    return { success: true };
  }

  async checkFeatureFlagConsistency(
    proposalId: string,
    variantId: string
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const key = this.snapshotKey(proposalId, variantId);
    const snapshot = this.snapshotRegistry.get(key);

    if (!snapshot) {
      return { passed: false, reason: 'snapshot_missing', check_timestamp: Date.now() };
    }

    for (const flagName of Object.keys(snapshot.flags)) {
      const expected = snapshot.flags[flagName];
      const actual = await this.unleashClient.getFlag(flagName);

      if (!flagStatesMatch(expected, actual)) {
        return { passed: false, reason: 'flag_state_mismatch', check_timestamp: Date.now() };
      }
    }

    const elapsed = Date.now() - startTime;
    if (elapsed > LATENCY_LIMIT_MS) {
      return { passed: false, reason: 'latency_exceeded', check_timestamp: Date.now() };
    }

    return { passed: true, check_timestamp: Date.now() };
  }
}
