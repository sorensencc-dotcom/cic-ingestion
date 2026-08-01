import { InstinctOps, InstinctContext, getInstinctOps } from './InstinctOps';

describe('InstinctOps', () => {
  let ops: InstinctOps;
  const mockContext: InstinctContext = {
    taskId: 'test-task-1',
    agentRole: 'coder',
    timestamp: Date.now(),
    enforced: true,
  };

  beforeEach(() => {
    ops = new InstinctOps();
    ops.setEnforceMode(true);
  });

  describe('Instinct 01: Verification First (beforeFix)', () => {
    it('should NOT violate when failingTests list is non-empty', () => {
      const res = ops.beforeFix(mockContext, {
        tests: ['test1.ts'],
        failingTests: ['test1.ts'],
      });

      expect(res.violated).toBe(false);
      expect(res.shouldHalt).toBe(false);
      expect(res.reason).toBeUndefined();
    });

    it('should VIOLATE and HALT when failingTests list is empty or undefined', () => {
      const resEmpty = ops.beforeFix(mockContext, {
        tests: ['test1.ts'],
        failingTests: [],
      });

      expect(resEmpty.violated).toBe(true);
      expect(resEmpty.shouldHalt).toBe(true);
      expect(resEmpty.reason).toBe('No failing test to verify fix against');
      expect(resEmpty.guidance).toContain('Write a failing test');

      const resUndef = ops.beforeFix(mockContext, {
        tests: ['test1.ts'],
        failingTests: undefined as any,
      });
      expect(resUndef.violated).toBe(true);
      expect(resUndef.shouldHalt).toBe(true);
    });
  });

  describe('Instinct 02: Define Done (beforePlan)', () => {
    it('should NOT violate when non-empty acceptance criteria string is provided', () => {
      const res = ops.beforePlan(mockContext, {
        request: 'Build feature X',
        criteria: 'Passes unit tests and returns 200',
      });

      expect(res.violated).toBe(false);
      expect(res.shouldHalt).toBe(false);
    });

    it('should VIOLATE and HALT when criteria is missing, empty, or whitespace', () => {
      const resMissing = ops.beforePlan(mockContext, { request: 'Build feature X' });
      expect(resMissing.violated).toBe(true);
      expect(resMissing.shouldHalt).toBe(true);
      expect(resMissing.reason).toBe('Acceptance criteria not defined');

      const resWhitespace = ops.beforePlan(mockContext, {
        request: 'Build feature X',
        criteria: '   ',
      });
      expect(resWhitespace.violated).toBe(true);
      expect(resWhitespace.shouldHalt).toBe(true);
    });
  });

  describe('Instinct 03: Deterministic Debugging (beforeFix_Debugging)', () => {
    it('should NOT violate when error is reproduced', () => {
      const res = ops.beforeFix_Debugging(mockContext, {
        errorReproduced: true,
        changesMade: 0,
      });

      expect(res.violated).toBe(false);
      expect(res.shouldHalt).toBe(false);
    });

    it('should VIOLATE and HALT when error is NOT reproduced', () => {
      const res = ops.beforeFix_Debugging(mockContext, {
        errorReproduced: false,
        changesMade: 1,
      });

      expect(res.violated).toBe(true);
      expect(res.shouldHalt).toBe(true);
      expect(res.reason).toBe('Error not reproduced before attempting fix');
    });
  });

  describe('Instinct 04: Dependency Skepticism (beforeDependencyAdd)', () => {
    it('should NOT violate when both justification and version are provided', () => {
      const res = ops.beforeDependencyAdd(mockContext, {
        depName: 'lodash',
        justification: 'Required for deep cloning',
        version: '^4.17.21',
      });

      expect(res.violated).toBe(false);
      expect(res.shouldHalt).toBe(false);
    });

    it('should VIOLATE when missing justification', () => {
      const res = ops.beforeDependencyAdd(mockContext, {
        depName: 'lodash',
        version: '^4.17.21',
      });

      expect(res.violated).toBe(true);
      expect(res.reason).toBe('Missing justification for lodash');
    });

    it('should VIOLATE when missing version', () => {
      const res = ops.beforeDependencyAdd(mockContext, {
        depName: 'lodash',
        justification: 'Required for deep cloning',
      });

      expect(res.violated).toBe(true);
      expect(res.reason).toBe('Missing version for lodash');
    });
  });

  describe('Instinct 05: Surface Uncertainty (surfaceUncertainty)', () => {
    it('should NOT violate when confident is false or when uncertainty is documented', () => {
      const resNotConfident = ops.surfaceUncertainty(mockContext, { confident: false });
      expect(resNotConfident.violated).toBe(false);

      const resWithUncertainty = ops.surfaceUncertainty(mockContext, {
        confident: true,
        uncertainty: 'Not sure if Node 18 supports this API',
      });
      expect(resWithUncertainty.violated).toBe(false);
    });

    it('should VIOLATE when confident is true without uncertainty statement', () => {
      const res = ops.surfaceUncertainty(mockContext, { confident: true });

      expect(res.violated).toBe(true);
      expect(res.shouldHalt).toBe(true);
      expect(res.reason).toBe('Confident assertion without uncertainty statement');
    });
  });

  describe('Instinct 06: Failure Mode Self-Recognition (failureModeSelfRecognition)', () => {
    it('should NOT violate when driftScore is 0', () => {
      const res = ops.failureModeSelfRecognition(mockContext, { driftScore: 0 });

      expect(res.violated).toBe(false);
      expect(res.shouldHalt).toBe(false);
    });

    it('should VIOLATE when driftScore is greater than 0', () => {
      const res = ops.failureModeSelfRecognition(mockContext, {
        driftScore: 0.5,
        driftType: 'schema_drift',
      });

      expect(res.violated).toBe(true);
      expect(res.shouldHalt).toBe(true);
      expect(res.reason).toBe('Drift detected: schema_drift');
    });
  });

  describe('Instinct 07: Surgical Change Preference (beforeRefactor)', () => {
    it('should NOT violate when modifying 1 or 0 files', () => {
      const res1 = ops.beforeRefactor(mockContext, { filesModified: 1 });
      expect(res1.violated).toBe(false);

      const res0 = ops.beforeRefactor(mockContext, { filesModified: 0 });
      expect(res0.violated).toBe(false);
    });

    it('should NOT violate when modifying multiple files WITH justification', () => {
      const res = ops.beforeRefactor(mockContext, {
        filesModified: 5,
        justification: 'Renamed shared type across 5 files',
      });

      expect(res.violated).toBe(false);
    });

    it('should VIOLATE when modifying multiple files WITHOUT justification', () => {
      const res = ops.beforeRefactor(mockContext, { filesModified: 3 });

      expect(res.violated).toBe(true);
      expect(res.shouldHalt).toBe(true);
      expect(res.reason).toBe('3 files modified without justification');
    });
  });

  describe('Instinct 08: Plan Before Code (beforeCode)', () => {
    it('should NOT violate when plan is non-empty and planSteps > 0', () => {
      const res = ops.beforeCode(mockContext, {
        plan: '1. Create route 2. Write tests',
        planSteps: 2,
      });

      expect(res.violated).toBe(false);
      expect(res.shouldHalt).toBe(false);
    });

    it('should VIOLATE when plan is missing or planSteps is 0', () => {
      const resNoPlan = ops.beforeCode(mockContext, { planSteps: 2 });
      expect(resNoPlan.violated).toBe(true);

      const resZeroSteps = ops.beforeCode(mockContext, {
        plan: 'Do stuff',
        planSteps: 0,
      });
      expect(resZeroSteps.violated).toBe(true);
      expect(resZeroSteps.reason).toBe('No plan or zero steps');
    });
  });

  describe('Instinct 09: Negative Case Awareness (negativeCaseAwareness)', () => {
    it('should NOT violate when negative tests are present or when no error criteria exist', () => {
      const resWithNegative = ops.negativeCaseAwareness(mockContext, {
        totalTests: 5,
        negativeTests: 2,
        acceptanceCriteriaErrors: 1,
      });
      expect(resWithNegative.violated).toBe(false);

      const resNoErrorCriteria = ops.negativeCaseAwareness(mockContext, {
        totalTests: 3,
        negativeTests: 0,
        acceptanceCriteriaErrors: 0,
      });
      expect(resNoErrorCriteria.violated).toBe(false);
    });

    it('should VIOLATE when acceptance criteria specify error cases but negativeTests is 0', () => {
      const res = ops.negativeCaseAwareness(mockContext, {
        totalTests: 5,
        negativeTests: 0,
        acceptanceCriteriaErrors: 2,
      });

      expect(res.violated).toBe(true);
      expect(res.shouldHalt).toBe(true);
      expect(res.reason).toBe(
        'Acceptance criteria specify error cases but no negative tests found'
      );
    });
  });

  describe('Instinct 10: Drift Halt Reflex (driftHaltReflex)', () => {
    it('should NOT violate when driftDetected is false', () => {
      const res = ops.driftHaltReflex(mockContext, { driftDetected: false });

      expect(res.violated).toBe(false);
      expect(res.shouldHalt).toBe(false);
    });

    it('should VIOLATE and HALT when driftDetected is true', () => {
      const res = ops.driftHaltReflex(mockContext, {
        driftDetected: true,
        driftType: 'pipeline_divergence',
      });

      expect(res.violated).toBe(true);
      expect(res.shouldHalt).toBe(true);
      expect(res.reason).toBe('Drift halt triggered: pipeline_divergence');
    });
  });

  describe('Enforce Mode, Telemetry & Bulk Operations', () => {
    it('should respect setEnforceMode(false)', () => {
      ops.setEnforceMode(false);

      const res = ops.beforeFix(mockContext, { tests: [], failingTests: [] });
      expect(res.violated).toBe(true);
      expect(res.shouldHalt).toBe(false);
    });

    it('should evaluate enforceAll and filter getHaltViolations', () => {
      const results = ops.enforceAll(mockContext, {
        tests: ['t1'],
        failingTests: [], // violates
        criteria: 'Valid criteria', // valid
        errorReproduced: false, // violates
      });

      expect(results).toHaveLength(3);
      const halts = ops.getHaltViolations(results);
      expect(halts).toHaveLength(2);
    });

    it('should track and reset telemetry counts', () => {
      ops.beforeFix(mockContext, { tests: [], failingTests: [] });
      ops.beforeFix(mockContext, { tests: [], failingTests: ['t1'] });

      const telemetry = ops.getTelemetry();
      expect(telemetry.verification_first).toBe(1);

      ops.resetTelemetry();
      expect(ops.getTelemetry()).toEqual({});
    });

    it('should return singleton instance from getInstinctOps', () => {
      const i1 = getInstinctOps();
      const i2 = getInstinctOps();
      expect(i1).toBe(i2);
    });
  });
});
