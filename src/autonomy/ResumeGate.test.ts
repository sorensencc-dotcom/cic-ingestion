/**
 * Wave G — Resume Gate Tests
 */

import { ResumeGate, RevisedPlan, RevisedCriteria } from './ResumeGate';
import { CorrelatedDriftVector } from './DriftCorrelationGraph';

describe('ResumeGate', () => {
  let gate: ResumeGate;

  beforeEach(() => {
    gate = new ResumeGate();
  });

  describe('Resume Conditions', () => {
    test('validates revised criteria exist', () => {
      const criteria: RevisedCriteria = {
        acceptanceCriteria: ['Pass all unit tests', 'No regressions'],
        negativeTestCases: 5,
        errorPaths: ['error-1', 'error-2'],
        dependencyJustifications: {},
        timestamp: Date.now(),
      };

      const plan: RevisedPlan = {
        wave: 'F',
        scope: ['src/core'],
        expectedFiles: ['src/core/main.ts'],
        maxFileChanges: 5,
        timestamp: Date.now(),
      };

      const vectors: CorrelatedDriftVector[] = [];

      const decision = gate.evaluate(vectors, plan, criteria, []);

      const criteriaCondition = decision.conditions.find((c) => c.name === 'Revised criteria exist');
      expect(criteriaCondition?.passed).toBe(true);
    });

    test('fails when revised criteria missing', () => {
      const badCriteria: RevisedCriteria = {
        acceptanceCriteria: [],
        negativeTestCases: 0,
        errorPaths: [],
        dependencyJustifications: {},
        timestamp: Date.now(),
      };

      const plan: RevisedPlan = {
        wave: 'F',
        scope: ['src/core'],
        expectedFiles: ['src/core/main.ts'],
        maxFileChanges: 5,
        timestamp: Date.now(),
      };

      const decision = gate.evaluate([], plan, badCriteria, []);

      expect(decision.failedConditions).toContain('criteria_exist');
    });

    test('validates revised plan exists', () => {
      const criteria: RevisedCriteria = {
        acceptanceCriteria: ['Pass tests'],
        negativeTestCases: 3,
        errorPaths: [],
        dependencyJustifications: {},
        timestamp: Date.now(),
      };

      const plan: RevisedPlan = {
        wave: 'F',
        scope: ['src/core', 'src/utils'],
        expectedFiles: ['src/core/main.ts', 'src/utils/helper.ts'],
        maxFileChanges: 10,
        timestamp: Date.now(),
      };

      const decision = gate.evaluate([], plan, criteria, []);

      const planCondition = decision.conditions.find((c) => c.name === 'Revised plan exists');
      expect(planCondition?.passed).toBe(true);
    });

    test('fails when revised plan missing', () => {
      const criteria: RevisedCriteria = {
        acceptanceCriteria: ['Pass tests'],
        negativeTestCases: 3,
        errorPaths: [],
        dependencyJustifications: {},
        timestamp: Date.now(),
      };

      const badPlan: RevisedPlan = {
        wave: 'F',
        scope: [],
        expectedFiles: [],
        maxFileChanges: 0,
        timestamp: Date.now(),
      };

      const decision = gate.evaluate([], badPlan, criteria, []);

      expect(decision.failedConditions).toContain('plan_exists');
    });

    test('validates severity threshold < 0.5', () => {
      const criteria: RevisedCriteria = {
        acceptanceCriteria: ['Pass tests'],
        negativeTestCases: 3,
        errorPaths: [],
        dependencyJustifications: {},
        timestamp: Date.now(),
      };

      const plan: RevisedPlan = {
        wave: 'F',
        scope: ['src/core'],
        expectedFiles: ['src/core/main.ts'],
        maxFileChanges: 5,
        timestamp: Date.now(),
      };

      const vector: CorrelatedDriftVector = {
        sourceWave: 'F',
        failureMode: 'WRONG_ABSTRACTION',
        severity: 0.3,
        correlatedEvents: [],
        recommendedPrimitives: [],
        confidence: 0.7,
        description: 'Test vector',
        timestamp: Date.now(),
      };

      const decision = gate.evaluate([vector], plan, criteria, []);

      expect(decision.failedConditions).not.toContain('severity_threshold');
    });

    test('fails when severity >= 0.5', () => {
      const criteria: RevisedCriteria = {
        acceptanceCriteria: ['Pass tests'],
        negativeTestCases: 3,
        errorPaths: [],
        dependencyJustifications: {},
        timestamp: Date.now(),
      };

      const plan: RevisedPlan = {
        wave: 'F',
        scope: ['src/core'],
        expectedFiles: ['src/core/main.ts'],
        maxFileChanges: 5,
        timestamp: Date.now(),
      };

      const vector: CorrelatedDriftVector = {
        sourceWave: 'F',
        failureMode: 'RUNAWAY_REFACTOR',
        severity: 0.8,
        correlatedEvents: [],
        recommendedPrimitives: [],
        confidence: 0.8,
        description: 'High severity drift',
        timestamp: Date.now(),
      };

      const decision = gate.evaluate([vector], plan, criteria, []);

      expect(decision.failedConditions).toContain('severity_threshold');
    });

    test('validates negative tests present', () => {
      const criteria: RevisedCriteria = {
        acceptanceCriteria: ['Handle errors'],
        negativeTestCases: 5,
        errorPaths: ['missing-input', 'network-error'],
        dependencyJustifications: {},
        timestamp: Date.now(),
      };

      const plan: RevisedPlan = {
        wave: 'F',
        scope: ['src/core'],
        expectedFiles: ['src/core/main.ts'],
        maxFileChanges: 5,
        timestamp: Date.now(),
      };

      const decision = gate.evaluate([], plan, criteria, []);

      const testCondition = decision.conditions.find((c) => c.name === 'Negative tests present');
      expect(testCondition?.passed).toBe(true);
    });

    test('validates dependency justifications', () => {
      const criteria: RevisedCriteria = {
        acceptanceCriteria: ['Use lodash for utils'],
        negativeTestCases: 3,
        errorPaths: [],
        dependencyJustifications: {
          lodash: 'Reduces array operations boilerplate by 40%',
          moment: 'Handles timezone conversions safely',
        },
        timestamp: Date.now(),
      };

      const plan: RevisedPlan = {
        wave: 'F',
        scope: ['src/core'],
        expectedFiles: ['src/core/main.ts'],
        maxFileChanges: 5,
        timestamp: Date.now(),
      };

      const decision = gate.evaluate([], plan, criteria, []);

      const depCondition = decision.conditions.find((c) => c.name === 'Dependency justifications complete');
      expect(depCondition?.passed).toBe(true);
    });
  });

  describe('Cross-Wave Contradictions', () => {
    test('detects contradictions in plan scope vs criteria', () => {
      const criteria: RevisedCriteria = {
        acceptanceCriteria: ['Fix src/services/auth.ts', 'Update src/config/db.ts'],
        negativeTestCases: 3,
        errorPaths: [],
        dependencyJustifications: {},
        timestamp: Date.now(),
      };

      const plan: RevisedPlan = {
        wave: 'F',
        scope: ['src/core'],
        expectedFiles: ['src/core/main.ts'],
        maxFileChanges: 5,
        timestamp: Date.now(),
      };

      const decision = gate.evaluate([], plan, criteria, []);

      expect(decision.contradictions.length).toBeGreaterThan(0);
    });

    test('detects multiple failure modes across waves', () => {
      const criteria: RevisedCriteria = {
        acceptanceCriteria: ['Pass tests'],
        negativeTestCases: 3,
        errorPaths: [],
        dependencyJustifications: {},
        timestamp: Date.now(),
      };

      const plan: RevisedPlan = {
        wave: 'F',
        scope: ['src/core'],
        expectedFiles: ['src/core/main.ts'],
        maxFileChanges: 5,
        timestamp: Date.now(),
      };

      const vector1: CorrelatedDriftVector = {
        sourceWave: 'C',
        failureMode: 'WRONG_ABSTRACTION',
        severity: 0.3,
        correlatedEvents: [],
        recommendedPrimitives: [],
        confidence: 0.7,
        description: 'Vector 1',
        timestamp: Date.now(),
      };

      const vector2: CorrelatedDriftVector = {
        sourceWave: 'F',
        failureMode: 'RUNAWAY_REFACTOR',
        severity: 0.4,
        correlatedEvents: [],
        recommendedPrimitives: [],
        confidence: 0.7,
        description: 'Vector 2',
        timestamp: Date.now(),
      };

      const vector3: CorrelatedDriftVector = {
        sourceWave: 'E',
        failureMode: 'OPTIMISTIC_PATH',
        severity: 0.2,
        correlatedEvents: [],
        recommendedPrimitives: [],
        confidence: 0.7,
        description: 'Vector 3',
        timestamp: Date.now(),
      };

      const decision = gate.evaluate([vector1, vector2, vector3], plan, criteria, []);

      expect(decision.contradictions.some((c) => c.includes('failure modes'))).toBe(true);
    });

    test('detects dependency creep without justifications', () => {
      const criteria: RevisedCriteria = {
        acceptanceCriteria: ['Pass tests'],
        negativeTestCases: 3,
        errorPaths: [],
        dependencyJustifications: {}, // No justifications
        timestamp: Date.now(),
      };

      const plan: RevisedPlan = {
        wave: 'F',
        scope: ['src/core'],
        expectedFiles: ['src/core/main.ts'],
        maxFileChanges: 5,
        timestamp: Date.now(),
      };

      const vector: CorrelatedDriftVector = {
        sourceWave: 'E',
        failureMode: 'WRONG_ABSTRACTION',
        severity: 0.3,
        details: { newDependencies: ['lodash', 'moment'] },
        correlatedEvents: [],
        recommendedPrimitives: [],
        confidence: 0.7,
        description: 'Dependency creep detected',
        timestamp: Date.now(),
      };

      const decision = gate.evaluate([vector], plan, criteria, []);

      expect(decision.contradictions.some((c) => c.includes('creep'))).toBe(true);
    });
  });

  describe('Drift Classification', () => {
    test('classifies KITCHEN_SINK as HARD drift', () => {
      const criteria: RevisedCriteria = {
        acceptanceCriteria: ['Pass tests'],
        negativeTestCases: 3,
        errorPaths: [],
        dependencyJustifications: {},
        timestamp: Date.now(),
      };

      const plan: RevisedPlan = {
        wave: 'F',
        scope: ['src/core'],
        expectedFiles: ['src/core/main.ts'],
        maxFileChanges: 5,
        timestamp: Date.now(),
      };

      const vector: CorrelatedDriftVector = {
        sourceWave: 'B',
        failureMode: 'KITCHEN_SINK',
        severity: 0.3,
        correlatedEvents: [],
        recommendedPrimitives: [],
        confidence: 0.7,
        description: 'Kitchen sink drift',
        timestamp: Date.now(),
      };

      const decision = gate.evaluate([vector], plan, criteria, []);

      expect(decision.driftClassification).toBe('HARD');
    });

    test('classifies RUNAWAY_REFACTOR as HARD drift', () => {
      const criteria: RevisedCriteria = {
        acceptanceCriteria: ['Pass tests'],
        negativeTestCases: 3,
        errorPaths: [],
        dependencyJustifications: {},
        timestamp: Date.now(),
      };

      const plan: RevisedPlan = {
        wave: 'F',
        scope: ['src/core'],
        expectedFiles: ['src/core/main.ts'],
        maxFileChanges: 5,
        timestamp: Date.now(),
      };

      const vector: CorrelatedDriftVector = {
        sourceWave: 'F',
        failureMode: 'RUNAWAY_REFACTOR',
        severity: 0.3,
        correlatedEvents: [],
        recommendedPrimitives: [],
        confidence: 0.7,
        description: 'Runaway refactor drift',
        timestamp: Date.now(),
      };

      const decision = gate.evaluate([vector], plan, criteria, []);

      expect(decision.driftClassification).toBe('HARD');
    });

    test('classifies WRONG_ABSTRACTION as SOFT drift', () => {
      const criteria: RevisedCriteria = {
        acceptanceCriteria: ['Pass tests'],
        negativeTestCases: 3,
        errorPaths: [],
        dependencyJustifications: {},
        timestamp: Date.now(),
      };

      const plan: RevisedPlan = {
        wave: 'F',
        scope: ['src/core'],
        expectedFiles: ['src/core/main.ts'],
        maxFileChanges: 5,
        timestamp: Date.now(),
      };

      const vector: CorrelatedDriftVector = {
        sourceWave: 'E',
        failureMode: 'WRONG_ABSTRACTION',
        severity: 0.3,
        correlatedEvents: [],
        recommendedPrimitives: [],
        confidence: 0.7,
        description: 'Wrong abstraction drift',
        timestamp: Date.now(),
      };

      const decision = gate.evaluate([vector], plan, criteria, []);

      expect(decision.driftClassification).toBe('SOFT');
    });

    test('classifies OPTIMISTIC_PATH as SOFT drift', () => {
      const criteria: RevisedCriteria = {
        acceptanceCriteria: ['Pass tests'],
        negativeTestCases: 3,
        errorPaths: [],
        dependencyJustifications: {},
        timestamp: Date.now(),
      };

      const plan: RevisedPlan = {
        wave: 'F',
        scope: ['src/core'],
        expectedFiles: ['src/core/main.ts'],
        maxFileChanges: 5,
        timestamp: Date.now(),
      };

      const vector: CorrelatedDriftVector = {
        sourceWave: 'D',
        failureMode: 'OPTIMISTIC_PATH',
        severity: 0.3,
        correlatedEvents: [],
        recommendedPrimitives: [],
        confidence: 0.7,
        description: 'Optimistic path drift',
        timestamp: Date.now(),
      };

      const decision = gate.evaluate([vector], plan, criteria, []);

      expect(decision.driftClassification).toBe('SOFT');
    });

    test('classifies no drift as NONE', () => {
      const criteria: RevisedCriteria = {
        acceptanceCriteria: ['Pass tests'],
        negativeTestCases: 3,
        errorPaths: [],
        dependencyJustifications: {},
        timestamp: Date.now(),
      };

      const plan: RevisedPlan = {
        wave: 'F',
        scope: ['src/core'],
        expectedFiles: ['src/core/main.ts'],
        maxFileChanges: 5,
        timestamp: Date.now(),
      };

      const decision = gate.evaluate([], plan, criteria, []);

      expect(decision.driftClassification).toBe('NONE');
    });
  });

  describe('Approval Decision', () => {
    test('hard drift requires manual approval', () => {
      const criteria: RevisedCriteria = {
        acceptanceCriteria: ['Pass tests'],
        negativeTestCases: 3,
        errorPaths: [],
        dependencyJustifications: {},
        timestamp: Date.now(),
      };

      const plan: RevisedPlan = {
        wave: 'F',
        scope: ['src/core'],
        expectedFiles: ['src/core/main.ts'],
        maxFileChanges: 5,
        timestamp: Date.now(),
      };

      const vector: CorrelatedDriftVector = {
        sourceWave: 'B',
        failureMode: 'KITCHEN_SINK',
        severity: 0.2,
        correlatedEvents: [],
        recommendedPrimitives: [],
        confidence: 0.7,
        description: 'Hard drift',
        timestamp: Date.now(),
      };

      const decision = gate.evaluate([vector], plan, criteria, []);

      expect(decision.allowed).toBe(false);
      expect(decision.requiredApprovals).toContain('human_review');
    });

    test('soft drift approved when all conditions pass', () => {
      const criteria: RevisedCriteria = {
        acceptanceCriteria: ['Pass tests'],
        negativeTestCases: 3,
        errorPaths: [],
        dependencyJustifications: {},
        timestamp: Date.now(),
      };

      const plan: RevisedPlan = {
        wave: 'F',
        scope: ['src/core'],
        expectedFiles: ['src/core/main.ts'],
        maxFileChanges: 5,
        timestamp: Date.now(),
      };

      const vector: CorrelatedDriftVector = {
        sourceWave: 'E',
        failureMode: 'WRONG_ABSTRACTION',
        severity: 0.2,
        correlatedEvents: [],
        recommendedPrimitives: [],
        confidence: 0.7,
        description: 'Soft drift',
        timestamp: Date.now(),
      };

      const decision = gate.evaluate([vector], plan, criteria, ['heal.require_abstraction_step']);

      expect(decision.allowed).toBe(true);
      expect(decision.requiredApprovals.length).toBe(0);
    });

    test('soft drift rejected when conditions fail', () => {
      const criteria: RevisedCriteria = {
        acceptanceCriteria: [],
        negativeTestCases: 0,
        errorPaths: [],
        dependencyJustifications: {},
        timestamp: Date.now(),
      };

      const plan: RevisedPlan = {
        wave: 'F',
        scope: ['src/core'],
        expectedFiles: ['src/core/main.ts'],
        maxFileChanges: 5,
        timestamp: Date.now(),
      };

      const vector: CorrelatedDriftVector = {
        sourceWave: 'E',
        failureMode: 'WRONG_ABSTRACTION',
        severity: 0.2,
        correlatedEvents: [],
        recommendedPrimitives: [],
        confidence: 0.7,
        description: 'Soft drift',
        timestamp: Date.now(),
      };

      const decision = gate.evaluate([vector], plan, criteria, []);

      expect(decision.allowed).toBe(false);
    });

    test('no drift approved when all conditions pass', () => {
      const criteria: RevisedCriteria = {
        acceptanceCriteria: ['Pass tests'],
        negativeTestCases: 3,
        errorPaths: [],
        dependencyJustifications: {},
        timestamp: Date.now(),
      };

      const plan: RevisedPlan = {
        wave: 'F',
        scope: ['src/core'],
        expectedFiles: ['src/core/main.ts'],
        maxFileChanges: 5,
        timestamp: Date.now(),
      };

      const decision = gate.evaluate([], plan, criteria, []);

      expect(decision.allowed).toBe(true);
      expect(decision.driftClassification).toBe('NONE');
    });
  });

  describe('Integration Scenarios', () => {
    test('e2e: complete gate flow with soft drift approval', () => {
      const criteria: RevisedCriteria = {
        acceptanceCriteria: ['All tests pass', 'No regressions in utils module'],
        negativeTestCases: 8,
        errorPaths: ['missing-input', 'network-error', 'timeout'],
        dependencyJustifications: {
          lodash: 'Utility functions reduce duplication',
        },
        timestamp: Date.now(),
      };

      const plan: RevisedPlan = {
        wave: 'E',
        scope: ['src/core', 'src/utils'],
        expectedFiles: ['src/core/main.ts', 'src/utils/helper.ts'],
        maxFileChanges: 8,
        maxDuplicates: 2,
        timestamp: Date.now(),
      };

      const vector: CorrelatedDriftVector = {
        sourceWave: 'E',
        rootCauseWave: 'C',
        failureMode: 'WRONG_ABSTRACTION',
        severity: 0.35,
        correlatedEvents: [
          {
            wave: 'C',
            failureMode: 'KITCHEN_SINK',
            severity: 'MEDIUM',
            details: { duplicateCount: 2 },
            timestamp: Date.now() - 1000,
          },
        ],
        recommendedPrimitives: ['heal.require_abstraction_step'],
        confidence: 0.8,
        description: 'Duplication in utils module',
        timestamp: Date.now(),
      };

      const decision = gate.evaluate([vector], plan, criteria, ['heal.require_abstraction_step']);

      expect(decision.allowed).toBe(true);
      expect(decision.driftClassification).toBe('SOFT');
      expect(decision.failedConditions.length).toBe(0);
    });

    test('e2e: hard drift blocks resume despite passing conditions', () => {
      const criteria: RevisedCriteria = {
        acceptanceCriteria: ['All tests pass'],
        negativeTestCases: 5,
        errorPaths: [],
        dependencyJustifications: {},
        timestamp: Date.now(),
      };

      const plan: RevisedPlan = {
        wave: 'F',
        scope: ['src/core'],
        expectedFiles: ['src/core/main.ts'],
        maxFileChanges: 5,
        timestamp: Date.now(),
      };

      const vector: CorrelatedDriftVector = {
        sourceWave: 'F',
        rootCauseWave: 'B',
        failureMode: 'RUNAWAY_REFACTOR',
        severity: 0.4,
        correlatedEvents: [],
        recommendedPrimitives: ['heal.enforce_surgical_diff', 'heal.freeze_architecture'],
        confidence: 0.85,
        description: 'Cascading refactor from planning ambiguity',
        timestamp: Date.now(),
      };

      const decision = gate.evaluate([vector], plan, criteria, ['heal.enforce_surgical_diff']);

      expect(decision.allowed).toBe(false);
      expect(decision.driftClassification).toBe('HARD');
      expect(decision.requiredApprovals).toContain('human_review');
    });

    test('e2e: multiple vectors with mixed classification', () => {
      const criteria: RevisedCriteria = {
        acceptanceCriteria: ['All tests pass'],
        negativeTestCases: 5,
        errorPaths: [],
        dependencyJustifications: {},
        timestamp: Date.now(),
      };

      const plan: RevisedPlan = {
        wave: 'F',
        scope: ['src/core'],
        expectedFiles: ['src/core/main.ts'],
        maxFileChanges: 5,
        timestamp: Date.now(),
      };

      const softVector: CorrelatedDriftVector = {
        sourceWave: 'E',
        failureMode: 'WRONG_ABSTRACTION',
        severity: 0.2,
        correlatedEvents: [],
        recommendedPrimitives: [],
        confidence: 0.7,
        description: 'Soft drift',
        timestamp: Date.now(),
      };

      const hardVector: CorrelatedDriftVector = {
        sourceWave: 'B',
        failureMode: 'KITCHEN_SINK',
        severity: 0.25,
        correlatedEvents: [],
        recommendedPrimitives: [],
        confidence: 0.8,
        description: 'Hard drift',
        timestamp: Date.now(),
      };

      const decision = gate.evaluate([softVector, hardVector], plan, criteria, []);

      // Hard drift takes precedence
      expect(decision.driftClassification).toBe('HARD');
      expect(decision.allowed).toBe(false);
    });
  });

  describe('Output Validation', () => {
    test('decision contains all required fields', () => {
      const criteria: RevisedCriteria = {
        acceptanceCriteria: ['Pass tests'],
        negativeTestCases: 3,
        errorPaths: [],
        dependencyJustifications: {},
        timestamp: Date.now(),
      };

      const plan: RevisedPlan = {
        wave: 'F',
        scope: ['src/core'],
        expectedFiles: ['src/core/main.ts'],
        maxFileChanges: 5,
        timestamp: Date.now(),
      };

      const decision = gate.evaluate([], plan, criteria, []);

      expect(decision.allowed).toBeDefined();
      expect(decision.driftClassification).toBeDefined();
      expect(decision.severity).toBeDefined();
      expect(decision.conditions).toBeDefined();
      expect(decision.failedConditions).toBeDefined();
      expect(decision.contradictions).toBeDefined();
      expect(decision.requiredApprovals).toBeDefined();
      expect(decision.reasoning).toBeDefined();
      expect(decision.timestamp).toBeDefined();
    });

    test('reasoning describes decision rationale', () => {
      const criteria: RevisedCriteria = {
        acceptanceCriteria: ['Pass tests'],
        negativeTestCases: 3,
        errorPaths: [],
        dependencyJustifications: {},
        timestamp: Date.now(),
      };

      const plan: RevisedPlan = {
        wave: 'F',
        scope: ['src/core'],
        expectedFiles: ['src/core/main.ts'],
        maxFileChanges: 5,
        timestamp: Date.now(),
      };

      const vector: CorrelatedDriftVector = {
        sourceWave: 'E',
        failureMode: 'WRONG_ABSTRACTION',
        severity: 0.3,
        correlatedEvents: [],
        recommendedPrimitives: [],
        confidence: 0.7,
        description: 'Test vector',
        timestamp: Date.now(),
      };

      const decision = gate.evaluate([vector], plan, criteria, []);

      expect(decision.reasoning.length).toBeGreaterThan(0);
      expect(decision.reasoning).toContain('WRONG_ABSTRACTION');
    });
  });
});
