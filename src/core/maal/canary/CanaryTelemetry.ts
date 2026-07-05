export interface CanaryTelemetry {
  telemetry_id: string;
  proposal_id: string;
  cohort_step: number;
  cohort_size: number;
  observation_window: {
    start: Date;
    end: Date;
    duration_minutes: number;
  };
  metrics: {
    cost_delta: number;
    latency_delta: number;
    correctness_delta: number;
    divergence: number;
    error_rate: number;
    task_success_rate: number;
  };
  decision: string;
  collected_at: Date;
  recorded_at: Date;
}

export interface CanaryTelemetryPoint {
  readonly proposalId: string;
  readonly timestamp: number;
  readonly cohortSize: number;
  readonly avgLatency: number;
  readonly avgCost: number;
  readonly successRate: number;
  readonly errorRate: number;
  readonly driftScore: number;
  readonly sampleCount: number;
}

export class CanaryTelemetryCollector {
  private points: CanaryTelemetryPoint[] = [];

  recordPoint(point: CanaryTelemetryPoint): void {
    this.points.push(point);
  }

  getPoints(): CanaryTelemetryPoint[] {
    return [...this.points];
  }

  getLatestPoint(): CanaryTelemetryPoint | undefined {
    return this.points.length > 0 ? this.points[this.points.length - 1] : undefined;
  }

  clear(): void {
    this.points = [];
  }
}
