/**
 * Phase 7 Config Rollback (etcd)
 *
 * Restores config state to etcd from a pre-deployment snapshot when a Phase 6
 * rollback trigger fires. Validates checksum + raft consensus on write, and
 * enforces a <1s latency gate on consistency checks.
 */

import * as crypto from 'crypto';

export interface ConfigSnapshot {
  proposalId: string;
  variantId: string;
  configState: Record<string, unknown>;
  checksum: string;
  etcdRevision: number;
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

export interface SnapshotRegistryClient {
  get(key: string): Promise<ConfigSnapshot | undefined>;
}

export interface EtcdTransactionResult {
  succeeded: boolean;
  revision: number;
}

export interface EtcdClient {
  put(key: string, value: Record<string, unknown>): Promise<EtcdTransactionResult>;
  get(key: string): Promise<Record<string, unknown> | undefined>;
}

const LATENCY_GATE_MS = 1000;

function computeChecksum(configState: Record<string, unknown>): string {
  const serialized = JSON.stringify(configState, Object.keys(configState).sort());
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

export class Phase7ConfigRollback {
  constructor(
    private readonly snapshotRegistry: SnapshotRegistryClient,
    private readonly etcdClient: EtcdClient
  ) {}

  async restoreConfigSnapshot(proposalId: string, variantId: string): Promise<RollbackResult> {
    const key = `proposal:${proposalId}:${variantId}:config`;
    const snapshot = await this.snapshotRegistry.get(key);

    if (!snapshot) {
      return { success: false, reason: 'snapshot_missing' };
    }

    const etcdKey = `/cic/deployment/config/${proposalId}/${variantId}/`;
    const txnResult = await this.etcdClient.put(etcdKey, snapshot.configState);

    if (!txnResult.succeeded) {
      return { success: false, reason: 'etcd_transaction_failed' };
    }

    const restored = await this.etcdClient.get(etcdKey);
    if (!restored) {
      return { success: false, reason: 'etcd_read_failed' };
    }

    const restoredChecksum = computeChecksum(restored);
    if (restoredChecksum !== snapshot.checksum) {
      return { success: false, reason: 'checksum_mismatch' };
    }

    return { success: true };
  }

  async checkConfigConsistency(proposalId: string, variantId: string): Promise<HealthCheckResult> {
    const startedAt = Date.now();
    const key = `proposal:${proposalId}:${variantId}:config`;
    const snapshot = await this.snapshotRegistry.get(key);

    if (!snapshot) {
      return { passed: false, reason: 'snapshot_missing', check_timestamp: Date.now() };
    }

    const etcdKey = `/cic/deployment/config/${proposalId}/${variantId}/`;
    const currentConfig = await this.etcdClient.get(etcdKey);

    if (!currentConfig) {
      return { passed: false, reason: 'config_missing', check_timestamp: Date.now() };
    }

    const currentChecksum = computeChecksum(currentConfig);
    const elapsedMs = Date.now() - startedAt;

    if (elapsedMs > LATENCY_GATE_MS) {
      return { passed: false, reason: 'latency_gate_exceeded', check_timestamp: Date.now() };
    }

    if (currentChecksum !== snapshot.checksum) {
      return { passed: false, reason: 'checksum_mismatch', check_timestamp: Date.now() };
    }

    return { passed: true, check_timestamp: Date.now() };
  }
}
