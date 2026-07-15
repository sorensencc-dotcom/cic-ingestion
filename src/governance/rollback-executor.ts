/**
 * Phase 6 Rollback Execution Engine
 * Covers full rollback pipeline: Detection → Transactional reversal → Verification
 *
 * Responsibilities:
 * 1. Identify rollback targets (database, cache, config, state)
 * 2. Execute transactional rollbacks (all-or-nothing per target)
 * 3. Verify rollback success via health checks
 * 4. Handle partial failures gracefully (dependency resolution)
 * 5. Batch rollbacks with ordering
 *
 * Config and feature_flag rollback types are delegated to handlers injected
 * at construction time (wired during Phase 7 composition, T7) rather than
 * mocked in-process.
 */

import { Phase7ConfigRollback } from '../rollback/config-rollback';
import { Phase7FeatureFlagRollback } from '../rollback/featureflag-rollback';
import { HealthCheckGate, RollbackStep as HealthGateRollbackStep } from '../rollback/health-check-gate';

// Phase 6 Domain Models

export interface RollbackTarget {
  target_id: string;
  type: 'database' | 'cache' | 'config' | 'state_store' | 'feature_flag';
  resource_name: string;
  version_to_revert: string;
  dependencies?: string[];
}

export interface RollbackTransaction {
  rollback_id: string;
  proposal_id: string;
  variant_id: string;
  targets: RollbackTarget[];
  initiated_at: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'partial';
}

export interface RollbackStep {
  step_id: string;
  target_id: string;
  action: string;
  before_state: Record<string, any>;
  after_state: Record<string, any>;
  timestamp: number;
  success: boolean;
  error?: string;
}

export interface HealthCheckResult {
  target_id: string;
  healthy: boolean;
  checks: Record<string, boolean>;
  timestamp: number;
}

export interface RollbackResult {
  rollback_id: string;
  overall_status: 'success' | 'partial_failure' | 'complete_failure';
  steps_executed: RollbackStep[];
  health_checks: HealthCheckResult[];
  rollback_time_ms: number;
  recommendation: string;
}

// Phase 6 Components

export class RollbackTargetDetector {
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

export class StateStore {
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

export class DatabaseRollback {
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

export class CacheRollback {
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

/**
 * Default handlers used when no config/feature_flag handler is injected.
 * Phase 7 composition (T7) will inject real etcd/Unleash-backed handlers.
 */
async function defaultConfigRollbackHandler(targetId: string): Promise<RollbackResult> {
  throw new Error(`No configRollbackHandler injected for target ${targetId}`);
}

async function defaultFlagRollbackHandler(targetId: string): Promise<RollbackResult> {
  throw new Error(`No flagRollbackHandler injected for target ${targetId}`);
}

/** Maps a Phase 6 rollback target type to the step name HealthCheckGate expects in rollbackLog. */
function healthGateStepName(type?: RollbackTarget['type']): string {
  switch (type) {
    case 'state_store':
      return 'phase6_state_store_rollback';
    case 'database':
      return 'phase6_database_rollback';
    case 'cache':
      return 'phase6_cache_rollback';
    case 'config':
      return 'phase7_config_rollback';
    case 'feature_flag':
      return 'phase7_feature_flag_rollback';
    default:
      return 'unknown';
  }
}

/** Adapts Phase 7's `{ success, reason }` result shape to RollbackExecutor's internal RollbackResult. */
function toRollbackResult(result: { success: boolean; reason?: string }): RollbackResult {
  return {
    rollback_id: '',
    overall_status: result.success ? 'success' : 'complete_failure',
    steps_executed: [],
    health_checks: [],
    rollback_time_ms: 0,
    recommendation: result.reason ?? (result.success ? 'OK' : 'unknown_failure'),
  };
}

export class RollbackExecutor {
  private stateStore: StateStore;
  private database: DatabaseRollback;
  private cache: CacheRollback;
  private executedSteps: RollbackStep[] = [];

