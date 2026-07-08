/**
 * InstinctOps: Pre-Cognitive Layer for Six Rules Discipline
 *
 * Biases autonomous agents toward deterministic coding behavior:
 * - Verification First (failing test before fix)
 * - Define Done (acceptance criteria upfront)
 * - Deterministic Debugging (reproduce → isolate → test)
 * - Dependency Skepticism (justify before adding)
 * - Surface Uncertainty (explicit non-confidence)
 * - Failure Mode Self-Recognition (KS/WA/OP/RR detection)
 * - Surgical Change Preference (minimal diffs)
 * - Plan Before Code (deterministic planning)
 * - Negative Case Awareness (error test coverage)
 * - Drift Halt Reflex (immediate stop on drift)
 */

export type InstinctHook = 'beforePlan' | 'beforeCode' | 'beforeFix' | 'beforeDependencyAdd' | 'beforeRefactor' | 'onDrift';

export interface InstinctContext {
  taskId: string;
  agentRole: 'planner' | 'coder' | 'debugger' | 'reviewer';
  timestamp: number;
  enforced: boolean; // whether to halt on instinct violation
}

export interface InstinctResult {
  hook: InstinctHook;
  violated: boolean;
  reason?: string;
  guidance?: string;
  shouldHalt: boolean;
}

/**
 * Core instinct engine
 */
export class InstinctOps {
  private enforceMode = true; // if true, halt on violation
  private telemetry: Map<string, number> = new Map();

  /**
   * Instinct 01: Verification First
   * Require failing test before any fix attempt
   */
  beforeFix(context: InstinctContext, input: { tests: string[]; failingTests: string[] }): InstinctResult {
    const hasFailing = input.failingTests && input.failingTests.length > 0;

    const violated = !hasFailing;
    this.record('verification_first', violated ? 0 : 1);

    return {
      hook: 'beforeFix',
      violated,
      reason: violated ? 'No failing test to verify fix against' : undefined,
      guidance: 'Write a failing test that reproduces the bug before fixing',
      shouldHalt: violated && this.enforceMode,
    };
  }

  /**
   * Instinct 02: Define Done
   * Convert request into machine-verifiable acceptance criteria
   */
  beforePlan(context: InstinctContext, input: { criteria?: string; request: string }): InstinctResult {
    const hasCriteria = input.criteria && input.criteria.trim().length > 0;

    const violated = !hasCriteria;
    this.record('define_done', hasCriteria ? 1 : 0);

    return {
      hook: 'beforePlan',
      violated,
      reason: violated ? 'Acceptance criteria not defined' : undefined,
      guidance: 'Define acceptance criteria: inputs, outputs, error cases, test conditions',
      shouldHalt: violated && this.enforceMode,
    };
  }

  /**
   * Instinct 03: Deterministic Debugging
   * Reproduce error before diagnosing
   */
  beforeFix_Debugging(context: InstinctContext, input: { errorReproduced: boolean; changesMade: number }): InstinctResult {
    const violated = !input.errorReproduced;
    this.record('deterministic_debugging', input.errorReproduced ? 1 : 0);

    return {
      hook: 'beforeFix',
      violated,
      reason: violated ? 'Error not reproduced before attempting fix' : undefined,
      guidance: 'Read error → reproduce error → isolate → change one variable → test',
      shouldHalt: violated && this.enforceMode,
    };
  }

  /**
   * Instinct 04: Dependency Skepticism
   * Require justification before adding dependencies
   */
  beforeDependencyAdd(context: InstinctContext, input: { depName: string; justification?: string; version?: string }): InstinctResult {
    const hasJustification = input.justification && input.justification.trim().length > 0;
    const hasVersion = input.version && input.version.trim().length > 0;

    const violated = !hasJustification || !hasVersion;
    this.record('dependency_skepticism', violated ? 0 : 1);

    return {
      hook: 'beforeDependencyAdd',
      violated,
      reason: violated ? `Missing ${!hasJustification ? 'justification' : 'version'} for ${input.depName}` : undefined,
      guidance: 'Document: justification, version, update schedule before adding',
      shouldHalt: violated && this.enforceMode,
    };
  }

  /**
   * Instinct 05: Surface Uncertainty
   * Require explicit uncertainty statements (no guessing)
   */
  surfaceUncertainty(context: InstinctContext, input: { confident: boolean; uncertainty?: string }): InstinctResult {
    const hasUncertainty = input.uncertainty && input.uncertainty.trim().length > 0;
    const violated = input.confident && !hasUncertainty;

    this.record('uncertainty_surfaced', violated ? 0 : 1);

    return {
      hook: 'beforeCode',
      violated,
      reason: violated ? 'Confident assertion without uncertainty statement' : undefined,
      guidance: 'State uncertainty explicitly: "Not sure X is supported in this version"',
      shouldHalt: violated && this.enforceMode,
    };
  }

  /**
   * Instinct 06: Failure Mode Self-Recognition
   * Detect KS/WA/OP/RR automatically
   */
  failureModeSelfRecognition(context: InstinctContext, input: { driftScore: number; driftType?: string }): InstinctResult {
    const violated = input.driftScore > 0;

    this.record('failure_mode_detected', violated ? 1 : 0);

    return {
      hook: 'onDrift',
      violated,
      reason: violated ? `Drift detected: ${input.driftType}` : undefined,
      guidance: 'Halt → produce drift report → regenerate plan with stricter constraints',
      shouldHalt: violated && this.enforceMode,
    };
  }

