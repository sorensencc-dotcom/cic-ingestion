/**
 * CohortPromotionEngine Unit Tests
 *
 * Test Coverage:
 * 1. Promote Scenario: all metrics pass + observation window complete → PROMOTE decision
 * 2. Rollback Scenario: metric fails threshold → ROLLBACK decision (atomic across cohorts)
 * 3. Continue Scenario: observation incomplete or metrics ambiguous → HOLD decision
 *
 * Total: 3 tests, 100% PASS target
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  CohortPromotionEngine,
  MetricCriteria,
  MetricObservation,
} from '../../src/governance/cohort-promotion-engine';

describe('CohortPromotionEngine', () => {
  let engine: CohortPromotionEngine;

  beforeEach(() => {
    engine = new CohortPromotionEngine();
  });

  describe('Promotion Scenario', () => {
    it('promotes cohort when all metrics pass and observation window complete', () => {
      // Arrange: Define standard Phase 5 metrics
      const criteria: MetricCriteria[] = [
        {
          metric_name: 'error_rate',
          operator: '<',
          threshold: 0.02, // 2%
        },
        {
          metric_name: 'cost_delta',
          operator: '<',
          threshold: 0.002, // 0.2%
        },
        {
          metric_name: 'latency_p99',
          operator: '<',
          threshold: 500, // ms
        },
      ];

      // Observations: all metrics pass
      const observations: MetricObservation[] = [
        {
          metric_name: 'error_rate',
          value: 0.01, // 1% < 2% ✓
          recorded_at: new Date().toISOString(),
        },
        {
          metric_name: 'error_rate',
          value: 0.012, // 1.2% < 2% ✓
          recorded_at: new Date().toISOString(),
        },
        {
          metric_name: 'cost_delta',
          value: 0.0015, // 0.15% < 0.2% ✓
          recorded_at: new Date().toISOString(),
        },
        {
          metric_name: 'cost_delta',
          value: 0.0018, // 0.18% < 0.2% ✓
          recorded_at: new Date().toISOString(),
        },
        {
          metric_name: 'latency_p99',
          value: 420, // 420ms < 500ms ✓
          recorded_at: new Date().toISOString(),
        },
        {
          metric_name: 'latency_p99',
          value: 450, // 450ms < 500ms ✓
          recorded_at: new Date().toISOString(),
        },
      ];

      // Observation window: 30 minutes (1,800,000 ms)
      const observationDurationMs = 30 * 60 * 1000; // 30 min
      const elapsedDurationMs = 30 * 60 * 1000; // Fully elapsed

      // Act: Evaluate and decide
      const result = engine.evaluateAndDecide(
        'cohort-10pct',
        'proposal-v1',
        'assign-v1-123',
        criteria,
        observations,
        observationDurationMs,
        elapsedDurationMs
      );

      // Assert: Decision should be PROMOTE
      expect(result.success).toBe(true);
      expect(result.decision).toBeDefined();
      expect(result.decision?.decision).toBe('promote');
      expect(result.decision?.cohort_id).toBe('cohort-10pct');
      expect(result.decision?.proposal_id).toBe('proposal-v1');
      expect(result.decision?.assignment_id).toBe('assign-v1-123');

      // Verify metric aggregations
      expect(result.decision?.metrics).toHaveLength(3);
      const errorRateMetric = result.decision?.metrics.find(
        (m) => m.metric_name === 'error_rate'
      );
      expect(errorRateMetric?.status).toBe('pass');
      expect(errorRateMetric?.value).toBeCloseTo(0.011, 3); // Average of 0.01 and 0.012

      const costDeltaMetric = result.decision?.metrics.find(
        (m) => m.metric_name === 'cost_delta'
      );
      expect(costDeltaMetric?.status).toBe('pass');
      expect(costDeltaMetric?.value).toBeCloseTo(0.00165, 5);

      const latencyMetric = result.decision?.metrics.find(
        (m) => m.metric_name === 'latency_p99'
      );
      expect(latencyMetric?.status).toBe('pass');
      expect(latencyMetric?.value).toBeCloseTo(435, 0); // Average of 420 and 450

      // Verify reason
      expect(result.decision?.reason).toContain('All 3 metric(s) passed threshold');

      // Verify immutability
      expect(() => {
        (result.decision as any).decision = 'rollback';
      }).toThrow();

      // Verify stored in log
      const stored = engine.getDecision('cohort-10pct');
      expect(stored).toBeDefined();
      expect(stored?.decision).toBe('promote');
    });
  });

  describe('Rollback Scenario', () => {
    it('rolls back cohort when metric fails threshold, atomic across all cohorts', () => {
      // Arrange: Define metrics
      const criteria: MetricCriteria[] = [
        {
          metric_name: 'error_rate',
          operator: '<',
          threshold: 0.02, // 2%
        },
        {
          metric_name: 'cost_delta',
          operator: '<',
          threshold: 0.002, // 0.2%
        },
      ];

      // Observations: error_rate exceeds threshold (FAIL)
      const observations: MetricObservation[] = [
        {
          metric_name: 'error_rate',
          value: 0.065, // 6.5% > 2% ✗ (exceeds rollback threshold)
          recorded_at: new Date().toISOString(),
        },
        {
          metric_name: 'cost_delta',
          value: 0.0015, // 0.15% < 0.2% ✓
          recorded_at: new Date().toISOString(),
        },
      ];

      const observationDurationMs = 30 * 60 * 1000;
      const elapsedDurationMs = 30 * 60 * 1000;

      // Act: Evaluate first cohort (10%)
      const result1 = engine.evaluateAndDecide(
        'cohort-10pct',
        'proposal-v1',
        'assign-v1-10pct',
        criteria,
        observations,
        observationDurationMs,
        elapsedDurationMs
      );

      expect(result1.success).toBe(true);
      expect(result1.decision?.decision).toBe('rollback');

      // Simulate earlier decisions for sibling cohorts (25%, 50%)
      const result2 = engine.evaluateAndDecide(
        'cohort-25pct',
        'proposal-v1',
        'assign-v1-25pct',
        criteria,
        [
          {
            metric_name: 'error_rate',
            value: 0.015, // Would pass individually
            recorded_at: new Date().toISOString(),
          },
          {
            metric_name: 'cost_delta',
            value: 0.0018,
            recorded_at: new Date().toISOString(),
          },
        ],
        observationDurationMs,
        elapsedDurationMs
      );

      expect(result2.success).toBe(true);
      expect(result2.decision?.decision).toBe('promote');

      // Act: Perform atomic rollback on the proposal
      const rolledbackDecisions = engine.atomicRollback(
        'proposal-v1',
        'error_rate exceeded 2% threshold in 10% cohort'
      );

      // Assert: Rollback should cascade to all cohorts
      expect(rolledbackDecisions.length).toBeGreaterThan(0);

      // Verify rollback decisions created
      const cohort25Rollback = rolledbackDecisions.find(
        (d) => d.cohort_id === 'cohort-25pct'
      );
      expect(cohort25Rollback).toBeDefined();
      expect(cohort25Rollback?.decision).toBe('rollback');
      expect(cohort25Rollback?.reason).toContain('Atomic rollback');

      // Verify all proposal decisions include rollback
      const allDecisions = engine.getProposalDecisions('proposal-v1');
      expect(allDecisions.length).toBeGreaterThanOrEqual(2); // At least the initial decision + rollback

      const totalRollbacks = allDecisions.filter(
        (d) => d.decision === 'rollback'
      ).length;
      expect(totalRollbacks).toBeGreaterThanOrEqual(1);

      // Verify statistics
      const stats = engine.getStatistics();
      expect(stats.total).toBeGreaterThanOrEqual(3); // At least 3 decisions recorded
      expect(stats.rolledback).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Continue Scenario', () => {
    it('holds cohort when observation incomplete or metrics ambiguous, awaits more data', () => {
      // Arrange: Define metrics
      const criteria: MetricCriteria[] = [
        {
          metric_name: 'error_rate',
          operator: '<',
          threshold: 0.02, // 2%
        },
        {
          metric_name: 'cost_delta',
          operator: '<',
          threshold: 0.002, // 0.2%
        },
      ];

      // Scenario 1: Observation incomplete (only 15 min of 30 min elapsed)
      const observations: MetricObservation[] = [
        {
          metric_name: 'error_rate',
          value: 0.015, // Would pass (1.5% < 2%)
          recorded_at: new Date().toISOString(),
        },
        {
          metric_name: 'cost_delta',
          value: 0.0018, // Would pass (0.18% < 0.2%)
          recorded_at: new Date().toISOString(),
        },
      ];

      const observationDurationMs = 30 * 60 * 1000; // 30 min target
      const elapsedDurationMs = 15 * 60 * 1000; // Only 15 min elapsed

      // Act: Evaluate decision (incomplete window)
      const result = engine.evaluateAndDecide(
        'cohort-25pct',
        'proposal-v1',
        'assign-v1-25pct',
        criteria,
        observations,
        observationDurationMs,
        elapsedDurationMs
      );

      // Assert: Decision should be HOLD (awaiting more time)
      expect(result.success).toBe(true);
      expect(result.decision).toBeDefined();
      expect(result.decision?.decision).toBe('hold');
      expect(result.decision?.reason).toContain('Observation window incomplete');
      expect(result.decision?.reason).toContain('900000ms remaining'); // 15 min remaining in ms

      // Verify metrics are still calculated (for reference)
      const errorRateMetric = result.decision?.metrics.find(
        (m) => m.metric_name === 'error_rate'
      );
      expect(errorRateMetric?.value).toBe(0.015);
      expect(errorRateMetric?.status).toBe('pass'); // Individual status

      // Scenario 2: Metrics incomplete (no observations for one metric)
      const partialObservations: MetricObservation[] = [
        {
          metric_name: 'error_rate',
          value: 0.015,
          recorded_at: new Date().toISOString(),
        },
        // Missing cost_delta observations
      ];

      const result2 = engine.evaluateAndDecide(
        'cohort-50pct',
        'proposal-v2',
        'assign-v2-50pct',
        criteria,
        partialObservations,
        observationDurationMs,
        observationDurationMs // Observation window complete
      );

      // Assert: Decision should be HOLD (awaiting cost_delta data)
      expect(result2.success).toBe(true);
      expect(result2.decision?.decision).toBe('hold');
      expect(result2.decision?.reason).toContain('Metric collection incomplete');

      // Verify cost_delta metric marked incomplete
      const costMetric = result2.decision?.metrics.find(
        (m) => m.metric_name === 'cost_delta'
      );
      expect(costMetric?.status).toBe('incomplete');

      // Verify stored decisions
      const stored1 = engine.getDecision('cohort-25pct');
      expect(stored1?.decision).toBe('hold');

      const stored2 = engine.getDecision('cohort-50pct');
      expect(stored2?.decision).toBe('hold');

      // Verify statistics
      const stats = engine.getStatistics();
      expect(stats.held).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Edge Cases & Immutability', () => {
    it('prevents duplicate decisions on same cohort', () => {
      const criteria: MetricCriteria[] = [
        { metric_name: 'error_rate', operator: '<', threshold: 0.02 },
      ];

      const observations: MetricObservation[] = [
        { metric_name: 'error_rate', value: 0.01, recorded_at: new Date().toISOString() },
      ];

      // First decision should succeed
      const result1 = engine.evaluateAndDecide(
        'cohort-10pct',
        'proposal-v1',
        'assign-v1-123',
        criteria,
        observations,
        30 * 60 * 1000,
        30 * 60 * 1000
      );

      expect(result1.success).toBe(true);

      // Second decision on same cohort should fail
      const result2 = engine.evaluateAndDecide(
        'cohort-10pct',
        'proposal-v1',
        'assign-v1-123',
        criteria,
        observations,
        30 * 60 * 1000,
        30 * 60 * 1000
      );

      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Decision already recorded');
    });

    it('enforces immutability of CohortDecision records', () => {
      const criteria: MetricCriteria[] = [
        { metric_name: 'error_rate', operator: '<', threshold: 0.02 },
      ];

      const observations: MetricObservation[] = [
        { metric_name: 'error_rate', value: 0.01, recorded_at: new Date().toISOString() },
      ];

      const result = engine.evaluateAndDecide(
        'cohort-10pct',
        'proposal-v1',
        'assign-v1-123',
        criteria,
        observations,
        30 * 60 * 1000,
        30 * 60 * 1000
      );

      const decision = result.decision;
      expect(decision).toBeDefined();

      // Attempt to mutate decision
      expect(() => {
        (decision as any).decision = 'rollback';
      }).toThrow();

      expect(() => {
        (decision as any).reason = 'Modified';
      }).toThrow();

      // Verify original values unchanged
      expect(decision?.decision).toBe('promote');
    });

    it('handles empty observations gracefully', () => {
      const criteria: MetricCriteria[] = [
        { metric_name: 'error_rate', operator: '<', threshold: 0.02 },
      ];

      const result = engine.evaluateAndDecide(
        'cohort-10pct',
        'proposal-v1',
        'assign-v1-123',
        criteria,
        [], // Empty observations
        30 * 60 * 1000,
        30 * 60 * 1000
      );

      expect(result.success).toBe(true);
      expect(result.decision?.decision).toBe('hold');
      expect(result.decision?.reason).toContain('Metric collection incomplete');
    });

    it('validates threshold operators correctly', () => {
      // Test all threshold operators: <, >, <=, >=, ==, !=
      const testCases = [
        {
          operator: '<' as const,
          value: 0.015,
          threshold: 0.02,
          expectedPass: true,
        },
        {
          operator: '>' as const,
          value: 0.025,
          threshold: 0.02,
          expectedPass: true,
        },
        {
          operator: '<=' as const,
          value: 0.02,
          threshold: 0.02,
          expectedPass: true,
        },
        {
          operator: '>=' as const,
          value: 0.02,
          threshold: 0.02,
          expectedPass: true,
        },
        {
          operator: '==' as const,
          value: 0.02,
          threshold: 0.02,
          expectedPass: true,
        },
        {
          operator: '!=' as const,
          value: 0.015,
          threshold: 0.02,
          expectedPass: true,
        },
      ];

      for (const tc of testCases) {
        const result = engine.evaluateAndDecide(
          `cohort-${tc.operator}`,
          'proposal-ops',
          `assign-${tc.operator}`,
          [{ metric_name: 'test_metric', operator: tc.operator, threshold: tc.threshold }],
          [
            {
              metric_name: 'test_metric',
              value: tc.value,
              recorded_at: new Date().toISOString(),
            },
          ],
          30 * 60 * 1000,
          30 * 60 * 1000
        );

        expect(result.success).toBe(true);
        const metricStatus = result.decision?.metrics[0].status;
        expect(metricStatus).toBe(tc.expectedPass ? 'pass' : 'fail');
      }
    });
  });

  describe('Statistics & Audit Trail', () => {
    it('tracks decision statistics and audit trail', () => {
      const criteria: MetricCriteria[] = [
        { metric_name: 'error_rate', operator: '<', threshold: 0.02 },
      ];

      // Create multiple decisions
      const decisions = [
        {
          cohort: 'cohort-10pct',
          proposal: 'proposal-v1',
          assign: 'assign-1',
          observations: [
            { metric_name: 'error_rate', value: 0.01, recorded_at: new Date().toISOString() },
          ],
          elapsed: 30 * 60 * 1000, // Complete
        },
        {
          cohort: 'cohort-25pct',
          proposal: 'proposal-v2',
          assign: 'assign-2',
          observations: [
            { metric_name: 'error_rate', value: 0.065, recorded_at: new Date().toISOString() }, // Fail
          ],
          elapsed: 30 * 60 * 1000,
        },
        {
          cohort: 'cohort-50pct',
          proposal: 'proposal-v3',
          assign: 'assign-3',
          observations: [
            { metric_name: 'error_rate', value: 0.015, recorded_at: new Date().toISOString() },
          ],
          elapsed: 15 * 60 * 1000, // Incomplete
        },
      ];

      for (const d of decisions) {
        engine.evaluateAndDecide(
          d.cohort,
          d.proposal,
          d.assign,
          criteria,
          d.observations,
          30 * 60 * 1000,
          d.elapsed
        );
      }

      // Verify statistics
      const stats = engine.getStatistics();
      expect(stats.total).toBe(3);
      expect(stats.promoted).toBe(1);
      expect(stats.rolledback).toBe(1);
      expect(stats.held).toBe(1);

      // Verify audit trail
      const allDecisions = engine.getAllDecisions();
      expect(allDecisions.length).toBe(3);
      expect(allDecisions.every((d) => d.decided_at)).toBe(true);
    });
  });
});
