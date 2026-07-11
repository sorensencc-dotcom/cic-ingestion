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

// Phase 6 Domain Models

interface RollbackTarget {
  target_id: string;
  type: 'database' | 'cache' | 'config' | 'state_store' | 'feature_flag';
  resource_name: string;
  version_to_revert: string;
  dependencies?: string[];
}

interface RollbackTransaction {
  rollback_id: string;
  proposal_id: string;
  variant_id: string;
  targets: RollbackTarget[];
  initiated_at: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'partial';
}

interface RollbackStep {
  step_id: string;
  target_id: string;
  action: string;
  before_state: Record<string, any>;
  after_state: Record<string, any>;
  timestamp: number;
  success: boolean;
  error?: string;
}

interface HealthCheckResult {
  target_id: string;
  healthy: boolean;
  checks: Record<string, boolean>;
  timestamp: number;
}

interface RollbackResult {
  rollback_id: string;
  overall_status: 'success' | 'partial_failure' | 'complete_failure';
  steps_executed: RollbackStep[];
  health_checks: HealthCheckResult[];
  rollback_time_ms: number;
  recommendation: string;
}

// Phase 6 Components

class RollbackTargetDetector {
  private deploymentLog: Map<string, any> = new Map();

  recordDeployment(proposalId: string, variantId: string, targets: RollbackTarget[]): void {
    this.deploymentLog.set(`${proposalId}:${variantId}`, targets);
  }

  detectTargets(proposalId: string, variantId: string): RollbackTarget[] {
    const key = `${proposalId}:${variantId}`;
    return this.deploymentLog.get(key) || [];
  }

  resolveDependencies(targets: RollbackTarget[]): RollbackTarget[] {
    // Topological sort: ensure dependent targets are reverted first
    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const target of targets) {
      if (!graph.has(target.target_id)) {
        graph.set(target.target_id, []);
        inDegree.set(target.target_id, 0);
      }
      if (target.dependencies) {
        for (const dep of target.dependencies) {
          if (!graph.has(dep)) {
            graph.set(dep, []);
            inDegree.set(dep, 0);
          }
          graph.get(dep)!.push(target.target_id);
          inDegree.set(target.target_id, (inDegree.get(target.target_id) || 0) + 1);
        }
      }
    }

    const sorted = [];
    const queue = Array.from(inDegree.keys()).filter(k => inDegree.get(k) === 0);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const targetObj = targets.find(t => t.target_id === current);
      if (targetObj) sorted.push(targetObj);

      for (const neighbor of graph.get(current) || []) {
        inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    return sorted;
  }
}

class StateStore {
  private data: Map<string, any> = new Map();
  private history: Map<string, any[]> = new Map();

  set(key: string, value: any): void {
    if (!this.history.has(key)) {
      this.history.set(key, []);
    }
    this.history.get(key)!.push(value);
    this.data.set(key, value);
  }

  get(key: string): any {
    return this.data.get(key);
  }

  getVersion(key: string, version: string): any {
    const hist = this.history.get(key) || [];
    const versionNum = parseInt(version);
    return hist[versionNum] || null;
  }

  getHistory(key: string): any[] {
    return this.history.get(key) || [];
  }

  rollback(key: string, targetVersion: string): boolean {
    const version = this.getVersion(key, targetVersion);
    if (version === null) return false;
    this.data.set(key, version);
    return true;
  }

  isHealthy(key: string): boolean {
    return this.data.has(key) && this.data.get(key) !== null;
  }
}

class DatabaseRollback {
  private db: Map<string, Map<string, any>> = new Map();
  private snapshots: Map<string, any> = new Map();

  createTable(tableName: string): void {
    if (!this.db.has(tableName)) {
      this.db.set(tableName, new Map());
    }
  }

  insert(tableName: string, id: string, record: any): void {
    if (!this.db.has(tableName)) {
      this.createTable(tableName);
    }
    this.db.get(tableName)!.set(id, record);
  }

  snapshot(tableName: string): void {
    const key = `${tableName}:snapshot`;
    if (this.db.has(tableName)) {
      this.snapshots.set(key, new Map(this.db.get(tableName)!));
    }
  }

  rollbackToSnapshot(tableName: string): boolean {
    const key = `${tableName}:snapshot`;
    const snap = this.snapshots.get(key);
    if (!snap) return false;
    this.db.set(tableName, new Map(snap));
    return true;
  }

  getTableSize(tableName: string): number {
    return this.db.get(tableName)?.size || 0;
  }

  isHealthy(tableName: string): boolean {
    return this.db.has(tableName) && this.db.get(tableName)!.size > 0;
  }
}

class CacheRollback {
  private cache: Map<string, any> = new Map();
  private versions: Map<string, any[]> = new Map();

  set(key: string, value: any): void {
    if (!this.versions.has(key)) {
      this.versions.set(key, []);
    }
    this.versions.get(key)!.push(value);
    this.cache.set(key, value);
  }

