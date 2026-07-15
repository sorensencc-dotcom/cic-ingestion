/**
 * Phase 7 Config Rollback E2E
 *
 * Verifies Phase7ConfigRollback restores config snapshots to etcd and
 * validates post-restore consistency (checksum + latency gate).
 */

import { describe, it, expect } from '@jest/globals';
import * as crypto from 'crypto';
import {
  Phase7ConfigRollback,
  ConfigSnapshot,
  SnapshotRegistryClient,
  EtcdClient,
  EtcdTransactionResult,
} from '../rollback/config-rollback';

function computeChecksum(configState: Record<string, unknown>): string {
  const serialized = JSON.stringify(configState, Object.keys(configState).sort());
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

function makeSnapshot(overrides: Partial<ConfigSnapshot> = {}): ConfigSnapshot {
  const configState = overrides.configState ?? {
    enrichment_strategy: 'ml-v1',
    confidence_threshold: 0.75,
  };
  return {
    proposalId: 'proposal-1',
    variantId: 'variant-a',
    configState,
    checksum: computeChecksum(configState),
    etcdRevision: 42,
    timestamp: Date.now(),
    ...overrides,
  };
}

class MockSnapshotRegistry implements SnapshotRegistryClient {
  private store = new Map<string, ConfigSnapshot>();

  set(key: string, snapshot: ConfigSnapshot): void {
    this.store.set(key, snapshot);
  }

  async get(key: string): Promise<ConfigSnapshot | undefined> {
    return this.store.get(key);
  }
}

class MockEtcdClient implements EtcdClient {
  private store = new Map<string, Record<string, unknown>>();
  public getDelayMs = 0;

  async put(key: string, value: Record<string, unknown>): Promise<EtcdTransactionResult> {
    this.store.set(key, { ...value });
    return { succeeded: true, revision: 43 };
  }

  async get(key: string): Promise<Record<string, unknown> | undefined> {
    if (this.getDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.getDelayMs));
    }
    return this.store.get(key);
  }

  seed(key: string, value: Record<string, unknown>): void {
    this.store.set(key, { ...value });
  }
}

describe('Phase7ConfigRollback', () => {
  it('restores config snapshot successfully and passes consistency check', async () => {
    const registry = new MockSnapshotRegistry();
    const etcd = new MockEtcdClient();
    const snapshot = makeSnapshot();

    registry.set('proposal:proposal-1:variant-a:config', snapshot);

    const rollback = new Phase7ConfigRollback(registry, etcd);

    const result = await rollback.restoreConfigSnapshot('proposal-1', 'variant-a');
    expect(result.success).toBe(true);
    expect(result.reason).toBeUndefined();

    const health = await rollback.checkConfigConsistency('proposal-1', 'variant-a');
    expect(health.passed).toBe(true);
  });

  it('returns snapshot_missing when no snapshot exists', async () => {
    const registry = new MockSnapshotRegistry();
    const etcd = new MockEtcdClient();
    const rollback = new Phase7ConfigRollback(registry, etcd);

    const result = await rollback.restoreConfigSnapshot('proposal-x', 'variant-z');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('snapshot_missing');
  });

  it('fails consistency check on checksum mismatch', async () => {
    const registry = new MockSnapshotRegistry();
    const etcd = new MockEtcdClient();
    const snapshot = makeSnapshot();

    registry.set('proposal:proposal-1:variant-a:config', snapshot);
    // Seed etcd with drifted config that doesn't match the snapshot checksum.
    etcd.seed('/cic/deployment/config/proposal-1/variant-a/', {
      enrichment_strategy: 'ml-v2-drifted',
      confidence_threshold: 0.99,
    });

    const rollback = new Phase7ConfigRollback(registry, etcd);

    const health = await rollback.checkConfigConsistency('proposal-1', 'variant-a');
    expect(health.passed).toBe(false);
    expect(health.reason).toBe('checksum_mismatch');
  });

  it('fails consistency check when latency exceeds 1s gate', async () => {
    const registry = new MockSnapshotRegistry();
    const etcd = new MockEtcdClient();
    const snapshot = makeSnapshot();

    registry.set('proposal:proposal-1:variant-a:config', snapshot);
    etcd.seed('/cic/deployment/config/proposal-1/variant-a/', snapshot.configState);
    etcd.getDelayMs = 1100;

    const rollback = new Phase7ConfigRollback(registry, etcd);

    const health = await rollback.checkConfigConsistency('proposal-1', 'variant-a');
    expect(health.passed).toBe(false);
    expect(health.reason).toBe('latency_gate_exceeded');
  }, 10000);
});
