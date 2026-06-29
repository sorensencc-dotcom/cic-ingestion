/**
 * Phase 4: Canary growth config — persistent, database-backed.
 * Append-only table (canary_growth_configs).
 * CI gate rule 7.
 */

export interface CanaryGrowthConfig {
  readonly cohortCapPercent: number; // e.g., 50 (max 50% of traffic)
  readonly growthCurve: 'linear' | 'exponential' | 'adaptive'; // growth strategy
  readonly observationWindowMs: number; // telemetry collection period
  readonly metricsCheckIntervalMs: number; // how often to check thresholds
  readonly thresholds: {
    readonly maxCostDelta: number; // ±% allowed
    readonly maxLatencyDelta: number; // ±% allowed
    readonly minSuccessRate: number; // % minimum
    readonly maxDriftScore: number; // 0-1 scale
  };
  readonly timestamp: number;
  readonly approver: string; // governance approver ID
}

/**
 * CanaryCohortController uses latest config from DB.
 */
export class CanaryGrowthConfigStore {
  private configs: CanaryGrowthConfig[] = [];

  appendConfig(config: CanaryGrowthConfig): void {
    this.configs.push(config);
  }

  getLatestConfig(): CanaryGrowthConfig | undefined {
    return this.configs.length > 0 ? this.configs[this.configs.length - 1] : undefined;
  }

  getConfigAt(timestamp: number): CanaryGrowthConfig | undefined {
    // Find config valid at given timestamp
    return this.configs
      .filter(c => c.timestamp <= timestamp)
      .sort((a, b) => b.timestamp - a.timestamp)[0];
  }

  getAllConfigs(): CanaryGrowthConfig[] {
    return [...this.configs];
  }
}
