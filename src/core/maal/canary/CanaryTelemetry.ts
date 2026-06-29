/**
 * Phase 4: CanaryTelemetry — collect & aggregate metrics from canary cohort.
 * CI gate rule 6: All promotions emit canary_gate_results.
 */

export interface CanaryTelemetryPoint {
  readonly proposalId: string;
  readonly timestamp: number;
  readonly cohortSize: number; // % of traffic
  readonly avgLatency: number; // ms
  readonly avgCost: number; // $
  readonly successRate: number; // 0-1
  readonly errorRate: number; // 0-1
  readonly driftScore: number; // 0-1 (simulator vs live)
  readonly sampleCount: number;
}

export class CanaryTelemetryCollector {
  private points: CanaryTelemetryPoint[] = [];

  recordPoint(point: CanaryTelemetryPoint): void {
    this.points.push(point);
  }

  getLatestPoint(proposalId: string): CanaryTelemetryPoint | undefined {
    const matching = this.points
      .filter(p => p.proposalId === proposalId)
      .sort((a, b) => b.timestamp - a.timestamp);
    return matching.length > 0 ? matching[0] : undefined;
  }

  getPointsBetween(proposalId: string, startTime: number, endTime: number): CanaryTelemetryPoint[] {
    return this.points.filter(p =>
      p.proposalId === proposalId && p.timestamp >= startTime && p.timestamp <= endTime,
    );
  }

  /**
   * Compute aggregate metrics for a proposal's canary run.
   */
  aggregateMetrics(proposalId: string): {
    avgLatency: number;
    avgCost: number;
    avgSuccessRate: number;
    maxDriftScore: number;
  } | null {
    const points = this.points.filter(p => p.proposalId === proposalId);
    if (points.length === 0) return null;

    return {
      avgLatency: points.reduce((sum, p) => sum + p.avgLatency, 0) / points.length,
      avgCost: points.reduce((sum, p) => sum + p.avgCost, 0) / points.length,
      avgSuccessRate: points.reduce((sum, p) => sum + p.successRate, 0) / points.length,
      maxDriftScore: Math.max(...points.map(p => p.driftScore)),
    };
  }

  getAllPoints(): CanaryTelemetryPoint[] {
    return [...this.points];
  }
}
