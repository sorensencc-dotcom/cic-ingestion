/**
 * Wave G — Resume-Gate Logic
 *
 * Validates revised acceptance criteria + plan, checks for cross-wave
 * contradictions, decides whether to resume execution after healing.
 *
 * Hard drift (KITCHEN_SINK, RUNAWAY_REFACTOR) requires manual approval.
 * Soft drift (WRONG_ABSTRACTION, OPTIMISTIC_PATH) auto-approved if all conditions met.
 */

import { CorrelatedDriftVector } from './DriftCorrelationGraph';

export interface ResumeCondition {
  name: string;
  passed: boolean;
  reason?: string;
}

export interface ResumeDecision {
  allowed: boolean;
  driftClassification: 'HARD' | 'SOFT' | 'NONE';
  severity: number; // 0.0–1.0
  failureMode?: string;
  conditions: ResumeCondition[];
  failedConditions: string[];
  contradictions: string[];
  requiredApprovals: string[];
  reasoning: string;
  timestamp: number;
}

export interface RevisedPlan {
  id?: string;
  wave: 'B' | 'C' | 'D' | 'E' | 'F';
  scope: string[];
  expectedFiles: string[];
  maxFileChanges: number;
  maxDuplicates: number;
  dependencies?: string[];
  timestamp: number;
}

export interface RevisedCriteria {
  acceptanceCriteria: string[];
  negativeTestCases: number;
  errorPaths: string[];
  dependencyJustifications: Record<string, string>;
  maxCorruptionPercent?: number;
  timestamp: number;
}

/**
 * Resume Gate — Validates readiness to resume after healing
 */
export class ResumeGate {
  /**
   * Evaluate resume decision
   */
  evaluate(
    driftVectors: CorrelatedDriftVector[],
    revisedPlan: RevisedPlan,
    revisedCriteria: RevisedCriteria,
    appliedPrimitives: string[]
  ): ResumeDecision {
    const conditions: ResumeCondition[] = [];
    const failedConditions: string[] = [];

    // Condition 1: Revised criteria exist
    const criteriaExist = this.validateCriteriaExist(revisedCriteria);
    conditions.push({ name: 'Revised criteria exist', passed: criteriaExist, reason: criteriaExist ? 'OK' : 'Missing' });
    if (!criteriaExist) failedConditions.push('criteria_exist');

    // Condition 2: Revised plan exists
    const planExists = this.validatePlanExists(revisedPlan);
    conditions.push({ name: 'Revised plan exists', passed: planExists, reason: planExists ? 'OK' : 'Missing' });
    if (!planExists) failedConditions.push('plan_exists');

    // Condition 3: Drift severity < 0.5
    const maxSeverity = Math.max(...driftVectors.map((v) => v.severity), 0);
    const severityOK = maxSeverity < 0.5;
    conditions.push({
      name: 'Drift severity < 0.5',
      passed: severityOK,
      reason: `Current severity: ${maxSeverity.toFixed(2)}`,
    });
    if (!severityOK) failedConditions.push('severity_threshold');

    // Condition 4: No cross-wave contradictions
    const contradictions = this.checkContradictions(revisedPlan, revisedCriteria, driftVectors);
    const noContradictions = contradictions.length === 0;
    conditions.push({
      name: 'No cross-wave contradictions',
      passed: noContradictions,
      reason: noContradictions ? 'OK' : `Found ${contradictions.length}`,
    });
    if (!noContradictions) failedConditions.push('contradictions');

    // Condition 5: Healing primitives applied (only required if drift detected)
    const hasDrift = driftVectors.length > 0;
    const primitivesApplied = hasDrift ? this.validatePrimitivesApplied(appliedPrimitives) : true;
    conditions.push({
      name: 'Healing primitives applied',
      passed: primitivesApplied,
      reason: hasDrift
        ? primitivesApplied
          ? `Applied: ${appliedPrimitives.length}`
          : 'Drift detected but no primitives applied'
        : 'No drift, primitives not required',
    });
    if (!primitivesApplied) failedConditions.push('primitives_applied');

    // Condition 6: Negative tests present
    const negativeTestsPresent = this.validateNegativeTests(revisedCriteria);
    conditions.push({
      name: 'Negative tests present',
      passed: negativeTestsPresent,
      reason: negativeTestsPresent ? `${revisedCriteria.negativeTestCases} tests` : 'None specified',
    });
    if (!negativeTestsPresent) failedConditions.push('negative_tests');

    // Condition 7: Dependency justification complete
    const dependenciesJustified = this.validateDependencyJustifications(revisedCriteria);
    conditions.push({
      name: 'Dependency justifications complete',
      passed: dependenciesJustified,
      reason: dependenciesJustified ? 'All justified' : 'Missing justifications',
    });
    if (!dependenciesJustified) failedConditions.push('dependency_justification');

    // Classify drift
    const driftClassification = this.classifyDrift(driftVectors);
    const failureMode = driftVectors.length > 0 ? driftVectors[0].failureMode : 'NONE';

    // Determine approval
    const allowed = this.decideApproval(driftClassification, failedConditions);

    const requiredApprovals =
      driftClassification === 'HARD'
        ? ['human_review', 'engineering_approval']
        : driftClassification === 'SOFT'
          ? []
          : [];

    const reasoning = this.buildReasoning(driftClassification, failedConditions, failureMode, maxSeverity);

    return {
      allowed,
      driftClassification,
      severity: maxSeverity,
      failureMode: failureMode !== 'NONE' ? failureMode : undefined,
      conditions,
      failedConditions,
      contradictions,
      requiredApprovals,
      reasoning,
      timestamp: Date.now(),
    };
  }

