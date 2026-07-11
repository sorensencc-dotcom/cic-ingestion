/**
 * CustomMetricsEngine: Phase 5 custom metrics registration, aggregation, and threshold evaluation
 *
 * Responsibilities:
 * - Metric registration (gauge, counter, histogram types)
 * - Observation recording with time-ordering
 * - Aggregation (combine multiple metric samples)
 * - Threshold evaluation (binary pass/fail per metric)
 * - Custom metrics extensibility (domain-specific metrics)
 *
 * Data Contract Ownership:
 * - Owns MetricSnapshot state (per-observation, time-ordered)
 * - Invariant: MetricSnapshot.timestamp monotonically increasing per variant+cohort
 *
 * Inherited Metrics (from Phase 4 Observability Contract):
 * - error_rate (threshold < 2% / 0.02)
 * - cost_delta (threshold < 0.2% / 0.002)
 * - latency_p99 (threshold < 500ms)
 *
 * Phase 5 New Metrics:
 * - cohort_progression_rate (gauge)
 * - rollback_count (counter)
 * - custom_metric_evaluation_time (histogram)
 */

/**
 * Metric type enumeration
 */
export type MetricType = 'gauge' | 'counter' | 'histogram';

/**
 * Threshold evaluation operator
 */
export type ThresholdOperator = '>' | '<' | '>=' | '<=' | '==' | '!=';

/**
 * Custom metric definition
 */
export interface CustomMetric {
  name: string;
  type: MetricType;
  threshold: number;
  operator: ThresholdOperator;
  unit: string;
  description?: string;
}

/**
 * Metric snapshot: per-observation, time-ordered
 * Invariant: timestamp must be monotonically increasing per variant+cohort
 */
export interface MetricSnapshot {
  metric_name: string;
  variant_id: string;
  cohort_id: string;
  value: number;
  timestamp: number; // Unix timestamp (ms)
  unit: string;
}

/**
 * Aggregated metrics result
 */
export interface AggregatedMetrics {
  variant_id: string;
  cohort_id: string;
  metrics: Record<string, number>;
  sample_count: number;
  aggregation_method: 'average';
}

/**
 * Threshold evaluation result
 */
export interface ThresholdEvaluationResult {
  metric_name: string;
  value: number;
  threshold: number;
  operator: ThresholdOperator;
  passed: boolean;
}

/**
 * All metrics evaluation result
 */
export interface AllMetricsEvaluationResult {
  variant_id: string;
  cohort_id: string;
  all_passed: boolean;
  results: ThresholdEvaluationResult[];
}

/**
 * CustomMetricsEngine: Register, collect, aggregate, and evaluate custom metrics
 *
 * Key features:
 * - Support for gauge, counter, histogram types
 * - Time-ordered metric snapshots with monotonic timestamp invariant
 * - Aggregation via averaging (extensible to other methods)
 * - Threshold evaluation with multiple operators
 * - Per-variant-cohort metric tracking
 */
export class CustomMetricsEngine {
  private metrics: Map<string, CustomMetric> = new Map();
  private snapshots: Map<string, MetricSnapshot[]> = new Map(); // key: variant_id:cohort_id:metric_name
  private lastTimestamp: Map<string, number> = new Map(); // key: variant_id:cohort_id, tracks last timestamp for monotonicity

  /**
   * Register a custom metric
   *
   * Throws if:
   * - Metric with same name already registered
   * - Invalid operator provided
   */
  registerMetric(metric: CustomMetric): void {
    if (this.metrics.has(metric.name)) {
      throw new Error(`Metric already registered: ${metric.name}`);
    }

    // Validate operator
    const validOperators: ThresholdOperator[] = [
      '>',
      '<',
      '>=',
      '<=',
      '==',
      '!=',
    ];
    if (!validOperators.includes(metric.operator)) {
      throw new Error(
        `Invalid operator: ${metric.operator}. Must be one of: ${validOperators.join(', ')}`
      );
    }

    this.metrics.set(metric.name, metric);
  }

  /**
   * Get registered metric by name
   */
  getMetric(metricName: string): CustomMetric | undefined {
    return this.metrics.get(metricName);
  }

  /**
   * Get all registered metrics
   */
  getAllMetrics(): CustomMetric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Record a metric observation
   *
   * Invariant: timestamp must be >= last recorded timestamp for this variant+cohort
   *
   * Throws if:
   * - Metric not registered
   * - Timestamp violates monotonic ordering
   */
  recordObservation(snapshot: MetricSnapshot): void {
    // Validate metric registered
    if (!this.metrics.has(snapshot.metric_name)) {
      throw new Error(
        `Metric not registered: ${snapshot.metric_name}. Register it first with registerMetric()`
      );
    }

    const key = `${snapshot.variant_id}:${snapshot.cohort_id}`;
    const lastTs = this.lastTimestamp.get(key);

    // Validate timestamp monotonicity
    if (lastTs !== undefined && snapshot.timestamp < lastTs) {
      throw new Error(
        `Timestamp violation for ${key}: new timestamp ${snapshot.timestamp} < last ${lastTs}. Timestamps must be monotonically increasing.`
      );
    }

    // Record snapshot
    const snapshotKey = `${key}:${snapshot.metric_name}`;
    if (!this.snapshots.has(snapshotKey)) {
      this.snapshots.set(snapshotKey, []);
    }
    this.snapshots.get(snapshotKey)!.push(snapshot);

    // Update last timestamp
    this.lastTimestamp.set(key, snapshot.timestamp);
  }

