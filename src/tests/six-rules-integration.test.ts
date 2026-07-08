/**
 * Six Rules Integration Tests
 *
 * Tests for CodeLevelDriftDetector, InstinctOps, and ExecutionPolicyAutoHealing
 */

import { CodeLevelDriftDetector, CodeLevelInput } from '../drift/CodeLevelDriftDetector.js';
import { InstinctOps } from '../autonomy/InstinctOps.js';
import { ExecutionPolicyAutoHealing } from '../autonomy/ExecutionPolicyInterceptor.AutoHealing.js';
import { DriftSignal } from '../drift/CodeLevelDriftDetector.js';

describe('CodeLevelDriftDetector', () => {
  let detector: CodeLevelDriftDetector;

  beforeEach(() => {
    detector = new CodeLevelDriftDetector();
  });

  describe('Kitchen Sink Detection', () => {
    test('detects unrelated file modification', () => {
      const input: CodeLevelInput = {
        plan: [{ id: '1', description: 'Fix auth bug', expectedScope: ['auth/middleware.ts'] }],
        codeChanges: [
          { file: 'auth/middleware.ts', additions: 10, deletions: 5, hunks: ['+ guard check'] },
          { file: 'dashboard/layout.tsx', additions: 20, deletions: 0, hunks: ['+ new component'] }, // unrelated
        ],
        tests: { failing: [], passing: ['auth.test.ts'] },
        dependencies: [],
        logs: [],
      };

      const drift = detector.check(input);
      expect(drift?.type).toBe('KITCHEN_SINK');
      expect(drift?.severity).toBe('HIGH');
    });

    test('ignores single unrelated file when under threshold', () => {
      const input: CodeLevelInput = {
        plan: [{ id: '1', description: 'Fix bug', expectedScope: ['src/core'] }],
        codeChanges: [
          { file: 'src/core/main.ts', additions: 10, deletions: 5, hunks: [] },
        ],
        tests: { failing: [], passing: [] },
        dependencies: [],
        logs: [],
      };

      const drift = detector.check(input);
      expect(drift).toBeNull();
    });

    test('detects critical scope creep with 2+ unrelated files', () => {
      const input: CodeLevelInput = {
        plan: [{ id: '1', description: 'Fix auth', expectedScope: ['auth'] }],
        codeChanges: [
          { file: 'auth/middleware.ts', additions: 5, deletions: 2, hunks: [] },
          { file: 'dashboard/sidebar.tsx', additions: 15, deletions: 0, hunks: [] },
          { file: 'api/routes.ts', additions: 20, deletions: 5, hunks: [] },
        ],
        tests: { failing: [], passing: [] },
        dependencies: [],
        logs: [],
      };

      const drift = detector.check(input);
      expect(drift?.type).toBe('KITCHEN_SINK');
      expect(drift?.severity).toBe('CRITICAL');
    });
  });

  describe('Wrong Abstraction Detection', () => {
    test('detects duplicate code blocks', () => {
      const sharedBlock = 'if (isValid) { return processData(); }';

      const input: CodeLevelInput = {
        plan: [{ id: '1', description: 'Refactor', expectedScope: [] }],
        codeChanges: [
          { file: 'file1.ts', additions: 10, deletions: 0, hunks: [sharedBlock, '+ other code'] },
          { file: 'file2.ts', additions: 10, deletions: 0, hunks: [sharedBlock, '+ other code'] },
          { file: 'file3.ts', additions: 10, deletions: 0, hunks: [sharedBlock, '+ other code'] },
        ],
        tests: { failing: [], passing: [] },
        dependencies: [],
        logs: [],
      };

      const drift = detector.check(input);
      expect(drift?.type).toBe('WRONG_ABSTRACTION');
      expect(drift?.severity).toMatch(/HIGH|MEDIUM/);
    });
  });

  describe('Optimistic Path Detection', () => {
    test('detects missing error handling', () => {
      const input: CodeLevelInput = {
        plan: [{ id: '1', description: 'Add validation', expectedScope: [] }],
        codeChanges: [
          { file: 'validator.ts', additions: 20, deletions: 0, hunks: ['+ if (x > 0) { return true }'] },
        ],
        tests: { failing: [], passing: ['happy-path.test'] },
        dependencies: [],
        logs: [],
      };

      const drift = detector.check(input);
      expect(drift?.type).toBe('OPTIMISTIC_PATH');
    });

    test('detects when error cases in criteria but no negative tests', () => {
      const input: CodeLevelInput = {
        plan: [
          {
            id: '1',
            description: 'Handle errors',
            expectedScope: ['error-handler.ts'],
          },
        ],
        codeChanges: [{ file: 'error-handler.ts', additions: 10, deletions: 0, hunks: [] }],
        tests: { failing: [], passing: ['basic.test'] },
        dependencies: [],
        logs: [],
      };

      const drift = detector.check(input);
      expect(drift?.type).toBe('OPTIMISTIC_PATH');
      expect(drift?.severity).toBe('HIGH');
    });
  });

  describe('Runaway Refactor Detection', () => {
    test('detects cascading changes across 4+ files', () => {
      const input: CodeLevelInput = {
        plan: [{ id: '1', description: 'Fix bug', expectedScope: ['core'] }],
        codeChanges: [
          { file: 'core/main.ts', additions: 5, deletions: 2, hunks: [] },
          { file: 'utils/helper.ts', additions: 5, deletions: 2, hunks: [] },
          { file: 'api/routes.ts', additions: 5, deletions: 2, hunks: [] },
          { file: 'config/settings.ts', additions: 5, deletions: 2, hunks: [] },
        ],
        tests: { failing: [], passing: [] },
        dependencies: [],
        logs: [],
      };

      const drift = detector.check(input);
      expect(drift?.type).toBe('RUNAWAY_REFACTOR');
      expect(drift?.severity).toBe('CRITICAL');
    });

    test('detects refactor-related logs with multi-file changes', () => {
      const input: CodeLevelInput = {
        plan: [{ id: '1', description: 'Fix', expectedScope: [] }],
        codeChanges: [
          { file: 'file1.ts', additions: 5, deletions: 2, hunks: [] },
          { file: 'file2.ts', additions: 5, deletions: 2, hunks: [] },
          { file: 'file3.ts', additions: 5, deletions: 2, hunks: [] },
        ],
        tests: { failing: [], passing: [] },
        dependencies: [],
        logs: ['while I am here, let me clean up the config module', 'modernizing the API layer'],
      };

      const drift = detector.check(input);
      expect(drift?.type).toBe('RUNAWAY_REFACTOR');
    });
  });

  describe('Drift Scoring', () => {
    test('returns 1.0 for critical drift', () => {
      const input: CodeLevelInput = {
        plan: [{ id: '1', description: 'Fix', expectedScope: ['src'] }],
        codeChanges: [
          { file: 'src/main.ts', additions: 5, deletions: 2, hunks: [] },
          { file: 'dashboard/layout.tsx', additions: 5, deletions: 0, hunks: [] },
          { file: 'api/routes.ts', additions: 5, deletions: 0, hunks: [] },
        ],
        tests: { failing: [], passing: [] },
        dependencies: [],
        logs: [],
      };

      const score = detector.computeScore(input);
      expect(score).toBe(1.0);
    });

    test('returns 0.0 for clean code', () => {
      const input: CodeLevelInput = {
        plan: [{ id: '1', description: 'Fix', expectedScope: ['src'] }],
        codeChanges: [{ file: 'src/main.ts', additions: 5, deletions: 2, hunks: [] }],
        tests: { failing: ['error.test'], passing: ['happy-path.test'] },
        dependencies: [],
        logs: [],
      };

      const score = detector.computeScore(input);
      expect(score).toBe(0.0);
    });
  });
});

