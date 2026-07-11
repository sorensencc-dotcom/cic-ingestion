/**
 * Execution Policy Interceptor — Auto-Healing Extension
 *
 * Extends ExecutionPolicyInterceptor with automatic plan recovery when drift is detected.
 * When CodeLevelDriftDetector fires, halts execution, diagnoses failure mode, rewrites
 * acceptance criteria and plan with stricter constraints, then resumes.
 *
 * Integrates with CodeLevelDriftDetector + InstinctOps + Six Rules Framework.
 */

import { DriftSignal, CodeLevelDriftDetector } from '../drift/CodeLevelDriftDetector.ts';
import { InstinctOps, InstinctResult } from './InstinctOps.ts';
import { getExecutionPolicyInterceptor, ExecutionPolicyInterceptor } from './ExecutionPolicyInterceptor.ts';

/**
 * Output from auto-healing process
 */
export interface HealingOutput {
  revisedPlan: string;
  revisedCriteria: string;
  amplifiedConstraints: Record<string, any>;
  resumeAllowed: boolean;
  reason: string;
  healingDuration: number;
}

/**
 * Mode-specific healing strategy
 */
interface HealingStrategy {
  shrinkScope: boolean;
  requireAbstraction: boolean;
  requireNegativeTests: boolean;
  constraintAmplification: Record<string, any>;
  requiredPlanSteps: string[];
}

/**
 * Auto-healing extension for execution policy
 */
export class ExecutionPolicyAutoHealing {
  private baseInterceptor: ExecutionPolicyInterceptor;
  private driftDetector = new CodeLevelDriftDetector();
  private instinctOps = new InstinctOps();

  constructor() {
    this.baseInterceptor = getExecutionPolicyInterceptor();
  }

  /**
   * Handle drift event: diagnose, heal, and decide resume
   */
  async onDriftDetected(drift: DriftSignal, context: { plan: string; criteria: string; logs: string[] }): Promise<HealingOutput> {
    const startTime = Date.now();

    // 1. Classify failure mode
    const healingStrategy = this.getHealingStrategy(drift.type);

    // 2. Generate revised acceptance criteria
    const revisedCriteria = this.revisingCriteria(context.criteria, drift.type, healingStrategy);

    // 3. Generate revised plan
    const revisedPlan = this.revisePlan(context.plan, drift.type, healingStrategy, revisedCriteria);

    // 4. Amplify constraints
    const amplifiedConstraints = this.amplifyConstraints(drift.type, healingStrategy);

    // 5. Decide if resume is allowed
    const resumeAllowed = this.decideResume(revisedPlan, revisedCriteria, amplifiedConstraints, drift.type);

    const duration = Date.now() - startTime;

    return {
      revisedPlan,
      revisedCriteria,
      amplifiedConstraints,
      resumeAllowed,
      reason: `Healed ${drift.type}: ${drift.details.reason}`,
      healingDuration: duration,
    };
  }

  /**
   * Get healing strategy based on failure mode
   */
  private getHealingStrategy(driftType: string): HealingStrategy {
    const strategies: Record<string, HealingStrategy> = {
      KITCHEN_SINK: {
        shrinkScope: true,
        requireAbstraction: false,
        requireNegativeTests: false,
        constraintAmplification: {
          max_files_modified: 1,
          no_new_files: true,
          explicit_module_list: true,
        },
        requiredPlanSteps: ['Confirm scope is single file/function', 'Verify all steps map to criteria'],
      },

      WRONG_ABSTRACTION: {
        shrinkScope: false,
        requireAbstraction: true,
        requireNegativeTests: false,
        constraintAmplification: {
          no_duplicate_blocks: true,
          require_factored_logic: true,
          extract_shared_function: true,
        },
        requiredPlanSteps: ['Extract shared logic into single function', 'Verify duplication removed'],
      },

      OPTIMISTIC_PATH: {
        shrinkScope: false,
        requireAbstraction: false,
        requireNegativeTests: true,
        constraintAmplification: {
          require_error_tests: true,
          enumerate_error_cases: true,
          test_all_error_paths: true,
        },
        requiredPlanSteps: ['Enumerate all error scenarios', 'Write test for each error case'],
      },

      RUNAWAY_REFACTOR: {
        shrinkScope: true,
        requireAbstraction: false,
        requireNegativeTests: false,
        constraintAmplification: {
          no_renames: true,
          no_restructure: true,
          max_files_modified: 2,
          freeze_architecture: true,
        },
        requiredPlanSteps: ['Limit changes to single function', 'No architectural changes'],
      },
    };

    return strategies[driftType] || strategies.KITCHEN_SINK;
  }

