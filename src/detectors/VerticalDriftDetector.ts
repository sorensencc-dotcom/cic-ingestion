import { AdapterOutput } from "../adapters/BaseAdapter";

export interface DriftSignal {
  type:
    | "NULL_RESULT"
    | "SCHEMA_MISMATCH"
    | "CONFIDENCE_DROP"
    | "TIMEOUT"
    | "RETRY_EXHAUSTION";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  details: any;
  timestamp: number;
}

export class VerticalDriftDetector {
  private baselineScores = new Map<string, number>();
  private readonly confidenceThreshold = 0.5;
  private readonly driftThreshold = 0.3;

  check(result: AdapterOutput, adapterId?: string): DriftSignal | null {
    if (!result) {
      return {
        type: "NULL_RESULT",
        severity: "CRITICAL",
        details: { reason: "adapter returned null" },
        timestamp: Date.now(),
      };
    }

    if (!result.success) {
      return {
        type: "TIMEOUT",
        severity: "HIGH",
        details: { error: result.error },
        timestamp: result.timestamp,
      };
    }

    if (result.score !== undefined) {
      if (result.score < this.confidenceThreshold) {
        return {
          type: "CONFIDENCE_DROP",
          severity: result.score < 0.2 ? "CRITICAL" : "HIGH",
          details: {
            score: result.score,
            threshold: this.confidenceThreshold,
          },
          timestamp: result.timestamp,
        };
      }

      if (adapterId && this.baselineScores.has(adapterId)) {
        const baseline = this.baselineScores.get(adapterId)!;
        const drift = Math.abs(result.score - baseline) / baseline;

        if (drift > this.driftThreshold) {
          return {
            type: "SCHEMA_MISMATCH",
            severity: "MEDIUM",
            details: {
              current: result.score,
              baseline,
              drift: (drift * 100).toFixed(2) + "%",
            },
            timestamp: result.timestamp,
          };
        }
      }
    }

    if (adapterId) {
      this.baselineScores.set(adapterId, result.score || 0.8);
    }

    return null;
  }

  checkBatch(results: AdapterOutput[], adapterId?: string): DriftSignal[] {
    return results
      .map((r) => this.check(r, adapterId))
      .filter((s): s is DriftSignal => s !== null);
  }

  getBaseline(adapterId: string): number | null {
    return this.baselineScores.get(adapterId) || null;
  }

  resetBaseline(adapterId: string): void {
    this.baselineScores.delete(adapterId);
  }

  clearBaselines(): void {
    this.baselineScores.clear();
  }
}