describe('InstinctOps', () => {
  let instincts: InstinctOps;
  const context = { taskId: 'task-1', agentRole: 'coder' as const, timestamp: Date.now(), enforced: true };

  beforeEach(() => {
    instincts = new InstinctOps();
  });

  describe('Verification First', () => {
    test('allows fix with failing test', () => {
      const result = instincts.beforeFix(context, {
        tests: ['pass1', 'pass2'],
        failingTests: ['fail1'],
      });

      expect(result.violated).toBe(false);
      expect(result.shouldHalt).toBe(false);
    });

    test('halts without failing test', () => {
      const result = instincts.beforeFix(context, {
        tests: ['pass1'],
        failingTests: [],
      });

      expect(result.violated).toBe(true);
      expect(result.shouldHalt).toBe(true);
    });
  });

  describe('Define Done', () => {
    test('allows plan with criteria', () => {
      const result = instincts.beforePlan(context, {
        criteria: 'Input: X, Output: Y, Errors: Z',
        request: 'Add validation',
      });

      expect(result.violated).toBe(false);
      expect(result.shouldHalt).toBe(false);
    });

    test('halts without criteria', () => {
      const result = instincts.beforePlan(context, {
        criteria: '',
        request: 'Add validation',
      });

      expect(result.violated).toBe(true);
      expect(result.shouldHalt).toBe(true);
    });
  });

  describe('Dependency Skepticism', () => {
    test('allows dependency with justification and version', () => {
      const result = instincts.beforeDependencyAdd(context, {
        depName: 'axios',
        justification: 'Need HTTP client for API calls',
        version: '1.6.0',
      });

      expect(result.violated).toBe(false);
      expect(result.shouldHalt).toBe(false);
    });

    test('halts without justification', () => {
      const result = instincts.beforeDependencyAdd(context, {
        depName: 'lodash',
        justification: '',
        version: '4.17.21',
      });

      expect(result.violated).toBe(true);
      expect(result.shouldHalt).toBe(true);
    });
  });

  describe('Telemetry', () => {
    test('records instinct events', () => {
      instincts.beforePlan(context, { criteria: 'test', request: '' });
      instincts.beforeFix(context, { tests: [], failingTests: ['fail'] });

      const telemetry = instincts.getTelemetry();
      expect(telemetry.define_done).toBe(1);
      expect(telemetry.verification_first).toBe(1);
    });

    test('can reset telemetry', () => {
      instincts.beforePlan(context, { criteria: 'test', request: '' });
      instincts.resetTelemetry();

      const telemetry = instincts.getTelemetry();
      expect(Object.keys(telemetry).length).toBe(0);
    });
  });
});

