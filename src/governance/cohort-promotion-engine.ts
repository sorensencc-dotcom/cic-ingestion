/**
 * CohortPromotionEngine: Phase 5 multi-cohort promotion decision logic
 *
 * Responsibilities:
 * - Evaluate custom metrics against heal thresholds (promote/rollback/hold)
 * - Make deterministic promotion decisions based on observation window completion
 * - Track immutable CohortDecision audit trail (append-only)
 * - Support atomic rollback across all cohorts
 *
 * Data Contract Ownership:
 * - Owns CohortDecision state (immutable audit trail)
 * - Invariant: CohortDecision immutable once written
 *
 * Decision Logic (4-state):
 * - PROMOTE: all custom metrics pass + observation_duration_ms elapsed
 * - ROLLBACK: any custom metric fails threshold
 * - HOLD: metric collection timeout OR deadline approaching
 * - IDLE: waiting for observation to complete
 */

/**
 * Custom metric evaluation criteria
 */
export interface MetricCriteria {
  metric_name: string;
  operator: '<' | '>' | '<=' | '>=' | '==' | '!=';
  threshold: number;
}

/**
 * Custom metric observation (single measurement)
 */
export interface MetricObservation {
  metric_name: string;
  value: number;
  recorded_at: string;
}

/**
 * Aggregated metric state (for decision evaluation)
 */
export interface AggregatedMetric {
  metric_name: string;
  value: number;
  status: 'pass' | 'fail' | 'incomplete';
}

/**
 * Cohort decision record (immutable audit trail)
 */
export interface CohortDecision {
  decision_id: string;
  cohort_id: string;
  proposal_id: string;
  assignment_id: string;
  decision: 'promote' | 'rollback' | 'hold' | 'idle';
  metrics: AggregatedMetric[];
  reason: string;
  observation_duration_ms: number;
  elapsed_duration_ms: number;
  decided_at: string;
}

/**
 * Decision result from evaluation
 */
export interface DecisionResult {
  success: boolean;
  decision?: CohortDecision;
  error?: string;
}

/**
 * CohortPromotionEngine: Makes promotion/rollback/hold decisions based on custom metrics
 */
export class CohortPromotionEngine {
  private decisions: Map<string, CohortDecision> = new Map(); // cohort_id → CohortDecision
  private decisionList: CohortDecision[] = []; // Append-only log

