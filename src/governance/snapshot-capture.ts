/**
 * Phase 5 Snapshot Capture
 *
 * Captures pre-deployment config + feature flag state so Phase 6/7 rollback
 * has a known-good snapshot to restore. Phase 5 must call
 * capturePreDeploymentSnapshot() after variant approval but before deployment.
 */

export interface DeploymentSnapshot {
  proposal_id: string;
  variant_id: string;
  config_snapshot: Record<string, any>;
  feature_flags_snapshot: Record<string, boolean>;
  captured_at: number;
}

interface SnapshotRegistry {
  snapshots: Map<string, DeploymentSnapshot>;
}

export class Phase5SnapshotCapture {
  private registry: SnapshotRegistry = { snapshots: new Map() };

  /**
   * Phase 5 must call this after variant approval but before deployment.
   * Captures current config state + feature flag state.
   */
  capturePreDeploymentSnapshot(
    proposalId: string,
    variantId: string,
    configState: Record<string, any>,
    featureFlagState: Record<string, boolean>
  ): DeploymentSnapshot {
    const snapshot: DeploymentSnapshot = {
      proposal_id: proposalId,
      variant_id: variantId,
      config_snapshot: { ...configState },
      feature_flags_snapshot: { ...featureFlagState },
      captured_at: Date.now(),
    };

    const key = `${proposalId}:${variantId}`;
    this.registry.snapshots.set(key, snapshot);

    return snapshot;
  }

  getSnapshot(proposalId: string, variantId: string): DeploymentSnapshot | undefined {
    const key = `${proposalId}:${variantId}`;
    return this.registry.snapshots.get(key);
  }

  hasSnapshot(proposalId: string, variantId: string): boolean {
    return this.getSnapshot(proposalId, variantId) !== undefined;
  }

  snapshotExists(proposalId: string, variantId: string): boolean {
    const snapshot = this.getSnapshot(proposalId, variantId);
    if (!snapshot) return false;

    // Snapshot must contain non-empty config + flag state
    const hasConfig = Object.keys(snapshot.config_snapshot).length > 0;
    const hasFlags = Object.keys(snapshot.feature_flags_snapshot).length > 0;

    return hasConfig && hasFlags;
  }
}
