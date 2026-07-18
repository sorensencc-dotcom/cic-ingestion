/**
 * Phase 7 Health-Check Gate — E2E Tests
 *
 * Validates HealthCheckGate.validateRollback() against the 5 mandatory
 * consistency checks + latency gate defined in
 * docs/meta/phase-7-rollback-health-check-gate.md (Section 7).
 */

import { describe, it, expect } from '@jest/globals';
import {
  HealthCheckGate,
  HealthCheckValidator,
  HealthCheckResult,
  RollbackStep,
} from '../rollback/health-check-gate';

const PROPOSAL_ID = 'proposal-1';
const VARIANT_ID = 'variant-a';

function passingValidator(): HealthCheckValidator {
  return { check: async () => ({ passed: true }) };
}

function failingValidator(reason: string): HealthCheckValidator {
  return { check: async () => ({ passed: false, reason }) };
}

function completeRollbackLog(): RollbackStep[] {
  const steps = [
    'phase6_state_store_rollback',
    'phase6_database_rollback',
    'phase6_cache_rollback',
    'phase7_config_rollback',
    'phase7_feature_flag_rollback',
  ];
  return steps.map((step_name, i) => ({
    step_name,
    executed_at: Date.now() + i,
    success: true,
  }));
}

function allPassingGate(): HealthCheckGate {
  return new HealthCheckGate({
    stateStoreValidator: passingValidator(),
    databaseValidator: passingValidator(),
    configValidator: passingValidator(),
    flagValidator: passingValidator(),
  });
}

describe('Suite 1: Health Check Pass Path', () => {
  it('passes when all checks succeed', async () => {
    const gate = allPassingGate();
    const result = await gate.validateRollback(PROPOSAL_ID, VARIANT_ID, completeRollbackLog());
    expect(result.passed).toBe(true);
  });

  it('returns reason OK on full pass', async () => {
    const gate = allPassingGate();
    const result = await gate.validateRollback(PROPOSAL_ID, VARIANT_ID, completeRollbackLog());
    expect(result.reason).toBe('OK');
  });

  it('includes individual check results for diagnostics', async () => {
    const gate = allPassingGate();
    const result = await gate.validateRollback(PROPOSAL_ID, VARIANT_ID, completeRollbackLog());
    expect(result.checks.state_store_consistent?.passed).toBe(true);
    expect(result.checks.database_consistent?.passed).toBe(true);
    expect(result.checks.config_store_consistent?.passed).toBe(true);
    expect(result.checks.feature_flags_consistent?.passed).toBe(true);
    expect(result.checks.rollback_lineage_complete?.passed).toBe(true);
    expect(result.checks.latency_ok?.passed).toBe(true);
  });

  it('measures latency under the 10s threshold', async () => {
    const gate = allPassingGate();
    const result = await gate.validateRollback(PROPOSAL_ID, VARIANT_ID, completeRollbackLog());
    expect(result.latency_ms).toBeLessThan(10000);
    expect(typeof result.timestamp).toBe('number');
  });
});

