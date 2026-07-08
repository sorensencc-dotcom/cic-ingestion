/**
 * Wave G — Healing Primitives Tests
 */

import {
  HealingPrimitives,
  HealingContext,
  DriftSignal,
} from './HealingPrimitives.js';

describe('HealingPrimitives', () => {
  let ctx: HealingContext;

  beforeEach(() => {
    ctx = {
      plan: [
        {
          id: 'plan-1',
          description: 'Fix core module',
          expectedScope: ['src/core'],
          step: 1,
        },
      ],
      criteria: {
        maxCorruptionPercent: 50,
        minSurvivalPercent: 50,
        requireBackupOnCorruption: true,
        timeoutMs: 5000,
      },
      codeChanges: [
        {
          file: 'src/core/main.ts',
          additions: 10,
          deletions: 5,
          hunks: ['const x = 1;', 'const y = 2;'],
        },
      ],
      tests: {
        failing: [],
        passing: ['test: basic functionality'],
        coverage: 80,
      },
      driftSignal: {
        type: 'KITCHEN_SINK',
        severity: 'HIGH',
        details: { filesModified: 1 },
        timestamp: Date.now(),
      },
    };
  });

  describe('heal.shrink_scope', () => {
    test('reduces scope to primary module', () => {
      const result = HealingPrimitives.shrinkScope(ctx);

      expect(result.applied).toBe(true);
      expect(result.modifiedPlan).toBeDefined();
      expect(result.modifiedPlan?.[0].expectedScope).toEqual(['src/core']);
      expect(result.reversible).toBe(true);
    });

    test('fails gracefully on empty code changes', () => {
      ctx.codeChanges = [];
      const result = HealingPrimitives.shrinkScope(ctx);

      expect(result.applied).toBe(false);
      expect(result.reason).toContain('No code changes');
    });
  });

  describe('heal.tighten_criteria', () => {
    test('tightens thresholds for scope creep', () => {
      ctx.codeChanges = [
        { file: 'src/core/main.ts', additions: 10, deletions: 5, hunks: [] },
        { file: 'src/utils/helper.ts', additions: 5, deletions: 2, hunks: [] },
      ];
      ctx.driftSignal = {
        type: 'KITCHEN_SINK',
        severity: 'CRITICAL',
        details: { unrelatedFiles: ['src/utils/helper.ts'] },
        timestamp: Date.now(),
      };

      const result = HealingPrimitives.tightenCriteria(ctx);

      expect(result.applied).toBe(true);
      expect(result.modifiedCriteria?.maxCorruptionPercent).toBe(40); // 50 * 0.8
      expect(result.modifiedCriteria?.minSurvivalPercent).toBe(60); // 50 * 1.2
      expect(result.reversible).toBe(true);
    });

    test('skips when no unrelated files', () => {
      const result = HealingPrimitives.tightenCriteria(ctx);

      expect(result.applied).toBe(false);
      expect(result.reason).toContain('No unrelated files');
    });
  });

  describe('heal.inject_negative_tests', () => {
    test('injects negative tests when missing', () => {
      ctx.tests = {
        failing: [],
        passing: ['test: success path'],
        coverage: 60,
      };

      const result = HealingPrimitives.injectNegativeTests(ctx);

      expect(result.applied).toBe(true);
      expect(result.modifiedTests?.failing.length).toBeGreaterThan(0);
      expect(result.modifiedTests?.failing).toContain(
        'test: handles invalid input gracefully'
      );
      expect(result.reversible).toBe(true);
    });

    test('skips when negative tests present', () => {
      ctx.tests = {
        failing: ['test: error handling'],
        passing: ['test: success'],
        coverage: 80,
      };

      const result = HealingPrimitives.injectNegativeTests(ctx);

      expect(result.applied).toBe(false);
      expect(result.reason).toContain('already present');
    });
  });

  describe('heal.enforce_surgical_diff', () => {
    test('reduces multiple files to single primary', () => {
      ctx.codeChanges = [
        { file: 'src/core/main.ts', additions: 20, deletions: 10, hunks: [] },
        { file: 'src/utils/helper.ts', additions: 5, deletions: 2, hunks: [] },
        { file: 'src/types/index.ts', additions: 3, deletions: 1, hunks: [] },
      ];
      ctx.driftSignal = {
        type: 'RUNAWAY_REFACTOR',
        severity: 'CRITICAL',
        details: { filesModified: 3 },
        timestamp: Date.now(),
      };

      const result = HealingPrimitives.enforceSurgicalDiff(ctx);

      expect(result.applied).toBe(true);
      expect(result.reason).toContain('3 files → 1 file');
      expect(result.reversible).toBe(true);
    });

    test('skips when already surgical', () => {
      const result = HealingPrimitives.enforceSurgicalDiff(ctx);

      expect(result.applied).toBe(false);
      expect(result.reason).toContain('Already surgical');
    });
  });

  describe('heal.freeze_architecture', () => {
    test('freezes architecture on runaway refactor', () => {
      ctx.driftSignal = {
        type: 'RUNAWAY_REFACTOR',
        severity: 'CRITICAL',
        details: { refactorLogs: ['renamed module X to Y', 'moved dir A to B'] },
        timestamp: Date.now(),
      };

      const result = HealingPrimitives.freezeArchitecture(ctx);

      expect(result.applied).toBe(true);
      expect(result.modifiedCriteria?._architectureFrozen).toBe(true);
      expect(result.modifiedCriteria?._frozenRules).toContain('no module renames');
      expect(result.reversible).toBe(true);
    });

    test('skips when no refactor detected', () => {
      ctx.driftSignal = {
        type: 'KITCHEN_SINK',
        severity: 'HIGH',
        details: {},
        timestamp: Date.now(),
      };

      const result = HealingPrimitives.freezeArchitecture(ctx);

      expect(result.applied).toBe(false);
    });
  });

  describe('heal.require_abstraction_step', () => {
    test('adds abstraction step on duplication', () => {
      ctx.codeChanges = [
        {
          file: 'src/core/main.ts',
          additions: 10,
          deletions: 5,
          hunks: [
            'const validate = (x) => x > 0;',
            'const validate = (x) => x > 0;', // duplicate
          ],
        },
      ];
      ctx.driftSignal = {
        type: 'WRONG_ABSTRACTION',
        severity: 'HIGH',
        details: {
          duplicateCount: 2,
          blocks: ['const validate = (x) => x > 0;'],
        },
        timestamp: Date.now(),
      };

      const result = HealingPrimitives.requireAbstractionStep(ctx);

      expect(result.applied).toBe(true);
      expect(result.modifiedPlan?.length).toBeGreaterThan(ctx.plan.length);
      expect(result.modifiedPlan?.[0].description).toContain('Extract duplicated');
      expect(result.reversible).toBe(true);
    });

    test('skips when no duplication', () => {
      const result = HealingPrimitives.requireAbstractionStep(ctx);

      expect(result.applied).toBe(false);
    });
  });

  describe('heal.require_dependency_justification', () => {
    test('flags new dependencies for justification', () => {
      ctx.codeChanges = [
        {
          file: 'src/core/main.ts',
          additions: 15,
          deletions: 5,
          hunks: [
            "import { lodash } from 'lodash';",
            "import { moment } from 'moment';",
          ],
        },
      ];

      const result = HealingPrimitives.requireDependencyJustification(ctx);

      expect(result.applied).toBe(true);
      expect(result.modifiedCriteria?._dependencyJustification).toBeDefined();
      expect(Object.keys(result.modifiedCriteria?._dependencyJustification || {})).toContain(
        'lodash'
      );
      expect(result.reversible).toBe(true);
    });

    test('skips when no new dependencies', () => {
      ctx.codeChanges = [
        {
          file: 'src/core/main.ts',
          additions: 5,
          deletions: 2,
          hunks: ['const x = 1;', 'return x + 1;'],
        },
      ];

      const result = HealingPrimitives.requireDependencyJustification(ctx);

      expect(result.applied).toBe(false);
    });
  });

  describe('Composition', () => {
    test('composes multiple primitives sequentially', () => {
      ctx.codeChanges = [
        { file: 'src/core/main.ts', additions: 20, deletions: 10, hunks: [] },
        { file: 'src/utils/helper.ts', additions: 5, deletions: 2, hunks: [] },
      ];
      ctx.tests = {
        failing: [],
        passing: ['test: basic'],
        coverage: 60,
      };

      const results = HealingPrimitives.compose(ctx, [
        'heal.shrink_scope',
        'heal.tighten_criteria',
        'heal.inject_negative_tests',
      ]);

      expect(results.length).toBe(3);
      expect(results[0].applied).toBe(true); // shrink_scope applies
      expect(results[1].applied).toBe(true); // tighten_criteria applies
      expect(results[2].applied).toBe(true); // inject_negative_tests applies
    });

    test('stops on unsupported primitive', () => {
      const results = HealingPrimitives.compose(ctx, [
        'heal.shrink_scope',
        'heal.unknown_primitive',
      ]);

      expect(results.length).toBe(2);
      expect(results[1].applied).toBe(false);
      expect(results[1].reason).toContain('Unknown');
    });

    test('all primitives are reversible', () => {
      const allPrimitives = [
        'heal.shrink_scope',
        'heal.tighten_criteria',
        'heal.inject_negative_tests',
        'heal.enforce_surgical_diff',
        'heal.freeze_architecture',
        'heal.require_abstraction_step',
        'heal.require_dependency_justification',
      ];

      const results = HealingPrimitives.compose(ctx, allPrimitives);

      for (const result of results) {
        expect(result.reversible).toBe(true);
      }
    });
  });

  describe('Instinct Alignment', () => {
    test('all primitives respect Verification First', () => {
      // Verification First: failing test before fix
      ctx.tests = {
        failing: ['test: current failure'],
        passing: [],
        coverage: 0,
      };

      const result = HealingPrimitives.injectNegativeTests(ctx);

      expect(result.applied).toBe(true);
      // Negative tests are added (verification-first approach)
    });

    test('all primitives respect Surgical Change', () => {
      ctx.codeChanges = [
        { file: 'src/a.ts', additions: 100, deletions: 50, hunks: [] },
        { file: 'src/b.ts', additions: 50, deletions: 25, hunks: [] },
        { file: 'src/c.ts', additions: 10, deletions: 5, hunks: [] },
      ];

      const result = HealingPrimitives.enforceSurgicalDiff(ctx);

      expect(result.applied).toBe(true);
      // Reduced to single file (surgical)
      expect(result.reason).toContain('→ 1 file');
    });

    test('all primitives respect Drift Halt Reflex', () => {
      // Setup: 5 files modified
      ctx.codeChanges = [
        { file: 'src/a.ts', additions: 10, deletions: 5, hunks: [] },
        { file: 'src/b.ts', additions: 10, deletions: 5, hunks: [] },
        { file: 'src/c.ts', additions: 10, deletions: 5, hunks: [] },
        { file: 'src/d.ts', additions: 10, deletions: 5, hunks: [] },
        { file: 'src/e.ts', additions: 10, deletions: 5, hunks: [] },
      ];
      ctx.driftSignal = {
        type: 'RUNAWAY_REFACTOR',
        severity: 'CRITICAL',
        details: { filesModified: 5, refactorLogs: ['refactoring module structure'] },
        timestamp: Date.now(),
      };

      const results = HealingPrimitives.compose(ctx, [
        'heal.enforce_surgical_diff',
        'heal.freeze_architecture',
      ]);

      // Both halt-related primitives apply
      expect(results[0].applied).toBe(true);
      expect(results[1].applied).toBe(true);
    });
  });
});
