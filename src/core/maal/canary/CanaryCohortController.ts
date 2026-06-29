/**
 * Phase 4: CanaryCohortController — adaptive cohort growth.
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

export class CanaryCohortController {
  private currentSize: number = 1; // Start at 1% cohort

  /**
   * Grow cohort based on metrics & config.
   * Returns new cohort size (%) or same size if growth paused.
   */
  growCohort(metrics: CohortMetrics, config: CanaryGrowthConfig): number {
    // Skeleton: placeholder growth logic
    const { maxCostDelta, maxLatencyDelta, minSuccessRate, maxDriftScore } = config.thresholds;

    // Check if metrics violate thresholds
    if (metrics.successRate < minSuccessRate || metrics.driftScore > maxDriftScore) {
      // Pause growth (soft violation)
      return this.currentSize;
    }

    // Growth decision: apply growth curve
    const newSize = this.applyGrowthCurve(this.currentSize, config);

    // Enforce cohort cap
    const capped = Math.min(newSize, config.cohortCapPercent);

    this.currentSize = capped;
    return capped;
  }

  private applyGrowthCurve(current: number, config: CanaryGrowthConfig): number {
    // Skeleton: placeholder curves
    switch (config.growthCurve) {
      case 'linear':
        return current + 2; // +2% per step
      case 'exponential':
        return current * 1.5; // 1.5x per step
      case 'adaptive':
        return current * 1.2; // 1.2x per step
      default:
        return current;
    }
  }

  getCurrentSize(): number {
    return this.currentSize;
  }
}
