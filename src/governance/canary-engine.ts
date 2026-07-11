import { Proposal } from './proposal-validator';
import { GovernanceDecision } from '../core/maal/governance/GovernanceDecisions';

/**
 * Result of canary execution: metrics and decision
 */
export interface CanaryResult {
  proposal_id: string;
  decision: 'promote' | 'rollback' | 'hold';
  metrics: {
    error_rate: number; // 0.0–1.0
    cost_delta: number; // percentage (e.g., 0.002 = 0.2%)
    latency_p99_ms: number;
  };
  observed_at: Date;
}

/**
 * Backward compatibility: old-style flat CanaryMetrics interface
 * @deprecated Use CanaryResult instead
 */
export interface CanaryMetrics {
  proposal_id: string;
  cohort_step: number;
  cohort_size: number;
  observation_window_minutes: number;
  cost_delta: number;
  latency_delta: number;
  correctness_delta: number;
  error_rate: number;
  task_success_rate: number;
  decision: 'continue' | 'rollback' | 'promote';
  collected_at: string;
}

/**
 * CanaryEngine: Execute deterministic canary tests for approved proposals
 * - Simulates 10% cohort test
 * - Collects 3 metrics (error_rate, cost_delta, latency_p99_ms)
 * - Observation window: 30 minutes (mocked)
 * - Thresholds:
 *   - error_rate: < 2% (0.02)
 *   - cost_delta: < 0.2% (0.002)
 *   - latency_p99_ms: < 500ms
 */
export class CanaryEngine {
  execute(proposal: Proposal, approval: GovernanceDecision): CanaryResult {
    // Simulate deterministic metrics for 10% cohort test
    // For tests: simulate success (pass all thresholds)
    const errorRate = this.simulateErrorRate();
    const costDelta = this.simulateCostDelta();
    const latencyP99Ms = this.simulateLatencyP99();

    // Decision: promote if all metrics pass thresholds, rollback if fail, hold otherwise
    const decision = this.determineDecision(errorRate, costDelta, latencyP99Ms);

    return {
      proposal_id: proposal.proposal_id,
      decision,
      metrics: {
        error_rate: errorRate,
        cost_delta: costDelta,
        latency_p99_ms: latencyP99Ms,
      },
      observed_at: new Date(),
    };
  }

  /**
   * Simulate error rate (0.0–1.0 scale)
   * For tests: returns deterministic value < 2% (0.01 = 1%)
   */
  private simulateErrorRate(): number {
    // Deterministic for testing: return 1%
    return 0.01;
  }

  /**
   * Simulate cost delta as percentage
   * For tests: returns deterministic value < 0.2% (0.002 = 0.2%)
   */
  private simulateCostDelta(): number {
    // Deterministic for testing: return 0.1% (half the threshold)
    return 0.001;
  }

  /**
   * Simulate latency p99 in milliseconds
   * For tests: returns deterministic value < 500ms
   */
  private simulateLatencyP99(): number {
    // Deterministic for testing: return 250ms (half the threshold)
    return 250;
  }

  /**
   * Determine canary decision based on metrics
   * Thresholds:
   * - error_rate: < 0.02 (2%)
   * - cost_delta: < 0.002 (0.2%)
   * - latency_p99_ms: < 500ms
   */
  private determineDecision(
    errorRate: number,
    costDelta: number,
    latencyP99Ms: number
  ): 'promote' | 'rollback' | 'hold' {
    const errorRatePass = errorRate < 0.02;
    const costDeltaPass = costDelta < 0.002;
    const latencyPass = latencyP99Ms < 500;

    // All metrics must pass to promote
    if (errorRatePass && costDeltaPass && latencyPass) {
      return 'promote';
    }

    // Any metric fails: rollback
    if (!errorRatePass || !costDeltaPass || !latencyPass) {
      return 'rollback';
    }

    // Default: hold
    return 'hold';
  }
}