describe('Suite 2: Single Check Failures', () => {
  it('blocks when state store check fails', async () => {
    const gate = new HealthCheckGate({
      stateStoreValidator: failingValidator('revision_mismatch'),
      databaseValidator: passingValidator(),
      configValidator: passingValidator(),
      flagValidator: passingValidator(),
    });
    const result = await gate.validateRollback(PROPOSAL_ID, VARIANT_ID, completeRollbackLog());
    expect(result.passed).toBe(false);
    expect(result.checks.state_store_consistent?.passed).toBe(false);
    expect(result.reason).toContain('state_store_consistent');
  });

  it('blocks when database check fails', async () => {
    const gate = new HealthCheckGate({
      stateStoreValidator: passingValidator(),
      databaseValidator: failingValidator('row_count_mismatch'),
      configValidator: passingValidator(),
      flagValidator: passingValidator(),
    });
    const result = await gate.validateRollback(PROPOSAL_ID, VARIANT_ID, completeRollbackLog());
    expect(result.passed).toBe(false);
    expect(result.checks.database_consistent?.passed).toBe(false);
  });

  it('blocks when config check fails', async () => {
    const gate = new HealthCheckGate({
      stateStoreValidator: passingValidator(),
      databaseValidator: passingValidator(),
      configValidator: failingValidator('checksum_mismatch'),
      flagValidator: passingValidator(),
    });
    const result = await gate.validateRollback(PROPOSAL_ID, VARIANT_ID, completeRollbackLog());
    expect(result.passed).toBe(false);
    expect(result.checks.config_store_consistent?.passed).toBe(false);
  });

  it('blocks when config validator is missing entirely', async () => {
    const gate = new HealthCheckGate({
      stateStoreValidator: passingValidator(),
      databaseValidator: passingValidator(),
      flagValidator: passingValidator(),
    });
    const result = await gate.validateRollback(PROPOSAL_ID, VARIANT_ID, completeRollbackLog());
    expect(result.passed).toBe(false);
    expect(result.checks.config_store_consistent?.reason).toBe('config_validator_missing');
  });

  it('blocks when feature flag check fails', async () => {
    const gate = new HealthCheckGate({
      stateStoreValidator: passingValidator(),
      databaseValidator: passingValidator(),
      configValidator: passingValidator(),
      flagValidator: failingValidator('flag_state_mismatch'),
    });
    const result = await gate.validateRollback(PROPOSAL_ID, VARIANT_ID, completeRollbackLog());
    expect(result.passed).toBe(false);
    expect(result.checks.feature_flags_consistent?.passed).toBe(false);
  });

  it('blocks when rollback lineage is incomplete', async () => {
    const gate = allPassingGate();
    const incompleteLog = completeRollbackLog().slice(0, 3);
    const result = await gate.validateRollback(PROPOSAL_ID, VARIANT_ID, incompleteLog);
    expect(result.passed).toBe(false);
    expect(result.checks.rollback_lineage_complete?.passed).toBe(false);
    expect(result.checks.rollback_lineage_complete?.reason).toContain('rollback_step_missing');
  });

  it('blocks when latency exceeds 10s', async () => {
    const slowValidator: HealthCheckValidator = {
      check: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { passed: true };
      },
    };
    const gate = new HealthCheckGate({
      stateStoreValidator: slowValidator,
      databaseValidator: passingValidator(),
      configValidator: passingValidator(),
      flagValidator: passingValidator(),
    });

    const rollbackLog = completeRollbackLog();
    const realDateNow = Date.now;
    let call = 0;
    Date.now = () => {
      call++;
      // first call = startTime, subsequent calls simulate elapsed time > threshold
      return call === 1 ? 0 : 10001;
    };

    try {
      const result = await gate.validateRollback(PROPOSAL_ID, VARIANT_ID, rollbackLog);
      expect(result.passed).toBe(false);
      expect(result.checks.latency_ok?.passed).toBe(false);
    } finally {
      Date.now = realDateNow;
    }
  });
});

