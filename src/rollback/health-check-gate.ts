/**
 * Phase 7 Health-Check Gate
 *
 * Mandatory post-rollback validation. Runs 5 consistency checks (state store,
 * database, config store, feature flags, rollback lineage) plus a latency
 * gate, in parallel. Blocks promotion restart if any check fails.
 *
 * State store + database checks are owned by Phase 6 and delegated via
 * injected validators. Config + feature-flag checks are owned by Phase 7.
 * Rollback lineage is validated locally against the rollback log.
 *
 * Spec: docs/meta/phase-7-rollback-health-check-gate.md (Section 2-6)
 */

export interface RollbackStep {
  step_name: string;
  executed_at: number;
  success: boolean;
  reason?: string;
}

export interface HealthCheckResult {
  passed: boolean;
  reason?: string;
}

export interface HealthCheckValidation {
  passed: boolean;
  checks: {
    state_store_consistent?: HealthCheckResult;
    database_consistent?: HealthCheckResult;
    config_store_consistent?: HealthCheckResult;
    feature_flags_consistent?: HealthCheckResult;
    rollback_lineage_complete?: HealthCheckResult;
    latency_ok?: HealthCheckResult;
  };
  reason?: string;
  latency_ms: number;
  timestamp: number;
}

export interface HealthCheckValidator {
  check(proposalId: string, variantId: string): Promise<HealthCheckResult>;
}

const EXPECTED_ROLLBACK_STEPS = [
  'phase6_state_store_rollback',
  'phase6_database_rollback',
  'phase6_cache_rollback',
  'phase7_config_rollback',
  'phase7_feature_flag_rollback',
];

const LATENCY_THRESHOLD_MS = 10000;

export interface HealthCheckGateOptions {
  stateStoreValidator?: HealthCheckValidator;
  databaseValidator?: HealthCheckValidator;
  configValidator?: HealthCheckValidator;
  flagValidator?: HealthCheckValidator;
  lineageValidator?: HealthCheckValidator;
}

export class HealthCheckGate {
  private stateStoreValidator?: HealthCheckValidator;
  private databaseValidator?: HealthCheckValidator;
  private configValidator?: HealthCheckValidator;
  private flagValidator?: HealthCheckValidator;
  private lineageValidator?: HealthCheckValidator;

  constructor(options: HealthCheckGateOptions = {}) {
    this.stateStoreValidator = options.stateStoreValidator;
    this.databaseValidator = options.databaseValidator;
    this.configValidator = options.configValidator;
    this.flagValidator = options.flagValidator;
    this.lineageValidator = options.lineageValidator;
  }

  async validateRollback(
    proposalId: string,
    variantId: string,
    rollbackLog: RollbackStep[]
  ): Promise<HealthCheckValidation> {
    const startTime = Date.now();

    const [
      state_store_consistent,
      database_consistent,
      config_store_consistent,
      feature_flags_consistent,
      rollback_lineage_complete,
    ] = await Promise.all([
      this.checkStateStore(proposalId, variantId),
      this.checkDatabase(proposalId, variantId),
      this.checkConfig(proposalId, variantId),
      this.checkFlags(proposalId, variantId),
      this.checkLineage(proposalId, variantId, rollbackLog),
    ]);

    const latency_ms = Date.now() - startTime;
    const latency_ok: HealthCheckResult =
      latency_ms > LATENCY_THRESHOLD_MS
        ? { passed: false, reason: `latency_exceeded: ${latency_ms}ms > ${LATENCY_THRESHOLD_MS}ms` }
        : { passed: true };

    const checks: HealthCheckValidation['checks'] = {
      state_store_consistent,
      database_consistent,
      config_store_consistent,
      feature_flags_consistent,
      rollback_lineage_complete,
      latency_ok,
    };

    const passed = Object.values(checks).every((c) => c?.passed === true);

    return {
      passed,
      checks,
      reason: passed ? 'OK' : this.getFailureReason(checks),
      latency_ms,
      timestamp: Date.now(),
    };
  }

  private async checkStateStore(proposalId: string, variantId: string): Promise<HealthCheckResult> {
    if (this.stateStoreValidator) {
      return this.stateStoreValidator.check(proposalId, variantId);
    }
    return { passed: true };
  }

  private async checkDatabase(proposalId: string, variantId: string): Promise<HealthCheckResult> {
    if (this.databaseValidator) {
      return this.databaseValidator.check(proposalId, variantId);
    }
    return { passed: true };
  }

  private async checkConfig(proposalId: string, variantId: string): Promise<HealthCheckResult> {
    if (this.configValidator) {
      return this.configValidator.check(proposalId, variantId);
    }
    return { passed: false, reason: 'config_validator_missing' };
  }

  private async checkFlags(proposalId: string, variantId: string): Promise<HealthCheckResult> {
    if (this.flagValidator) {
      return this.flagValidator.check(proposalId, variantId);
    }
    return { passed: false, reason: 'flag_validator_missing' };
  }

  private async checkLineage(
    proposalId: string,
    variantId: string,
    rollbackLog: RollbackStep[]
  ): Promise<HealthCheckResult> {
    if (this.lineageValidator) {
      return this.lineageValidator.check(proposalId, variantId);
    }

    const executedSteps = rollbackLog.map((s) => s.step_name);

    for (let i = 0; i < EXPECTED_ROLLBACK_STEPS.length; i++) {
      const expectedStep = EXPECTED_ROLLBACK_STEPS[i];
      const actualStep = executedSteps[i];

      if (actualStep !== expectedStep) {
        return {
          passed: false,
          reason: `rollback_step_missing: expected ${expectedStep} at position ${i}, got ${actualStep || 'nothing'}`,
        };
      }

      if (!rollbackLog[i].success) {
        return {
          passed: false,
          reason: `rollback_step_failed: ${expectedStep} (${rollbackLog[i].reason || 'no reason given'})`,
        };
      }
    }

    return { passed: true };
  }

  private getFailureReason(checks: HealthCheckValidation['checks']): string {
    for (const [key, result] of Object.entries(checks)) {
      if (result && !result.passed) {
        return `${key}: ${result.reason || 'unknown'}`;
      }
    }
    return 'unknown_failure';
  }
}