  /**
   * Get metric snapshots for variant+cohort+metric
   */
  getSnapshots(
    variantId: string,
    cohortId: string,
    metricName: string
  ): MetricSnapshot[] {
    const key = `${variantId}:${cohortId}:${metricName}`;
    return this.snapshots.get(key) || [];
  }

  /**
   * Aggregate metric observations via averaging
   *
   * Returns average of all observed values for each metric in variant+cohort
   */
  aggregateMetrics(
    variantId: string,
    cohortId: string
  ): AggregatedMetrics | null {
    const key = `${variantId}:${cohortId}`;
    const aggregated: Record<string, number> = {};
    let sampleCount = 0;

    // Collect all metrics for this variant+cohort
    for (const metricName of this.metrics.keys()) {
      const snapshotKey = `${key}:${metricName}`;
      const snapshots = this.snapshots.get(snapshotKey) || [];

      if (snapshots.length === 0) {
        // No samples for this metric; skip it
        continue;
      }

      // Calculate average
      const sum = snapshots.reduce((acc, s) => acc + s.value, 0);
      aggregated[metricName] = sum / snapshots.length;
      sampleCount = Math.max(sampleCount, snapshots.length);
    }

    // Return null if no observations
    if (Object.keys(aggregated).length === 0) {
      return null;
    }

    return {
      variant_id: variantId,
      cohort_id: cohortId,
      metrics: aggregated,
      sample_count: sampleCount,
      aggregation_method: 'average',
    };
  }

  /**
   * Evaluate a single metric against its threshold
   *
   * Returns true if metric passes threshold, false otherwise
   * If metric not registered, returns true (no constraint)
   */
  evaluateThreshold(metricName: string, value: number): boolean {
    const metric = this.metrics.get(metricName);
    if (!metric) {
      // No constraint for unregistered metric
      return true;
    }

    switch (metric.operator) {
      case '>':
        return value > metric.threshold;
      case '<':
        return value < metric.threshold;
      case '>=':
        return value >= metric.threshold;
      case '<=':
        return value <= metric.threshold;
      case '==':
        return value === metric.threshold;
      case '!=':
        return value !== metric.threshold;
      default:
        return true;
    }
  }

  /**
   * Evaluate all metrics for a variant+cohort
   *
   * Returns detailed pass/fail results for each metric
   */
  evaluateAllMetrics(
    variantId: string,
    cohortId: string
  ): AllMetricsEvaluationResult {
    const aggregated = this.aggregateMetrics(variantId, cohortId);

    const results: ThresholdEvaluationResult[] = [];
    let allPassed = true;

    // If no observations, return pass (nothing to evaluate)
    if (!aggregated) {
      return {
        variant_id: variantId,
        cohort_id: cohortId,
        all_passed: true, // Default to pass if no observations
        results: [],
      };
    }

    // Evaluate each metric
    for (const [metricName, value] of Object.entries(aggregated.metrics)) {
      const metric = this.metrics.get(metricName);
      if (!metric) continue;

      const passed = this.evaluateThreshold(metricName, value);
      results.push({
        metric_name: metricName,
        value,
        threshold: metric.threshold,
        operator: metric.operator,
        passed,
      });

      if (!passed) {
        allPassed = false;
      }
    }

    return {
      variant_id: variantId,
      cohort_id: cohortId,
      all_passed: allPassed,
      results,
    };
  }

  /**
   * Quick check: do all metrics pass for variant+cohort?
   *
   * Returns true if all metrics pass thresholds
   */
  allMetricsPass(variantId: string, cohortId: string): boolean {
    const evaluation = this.evaluateAllMetrics(variantId, cohortId);
    return evaluation.all_passed;
  }

  /**
   * Extend metrics with domain-specific custom metric
   *
   * Allows Phase 5+ to add custom metrics beyond inherited Phase 4 metrics
   * Example: cohort_progression_rate, rollback_count, custom_metric_evaluation_time
   */
  registerCustomMetric(
    name: string,
    type: MetricType,
    threshold: number,
    operator: ThresholdOperator,
    unit: string,
    description?: string
  ): void {
    this.registerMetric({
      name,
      type,
      threshold,
      operator,
      unit,
      description,
    });
  }

  /**
   * Clear all observations (for testing/reset scenarios)
   */
  clearObservations(): void {
    this.snapshots.clear();
    this.lastTimestamp.clear();
  }

  /**
   * Clear specific variant+cohort observations
   */
  clearObservationsForVariantCohort(variantId: string, cohortId: string): void {
    const key = `${variantId}:${cohortId}`;
    const keysToDelete: string[] = [];

    for (const snaphotKey of this.snapshots.keys()) {
      if (snaphotKey.startsWith(key + ':')) {
        keysToDelete.push(snaphotKey);
      }
    }

    for (const key of keysToDelete) {
      this.snapshots.delete(key);
    }

    this.lastTimestamp.delete(key);
  }
}
