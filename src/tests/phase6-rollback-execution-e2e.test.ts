/**
 * Phase 6 Rollback Execution Engine E2E
 * Covers full rollback pipeline: Detection → Transactional reversal → Verification
 *
 * Test Plan:
 * 1. Identify rollback targets (database, cache, config, state)
 * 2. Execute transactional rollbacks (all-or-nothing)
 * 3. Verify rollback success via health checks
 * 4. Handle partial failures gracefully (dependency resolution)
 * 5. Phase 5→6 integration (promotion/cohort decision → rollback execution)
 * 6. Batch rollbacks with ordering
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  RollbackTarget,
  RollbackTargetDetector,
  StateStore,
  DatabaseRollback,
  CacheRollback,
  RollbackExecutor,
} from '../governance/rollback-executor';

// Tests

describe('Phase 6: Rollback Execution Engine', () => {
  let detector: RollbackTargetDetector;
  let executor: RollbackExecutor;

  beforeEach(() => {
    detector = new RollbackTargetDetector();
    executor = new RollbackExecutor();

    // Setup initial state
    executor.getStateStore().set('user:config', { version: 1, strategy: 'v1' });
    executor.getStateStore().set('user:config', { version: 2, strategy: 'v2' });

    executor.getDatabase().createTable('users');
    executor.getDatabase().insert('users', '1', { id: 1, name: 'Alice' });
    executor.getDatabase().snapshot('users');

    executor.getCache().set('cache:v2', { cached: true, value: 'v2_data' });
  });

  describe('Rollback Target Detection', () => {
    it('records deployment targets', () => {
      const targets: RollbackTarget[] = [
        {
          target_id: 'db-users',
          type: 'database',
          resource_name: 'users',
          version_to_revert: '1',
        },
      ];

      detector.recordDeployment('proposal-1', 'variant-a', targets);
      const detected = detector.detectTargets('proposal-1', 'variant-a');

      expect(detected.length).toBe(1);
      expect(detected[0].target_id).toBe('db-users');
    });

    it('detects multiple targets', () => {
      const targets: RollbackTarget[] = [
        {
          target_id: 'state-config',
          type: 'state_store',
          resource_name: 'user:config',
          version_to_revert: '0',
        },
        {
          target_id: 'db-users',
          type: 'database',
          resource_name: 'users',
          version_to_revert: '1',
        },
        {
          target_id: 'cache-v2',
          type: 'cache',
          resource_name: 'cache:v2',
          version_to_revert: '0',
        },
      ];

      detector.recordDeployment('proposal-1', 'variant-a', targets);
      const detected = detector.detectTargets('proposal-1', 'variant-a');

      expect(detected.length).toBe(3);
    });

    it('resolves dependencies (topological sort)', () => {
      const targets: RollbackTarget[] = [
        {
          target_id: 'cache-v2',
          type: 'cache',
          resource_name: 'cache:v2',
          version_to_revert: '0',
          dependencies: ['db-users'],
        },
        {
          target_id: 'db-users',
          type: 'database',
          resource_name: 'users',
          version_to_revert: '1',
          dependencies: [],
        },
      ];

      const resolved = detector.resolveDependencies(targets);

      // db-users should come first (depended upon)
      expect(resolved[0].target_id).toBe('db-users');
      expect(resolved[1].target_id).toBe('cache-v2');
    });

    it('handles cyclic dependencies gracefully', () => {
      const targets: RollbackTarget[] = [
        {
          target_id: 'target-a',
          type: 'config',
          resource_name: 'config-a',
          version_to_revert: '0',
          dependencies: ['target-b'],
        },
        {
          target_id: 'target-b',
          type: 'config',
          resource_name: 'config-b',
          version_to_revert: '0',
          dependencies: ['target-a'],
        },
      ];

      // Should not throw; cyclic deps return empty (safe fail)
      const resolved = detector.resolveDependencies(targets);
      expect(() => detector.resolveDependencies(targets)).not.toThrow();
    });
  });

  describe('State Store Rollback', () => {
    it('rolls back to previous version', () => {
      const store = executor.getStateStore();

      store.set('key-1', 'value-v1');
      store.set('key-1', 'value-v2');

      expect(store.get('key-1')).toBe('value-v2');

      const success = store.rollback('key-1', '0');

      expect(success).toBe(true);
      expect(store.get('key-1')).toBe('value-v1');
    });

    it('returns false for non-existent version', () => {
      const store = executor.getStateStore();

      store.set('key-1', 'value-v1');

      const success = store.rollback('key-1', '99');

      expect(success).toBe(false);
    });

    it('maintains health check', () => {
      const store = executor.getStateStore();

      store.set('key-1', 'value');
      const healthy = store.isHealthy('key-1');

      expect(healthy).toBe(true);
    });
  });

  describe('Database Rollback', () => {
    it('rolls back table to snapshot', () => {
      const db = executor.getDatabase();

      db.createTable('products');
      db.insert('products', 'p1', { id: 'p1', name: 'Product 1' });
      db.snapshot('products');

      db.insert('products', 'p2', { id: 'p2', name: 'Product 2' });
      expect(db.getTableSize('products')).toBe(2);

      const success = db.rollbackToSnapshot('products');

      expect(success).toBe(true);
      expect(db.getTableSize('products')).toBe(1);
    });

    it('returns false for no snapshot', () => {
      const db = executor.getDatabase();

      db.createTable('orders');
      db.insert('orders', 'o1', { id: 'o1' });

      const success = db.rollbackToSnapshot('orders');

      expect(success).toBe(false);
    });

    it('health check reflects table state', () => {
      const db = executor.getDatabase();

      db.createTable('logs');
      db.insert('logs', 'log-1', { message: 'test' });

      const healthy = db.isHealthy('logs');

      expect(healthy).toBe(true);
    });
  });

  describe('Cache Rollback', () => {
    it('rolls back to previous version', () => {
      const cache = executor.getCache();

      cache.set('session:user123', { data: 'v1', version: 1 });
      cache.set('session:user123', { data: 'v2', version: 2 });

      const success = cache.rollback('session:user123', 0);

      expect(success).toBe(true);
      expect(cache.get('session:user123').version).toBe(1);
    });

    it('invalidates cache entry', () => {
      const cache = executor.getCache();

      cache.set('key-1', 'value-1');
      cache.invalidate('key-1');

      expect(cache.get('key-1')).toBeUndefined();
    });

    it('returns false for invalid version', () => {
      const cache = executor.getCache();

      cache.set('key-1', 'v1');

      const success = cache.rollback('key-1', 99);

      expect(success).toBe(false);
    });
  });

  describe('Rollback Executor', () => {
    it('executes single target rollback', async () => {
      const targets: RollbackTarget[] = [
        {
          target_id: 'state-config',
          type: 'state_store',
          resource_name: 'user:config',
          version_to_revert: '0',
        },
      ];

      const result = await executor.executeRollback(
        'rollback-1',
        'proposal-1',
        'variant-a',
        targets
      );

      expect(result.overall_status).toBe('success');
      expect(result.steps_executed.length).toBe(1);
      expect(result.steps_executed[0].success).toBe(true);
    });

    it('executes multiple target rollback', async () => {
      const targets: RollbackTarget[] = [
        {
          target_id: 'db-users',
          type: 'database',
          resource_name: 'users',
          version_to_revert: '1',
        },
        {
          target_id: 'cache-v2',
          type: 'cache',
          resource_name: 'cache:v2',
          version_to_revert: '0',
        },
      ];

      const result = await executor.executeRollback(
        'rollback-1',
        'proposal-1',
        'variant-a',
        targets
      );

      expect(result.overall_status).toBe('success');
      expect(result.steps_executed.length).toBe(2);
    });

    it('detects partial failures', async () => {
      const targets: RollbackTarget[] = [
        {
          target_id: 'valid-state',
          type: 'state_store',
          resource_name: 'user:config',
          version_to_revert: '0',
        },
        {
          target_id: 'invalid-db',
          type: 'database',
          resource_name: 'nonexistent_table',
          version_to_revert: '1',
        },
      ];

      const result = await executor.executeRollback(
        'rollback-1',
        'proposal-1',
        'variant-a',
        targets
      );

      expect(result.overall_status).toBe('partial_failure');
      expect(result.steps_executed.some(s => s.success)).toBe(true);
      expect(result.steps_executed.some(s => !s.success)).toBe(true);
    });

    it('measures rollback execution time', async () => {
      const targets: RollbackTarget[] = [
        {
          target_id: 'state-config',
          type: 'state_store',
          resource_name: 'user:config',
          version_to_revert: '0',
        },
      ];

      const result = await executor.executeRollback(
        'rollback-1',
        'proposal-1',
        'variant-a',
        targets
      );

      expect(result.rollback_time_ms).toBeGreaterThanOrEqual(0);
    });

    it('provides health check results', async () => {
      const targets: RollbackTarget[] = [
        {
          target_id: 'db-users',
          type: 'database',
          resource_name: 'users',
          version_to_revert: '1',
        },
      ];

      const result = await executor.executeRollback(
        'rollback-1',
        'proposal-1',
        'variant-a',
        targets
      );

      expect(result.health_checks.length).toBe(1);
      expect(result.health_checks[0].healthy).toBe(true);
    });
  });

  describe('Phase 5→6 Integration', () => {
    it('converts Phase 5 rollback decision to Phase 6 execution', async () => {
      // Phase 5: Cohort promotion failed, decide to rollback variant
      const phase5Decision = {
        proposal_id: 'proposal-1',
        variant_id: 'variant-a',
        decision: 'rollback',
        reason: 'Error rate exceeded threshold',
      };

      // Phase 6: Record deployment targets, then execute rollback
      const targets: RollbackTarget[] = [
        {
          target_id: 'state-config',
          type: 'state_store',
          resource_name: 'user:config',
          version_to_revert: '0',
        },
        {
          target_id: 'db-users',
          type: 'database',
          resource_name: 'users',
          version_to_revert: '1',
        },
      ];

      detector.recordDeployment(
        phase5Decision.proposal_id,
        phase5Decision.variant_id,
        targets
      );

      const detectedTargets = detector.detectTargets(
        phase5Decision.proposal_id,
        phase5Decision.variant_id
      );

      const result = await executor.executeRollback(
        `rollback-${phase5Decision.proposal_id}`,
        phase5Decision.proposal_id,
        phase5Decision.variant_id,
        detectedTargets
      );

      expect(result.overall_status).toBe('success');
    });

    it('preserves rollback lineage', async () => {
      const proposalId = 'proposal-1';
      const variantId = 'variant-a';
      const rollbackId = `rollback-${proposalId}`;

      const targets: RollbackTarget[] = [
        {
          target_id: 'state-config',
          type: 'state_store',
          resource_name: 'user:config',
          version_to_revert: '0',
        },
      ];

      detector.recordDeployment(proposalId, variantId, targets);

      const result = await executor.executeRollback(
        rollbackId,
        proposalId,
        variantId,
        detector.detectTargets(proposalId, variantId)
      );

      expect(result.rollback_id).toBe(rollbackId);
      expect(result.steps_executed[0].before_state).toBeDefined();
      expect(result.steps_executed[0].after_state).toBeDefined();
    });
  });

  describe('Batch Rollbacks', () => {
    it('executes rollbacks for multiple proposals', async () => {
      const proposals = [
        { proposal_id: 'proposal-1', variant_id: 'variant-a' },
        { proposal_id: 'proposal-2', variant_id: 'variant-b' },
      ];

      const results = [];

      for (const { proposal_id, variant_id } of proposals) {
        const targets: RollbackTarget[] = [
          {
            target_id: `state-${proposal_id}`,
            type: 'state_store',
            resource_name: `config:${proposal_id}`,
            version_to_revert: '0',
          },
        ];

        // Simulate initial setup
        executor.getStateStore().set(`config:${proposal_id}`, { version: 1 });
        executor.getStateStore().set(`config:${proposal_id}`, { version: 2 });

        detector.recordDeployment(proposal_id, variant_id, targets);

        const result = await executor.executeRollback(
          `rollback-${proposal_id}`,
          proposal_id,
          variant_id,
          targets
        );

        results.push(result);
      }

      expect(results.length).toBe(2);
      results.forEach(r => {
        expect(r.overall_status).toBe('success');
      });
    });

    it('respects rollback ordering with dependencies', async () => {
      const targets: RollbackTarget[] = [
        {
          target_id: 'cache-entry',
          type: 'cache',
          resource_name: 'cache:data',
          version_to_revert: '0',
          dependencies: ['db-table'],
        },
        {
          target_id: 'db-table',
          type: 'database',
          resource_name: 'data_table',
          version_to_revert: '1',
          dependencies: [],
        },
      ];

      executor.getDatabase().createTable('data_table');
      executor.getDatabase().insert('data_table', 'r1', { data: 'v1' });
      executor.getDatabase().snapshot('data_table');
      executor.getCache().set('cache:data', 'cached_v1');

      const resolved = detector.resolveDependencies(targets);

      // Database should be rolled back first
      expect(resolved[0].target_id).toBe('db-table');
      expect(resolved[1].target_id).toBe('cache-entry');
    });
  });

  describe('Error Handling & Safety', () => {
    it('handles missing snapshot gracefully', async () => {
      const targets: RollbackTarget[] = [
        {
          target_id: 'db-no-snap',
          type: 'database',
          resource_name: 'nonexistent_table',
          version_to_revert: '1',
        },
      ];

      const result = await executor.executeRollback(
        'rollback-1',
        'proposal-1',
        'variant-a',
        targets
      );

      expect(result.overall_status).toBe('complete_failure');
      expect(result.steps_executed[0].success).toBe(false);
      expect(result.steps_executed[0].error).toBeDefined();
    });

    it('provides recovery recommendation on failure', async () => {
      const targets: RollbackTarget[] = [
        {
          target_id: 'bad-target',
          type: 'state_store' as const,
          resource_name: 'nonexistent_key',
          version_to_revert: '99',
        },
      ];

      const result = await executor.executeRollback(
        'rollback-1',
        'proposal-1',
        'variant-a',
        targets
      );

      expect(result.recommendation).toContain('Manual recovery required');
    });

    it('logs all rollback steps for audit', async () => {
      const targets: RollbackTarget[] = [
        {
          target_id: 'state-config',
          type: 'state_store',
          resource_name: 'user:config',
          version_to_revert: '0',
        },
      ];

      const result = await executor.executeRollback(
        'rollback-1',
        'proposal-1',
        'variant-a',
        targets
      );

      expect(result.steps_executed.length).toBe(1);
      const step = result.steps_executed[0];

      expect(step.step_id).toBeDefined();
      expect(step.action).toBeDefined();
      expect(step.timestamp).toBeGreaterThan(0);
      expect(step.success).toBeDefined();
    });
  });

  describe('Full Phase 2-6 Integration', () => {
    it('chains Phase 5 promotion → Phase 6 rollback → health verify', async () => {
      // Phase 5: Promotion failed, rollback triggered
      const phase5Rollback = {
        proposal_id: 'proposal-1',
        variant_id: 'variant-a',
        reason: 'Metrics failed',
      };

      // Phase 6: Execute rollback
      const targets: RollbackTarget[] = [
        {
          target_id: 'db-users',
          type: 'database',
          resource_name: 'users',
          version_to_revert: '1',
        },
        {
          target_id: 'cache-v2',
          type: 'cache',
          resource_name: 'cache:v2',
          version_to_revert: '0',
        },
      ];

      detector.recordDeployment(
        phase5Rollback.proposal_id,
        phase5Rollback.variant_id,
        targets
      );

      const result = await executor.executeRollback(
        `rollback-${phase5Rollback.proposal_id}`,
        phase5Rollback.proposal_id,
        phase5Rollback.variant_id,
        detector.detectTargets(
          phase5Rollback.proposal_id,
          phase5Rollback.variant_id
        )
      );

      // Verify all health checks pass
      expect(result.overall_status).toBe('success');
      expect(result.health_checks.every(h => h.healthy)).toBe(true);
    });
  });
});
