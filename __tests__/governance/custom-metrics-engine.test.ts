/**
 * CustomMetricsEngine Tests — Phase 5
 * Focus: Metric registration, aggregation, threshold evaluation, custom metrics extensibility
 *
 * Test Plan (7 tests):
 * 1. Registration: 1 test
 * 2. Aggregation: 2 tests (single sample, multiple samples)
 * 3. Threshold Evaluation: 2 tests (pass, fail)
 * 4. Custom Metrics: 2 tests (domain-specific, extensibility)
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  CustomMetricsEngine,
  CustomMetric,
  MetricSnapshot,
  ThresholdOperator,
} from '../../src/governance/custom-metrics-engine';

describe('CustomMetricsEngine', () => {
  let engine: CustomMetricsEngine;

  beforeEach(() => {
    engine = new CustomMetricsEngine();
  });

  // ============= REGISTRATION TESTS (1 test) =============

  describe('Metric Registration', () => {
    it('registers custom metric successfully', () => {
      const metric: CustomMetric = {
        name: 'error_rate',
        type: 'gauge',
        threshold: 0.02,
        operator: '<',
        unit: 'ratio',
        description: 'Error rate threshold for canary',
      };

      engine.registerMetric(metric);
      const retrieved = engine.getMetric('error_rate');

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('error_rate');
      expect(retrieved?.threshold).toBe(0.02);
      expect(retrieved?.operator).toBe('<');
      expect(retrieved?.type).toBe('gauge');
      expect(retrieved?.unit).toBe('ratio');
    });
  });

  // ============= AGGREGATION TESTS (2 tests) =============

  describe('Metric Aggregation', () => {
    it('aggregates single metric sample', () => {
      // Register metric
      engine.registerMetric({
        name: 'latency_p99',
        type: 'gauge',
        threshold: 500,
        operator: '<',
        unit: 'ms',
      });

      // Record single observation
      const snapshot: MetricSnapshot = {
        metric_name: 'latency_p99',
        variant_id: 'variant-a',
        cohort_id: 'cohort-10pct',
        value: 250,
        timestamp: Date.now(),
        unit: 'ms',
      };

      engine.recordObservation(snapshot);

      // Aggregate
      const aggregated = engine.aggregateMetrics('variant-a', 'cohort-10pct');

      expect(aggregated).toBeDefined();
      expect(aggregated?.variant_id).toBe('variant-a');
      expect(aggregated?.cohort_id).toBe('cohort-10pct');
      expect(aggregated?.metrics.latency_p99).toBe(250);
      expect(aggregated?.sample_count).toBe(1);
      expect(aggregated?.aggregation_method).toBe('average');
    });

    it('aggregates multiple metric samples (averaging)', () => {
      // Register metrics
      engine.registerMetric({
        name: 'error_rate',
        type: 'gauge',
        threshold: 0.02,
        operator: '<',
        unit: 'ratio',
      });
      engine.registerMetric({
        name: 'cost_delta',
        type: 'gauge',
        threshold: 0.002,
        operator: '<',
        unit: 'ratio',
      });

      // Record multiple observations for error_rate
      // Timestamps must be monotonically increasing per variant+cohort
      const now = Date.now();
      const obs1: MetricSnapshot = {
        metric_name: 'error_rate',
        variant_id: 'variant-a',
        cohort_id: 'cohort-10pct',
        value: 0.01,
        timestamp: now,
        unit: 'ratio',
      };
      const obs2: MetricSnapshot = {
        metric_name: 'cost_delta',
        variant_id: 'variant-a',
        cohort_id: 'cohort-10pct',
        value: 0.001,
        timestamp: now + 500,
        unit: 'ratio',
      };
      const obs3: MetricSnapshot = {
        metric_name: 'error_rate',
        variant_id: 'variant-a',
        cohort_id: 'cohort-10pct',
        value: 0.015,
        timestamp: now + 1000,
        unit: 'ratio',
      };

      engine.recordObservation(obs1);
      engine.recordObservation(obs2);
      engine.recordObservation(obs3);

      // Aggregate
      const aggregated = engine.aggregateMetrics('variant-a', 'cohort-10pct');

      expect(aggregated).toBeDefined();
      expect(aggregated?.sample_count).toBe(2); // Max of 2 samples for error_rate
      // Average of error_rate: (0.01 + 0.015) / 2 = 0.0125
      expect(aggregated?.metrics.error_rate).toBeCloseTo(0.0125, 4);
      // Single sample for cost_delta
      expect(aggregated?.metrics.cost_delta).toBe(0.001);
    });
  });

  // ============= THRESHOLD EVALUATION TESTS (2 tests) =============

  describe('Threshold Evaluation', () => {
    it('evaluates metric threshold — pass condition', () => {
      // Register multiple metrics with different operators
      engine.registerMetric({
        name: 'error_rate',
        type: 'gauge',
        threshold: 0.02,
        operator: '<',
        unit: 'ratio',
      });
      engine.registerMetric({
        name: 'latency_p99',
        type: 'gauge',
        threshold: 500,
        operator: '<=',
        unit: 'ms',
      });
      engine.registerMetric({
        name: 'rollback_count',
        type: 'counter',
        threshold: 0,
        operator: '==',
        unit: 'count',
      });

      // Test passing thresholds
      expect(engine.evaluateThreshold('error_rate', 0.01)).toBe(true); // 0.01 < 0.02
      expect(engine.evaluateThreshold('latency_p99', 500)).toBe(true); // 500 <= 500
      expect(engine.evaluateThreshold('rollback_count', 0)).toBe(true); // 0 == 0
    });

    it('evaluates metric threshold — fail condition', () => {
      // Register metrics
      engine.registerMetric({
        name: 'error_rate',
        type: 'gauge',
        threshold: 0.02,
        operator: '<',
        unit: 'ratio',
      });
      engine.registerMetric({
        name: 'cost_delta',
        type: 'gauge',
        threshold: 0.002,
        operator: '<',
        unit: 'ratio',
      });
      engine.registerMetric({
        name: 'latency_p99',
        type: 'gauge',
        threshold: 500,
        operator: '<=',
        unit: 'ms',
      });

      // Test failing thresholds
      expect(engine.evaluateThreshold('error_rate', 0.03)).toBe(false); // 0.03 NOT < 0.02
      expect(engine.evaluateThreshold('cost_delta', 0.003)).toBe(false); // 0.003 NOT < 0.002
      expect(engine.evaluateThreshold('latency_p99', 600)).toBe(false); // 600 NOT <= 500
    });
  });

  // ============= CUSTOM METRICS TESTS (2 tests) =============

  describe('Custom Metrics Extensibility', () => {
    it('registers domain-specific custom metric (Phase 5 new metric)', () => {
      // Phase 5 introduces new metrics beyond Phase 4
      engine.registerCustomMetric(
        'cohort_progression_rate',
        'gauge',
        0.8,
        '>=',
        'ratio',
        'Minimum cohort progression rate for promotion'
      );

      const retrieved = engine.getMetric('cohort_progression_rate');
      expect(retrieved).toBeDefined();
      expect(retrieved?.type).toBe('gauge');
      expect(retrieved?.operator).toBe('>=');
      expect(retrieved?.description).toContain('cohort progression');
    });

    it('supports extensible metric API with multiple domain-specific metrics', () => {
      // Register Phase 4 inherited metrics
      engine.registerCustomMetric(
        'error_rate',
        'gauge',
        0.02,
        '<',
        'ratio',
        'Phase 4 inherited'
      );
      engine.registerCustomMetric(
        'cost_delta',
        'gauge',
        0.002,
        '<',
        'ratio',
        'Phase 4 inherited'
      );
      engine.registerCustomMetric(
        'latency_p99',
        'gauge',
        500,
        '<',
        'ms',
        'Phase 4 inherited'
      );

      // Register Phase 5 new metrics
      engine.registerCustomMetric(
        'cohort_progression_rate',
        'gauge',
        0.8,
        '>=',
        'ratio',
        'Phase 5 new'
      );
      engine.registerCustomMetric(
        'rollback_count',
        'counter',
        5,
        '<=',
        'count',
        'Phase 5 new'
      );
      engine.registerCustomMetric(
        'custom_metric_evaluation_time',
        'histogram',
        100,
        '<',
        'ms',
        'Phase 5 new'
      );

      // Verify all metrics registered
      const allMetrics = engine.getAllMetrics();
      expect(allMetrics.length).toBe(6);
      expect(allMetrics.map((m) => m.name)).toContain('error_rate');
      expect(allMetrics.map((m) => m.name)).toContain('cohort_progression_rate');
      expect(allMetrics.map((m) => m.name)).toContain('rollback_count');
      expect(allMetrics.map((m) => m.name)).toContain(
        'custom_metric_evaluation_time'
      );

      // Verify all metrics types
      const gaugeMetrics = allMetrics.filter((m) => m.type === 'gauge');
      const counterMetrics = allMetrics.filter((m) => m.type === 'counter');
      const histogramMetrics = allMetrics.filter((m) => m.type === 'histogram');

      expect(gaugeMetrics.length).toBeGreaterThanOrEqual(4);
      expect(counterMetrics.length).toBeGreaterThanOrEqual(1);
      expect(histogramMetrics.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============= ADDITIONAL VALIDATION TESTS =============

  describe('Timestamp Monotonicity Invariant', () => {
    it('enforces monotonically increasing timestamps per variant+cohort', () => {
      engine.registerMetric({
        name: 'error_rate',
        type: 'gauge',
        threshold: 0.02,
        operator: '<',
        unit: 'ratio',
      });

      const now = Date.now();
      const obs1: MetricSnapshot = {
        metric_name: 'error_rate',
        variant_id: 'variant-a',
        cohort_id: 'cohort-10pct',
        value: 0.01,
        timestamp: now,
        unit: 'ratio',
      };
      const obs2: MetricSnapshot = {
        metric_name: 'error_rate',
        variant_id: 'variant-a',
        cohort_id: 'cohort-10pct',
        value: 0.015,
        timestamp: now - 100, // Earlier timestamp — should fail
        unit: 'ratio',
      };

      engine.recordObservation(obs1);
      expect(() => engine.recordObservation(obs2)).toThrow(
        /Timestamp violation/
      );
    });
  });

  describe('Metric Evaluation Results', () => {
    it('evaluates all metrics and returns detailed results', () => {
      // Setup metrics
      engine.registerMetric({
        name: 'error_rate',
        type: 'gauge',
        threshold: 0.02,
        operator: '<',
        unit: 'ratio',
      });
      engine.registerMetric({
        name: 'cost_delta',
        type: 'gauge',
        threshold: 0.002,
        operator: '<',
        unit: 'ratio',
      });

      // Record observations
      const now = Date.now();
      engine.recordObservation({
        metric_name: 'error_rate',
        variant_id: 'variant-a',
        cohort_id: 'cohort-10pct',
        value: 0.01, // Passes threshold
        timestamp: now,
        unit: 'ratio',
      });
      engine.recordObservation({
        metric_name: 'cost_delta',
        variant_id: 'variant-a',
        cohort_id: 'cohort-10pct',
        value: 0.003, // Fails threshold (0.003 NOT < 0.002)
        timestamp: now + 100,
        unit: 'ratio',
      });

      // Evaluate all metrics
      const evaluation = engine.evaluateAllMetrics('variant-a', 'cohort-10pct');

      expect(evaluation.variant_id).toBe('variant-a');
      expect(evaluation.cohort_id).toBe('cohort-10pct');
      expect(evaluation.all_passed).toBe(false); // Because cost_delta fails
      expect(evaluation.results.length).toBe(2);

      // Verify individual results
      const errorRateResult = evaluation.results.find(
        (r) => r.metric_name === 'error_rate'
      );
      expect(errorRateResult?.passed).toBe(true);

      const costDeltaResult = evaluation.results.find(
        (r) => r.metric_name === 'cost_delta'
      );
      expect(costDeltaResult?.passed).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('returns null for aggregation with no observations', () => {
      engine.registerMetric({
        name: 'error_rate',
        type: 'gauge',
        threshold: 0.02,
        operator: '<',
        unit: 'ratio',
      });

      const aggregated = engine.aggregateMetrics('variant-x', 'cohort-x');
      expect(aggregated).toBeNull();
    });

    it('returns true for allMetricsPass with no observations', () => {
      engine.registerMetric({
        name: 'error_rate',
        type: 'gauge',
        threshold: 0.02,
        operator: '<',
        unit: 'ratio',
      });

      const result = engine.allMetricsPass('variant-x', 'cohort-x');
      expect(result).toBe(true); // Default to pass if no observations
    });

    it('throws error when recording unregistered metric', () => {
      const snapshot: MetricSnapshot = {
        metric_name: 'unknown_metric',
        variant_id: 'variant-a',
        cohort_id: 'cohort-10pct',
        value: 100,
        timestamp: Date.now(),
        unit: 'unknown',
      };

      expect(() => engine.recordObservation(snapshot)).toThrow(
        /Metric not registered: unknown_metric/
      );
    });

    it('throws error when registering duplicate metric', () => {
      const metric: CustomMetric = {
        name: 'error_rate',
        type: 'gauge',
        threshold: 0.02,
        operator: '<',
        unit: 'ratio',
      };

      engine.registerMetric(metric);
      expect(() => engine.registerMetric(metric)).toThrow(
        /Metric already registered/
      );
    });

    it('throws error with invalid operator', () => {
      const invalidMetric: any = {
        name: 'test_metric',
        type: 'gauge',
        threshold: 100,
        operator: 'invalid_op',
        unit: 'test',
      };

      expect(() => engine.registerMetric(invalidMetric)).toThrow(
        /Invalid operator/
      );
    });
  });

  describe('Data Isolation per Variant+Cohort', () => {
    it('isolates metric observations per variant+cohort pair', () => {
      engine.registerMetric({
        name: 'error_rate',
        type: 'gauge',
        threshold: 0.02,
        operator: '<',
        unit: 'ratio',
      });

      const now = Date.now();

      // Record for variant-a, cohort-10pct
      engine.recordObservation({
        metric_name: 'error_rate',
        variant_id: 'variant-a',
        cohort_id: 'cohort-10pct',
        value: 0.01,
        timestamp: now,
        unit: 'ratio',
      });

      // Record for variant-b, cohort-10pct (same cohort, different variant)
      engine.recordObservation({
        metric_name: 'error_rate',
        variant_id: 'variant-b',
        cohort_id: 'cohort-10pct',
        value: 0.015,
        timestamp: now,
        unit: 'ratio',
      });

      // Record for variant-a, cohort-25pct (same variant, different cohort)
      engine.recordObservation({
        metric_name: 'error_rate',
        variant_id: 'variant-a',
        cohort_id: 'cohort-25pct',
        value: 0.005,
        timestamp: now,
        unit: 'ratio',
      });

      // Verify aggregations are isolated
      const agg1 = engine.aggregateMetrics('variant-a', 'cohort-10pct');
      const agg2 = engine.aggregateMetrics('variant-b', 'cohort-10pct');
      const agg3 = engine.aggregateMetrics('variant-a', 'cohort-25pct');

      expect(agg1?.metrics.error_rate).toBe(0.01);
      expect(agg2?.metrics.error_rate).toBe(0.015);
      expect(agg3?.metrics.error_rate).toBe(0.005);
    });
  });
});