describe('ExecutionPolicyAutoHealing', () => {
  let healing: ExecutionPolicyAutoHealing;

  beforeEach(() => {
    healing = new ExecutionPolicyAutoHealing();
  });

  describe('Kitchen Sink Healing', () => {
    test('shrinks scope to single file', async () => {
      const drift: DriftSignal = {
        type: 'KITCHEN_SINK',
        severity: 'CRITICAL',
        details: { reason: 'Scope expanded beyond criteria' },
        timestamp: Date.now(),
      };

      const result = await healing.onDriftDetected(drift, {
        plan: 'Fix auth bug',
        criteria: 'Fix authentication issue',
        logs: [],
      });

      expect(result.amplifiedConstraints.max_files_modified).toBe(1);
      expect(result.amplifiedConstraints.no_new_files).toBe(true);
      expect(result.resumeAllowed).toBe(false); // hard drift, requires manual approval
    });
  });

  describe('Optimistic Path Healing', () => {
    test('adds negative test requirements', async () => {
      const drift: DriftSignal = {
        type: 'OPTIMISTIC_PATH',
        severity: 'HIGH',
        details: { reason: 'No negative tests found' },
        timestamp: Date.now(),
      };

      const result = await healing.onDriftDetected(drift, {
        plan: 'Add validation',
        criteria: 'Handle invalid inputs',
        logs: [],
      });

      expect(result.amplifiedConstraints.require_error_tests).toBe(true);
      expect(result.amplifiedConstraints.enumerate_error_cases).toBe(true);
      expect(result.resumeAllowed).toBe(true); // soft drift, can auto-resume
    });
  });

  describe('Healing Report', () => {
    test('formats healing report correctly', async () => {
      const drift: DriftSignal = {
        type: 'WRONG_ABSTRACTION',
        severity: 'HIGH',
        details: { reason: 'Duplicated code blocks' },
        timestamp: Date.now(),
      };

      const healing_result = await healing.onDriftDetected(drift, {
        plan: 'Refactor utils',
        criteria: 'Extract shared logic',
        logs: [],
      });

      const report = healing.formatHealingReport(drift, healing_result);
      expect(report).toContain('DRIFT HEALING REPORT');
      expect(report).toContain('WRONG_ABSTRACTION');
      expect(report).toContain('Extract shared logic');
    });
  });
});
