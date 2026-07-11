/**
 * Phase 3 Observability: Metrics Collection Scaffold
 *
 * Provides structured metrics for monitoring ingestion pipeline health.
 * Phase 3: Core metric definitions only. Instrumentation in later phases.
 */

export interface MetricsSnapshot {
  jobsProcessed: number;
  jobsFailedToDLQ: number;
  extractionTime: number; // ms
  pipelineLatency: number; // ms
  timestamp: number;
}

export class MetricsCollector {
  private jobsProcessed: number = 0;
  private jobsFailedToDLQ: number = 0;
  private extractionTime: number = 0;
  private pipelineLatency: number = 0;
  private startTime: number = Date.now();

  /**
   * Record a successfully processed job
   */
  recordJobProcessed(): void {
    this.jobsProcessed++;
  }

  /**
   * Record a job that failed to DLQ
   */
  recordJobFailedToDLQ(): void {
    this.jobsFailedToDLQ++;
  }

  /**
   * Record extraction time for a single job (in milliseconds)
   */
  recordExtractionTime(ms: number): void {
    this.extractionTime = ms;
  }

  /**
   * Record end-to-end pipeline latency (in milliseconds)
   */
  recordPipelineLatency(ms: number): void {
    this.pipelineLatency = ms;
  }

  /**
   * Get current metrics snapshot
   */
  getSnapshot(): MetricsSnapshot {
    return {
      jobsProcessed: this.jobsProcessed,
      jobsFailedToDLQ: this.jobsFailedToDLQ,
      extractionTime: this.extractionTime,
      pipelineLatency: this.pipelineLatency,
      timestamp: Date.now(),
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.jobsProcessed = 0;
    this.jobsFailedToDLQ = 0;
    this.extractionTime = 0;
    this.pipelineLatency = 0;
    this.startTime = Date.now();
  }

  /**
   * Get uptime since collector creation (in milliseconds)
   */
  getUptime(): number {
    return Date.now() - this.startTime;
  }
}

// Singleton instance for global access
export const metricsCollector = new MetricsCollector();
