import { describe, it, expect, jest } from '@jest/globals';
import { HealthCheckGate, RollbackStep, HealthCheckValidator } from './health-check-gate';

describe('HealthCheckGate', () => {
  const proposalId = 'prop-123';
  const variantId = 'var-456';

  const validRollbackLog: RollbackStep[] = [
    { step_name: 'phase6_state_store_rollback', executed_at: Date.now(), success: true },
    { step_name: 'phase6_database_rollback', executed_at: Date.now(), success: true },
    { step_name: 'phase6_cache_rollback', executed_at: Date.now(), success: true },
    { step_name: 'phase7_config_rollback', executed_at: Date.now(), success: true },
    { step_name: 'phase7_feature_flag_rollback', executed_at: Date.now(), success: true },
  ];

  const createPassingValidator = (): HealthCheckValidator => ({
    check: jest.fn(async () => ({ passed: true })) as any,
  });

  const createFailingValidator = (reason: string): HealthCheckValidator => ({
    check: jest.fn(async () => ({ passed: false, reason })) as any,
  });

  it('passes validation when all validators and logs match', async () => {
    const configVal = createPassingValidator();
    const flagVal = createPassingValidator();

    const gate = new HealthCheckGate({
      configValidator: configVal,
      flagValidator: flagVal,
    });

    const result = await gate.validateRollback(proposalId, variantId, validRollbackLog);

    expect(result.passed).toBe(true);
    expect(result.reason).toBe('OK');
    expect(result.checks.state_store_consistent?.passed).toBe(true);
    expect(result.checks.database_consistent?.passed).toBe(true);
    expect(result.checks.config_store_consistent?.passed).toBe(true);
    expect(result.checks.feature_flags_consistent?.passed).toBe(true);
    expect(result.checks.rollback_lineage_complete?.passed).toBe(true);
    expect(result.checks.latency_ok?.passed).toBe(true);
  });

  it('fails if config or flag validator is missing', async () => {
    const gate = new HealthCheckGate({});

    const result = await gate.validateRollback(proposalId, variantId, validRollbackLog);

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('config_validator_missing');
  });

  it('fails if any validator reports failure', async () => {
    const configVal = createFailingValidator('config_corrupt');
    const flagVal = createPassingValidator();

    const gate = new HealthCheckGate({
      configValidator: configVal,
      flagValidator: flagVal,
    });

    const result = await gate.validateRollback(proposalId, variantId, validRollbackLog);

    expect(result.passed).toBe(false);
    expect(result.reason).toBe('config_store_consistent: config_corrupt');
  });

  it('fails if rollback log steps are missing or out of order', async () => {
    const configVal = createPassingValidator();
    const flagVal = createPassingValidator();

    const gate = new HealthCheckGate({
      configValidator: configVal,
      flagValidator: flagVal,
    });

    const invalidLog = [
      validRollbackLog[0],
      validRollbackLog[1],
      validRollbackLog[3],
      validRollbackLog[4],
    ];

    const result = await gate.validateRollback(proposalId, variantId, invalidLog);

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('rollback_step_missing');
  });

  it('fails if any rollback log step was not successful', async () => {
    const configVal = createPassingValidator();
    const flagVal = createPassingValidator();

    const gate = new HealthCheckGate({
      configValidator: configVal,
      flagValidator: flagVal,
    });

    const failedLog = [...validRollbackLog];
    failedLog[3] = {
      step_name: 'phase7_config_rollback',
      executed_at: Date.now(),
      success: false,
      reason: 'etcd_timeout',
    };

    const result = await gate.validateRollback(proposalId, variantId, failedLog);

    expect(result.passed).toBe(false);
    expect(result.reason).toBe('rollback_lineage_complete: rollback_step_failed: phase7_config_rollback (etcd_timeout)');
  });

  it('fails if latency threshold is exceeded', async () => {
    const gate = new HealthCheckGate({
      configValidator: createPassingValidator(),
      flagValidator: createPassingValidator(),
    });

    const realDateNow = Date.now;
    let call = 0;
    Date.now = () => {
      call++;
      return call === 1 ? 0 : 11000;
    };

    try {
      const result = await gate.validateRollback(proposalId, variantId, validRollbackLog);
      expect(result.passed).toBe(false);
      expect(result.checks.latency_ok?.passed).toBe(false);
    } finally {
      Date.now = realDateNow;
    }
  });
});