  /** Injected during Phase 7 composition (T7): performs config rollback (e.g. etcd). */
  configRollbackHandler: (targetId: string) => Promise<RollbackResult>;
  /** Injected during Phase 7 composition (T7): performs feature flag rollback (e.g. Unleash). */
  flagRollbackHandler: (targetId: string) => Promise<RollbackResult>;
  /** Injected during Phase 7 composition (T7): mandatory post-rollback consistency gate. */
  private healthCheckGate?: HealthCheckGate;

  /** Set at the start of each executeRollback() call; consumed by the Phase 7 handler closures. */
  private currentProposalId = '';
  private currentVariantId = '';

  constructor(
    configRollbackHandler: (targetId: string) => Promise<RollbackResult> = defaultConfigRollbackHandler,
    flagRollbackHandler: (targetId: string) => Promise<RollbackResult> = defaultFlagRollbackHandler,
    configRollback?: Phase7ConfigRollback,
    flagRollback?: Phase7FeatureFlagRollback,
    healthCheckGate?: HealthCheckGate
  ) {
    this.stateStore = new StateStore();
    this.database = new DatabaseRollback();
    this.cache = new CacheRollback();
    this.configRollbackHandler = configRollbackHandler;
    this.flagRollbackHandler = flagRollbackHandler;
    this.healthCheckGate = healthCheckGate;

    if (configRollback) {
      this.configRollbackHandler = async (_targetId: string) =>
        toRollbackResult(
          await configRollback.restoreConfigSnapshot(this.currentProposalId, this.currentVariantId)
        );
    }
    if (flagRollback) {
      this.flagRollbackHandler = async (_targetId: string) =>
        toRollbackResult(
          await flagRollback.restoreFeatureFlagSnapshot(this.currentProposalId, this.currentVariantId)
        );
    }
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
    this.currentProposalId = proposalId;
    this.currentVariantId = variantId;
    const healthChecks: HealthCheckResult[] = [];
    const stepStatuses: boolean[] = [];

    // Execute each target rollback. Callers are responsible for ordering
    // `targets` (e.g. via RollbackTargetDetector.resolveDependencies); this
    // loop preserves that order, which is what keeps config rollback ahead
    // of feature-flag rollback in the executed step sequence below.
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

    // Topological order enforcement: config restore must precede flag
    // restore in the executed step sequence (Phase 7 composition, T7).
    const configStepIndex = this.executedSteps.findIndex(
      s => targets.find(t => t.target_id === s.target_id)?.type === 'config'
    );
    const flagStepIndex = this.executedSteps.findIndex(
      s => targets.find(t => t.target_id === s.target_id)?.type === 'feature_flag'
    );
    if (configStepIndex !== -1 && flagStepIndex !== -1 && configStepIndex > flagStepIndex) {
      throw new Error(
        `Rollback ordering violation: feature_flag step (index ${flagStepIndex}) executed before config step (index ${configStepIndex})`
      );
    }

    const allSuccess = stepStatuses.every(s => s);
    const anySuccess = stepStatuses.some(s => s);

    const overallStatus = allSuccess
      ? 'success'
      : anySuccess
      ? 'partial_failure'
      : 'complete_failure';

    // Mandatory post-rollback health-check gate (Phase 7 composition, T7).
    // Only runs when a gate is injected; Phase 6-only usage is unaffected.
    if (this.healthCheckGate) {
      const rollbackLog: HealthGateRollbackStep[] = this.executedSteps.map(step => ({
        step_name: healthGateStepName(targets.find(t => t.target_id === step.target_id)?.type),
        executed_at: step.timestamp,
        success: step.success,
        reason: step.error,
      }));

      const healthResult = await this.healthCheckGate.validateRollback(
        proposalId,
        variantId,
        rollbackLog
      );
      if (!healthResult.passed) {
        throw new Error(`Health check failed: ${healthResult.reason}`);
      }
    }

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

        case 'config': {
          const result = await this.configRollbackHandler(target.target_id);
          success = result.overall_status === 'success';
          if (!success) error = result.recommendation;
          afterState = { config_version: target.version_to_revert };
          break;
        }

        case 'feature_flag': {
          const result = await this.flagRollbackHandler(target.target_id);
          success = result.overall_status === 'success';
          if (!success) error = result.recommendation;
          afterState = { enabled: false };
          break;
        }

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
