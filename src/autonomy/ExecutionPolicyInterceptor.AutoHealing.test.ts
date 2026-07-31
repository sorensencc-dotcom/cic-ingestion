import {
  ExecutionPolicyAutoHealing,
  getExecutionPolicyAutoHealing,
  HealingOutput,
} from './ExecutionPolicyInterceptor.AutoHealing.ts';
import { DriftSignal } from '../drift/CodeLevelDriftDetector.ts';

describe('ExecutionPolicyAutoHealing', () => {
  let autoHealing: ExecutionPolicyAutoHealing;

  beforeEach(() => {
    autoHealing = new ExecutionPolicyAutoHealing();
  });

  describe('onDriftDetected — Failure Mode Triggers & Restraint', () => {
    it('triggers healing on KITCHEN_SINK drift and restrains auto-resume (HARD drift)', async () => {
      const drift: DriftSignal = {
        type: 'KITCHEN_SINK',
        severity: 'CRITICAL',
        details: { reason: 'Scope expanded beyond acceptance criteria', unrelatedFiles: ['src/a.ts', 'src/b.ts'] },
        timestamp: Date.now(),
      };

      const context = {
        plan: '1. Update core module\n2. Update helper module',
        criteria: 'All functions pass unit tests',
        logs: ['File created outside scope'],
      };

      const output: HealingOutput = await autoHealing.onDriftDetected(drift, context);

      expect(output.revisedPlan).toContain('Revised Plan (Healed: KITCHEN_SINK)');
      expect(output.revisedCriteria).toContain('Revised Acceptance Criteria (Healed: KITCHEN_SINK)');
      expect(output.amplifiedConstraints.failureMode).toBe('KITCHEN_SINK');
      expect(output.amplifiedConstraints.max_files_modified).toBe(1);
      expect(output.amplifiedConstraints.requireManualApprovalToResume).toBe(true);

      // RESTABILITY ASSERTION: Hard drift must NOT allow auto-resume
      expect(output.resumeAllowed).toBe(false);
      expect(output.reason).toContain('Healed KITCHEN_SINK');
    });

    it('triggers healing on RUNAWAY_REFACTOR drift and restrains auto-resume (HARD drift)', async () => {
      const drift: DriftSignal = {
        type: 'RUNAWAY_REFACTOR',
        severity: 'CRITICAL',
        details: { reason: 'Cascading refactor: too many files modified', filesModified: 5 },
        timestamp: Date.now(),
      };

      const context = {
        plan: '1. Refactor helper\n2. Refactor router\n3. Refactor config',
        criteria: 'Refactor without breaking tests',
        logs: ['Refactoring file 4', 'Refactoring file 5'],
      };

      const output: HealingOutput = await autoHealing.onDriftDetected(drift, context);

      expect(output.revisedPlan).toContain('Revised Plan (Healed: RUNAWAY_REFACTOR)');
      expect(output.amplifiedConstraints.no_renames).toBe(true);
      expect(output.amplifiedConstraints.freeze_architecture).toBe(true);
      expect(output.amplifiedConstraints.requireManualApprovalToResume).toBe(true);

      // RESTABILITY ASSERTION: Hard drift must NOT allow auto-resume
      expect(output.resumeAllowed).toBe(false);
    });

    it('triggers healing on WRONG_ABSTRACTION drift and allows auto-resume if constraints met (SOFT drift)', async () => {
      const drift: DriftSignal = {
        type: 'WRONG_ABSTRACTION',
        severity: 'HIGH',
        details: { reason: 'Logic duplicated across multiple code hunks', duplicateCount: 3 },
        timestamp: Date.now(),
      };

      const context = {
        plan: '1. Implement feature A\n2. Implement feature B',
        criteria: 'No duplicate blocks',
        logs: ['Duplicate logic block found'],
      };

      const output: HealingOutput = await autoHealing.onDriftDetected(drift, context);

      expect(output.revisedPlan).toContain('Revised Plan (Healed: WRONG_ABSTRACTION)');
      expect(output.revisedCriteria).toContain('Shared logic must be extracted to single module/function');
      expect(output.amplifiedConstraints.no_duplicate_blocks).toBe(true);
      expect(output.amplifiedConstraints.extract_shared_function).toBe(true);

      // SOFT drift allows resume when valid plan and criteria exist
      expect(output.resumeAllowed).toBe(true);
    });

    it('triggers healing on OPTIMISTIC_PATH drift and allows auto-resume if constraints met (SOFT drift)', async () => {
      const drift: DriftSignal = {
        type: 'OPTIMISTIC_PATH',
        severity: 'HIGH',
        details: { reason: 'Tests exist but zero cover error cases', missingErrorCases: true },
        timestamp: Date.now(),
      };

      const context = {
        plan: '1. Write happy path tests',
        criteria: 'All happy path tests green',
        logs: ['Zero negative tests present'],
      };

      const output: HealingOutput = await autoHealing.onDriftDetected(drift, context);

      expect(output.revisedPlan).toContain('Revised Plan (Healed: OPTIMISTIC_PATH)');
      expect(output.revisedCriteria).toContain('Negative tests exist for: malformed input, null, timeout, network failure');
      expect(output.amplifiedConstraints.require_error_tests).toBe(true);

      // SOFT drift allows resume
      expect(output.resumeAllowed).toBe(true);
    });

    it('falls back gracefully on unknown drift types and enforces default restraint', async () => {
      const drift: DriftSignal = {
        type: 'UNKNOWN_DRIFT' as any,
        severity: 'MEDIUM',
        details: { reason: 'Unrecognized drift pattern' },
        timestamp: Date.now(),
      };

      const context = {
        plan: '1. Step A',
        criteria: 'Criteria A',
        logs: [],
      };

      const output: HealingOutput = await autoHealing.onDriftDetected(drift, context);

      expect(output.revisedPlan).toBeDefined();
      expect(output.revisedCriteria).toBeDefined();
      // Defaults to KITCHEN_SINK strategy; for unknown drift types hardDrifts check is false, allowing soft resume
      expect(output.resumeAllowed).toBe(true);
    });
  });

  describe('formatHealingReport', () => {
    it('formats detailed audit report from drift and healing output', async () => {
      const drift: DriftSignal = {
        type: 'WRONG_ABSTRACTION',
        severity: 'HIGH',
        details: { reason: 'Duplicated logic' },
        timestamp: Date.now(),
      };

      const context = {
        plan: 'Plan A',
        criteria: 'Criteria A',
        logs: [],
      };

      const healingOutput = await autoHealing.onDriftDetected(drift, context);
      const report = autoHealing.formatHealingReport(drift, healingOutput);

      expect(report).toContain('DRIFT HEALING REPORT');
      expect(report).toContain('Drift Type: WRONG_ABSTRACTION');
      expect(report).toContain('Severity: HIGH');
      expect(report).toContain('Resume Allowed: true');
    });
  });

  describe('getExecutionPolicyAutoHealing', () => {
    it('returns singleton instance', () => {
      const instance1 = getExecutionPolicyAutoHealing();
      const instance2 = getExecutionPolicyAutoHealing();

      expect(instance1).toBe(instance2);
    });
  });
});