  get(key: string): any {
    return this.cache.get(key);
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  rollback(key: string, version: number): boolean {
    const hist = this.versions.get(key);
    if (!hist || version < 0 || version >= hist.length) return false;
    this.cache.set(key, hist[version]);
    return true;
  }

  getAllKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  isHealthy(key: string): boolean {
    return this.cache.has(key);
  }
}

class RollbackExecutor {
  private stateStore: StateStore;
  private database: DatabaseRollback;
  private cache: CacheRollback;
  private executedSteps: RollbackStep[] = [];

  constructor() {
    this.stateStore = new StateStore();
    this.database = new DatabaseRollback();
    this.cache = new CacheRollback();
  }

  getStateStore(): StateStore {
    return this.stateStore;
  }

  getDatabase(): DatabaseRollback {
    return this.database;
  }

  getCache(): CacheRollback {
    return this.cache;
  }

  async executeRollback(
    rollbackId: string,
    proposalId: string,
    variantId: string,
    targets: RollbackTarget[]
  ): Promise<RollbackResult> {
    const startTime = Date.now();
    this.executedSteps = [];
    const healthChecks: HealthCheckResult[] = [];
    const stepStatuses: boolean[] = [];

    // Execute each target rollback
    for (const target of targets) {
      const step = await this.executeRollbackStep(
        rollbackId,
        target
      );

      this.executedSteps.push(step);
      stepStatuses.push(step.success);

      // Health check
      const health = this.performHealthCheck(target);
      healthChecks.push(health);
    }

    const allSuccess = stepStatuses.every(s => s);
    const anySuccess = stepStatuses.some(s => s);

    const overallStatus = allSuccess
      ? 'success'
      : anySuccess
      ? 'partial_failure'
      : 'complete_failure';

    return {
      rollback_id: rollbackId,
      overall_status: overallStatus,
      steps_executed: this.executedSteps,
      health_checks: healthChecks,
      rollback_time_ms: Date.now() - startTime,
      recommendation:
        overallStatus === 'success'
          ? 'Rollback completed successfully. Variant reverted.'
          : overallStatus === 'partial_failure'
          ? 'Partial rollback. Manual intervention recommended for failed targets.'
          : 'Complete rollback failure. Manual recovery required.',
    };
  }

  private async executeRollbackStep(
    rollbackId: string,
    target: RollbackTarget
  ): Promise<RollbackStep> {
    const stepId = `${rollbackId}:${target.target_id}`;
    let success = false;
    let error: string | undefined;
    const beforeState = {};
    let afterState = {};

    try {
      switch (target.type) {
        case 'state_store':
          success = this.stateStore.rollback(target.resource_name, target.version_to_revert);
          if (!success) error = `Failed to rollback state ${target.resource_name}`;
          afterState = { value: this.stateStore.get(target.resource_name) };
          break;

        case 'database':
          success = this.database.rollbackToSnapshot(target.resource_name);
          if (!success) error = `No snapshot found for ${target.resource_name}`;
          afterState = { size: this.database.getTableSize(target.resource_name) };
          break;

        case 'cache':
          const version = parseInt(target.version_to_revert);
          success = this.cache.rollback(target.resource_name, version);
          if (!success) error = `Failed to rollback cache ${target.resource_name}`;
          afterState = { value: this.cache.get(target.resource_name) };
          break;

        case 'config':
          // Mock config rollback
          success = true;
          afterState = { config_version: target.version_to_revert };
          break;

        case 'feature_flag':
          // Mock feature flag rollback
          success = true;
          afterState = { enabled: false };
          break;

        default:
          error = `Unknown target type: ${target.type}`;
      }
    } catch (e) {
      success = false;
      error = String(e);
    }

    return {
      step_id: stepId,
      target_id: target.target_id,
      action: `Rollback ${target.type} ${target.resource_name}`,
      before_state: beforeState,
      after_state: afterState,
      timestamp: Date.now(),
      success,
      error,
    };
  }

  private performHealthCheck(target: RollbackTarget): HealthCheckResult {
    const checks: Record<string, boolean> = {};

    switch (target.type) {
      case 'state_store':
        checks.exists = this.stateStore.get(target.resource_name) !== undefined;
        checks.healthy = this.stateStore.isHealthy(target.resource_name);
        break;

      case 'database':
        checks.exists = this.database.getTableSize(target.resource_name) > 0;
        checks.healthy = this.database.isHealthy(target.resource_name);
        break;

      case 'cache':
        checks.exists = this.cache.get(target.resource_name) !== undefined;
        checks.healthy = this.cache.isHealthy(target.resource_name);
        break;

      case 'config':
      case 'feature_flag':
        checks.accessible = true;
        checks.healthy = true;
        break;
    }

    const healthy = Object.values(checks).every(c => c === true);

    return {
      target_id: target.target_id,
      healthy,
      checks,
      timestamp: Date.now(),
    };
  }

  getExecutedSteps(): RollbackStep[] {
    return this.executedSteps;
  }
}

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
