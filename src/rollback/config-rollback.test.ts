import { describe, it, expect, jest } from '@jest/globals';
import { Phase7ConfigRollback, ConfigSnapshot, SnapshotRegistryClient, EtcdClient } from './config-rollback';

describe('Phase7ConfigRollback', () => {
  const proposalId = 'prop-123';
  const variantId = 'var-456';
  const configKey = `proposal:${proposalId}:${variantId}:config`;
  const etcdKey = `/cic/deployment/config/${proposalId}/${variantId}/`;

  const dummyState = { servicePort: 8080, dbName: 'testdb' };
  // Checksum of dummyState (sorted keys: dbName, servicePort)
  const correctChecksum = 'ec43cd73ff6ff04c56a9577f6b357344b496eeca6c46bee63eb2f9f3b5e92af7';

  const mockSnapshot: ConfigSnapshot = {
    proposalId,
    variantId,
    configState: dummyState,
    checksum: correctChecksum,
    etcdRevision: 100,
    timestamp: Date.now(),
  };

  it('restores config snapshot successfully', async () => {
    const mockRegistry: SnapshotRegistryClient = {
      get: jest.fn(async (key) => key === configKey ? mockSnapshot : undefined) as any,
    };

    const mockEtcd: EtcdClient = {
      put: jest.fn(async () => ({ succeeded: true, revision: 101 })) as any,
      get: jest.fn(async (key) => key === etcdKey ? dummyState : undefined) as any,
    };

    const rollback = new Phase7ConfigRollback(mockRegistry, mockEtcd);
    const result = await rollback.restoreConfigSnapshot(proposalId, variantId);

    expect(result.success).toBe(true);
    expect(mockRegistry.get).toHaveBeenCalledWith(configKey);
    expect(mockEtcd.put).toHaveBeenCalledWith(etcdKey, dummyState);
  });

  it('fails restore if snapshot registry is missing target key', async () => {
    const mockRegistry: SnapshotRegistryClient = {
      get: jest.fn(async () => undefined) as any,
    };
    const mockEtcd: EtcdClient = {
      put: jest.fn() as any,
      get: jest.fn() as any,
    };

    const rollback = new Phase7ConfigRollback(mockRegistry, mockEtcd);
    const result = await rollback.restoreConfigSnapshot(proposalId, variantId);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('snapshot_missing');
  });

  it('fails restore if etcd transaction fails', async () => {
    const mockRegistry: SnapshotRegistryClient = {
      get: jest.fn(async () => mockSnapshot) as any,
    };
    const mockEtcd: EtcdClient = {
      put: jest.fn(async () => ({ succeeded: false, revision: 0 })) as any,
      get: jest.fn() as any,
    };

    const rollback = new Phase7ConfigRollback(mockRegistry, mockEtcd);
    const result = await rollback.restoreConfigSnapshot(proposalId, variantId);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('etcd_transaction_failed');
  });

  it('fails restore if etcd returns mismatching checksum', async () => {
    const mockRegistry: SnapshotRegistryClient = {
      get: jest.fn(async () => mockSnapshot) as any,
    };
    const mockEtcd: EtcdClient = {
      put: jest.fn(async () => ({ succeeded: true, revision: 101 })) as any,
      get: jest.fn(async () => ({ different: 'state' })) as any,
    };

    const rollback = new Phase7ConfigRollback(mockRegistry, mockEtcd);
    const result = await rollback.restoreConfigSnapshot(proposalId, variantId);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('checksum_mismatch');
  });

  describe('checkConfigConsistency', () => {
    it('passes if current config matches snapshot', async () => {
      const mockRegistry: SnapshotRegistryClient = {
        get: jest.fn(async () => mockSnapshot) as any,
      };
      const mockEtcd: EtcdClient = {
        put: jest.fn() as any,
        get: jest.fn(async () => dummyState) as any,
      };

      const rollback = new Phase7ConfigRollback(mockRegistry, mockEtcd);
      const result = await rollback.checkConfigConsistency(proposalId, variantId);

      expect(result.passed).toBe(true);
    });

    it('fails if config has mismatching checksum', async () => {
      const mockRegistry: SnapshotRegistryClient = {
        get: jest.fn(async () => mockSnapshot) as any,
      };
      const mockEtcd: EtcdClient = {
        put: jest.fn() as any,
        get: jest.fn(async () => ({ unexpected: 'data' })) as any,
      };

      const rollback = new Phase7ConfigRollback(mockRegistry, mockEtcd);
      const result = await rollback.checkConfigConsistency(proposalId, variantId);

      expect(result.passed).toBe(false);
      expect(result.reason).toBe('checksum_mismatch');
    });

    it('fails if latency gate exceeded', async () => {
      const mockRegistry: SnapshotRegistryClient = {
        get: jest.fn(async () => mockSnapshot) as any,
      };
      const mockEtcd: EtcdClient = {
        put: jest.fn() as any,
        get: jest.fn(async () => {
          await new Promise((resolve) => setTimeout(resolve, 1100));
          return dummyState;
        }) as any,
      };

      const rollback = new Phase7ConfigRollback(mockRegistry, mockEtcd);
      const result = await rollback.checkConfigConsistency(proposalId, variantId);

      expect(result.passed).toBe(false);
      expect(result.reason).toBe('latency_gate_exceeded');
    });
  });
});