  /**
   * Rewrite acceptance criteria with stricter constraints
   */
  private revisingCriteria(original: string, driftType: string, strategy: HealingStrategy): string {
    const lines = original.split('\n');
    const revised: string[] = [];

    revised.push(`# Revised Acceptance Criteria (Healed: ${driftType})\n`);

    // Copy original but mark as revised
    revised.push('## Original Criteria:');
    revised.push(original);

    revised.push('\n## Tightened Constraints:');

    // Add strategy-specific constraints
    if (strategy.shrinkScope) {
      revised.push('- CONSTRAINT: Changes limited to single file or function only');
      revised.push('- MUST VERIFY: Scope does not expand beyond single target');
    }

    if (strategy.requireAbstraction) {
      revised.push('- CONSTRAINT: Shared logic must be extracted to single module/function');
      revised.push('- MUST VERIFY: No duplicated code blocks remain');
    }

    if (strategy.requireNegativeTests) {
      revised.push('- CONSTRAINT: Tests must cover all error cases from acceptance criteria');
      revised.push('- MUST VERIFY: Negative tests exist for: malformed input, null, timeout, network failure');
    }

    revised.push('\n## Required Plan Steps:');
    strategy.requiredPlanSteps.forEach((step) => revised.push(`- ${step}`));

    revised.push('\n## Amplified Constraints:');
    Object.entries(strategy.constraintAmplification).forEach(([key, value]) => {
      revised.push(`- ${key}: ${JSON.stringify(value)}`);
    });

    return revised.join('\n');
  }

  /**
   * Rewrite plan with stricter, smaller steps
   */
  private revisePlan(original: string, driftType: string, strategy: HealingStrategy, revisedCriteria: string): string {
    const revised: string[] = [];

    revised.push(`# Revised Plan (Healed: ${driftType})\n`);

    // Original plan as reference
    revised.push('## Original Plan:');
    revised.push(original);

    revised.push('\n## Revised Plan (Stricter Constraints):\n');

    // Add strategy-specific steps
    const commonSteps = [
      '1. Review revised acceptance criteria and constraints',
      '2. Confirm single-file or single-function scope',
      '3. Verify all steps map directly to revised criteria',
    ];

    strategy.requiredPlanSteps.forEach((step, idx) => {
      revised.push(`${idx + commonSteps.length + 1}. ${step}`);
    });

    const finalSteps = ['Generate revised plan steps', 'Verify no ambiguous language', 'Proceed only after approval'];
    finalSteps.forEach((step, idx) => {
      revised.push(`${idx + commonSteps.length + strategy.requiredPlanSteps.length + 1}. ${step}`);
    });

    revised.push('\n## Constraints Enforced:');
    Object.entries(strategy.constraintAmplification).forEach(([key, value]) => {
      revised.push(`- ${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
    });

    return revised.join('\n');
  }

  /**
   * Amplify constraints from soft expectations to hard rules
   */
  private amplifyConstraints(driftType: string, strategy: HealingStrategy): Record<string, any> {
    return {
      mode: 'INSTINCT_ENFORCED', // new execution mode
      driftDetected: true,
      failureMode: driftType,
      ...strategy.constraintAmplification,
      enforceInstincts: true,
      haltOnViolation: true,
      requireManualApprovalToResume: driftType === 'RUNAWAY_REFACTOR' || driftType === 'KITCHEN_SINK', // hard drifts
    };
  }

  /**
   * Decide if execution can resume
   */
  private decideResume(revisedPlan: string, revisedCriteria: string, constraints: Record<string, any>, driftType: string): boolean {
    // Hard drifts (KITCHEN_SINK, RUNAWAY_REFACTOR) require manual approval
    const hardDrifts = ['KITCHEN_SINK', 'RUNAWAY_REFACTOR'];

    if (hardDrifts.includes(driftType)) {
      return false; // manual approval required
    }

    // Soft drifts (WRONG_ABSTRACTION, OPTIMISTIC_PATH) can auto-resume if constraints met
    const hasPlan = revisedPlan && revisedPlan.trim().length > 0;
    const hasCriteria = revisedCriteria && revisedCriteria.trim().length > 0;
    const hasConstraints = Object.keys(constraints).length > 0;

    return hasPlan && hasCriteria && hasConstraints;
  }

  /**
   * Format healing report for audit
   */
  formatHealingReport(drift: DriftSignal, healing: HealingOutput): string {
    return `
DRIFT HEALING REPORT
====================
Timestamp: ${new Date().toISOString()}
Drift Type: ${drift.type}
Severity: ${drift.severity}

Original Drift:
  ${drift.details.reason}

Healing Strategy:
  ${healing.reason}
  Duration: ${healing.healingDuration}ms

Revised Criteria:
${healing.revisedCriteria}

Revised Plan:
${healing.revisedPlan}

Amplified Constraints:
${JSON.stringify(healing.amplifiedConstraints, null, 2)}

Resume Allowed: ${healing.resumeAllowed}
`.trim();
  }
}

/**
 * Singleton instance
 */
let globalAutoHealing: ExecutionPolicyAutoHealing | null = null;

export function getExecutionPolicyAutoHealing(): ExecutionPolicyAutoHealing {
  if (!globalAutoHealing) {
    globalAutoHealing = new ExecutionPolicyAutoHealing();
  }
  return globalAutoHealing;
}
