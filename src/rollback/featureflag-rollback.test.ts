import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Phase7FeatureFlagRollback, FeatureFlagSnapshot, SnapshotRegistry, UnleashClient, FlagState } from './featureflag-rollback';

describe('Phase7FeatureFlagRollback', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const proposalId = 'prop-123';
  const variantId = 'var-456';
  const snapshotKey = `proposal:${proposalId}:${variantId}:flags`;

  const dummyFlags: Record<string, FlagState> = {
    'new-search-v2': {
      name: 'new-search-v2',
      enabled: true,
      strategies: [{ name: 'default' }],
      variants: [{ name: 'variant-a', weight: 100 }],
    },
  };

  const mockSnapshot: FeatureFlagSnapshot = {
    proposalId,
    variantId,
    flags: dummyFlags,
    timestamp: Date.now(),
  };

  it('restores feature flag snapshot successfully', async () => {
    const mockRegistry: SnapshotRegistry = {
      get: jest.fn((key) => key === snapshotKey ? mockSnapshot : undefined) as any,
    };

    const mockUnleash: UnleashClient = {
      updateFlag: jest.fn(async () => {}) as any,
      getFlag: jest.fn(async (name) => name === 'new-search-v2' ? dummyFlags['new-search-v2'] : undefined) as any,
    };

    const rollback = new Phase7FeatureFlagRollback(mockRegistry, mockUnleash);
    const result = await rollback.restoreFeatureFlagSnapshot(proposalId, variantId);

    expect(result.success).toBe(true);
    expect(mockRegistry.get).toHaveBeenCalledWith(snapshotKey);
    expect(mockUnleash.updateFlag).toHaveBeenCalledWith('new-search-v2', dummyFlags['new-search-v2']);
  });

  it('fails restore if snapshot registry is missing target key', async () => {
    const mockRegistry: SnapshotRegistry = {
      get: jest.fn(() => undefined) as any,
    };
    const mockUnleash: UnleashClient = {
      updateFlag: jest.fn() as any,
      getFlag: jest.fn() as any,
    };

    const rollback = new Phase7FeatureFlagRollback(mockRegistry, mockUnleash);
    const result = await rollback.restoreFeatureFlagSnapshot(proposalId, variantId);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('snapshot_missing');
  });

  it('fails restore if unleash update fails', async () => {
    const mockRegistry: SnapshotRegistry = {
      get: jest.fn(() => mockSnapshot) as any,
    };
    const mockUnleash: UnleashClient = {
      updateFlag: jest.fn(async () => {
        throw new Error('unleash error');
      }) as any,
      getFlag: jest.fn() as any,
    };

    const rollback = new Phase7FeatureFlagRollback(mockRegistry, mockUnleash);
    const result = await rollback.restoreFeatureFlagSnapshot(proposalId, variantId);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('flag_restore_failed');
  });

  describe('checkFeatureFlagConsistency', () => {
    it('passes when flag states match', async () => {
      const mockRegistry: SnapshotRegistry = {
        get: jest.fn(() => mockSnapshot) as any,
      };
      const mockUnleash: UnleashClient = {
        updateFlag: jest.fn() as any,
        getFlag: jest.fn(async () => dummyFlags['new-search-v2']) as any,
      };

      const rollback = new Phase7FeatureFlagRollback(mockRegistry, mockUnleash);
      const result = await rollback.checkFeatureFlagConsistency(proposalId, variantId);

      expect(result.passed).toBe(true);
    });

    it('fails when flag states do not match', async () => {
      const mockRegistry: SnapshotRegistry = {
        get: jest.fn(() => mockSnapshot) as any,
      };
      const mismatchedFlag: FlagState = {
        name: 'new-search-v2',
        enabled: false,
        strategies: [],
      };
      const mockUnleash: UnleashClient = {
        updateFlag: jest.fn() as any,
        getFlag: jest.fn(async () => mismatchedFlag) as any,
      };

      const rollback = new Phase7FeatureFlagRollback(mockRegistry, mockUnleash);
      const result = await rollback.checkFeatureFlagConsistency(proposalId, variantId);

      expect(result.passed).toBe(false);
      expect(result.reason).toBe('flag_state_mismatch');
    });

    it('fails when latency gate limit is exceeded', async () => {
      const mockRegistry: SnapshotRegistry = {
        get: jest.fn(() => mockSnapshot) as any,
      };
      const mockUnleash: UnleashClient = {
        updateFlag: jest.fn() as any,
        getFlag: jest.fn(async () => {
          await new Promise((resolve) => setTimeout(resolve, 5100));
          return dummyFlags['new-search-v2'];
        }) as any,
      };

      const rollback = new Phase7FeatureFlagRollback(mockRegistry, mockUnleash);
      const resultPromise = rollback.checkFeatureFlagConsistency(proposalId, variantId);

      await jest.advanceTimersByTimeAsync(5100);

      const result = await resultPromise;
      expect(result.passed).toBe(false);
      expect(result.reason).toBe('latency_exceeded');
    });
  });
});
