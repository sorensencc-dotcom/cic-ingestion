/**
 * Phase 4: CanaryCohortController — adaptive cohort growth.
 * Monitors metrics, decides grow/pause/rollback based on governance thresholds.
 */

import { CanaryGrowthConfig } from './CanaryGrowthConfig';

export interface CohortMetrics {
  readonly cohortSize: number; // % of traffic
  readonly avgLatency: number; // ms
  readonly avgCost: number; // $
  readonly successRate: number; // 0-1
  readonly driftScore: number; // 0-1
  readonly sampleCount: number;
}

export interface GrowthDecision {
  readonly action: 'grow' | 'pause' | 'rollback_soft' | 'rollback_hard';
  readonly newSize?: number;
  readonly reason: string;
  readonly violated?: string[];
}

export class CanaryCohortController {
  private currentSize: number = 1; // Start at 1% cohort
  private baselineMetrics: Partial<CohortMetrics> = {}; // Baseline to compare against

  /**
   * Set baseline metrics (control group) for delta comparison.
   */
  setBaseline(metrics: Partial<CohortMetrics>): void {
    this.baselineMetrics = metrics;
  }

  /**
   * Grow cohort based on metrics & config.
   * Implements soft (pause) and hard (rollback) violations.
   */
  decideCohortGrowth(metrics: CohortMetrics, config: CanaryGrowthConfig): GrowthDecision {
    const { maxCostDelta, maxLatencyDelta, minSuccessRate, maxDriftScore } = config.thresholds;
    const violations: string[] = [];

    // Hard violations → immediate rollback
    if (metrics.successRate < minSuccessRate) {
      violations.push(`success_rate (${metrics.successRate.toFixed(3)} < ${minSuccessRate})`);
    }

    if (metrics.driftScore > maxDriftScore) {
      violations.push(`drift_score (${metrics.driftScore.toFixed(3)} > ${maxDriftScore})`);
    }

    if (violations.length > 0) {
      return {
        action: 'rollback_hard',
        reason: `Hard violations detected: ${violations.join(', ')}`,
        violated: violations,
      };
    }

    // Soft violations → pause growth (no rollback)
    const softViolations: string[] = [];

    const costDelta = this.estimateDelta(metrics.avgCost, this.baselineMetrics.avgCost || 0);
    if (Math.abs(costDelta) > maxCostDelta) {
      softViolations.push(`cost_delta (${costDelta.toFixed(3)} > ${maxCostDelta})`);
    }

    const latencyDelta = this.estimateDelta(metrics.avgLatency, this.baselineMetrics.avgLatency || 0);
    if (Math.abs(latencyDelta) > maxLatencyDelta) {
      softViolations.push(`latency_delta (${latencyDelta.toFixed(3)} > ${maxLatencyDelta})`);
    }

    if (softViolations.length > 0) {
      return {
        action: 'pause',
        newSize: this.currentSize,
        reason: `Soft violations detected: ${softViolations.join(', ')}`,
        violated: softViolations,
      };
    }

    // All metrics passed → grow cohort
    const newSize = this.applyGrowthCurve(this.currentSize, config);
    const capped = Math.min(newSize, config.cohortCapPercent);

    if (capped === this.currentSize) {
      return {
        action: 'pause',
        newSize: this.currentSize,
        reason: `Cohort at cap (${this.currentSize}% / ${config.cohortCapPercent}%)`,
      };
    }

    this.currentSize = capped;
    return {
      action: 'grow',
      newSize: capped,
      reason: `Growth approved: metrics within bounds. New size ${capped}%`,
    };
  }

  private estimateDelta(actual: number, baseline: number): number {
    if (baseline === 0) return actual > 0 ? 1 : 0;
    return (actual - baseline) / baseline; // Relative change
  }

  private applyGrowthCurve(current: number, config: CanaryGrowthConfig): number {
    // Apply growth strategy (deterministic)
    const stepSize = this.calculateStepSize(config);
    switch (config.growthCurve) {
      case 'linear':
        return current + stepSize; // Fixed step
      case 'exponential':
        return current * (1 + stepSize); // Multiplicative
      case 'adaptive':
        return current + (stepSize * 0.75); // Slower exponential hybrid
      default:
        return current;
    }
  }

  private calculateStepSize(config: CanaryGrowthConfig): number {
    // Step size based on metrics check interval
    // E.g., if checking every 5 min with 1h window, ~12 steps to reach cap
    return Math.max(1, config.cohortCapPercent / 10); // Target 10 steps to cap
  }

  getCurrentSize(): number {
    return this.currentSize;
  }

  reset(): void {
    this.currentSize = 1;
    this.baselineMetrics = {};
  }
}