  /**
   * Validate revised criteria exist and are complete
   */
  private validateCriteriaExist(criteria: RevisedCriteria): boolean {
    return (
      criteria &&
      criteria.acceptanceCriteria &&
      criteria.acceptanceCriteria.length > 0 &&
      criteria.negativeTestCases > 0
    );
  }

  /**
   * Validate revised plan exists and is complete
   */
  private validatePlanExists(plan: RevisedPlan): boolean {
    return (
      plan &&
      plan.scope &&
      plan.scope.length > 0 &&
      plan.expectedFiles &&
      plan.expectedFiles.length > 0 &&
      typeof plan.maxFileChanges === 'number'
    );
  }

  /**
   * Check for cross-wave contradictions
   */
  private checkContradictions(plan: RevisedPlan, criteria: RevisedCriteria, vectors: CorrelatedDriftVector[]): string[] {
    const contradictions: string[] = [];

    // Contradiction 1: Plan scope vs criteria
    if (plan.scope && plan.scope.length > 0 && criteria.acceptanceCriteria) {
      for (const criterion of criteria.acceptanceCriteria) {
        // Check if criterion references files outside plan scope
        if (criterion.includes('src/') && !plan.scope.some((s) => criterion.includes(s))) {
          contradictions.push(`Criterion "${criterion.substring(0, 50)}..." references file outside plan scope`);
        }
      }
    }

    // Contradiction 2: Severity vs revised plan constraints
    const maxSeverity = Math.max(...vectors.map((v) => v.severity), 0);
    if (maxSeverity > 0.75 && plan.maxFileChanges > 10) {
      contradictions.push('High severity drift with relaxed file change limits creates risk');
    }

    // Contradiction 3: Multiple failure modes across waves
    const failureModes = new Set(vectors.map((v) => v.failureMode));
    if (failureModes.size > 2) {
      contradictions.push(`Multiple failure modes detected across waves: ${Array.from(failureModes).join(', ')}`);
    }

    // Contradiction 4: Root cause wave vs revised plan
    const rootCauseWaves = new Set(vectors.map((v) => v.rootCauseWave).filter(Boolean));
    if (rootCauseWaves.size > 1) {
      contradictions.push(`Multiple root cause waves suggest incomplete revision: ${Array.from(rootCauseWaves).join(',')}`);
    }

    // Contradiction 5: Dependency justifications vs detected creep
    const hasDependencyCreep = vectors.some(
      (v) => v.failureMode === 'WRONG_ABSTRACTION' && v.details?.newDependencies
    );
    if (hasDependencyCreep && Object.keys(criteria.dependencyJustifications || {}).length === 0) {
      contradictions.push('Dependency creep detected but no justifications provided');
    }

    return contradictions;
  }

