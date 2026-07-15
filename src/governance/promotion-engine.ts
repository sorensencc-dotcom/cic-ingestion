import { Proposal } from './proposal-validator';
import { CanaryMetrics, CanaryResult } from './canary-engine';

/**
 * Phase 4 Promotion Decision Record
 * Immutable record of a promotion/rollback/hold decision based on canary metrics
 */
export interface PromotionRecord {
  proposal_id: string;
  decision: 'promote' | 'rollback' | 'hold';
  phase_next: number;
  recorded_at: Date;
}

/**
 * Backward compatibility interface (deprecated)
 */
export interface PromotionDecision {
  proposal_id: string;
  decision: 'promoted' | 'rolled_back' | 'held';
  reason: string;
  executed_at: string;
}

/**
 * PromotionEngine: Makes promotion/rollback decisions based on canary metrics
 * Applies Phase 4 heal thresholds to determine if a proposal should be promoted to phase 5
 */
export class PromotionEngine {
  /**
   * Apply heal thresholds to make a promotion decision
   * Promote: error_rate < 2% AND cost_delta < 0.2%
   * Rollback: error_rate >= 5% OR cost_delta >= 0.5%
   * Hold: else (metrics ambiguous)
   */
  decide(result: CanaryMetrics | CanaryResult): PromotionRecord {
    const decision = this.evaluateMetrics(result);
    const phase_next = this.getNextPhase(decision);

    return {
      proposal_id: result.proposal_id,
      decision,
      phase_next,
      recorded_at: new Date(),
    };
  }

  /**
   * Evaluate canary metrics against heal thresholds
   */
  private evaluateMetrics(result: CanaryMetrics | CanaryResult): 'promote' | 'rollback' | 'hold' {
    const errorRateThresholdPromote = 0.02; // 2%
    const errorRateThresholdRollback = 0.05; // 5%
    const costDeltaThresholdPromote = 0.002; // 0.2%
    const costDeltaThresholdRollback = 0.005; // 0.5%
    const latencyDeltaThresholdPromote = 100; // ms
    const latencyDeltaThresholdRollback = 500; // ms

    // Support both old flat and new nested metric structures
    let errorRate: number;
    let costDelta: number;
    let latencyDelta: number;

    if ('metrics' in result && typeof result.metrics === 'object') {
      // New CanaryResult structure with nested metrics
      errorRate = result.metrics.error_rate;
      costDelta = result.metrics.cost_delta;
      latencyDelta = result.metrics.latency_p99_ms;
    } else {
      // Old CanaryMetrics structure with flat fields
      errorRate = (result as any).error_rate;
      costDelta = (result as any).cost_delta;
      latencyDelta = (result as any).latency_delta;
    }

    // Check rollback conditions (fail-fast)
    if (
      errorRate >= errorRateThresholdRollback ||
      costDelta >= costDeltaThresholdRollback ||
      Math.abs(latencyDelta) >= latencyDeltaThresholdRollback
    ) {
      return 'rollback';
    }

    // Check promote conditions (all must pass)
    if (
      errorRate < errorRateThresholdPromote &&
      costDelta < costDeltaThresholdPromote &&
      Math.abs(latencyDelta) < latencyDeltaThresholdPromote
    ) {
      return 'promote';
    }

    // Otherwise hold (metrics ambiguous)
    return 'hold';
  }

  /**
   * Map decision to next phase
   */
  private getNextPhase(decision: 'promote' | 'rollback' | 'hold'): number {
    if (decision === 'promote') {
      return 5; // Advance to phase 5
    }
    // rollback and hold both stay at phase 4
    return 4;
  }

  /**
   * Legacy method for backward compatibility
   */
  promote(
    proposal: Proposal,
    canaryMetrics: CanaryMetrics | CanaryResult
  ): PromotionDecision {
    let decision: 'promoted' | 'rolled_back' | 'held' = 'held';
    let reason = '';

    // Get decision and error_rate from either old or new structure
    let decisionValue: string;
    let errorRate: number;

    if ('metrics' in canaryMetrics && typeof canaryMetrics.metrics === 'object') {
      // New CanaryResult structure
      decisionValue = canaryMetrics.decision;
      errorRate = canaryMetrics.metrics.error_rate;
    } else {
      // Old CanaryMetrics structure
      decisionValue = (canaryMetrics as any).decision;
      errorRate = (canaryMetrics as any).error_rate;
    }

    if (decisionValue === 'promote') {
      decision = 'promoted';
      reason = 'Canary metrics passed threshold';
    } else if (errorRate > 0.05) {
      decision = 'rolled_back';
      reason = 'Error rate exceeded threshold';
    } else {
      decision = 'held';
      reason = 'Awaiting next canary observation';
    }

    return {
      proposal_id: proposal.proposal_id,
      decision,
      reason,
      executed_at: new Date().toISOString(),
    };
  }
}
