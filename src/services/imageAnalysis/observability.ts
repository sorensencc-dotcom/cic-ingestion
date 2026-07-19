/**
 * Observability & Metrics for Image Analysis Service
 * Phase 3: Collect latency, fallback rates, errors for monitoring & SLA tracking
 */

export interface MetricsSnapshot {
  timestamp: string;
  totalRequests: number;
  successfulRequests: number;
  errorRequests: number;
  latencies: {
    mean: number;
    p50: number;
    p95: number;
    p99: number;
  };
  visionApiUsageRatio: number; // 0-1: real Vision API vs fallback
  fallbackRatio: number; // 0-1: fallback ratio
  errorsByType: Record<string, number>;
}

export class ImageAnalysisMetrics {
  private latencies: number[] = [];
  private totalRequests = 0;
  private successfulRequests = 0;
  private errorRequests = 0;
  private errorsByType: Map<string, number> = new Map();
  private visionApiUsedCount = 0;
  private fallbackCount = 0;

  /**
   * Record a successful request
   */
  recordSuccess(latencyMs: number, visionApiUsed: boolean): void {
    this.totalRequests++;
    this.successfulRequests++;
    this.latencies.push(latencyMs);

    if (visionApiUsed) {
      this.visionApiUsedCount++;
    } else {
      this.fallbackCount++;
    }
  }

  /**
   * Record a failed request
   */
  recordError(errorType: string, latencyMs: number): void {
    this.totalRequests++;
    this.errorRequests++;
    this.latencies.push(latencyMs);

    const count = this.errorsByType.get(errorType) || 0;
    this.errorsByType.set(errorType, count + 1);
  }

  /**
   * Get current metrics snapshot
   */
  getSnapshot(): MetricsSnapshot {
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const mean = this.latencies.length > 0 ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length : 0;

    const errors: Record<string, number> = {};
    this.errorsByType.forEach((count, type) => {
      errors[type] = count;
    });

    return {
      timestamp: new Date().toISOString(),
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      errorRequests: this.errorRequests,
      latencies: {
        mean: Math.round(mean),
        p50: sorted[Math.floor(sorted.length * 0.50)] || 0,
        p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
        p99: sorted[Math.floor(sorted.length * 0.99)] || 0,
      },
      visionApiUsageRatio: this.totalRequests > 0 ? this.visionApiUsedCount / this.totalRequests : 0,
      fallbackRatio: this.totalRequests > 0 ? this.fallbackCount / this.totalRequests : 0,
      errorsByType: errors,
    };
  }

  /**
   * Reset metrics (for batch windowing)
   */
  reset(): void {
    this.latencies = [];
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.errorRequests = 0;
    this.errorsByType.clear();
    this.visionApiUsedCount = 0;
    this.fallbackCount = 0;
  }

  /**
   * Check SLA compliance
   */
  isSLACompliant(slaP99Ms: number = 500, maxFallbackRatio: number = 0.05, maxErrorRate: number = 0.05): boolean {
    const snapshot = this.getSnapshot();
    const errorRate = this.totalRequests > 0 ? this.errorRequests / this.totalRequests : 0;

    return (
      snapshot.latencies.p99 <= slaP99Ms &&
      snapshot.fallbackRatio <= maxFallbackRatio &&
      errorRate <= maxErrorRate
    );
  }

  /**
   * Generate alert if fallback rate exceeds threshold
   */
  checkFallbackAlert(threshold: number = 0.05): { triggered: boolean; message: string } {
    const snapshot = this.getSnapshot();

    if (snapshot.fallbackRatio > threshold) {
      return {
        triggered: true,
        message: `Vision API fallback rate ${(snapshot.fallbackRatio * 100).toFixed(1)}% exceeds threshold ${(threshold * 100).toFixed(1)}%`,
      };
    }

    return {
      triggered: false,
      message: '',
    };
  }
}

/**
 * Global metrics instance (singleton)
 */
export const globalMetrics = new ImageAnalysisMetrics();
