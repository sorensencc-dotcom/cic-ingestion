/**
 * Phase 7 Feature Flag Rollback (Unleash) E2E
 *
 * Verifies Phase7FeatureFlagRollback restores flag snapshots into Unleash,
 * handles missing snapshots, detects state mismatches, and enforces the
 * <5s consistency-check latency gate.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  Phase7FeatureFlagRollback,
  FeatureFlagSnapshot,
  FlagState,
  SnapshotRegistry,
  UnleashClient,
} from '../rollback/featureflag-rollback';

class MockSnapshotRegistry implements SnapshotRegistry {
  private store = new Map<string, FeatureFlagSnapshot>();

  set(key: string, snapshot: FeatureFlagSnapshot): void {
    this.store.set(key, snapshot);
  }

  get(key: string): FeatureFlagSnapshot | undefined {
    return this.store.get(key);
  }
}

class MockUnleashClient implements UnleashClient {
  private flags = new Map<string, FlagState>();

  seed(flagState: FlagState): void {
    this.flags.set(flagState.name, flagState);
  }

  async updateFlag(flagName: string, flagState: FlagState): Promise<void> {
    this.flags.set(flagName, flagState);
  }

  async getFlag(flagName: string): Promise<FlagState | undefined> {
    return this.flags.get(flagName);
  }
}

const sampleFlag: FlagState = {
  name: 'canary-rollout',
  enabled: true,
  strategies: [{ name: 'flexibleRollout', parameters: { rollout: '50' } }],
  variants: [{ name: 'control', weight: 50 }, { name: 'treatment', weight: 50 }],
};

describe('Phase 7 Feature Flag Rollback (Unleash)', () => {
  let registry: MockSnapshotRegistry;
  let unleash: MockUnleashClient;
  let rollback: Phase7FeatureFlagRollback;

  beforeEach(() => {
    registry = new MockSnapshotRegistry();
    unleash = new MockUnleashClient();
    rollback = new Phase7FeatureFlagRollback(registry, unleash);
  });

  it('Test 1: restores snapshot into Unleash and passes consistency check', async () => {
    const snapshot: FeatureFlagSnapshot = {
      proposalId: 'prop-1',
      variantId: 'var-1',
      flags: { 'canary-rollout': sampleFlag },
      timestamp: Date.now(),
    };
    registry.set('proposal:prop-1:var-1:flags', snapshot);

    // Unleash currently has a divergent (pre-rollback) state.
    unleash.seed({ ...sampleFlag, enabled: false, strategies: [] });

    const result = await rollback.restoreFeatureFlagSnapshot('prop-1', 'var-1');

    expect(result.success).toBe(true);
    const restored = await unleash.getFlag('canary-rollout');
    expect(restored).toEqual(sampleFlag);
  });

  it('Test 2: missing snapshot returns snapshot_missing error', async () => {
    const result = await rollback.restoreFeatureFlagSnapshot('prop-missing', 'var-missing');

    expect(result.success).toBe(false);
    expect(result.reason).toBe('snapshot_missing');
  });

  it('Test 3: flag state mismatch fails consistency check', async () => {
    const snapshot: FeatureFlagSnapshot = {
      proposalId: 'prop-2',
      variantId: 'var-2',
      flags: { 'canary-rollout': sampleFlag },
      timestamp: Date.now(),
    };
    registry.set('proposal:prop-2:var-2:flags', snapshot);

    // Seed Unleash with a state that diverges from the snapshot (no update performed).
    unleash.seed({ ...sampleFlag, enabled: false });

    const health = await rollback.checkFeatureFlagConsistency('prop-2', 'var-2');

    expect(health.passed).toBe(false);
    expect(health.reason).toBe('flag_state_mismatch');
  });

  it('Test 4: latency over 5s fails the consistency check', async () => {
    const snapshot: FeatureFlagSnapshot = {
      proposalId: 'prop-3',
      variantId: 'var-3',
      flags: { 'canary-rollout': sampleFlag },
      timestamp: Date.now(),
    };
    registry.set('proposal:prop-3:var-3:flags', snapshot);
    unleash.seed(sampleFlag);

    const realNow = Date.now();
    const nowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(realNow) // start time
      .mockReturnValueOnce(realNow + 5001); // after loop, before latency check

    const health = await rollback.checkFeatureFlagConsistency('prop-3', 'var-3');

    expect(health.passed).toBe(false);
    expect(health.reason).toBe('latency_exceeded');

    nowSpy.mockRestore();
  });
});
