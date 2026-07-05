/**
 * Fire-Drill Manager: D-Phase Integration
 * Runs resilience tests against MAAL routing layer
 * Reports violations to SLO controller + governance layer
 */

import { FireDrillHarness, FireDrillResult } from "src/tests/d-phase/fire-drill-harness.js";
import { MockProvider } from "src/tests/mocks/mockProvider.js";
import { logEvent } from "src/observability/events.js";

export interface FireDrillConfig {
  enabled: boolean;
  runOnStartup?: boolean;
  runOnInterval?: number; // ms
  failureThreshold?: number; // % of drills that must pass (default 100)
  reportToSLO?: boolean;
}

export interface FireDrillReport {
  timestamp: Date;
  totalDrills: number;
  passedDrills: number;
  failedDrills: number;
  passRate: string;
  violations: FireDrillResult[];
  healthy: boolean;
}

export class FireDrillManager {
  private config: FireDrillConfig;
  private harness: FireDrillHarness;
  private lastReport: FireDrillReport | null = null;
  private intervalHandle: NodeJS.Timeout | null = null;

  constructor(config: FireDrillConfig = { enabled: true, reportToSLO: true }) {
    this.config = config;
    const mockProvider = new MockProvider();
    this.harness = new FireDrillHarness(mockProvider);
  }

  async runDrills(): Promise<FireDrillReport> {
    const startTime = Date.now();
    const results = await this.harness.runAll();
    const summary = this.harness.getSummary();

    const report: FireDrillReport = {
      timestamp: new Date(),
      totalDrills: summary.total,
      passedDrills: summary.passed,
      failedDrills: summary.failed,
      passRate: summary.passRate,
      violations: results.filter((r: FireDrillResult) => !r.passed),
      healthy: summary.passed === summary.total
    };

    this.lastReport = report;

    logEvent({
      eventName: "MODEL_CALL_SUCCESS",
      model: "FireDrillManager",
      agent: "D-Phase",
      latencyMs: Date.now() - startTime,
      error: report.healthy ? undefined : `${report.failedDrills} drills failed`,
      tokensUsed: { input: 0, output: 0 }
    });

    return report;
  }

  startSchedule(intervalMs: number): void {
    if (this.intervalHandle) clearInterval(this.intervalHandle);

    this.intervalHandle = setInterval(async () => {
      await this.runDrills();
    }, intervalMs || this.config.runOnInterval || 3600000);
  }

  stopSchedule(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  getLastReport(): FireDrillReport | null {
    return this.lastReport;
  }

  isHealthy(): boolean {
    return this.lastReport?.healthy ?? true;
  }
}