describe('Suite 3: Partial Failures', () => {
  it('blocks with aggregated reason when config and flags both fail', async () => {
    const gate = new HealthCheckGate({
      stateStoreValidator: passingValidator(),
      databaseValidator: passingValidator(),
      configValidator: failingValidator('checksum_mismatch'),
      flagValidator: failingValidator('flag_state_mismatch'),
    });
    const result = await gate.validateRollback(PROPOSAL_ID, VARIANT_ID, completeRollbackLog());
    expect(result.passed).toBe(false);
    expect(result.checks.config_store_consistent?.passed).toBe(false);
    expect(result.checks.feature_flags_consistent?.passed).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('blocks when database fails and state store fails simultaneously', async () => {
    const gate = new HealthCheckGate({
      stateStoreValidator: failingValidator('revision_mismatch'),
      databaseValidator: failingValidator('row_count_mismatch'),
      configValidator: passingValidator(),
      flagValidator: passingValidator(),
    });
    const result = await gate.validateRollback(PROPOSAL_ID, VARIANT_ID, completeRollbackLog());
    expect(result.passed).toBe(false);
    expect(result.checks.state_store_consistent?.passed).toBe(false);
    expect(result.checks.database_consistent?.passed).toBe(false);
  });

  it('blocks when all five checks fail simultaneously', async () => {
    const gate = new HealthCheckGate({
      stateStoreValidator: failingValidator('a'),
      databaseValidator: failingValidator('b'),
      configValidator: failingValidator('c'),
      flagValidator: failingValidator('d'),
    });
    const result = await gate.validateRollback(PROPOSAL_ID, VARIANT_ID, []);
    expect(result.passed).toBe(false);
    expect(Object.values(result.checks).some((c) => c?.passed === false)).toBe(true);
  });

  it('surfaces the first failing check as the top-level reason', async () => {
    const gate = new HealthCheckGate({
      stateStoreValidator: failingValidator('revision_mismatch'),
      databaseValidator: passingValidator(),
      configValidator: passingValidator(),
      flagValidator: passingValidator(),
    });
    const result = await gate.validateRollback(PROPOSAL_ID, VARIANT_ID, completeRollbackLog());
    expect(result.reason).toContain('state_store_consistent');
    expect(result.reason).toContain('revision_mismatch');
  });
});

describe('Suite 4: Recovery', () => {
  it('fails first, then passes after manual fix (validator swapped to passing)', async () => {
    let stateStoreHealthy = false;
    const dynamicValidator: HealthCheckValidator = {
      check: async () => (stateStoreHealthy ? { passed: true } : { passed: false, reason: 'revision_mismatch' }),
    };
    const gate = new HealthCheckGate({
      stateStoreValidator: dynamicValidator,
      databaseValidator: passingValidator(),
      configValidator: passingValidator(),
      flagValidator: passingValidator(),
    });

    const firstResult = await gate.validateRollback(PROPOSAL_ID, VARIANT_ID, completeRollbackLog());
    expect(firstResult.passed).toBe(false);

    stateStoreHealthy = true;
    const secondResult = await gate.validateRollback(PROPOSAL_ID, VARIANT_ID, completeRollbackLog());
    expect(secondResult.passed).toBe(true);
  });

  it('re-check after manual flag recovery passes', async () => {
    let flagsHealthy = false;
    const dynamicFlagValidator: HealthCheckValidator = {
      check: async () => (flagsHealthy ? { passed: true } : { passed: false, reason: 'flag_state_mismatch' }),
    };
    const gate = new HealthCheckGate({
      stateStoreValidator: passingValidator(),
      databaseValidator: passingValidator(),
      configValidator: passingValidator(),
      flagValidator: dynamicFlagValidator,
    });

    const firstResult = await gate.validateRollback(PROPOSAL_ID, VARIANT_ID, completeRollbackLog());
    expect(firstResult.passed).toBe(false);

    flagsHealthy = true;
    const secondResult = await gate.validateRollback(PROPOSAL_ID, VARIANT_ID, completeRollbackLog());
    expect(secondResult.passed).toBe(true);
  });

  it('re-check after rollback log is completed passes lineage check', async () => {
    const gate = allPassingGate();
    const partialLog = completeRollbackLog().slice(0, 2);
    const firstResult = await gate.validateRollback(PROPOSAL_ID, VARIANT_ID, partialLog);
    expect(firstResult.passed).toBe(false);

    const secondResult = await gate.validateRollback(PROPOSAL_ID, VARIANT_ID, completeRollbackLog());
    expect(secondResult.passed).toBe(true);
  });

  it('does not mutate gate state between validateRollback calls', async () => {
    const gate = allPassingGate();
    const result1 = await gate.validateRollback(PROPOSAL_ID, VARIANT_ID, completeRollbackLog());
    const result2 = await gate.validateRollback(PROPOSAL_ID, VARIANT_ID, completeRollbackLog());
    expect(result1.passed).toBe(true);
    expect(result2.passed).toBe(true);
  });
});