  /**
   * Instinct 07: Surgical Change Preference
   * Enforce minimal diffs, justify multi-file changes
   */
  beforeRefactor(context: InstinctContext, input: { filesModified: number; justification?: string }): InstinctResult {
    const isSurgical = input.filesModified <= 1;
    const hasJustification = input.justification && input.justification.trim().length > 0;

    const violated = !isSurgical && !hasJustification;
    this.record('surgical_change', isSurgical ? 1 : 0);

    return {
      hook: 'beforeRefactor',
      violated,
      reason: violated ? `${input.filesModified} files modified without justification` : undefined,
      guidance: 'Prefer single-file changes. Multi-file requires explicit criteria justification',
      shouldHalt: violated && this.enforceMode,
    };
  }

  /**
   * Instinct 08: Plan Before Code
   * Generate step-bounded plan before writing code
   */
  beforeCode(context: InstinctContext, input: { plan?: string; planSteps?: number }): InstinctResult {
    const hasPlan = input.plan && input.plan.trim().length > 0;
    const stepCount = input.planSteps || 0;
    const isValid = hasPlan && stepCount > 0;

    const violated = !isValid;
    this.record('plan_first', isValid ? 1 : 0);

    return {
      hook: 'beforeCode',
      violated,
      reason: violated ? 'No plan or zero steps' : undefined,
      guidance: 'Generate deterministic plan with numbered steps before writing code',
      shouldHalt: violated && this.enforceMode,
    };
  }

  /**
   * Instinct 09: Negative Case Awareness
   * Require error/malformed/edge case tests
   */
  negativeCaseAwareness(context: InstinctContext, input: { totalTests: number; negativeTests: number; acceptanceCriteriaErrors?: number }): InstinctResult {
    const errorCaseCoverage = input.acceptanceCriteriaErrors || 0;
    const hasNegativeTests = input.negativeTests > 0;
    const violated = !hasNegativeTests && errorCaseCoverage > 0;

    this.record('negative_cases', hasNegativeTests ? 1 : 0);

    return {
      hook: 'beforeCode',
      violated,
      reason: violated ? 'Acceptance criteria specify error cases but no negative tests found' : undefined,
      guidance: 'Add tests for: malformed input, network failure, null values, timeouts',
      shouldHalt: violated && this.enforceMode,
    };
  }

  /**
   * Instinct 10: Drift Halt Reflex
   * Stop immediately on any drift signal
   */
  driftHaltReflex(context: InstinctContext, input: { driftDetected: boolean; driftType?: string }): InstinctResult {
    const violated = input.driftDetected;
    this.record('drift_halt', violated ? 1 : 0);

    return {
      hook: 'onDrift',
      violated,
      reason: violated ? `Drift halt triggered: ${input.driftType}` : undefined,
      guidance: 'No continuation allowed. Halt → auto-heal → regenerate plan → resume',
      shouldHalt: violated && this.enforceMode,
    };
  }

  /**
   * Enforce all instincts for a given context
   */
  enforceAll(context: InstinctContext, input: Record<string, any>): InstinctResult[] {
    const results: InstinctResult[] = [];

    if (input.tests !== undefined) results.push(this.beforeFix(context, input));
    if (input.criteria !== undefined) results.push(this.beforePlan(context, input));
    if (input.errorReproduced !== undefined) results.push(this.beforeFix_Debugging(context, input));
    if (input.depName !== undefined) results.push(this.beforeDependencyAdd(context, input));
    if (input.confident !== undefined) results.push(this.surfaceUncertainty(context, input));
    if (input.driftScore !== undefined) results.push(this.failureModeSelfRecognition(context, input));
    if (input.filesModified !== undefined) results.push(this.beforeRefactor(context, input));
    if (input.plan !== undefined) results.push(this.beforeCode(context, input));
    if (input.totalTests !== undefined) results.push(this.negativeCaseAwareness(context, input));

    return results;
  }

  /**
   * Get any violations that should halt execution
   */
  getHaltViolations(results: InstinctResult[]): InstinctResult[] {
    return results.filter((r) => r.shouldHalt);
  }

  /**
   * Record telemetry
   */
  private record(instinct: string, value: number): void {
    const current = this.telemetry.get(instinct) || 0;
    this.telemetry.set(instinct, current + value);
  }

  /**
   * Get telemetry snapshot
   */
  getTelemetry(): Record<string, number> {
    return Object.fromEntries(this.telemetry);
  }

  /**
   * Reset telemetry
   */
  resetTelemetry(): void {
    this.telemetry.clear();
  }

  /**
   * Set enforce mode
   */
  setEnforceMode(enforce: boolean): void {
    this.enforceMode = enforce;
  }
}

/**
 * Singleton instance
 */
let instance: InstinctOps | null = null;

export function getInstinctOps(): InstinctOps {
  if (!instance) {
    instance = new InstinctOps();
  }
  return instance;
}