  /**
   * Evaluate custom metrics and make promotion decision
   *
   * Decision Logic:
   * - PROMOTE: all metrics pass AND observation window complete
   * - ROLLBACK: any metric fails threshold
   * - HOLD: observation incomplete or deadline approaching
   * - IDLE: waiting state (no decision yet)
   *
   * @param cohortId Cohort identifier
   * @param proposalId Proposal identifier
   * @param assignmentId Assignment identifier
   * @param criteria Custom metric criteria (threshold definitions)
   * @param observations Collected metric observations
   * @param observationDurationMs Target observation window duration
   * @param elapsedDurationMs Actual elapsed time
   * @returns DecisionResult with CohortDecision record
   */
  evaluateAndDecide(
    cohortId: string,
    proposalId: string,
    assignmentId: string,
    criteria: MetricCriteria[],
    observations: MetricObservation[],
    observationDurationMs: number,
    elapsedDurationMs: number
  ): DecisionResult {
    // Validate inputs
    if (!cohortId || !proposalId || !assignmentId) {
      return {
        success: false,
        error: 'Missing required cohort/proposal/assignment identifiers',
      };
    }

    if (criteria.length === 0) {
      return {
        success: false,
        error: 'No metric criteria provided',
      };
    }

    // Aggregate metrics and evaluate
    const aggregated = this.aggregateMetrics(criteria, observations);
    const metricsPass = aggregated.every((m) => m.status === 'pass');
    const anyFails = aggregated.some((m) => m.status === 'fail');
    const allComplete = aggregated.every((m) => m.status !== 'incomplete');
    const observationComplete = elapsedDurationMs >= observationDurationMs;

    // Determine decision
    let decision: 'promote' | 'rollback' | 'hold' | 'idle';
    let reason: string;

    if (anyFails) {
      // Any metric fails → immediate rollback (fail-fast)
      decision = 'rollback';
      const failedMetrics = aggregated
        .filter((m) => m.status === 'fail')
        .map((m) => m.metric_name);
      reason = `Metric(s) failed threshold: ${failedMetrics.join(', ')}`;
    } else if (metricsPass && observationComplete && allComplete) {
      // All metrics pass AND observation window complete → promote
      decision = 'promote';
      reason = `All ${criteria.length} metric(s) passed threshold and observation window (${elapsedDurationMs}ms) complete`;
    } else if (!observationComplete) {
      // Observation incomplete → hold
      decision = 'hold';
      const remaining = observationDurationMs - elapsedDurationMs;
      reason = `Observation window incomplete. Elapsed: ${elapsedDurationMs}ms / Target: ${observationDurationMs}ms (${remaining}ms remaining)`;
    } else if (!allComplete) {
      // Metrics incomplete → hold (awaiting more data)
      decision = 'hold';
      reason = 'Metric collection incomplete. Awaiting more data.';
    } else {
      // Default to idle (should not reach here in normal flow)
      decision = 'idle';
      reason = 'Awaiting decision trigger';
    }

    // Create immutable decision record
    const cohortDecision: CohortDecision = {
      decision_id: this.generateDecisionId(cohortId, proposalId),
      cohort_id: cohortId,
      proposal_id: proposalId,
      assignment_id: assignmentId,
      decision,
      metrics: aggregated,
      reason,
      observation_duration_ms: observationDurationMs,
      elapsed_duration_ms: elapsedDurationMs,
      decided_at: new Date().toISOString(),
    };

    // Freeze decision for immutability
    Object.freeze(cohortDecision);
    Object.freeze(cohortDecision.metrics);

    // Check for duplicate decision (idempotency)
    if (this.decisions.has(cohortId)) {
      return {
        success: false,
        error: `Decision already recorded for cohort: ${cohortId}`,
      };
    }

    // Record in immutable log
    this.decisions.set(cohortId, cohortDecision);
    this.decisionList.push(cohortDecision);

    return {
      success: true,
      decision: cohortDecision,
    };
  }

  /**
   * Aggregate metric observations against criteria
   * Calculates average value and compares against threshold
   *
   * @param criteria Threshold definitions
   * @param observations Collected observations
   * @returns Aggregated metrics with pass/fail status
   */
  private aggregateMetrics(
    criteria: MetricCriteria[],
    observations: MetricObservation[]
  ): AggregatedMetric[] {
    return criteria.map((criterion) => {
      // Find all observations for this metric
      const metricObs = observations.filter(
        (o) => o.metric_name === criterion.metric_name
      );

      if (metricObs.length === 0) {
        // No observations for this metric
        return {
          metric_name: criterion.metric_name,
          value: 0,
          status: 'incomplete',
        };
      }

      // Calculate average
      const avgValue =
        metricObs.reduce((sum, o) => sum + o.value, 0) / metricObs.length;

      // Evaluate against threshold
      const passes = this.evaluateThreshold(
        avgValue,
        criterion.operator,
        criterion.threshold
      );

      return {
        metric_name: criterion.metric_name,
        value: avgValue,
        status: passes ? 'pass' : 'fail',
      };
    });
  }