  /**
   * Validate healing primitives were applied
   */
  private validatePrimitivesApplied(primitives: string[]): boolean {
    return Array.isArray(primitives) && primitives.length > 0;
  }

  /**
   * Validate negative test cases present
   */
  private validateNegativeTests(criteria: RevisedCriteria): boolean {
    return criteria && criteria.negativeTestCases && criteria.negativeTestCases > 0;
  }

  /**
   * Validate dependency justifications complete
   */
  private validateDependencyJustifications(criteria: RevisedCriteria): boolean {
    // If no dependencies declared, pass
    if (!criteria.dependencyJustifications || Object.keys(criteria.dependencyJustifications).length === 0) {
      return true;
    }
    // All dependencies should have justifications
    return Object.values(criteria.dependencyJustifications).every((j) => j && j.length > 0);
  }

  /**
   * Classify drift as HARD (requires manual approval) or SOFT (auto-healable)
   */
  private classifyDrift(vectors: CorrelatedDriftVector[]): 'HARD' | 'SOFT' | 'NONE' {
    if (vectors.length === 0) return 'NONE';

    const failureModes = vectors.map((v) => v.failureMode);

    // Hard drift modes (require manual approval)
    const hardModes = ['KITCHEN_SINK', 'RUNAWAY_REFACTOR'];
    if (failureModes.some((mode) => hardModes.includes(mode))) {
      return 'HARD';
    }

    // Soft drift modes (auto-healable)
    const softModes = ['WRONG_ABSTRACTION', 'OPTIMISTIC_PATH'];
    if (failureModes.some((mode) => softModes.includes(mode))) {
      return 'SOFT';
    }

    return 'NONE';
  }

  /**
   * Decide whether to allow resume based on drift classification and failed conditions
   */
  private decideApproval(classification: 'HARD' | 'SOFT' | 'NONE', failedConditions: string[]): boolean {
    // Hard drift always requires manual approval (external decision)
    if (classification === 'HARD') {
      return false;
    }

    // Soft drift approved if no failed conditions
    if (classification === 'SOFT') {
      return failedConditions.length === 0;
    }

    // No drift: approve if all conditions passed
    return failedConditions.length === 0;
  }

  /**
   * Build human-readable reasoning for the decision
   */
  private buildReasoning(
    classification: 'HARD' | 'SOFT' | 'NONE',
    failedConditions: string[],
    failureMode: string,
    severity: number
  ): string {
    const parts: string[] = [];

    if (classification === 'HARD') {
      parts.push(`${failureMode} drift detected (severity ${severity.toFixed(2)}). Hard drift requires manual approval.`);
    } else if (classification === 'SOFT') {
      if (failedConditions.length === 0) {
        parts.push(`${failureMode} drift is soft-healable and all conditions passed. Ready to resume.`);
      } else {
        parts.push(
          `${failureMode} drift is soft-healable but ${failedConditions.length} conditions failed: ${failedConditions.join(', ')}.`
        );
      }
    } else {
      if (failedConditions.length === 0) {
        parts.push('No drift detected and all conditions passed. Ready to resume.');
      } else {
        parts.push(`No drift detected but ${failedConditions.length} conditions failed: ${failedConditions.join(', ')}.`);
      }
    }

    return parts.join(' ');
  }
}
