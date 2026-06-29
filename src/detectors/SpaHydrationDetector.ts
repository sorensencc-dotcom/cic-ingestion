import { AdapterOutput } from "../adapters/BaseAdapter";

export interface HydrationFailure {
  reason: string;
  details?: any;
  severity: "LOW" | "MEDIUM" | "HIGH";
}

export class SpaHydrationDetector {
  check(result: AdapterOutput): HydrationFailure | null {
    if (!result) {
      return {
        reason: "null result",
        severity: "HIGH",
      };
    }

    if (!result.hydration) {
      return {
        reason: "missing hydration metadata",
        severity: "MEDIUM",
      };
    }

    if (result.hydration.errors && result.hydration.errors.length > 0) {
      return {
        reason: "hydration errors detected",
        details: result.hydration.errors,
        severity: "HIGH",
      };
    }

    if (!result.success) {
      return {
        reason: "adapter execution failed",
        details: result.error,
        severity: "HIGH",
      };
    }

    if (result.score !== undefined && result.score < 0.3) {
      return {
        reason: "low confidence score",
        details: { score: result.score, threshold: 0.3 },
        severity: "MEDIUM",
      };
    }

    return null;
  }

  checkBatch(results: AdapterOutput[]): HydrationFailure[] {
    return results
      .map((r) => this.check(r))
      .filter((f): f is HydrationFailure => f !== null);
  }
}