  /**
   * Evaluate threshold comparison
   *
   * @param value Observed value
   * @param operator Comparison operator
   * @param threshold Threshold value
   * @returns True if condition passes
   */
  private evaluateThreshold(
    value: number,
    operator: '<' | '>' | '<=' | '>=' | '==' | '!=',
    threshold: number
  ): boolean {
    switch (operator) {
      case '<':
        return value < threshold;
      case '>':
        return value > threshold;
      case '<=':
        return value <= threshold;
      case '>=':
        return value >= threshold;
      case '==':
        return Math.abs(value - threshold) < 0.0001; // Floating-point equality
      case '!=':
        return Math.abs(value - threshold) >= 0.0001;
      default:
        return false;
    }
  }

  /**
   * Atomic rollback: revert all cohorts in a rollout group
   *
   * Usage: when a metric fails, rollback all sibling cohorts
   *
   * @param proposalId Proposal identifier
   * @param rollbackReason Human-readable reason
   * @returns Array of decisions reverted
   */
  atomicRollback(
    proposalId: string,
    rollbackReason: string
  ): CohortDecision[] {
    // Find all decisions for this proposal
    const proposalDecisions = this.decisionList.filter(
      (d) => d.proposal_id === proposalId
    );

    // Cannot modify existing decisions; instead, record new rollback decision for each cohort
    const rolledBackDecisions: CohortDecision[] = [];

    for (const existingDecision of proposalDecisions) {
      if (existingDecision.decision !== 'rollback') {
        // Create new rollback decision (separate record)
        const rollbackDecision: CohortDecision = {
          decision_id: this.generateDecisionId(
            existingDecision.cohort_id,
            proposalId
          ),
          cohort_id: existingDecision.cohort_id,
          proposal_id: proposalId,
          assignment_id: existingDecision.assignment_id,
          decision: 'rollback',
          metrics: existingDecision.metrics,
          reason: `Atomic rollback: ${rollbackReason}`,
          observation_duration_ms: existingDecision.observation_duration_ms,
          elapsed_duration_ms: existingDecision.elapsed_duration_ms,
          decided_at: new Date().toISOString(),
        };

        Object.freeze(rollbackDecision);
        Object.freeze(rollbackDecision.metrics);

        this.decisionList.push(rollbackDecision);
        rolledBackDecisions.push(rollbackDecision);
      }
    }

    return rolledBackDecisions;
  }

  /**
   * Get decision for a cohort (immutable view)
   *
   * @param cohortId Cohort identifier
   * @returns CohortDecision if found, undefined otherwise
   */
  getDecision(cohortId: string): CohortDecision | undefined {
    return this.decisions.get(cohortId);
  }

  /**
   * Get all decisions (append-only log)
   *
   * @returns Read-only array of all decisions
   */
  getAllDecisions(): readonly CohortDecision[] {
    return Object.freeze([...this.decisionList]);
  }

  /**
   * Get decisions for a specific proposal
   *
   * @param proposalId Proposal identifier
   * @returns Array of decisions for proposal
   */
  getProposalDecisions(proposalId: string): CohortDecision[] {
    return this.decisionList.filter((d) => d.proposal_id === proposalId);
  }

  /**
   * Count promotions, rollbacks, holds
   *
   * @returns Statistics object
   */
  getStatistics(): {
    total: number;
    promoted: number;
    rolledback: number;
    held: number;
    idle: number;
  } {
    const stats = {
      total: this.decisionList.length,
      promoted: 0,
      rolledback: 0,
      held: 0,
      idle: 0,
    };

    for (const decision of this.decisionList) {
      if (decision.decision === 'promote') stats.promoted++;
      else if (decision.decision === 'rollback') stats.rolledback++;
      else if (decision.decision === 'hold') stats.held++;
      else if (decision.decision === 'idle') stats.idle++;
    }

    return stats;
  }

  /**
   * Private: Generate unique decision_id
   */
  private generateDecisionId(cohortId: string, proposalId: string): string {
    return `decision-${cohortId}-${proposalId}-${Date.now()}`;
  }

  /**
   * Clear all decisions (for testing only)
   */
  clear(): void {
    this.decisions.clear();
    this.decisionList = [];
  }
}
