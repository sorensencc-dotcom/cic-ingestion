/**
 * Phase 5 A/B Testing E2E Flow
 * Comprehensive end-to-end implementation for variant rollout:
 * Variant Registration → Cohort Allocation → Metrics Collection → Promotion Decisions
 *
 * Data Flow:
 *   ABTestEngine (variant registration)
 *     → MultiCohortEngine (cohort allocation: 10% → 25% → 50% → 100%)
 *     → CustomMetricsEngine (observe + aggregate + threshold eval)
 *     → CohortPromotionEngine (decide: PROMOTE/ROLLBACK/CONTINUE)
 *     → GovernanceLog (audit trail)
 *
 * Test Coverage:
 * - single_variant: 1 variant through full 10%→25%→50%→100% rollout
 * - multiple_variants: 2+ variants in parallel, independent decisions
 * - rollback: Variant fails threshold → atomic revert all cohorts
 * - full_100_promotion: Complete end-to-end flow with all stages
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// ============================================================================
// Domain Models
// ============================================================================

interface CohortConfig {
  id: string;
  size: number; // 0.0-1.0 (10%, 25%, 50%, 100%)
  duration_minutes: number;
}

interface ABVariant {
  variant_id: string;
  name: string;
  description: string;
  treatment_config: Record<string, any>;
  created_at: number;
}

interface CohortAssignment {
  proposal_id: string;
  variant_id: string;
  cohort_id: string;
  cohort_size: number;
  assigned_at: number;
}

interface CustomMetric {
  name: string;
  type: 'gauge' | 'counter' | 'histogram';
  threshold: number;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  unit: string;
}

interface VariantMetrics {
  variant_id: string;
  cohort_id: string;
  custom_metrics: Record<string, number>;
  timestamp: number;
}

interface CohortDecision {
  proposal_id: string;
  variant_id: string;
  current_cohort: CohortConfig;
  next_cohort?: CohortConfig;
  decision: 'promote_cohort' | 'continue_observing' | 'rollback' | 'promote_all';
  reason: string;
  recommendation: string;
  timestamp: number;
}

interface GovernanceLogEntry {
  event_type: 'variant_registered' | 'cohort_assigned' | 'metrics_recorded' | 'promotion_decided' | 'rollback_initiated';
  proposal_id: string;
  variant_id: string;
  cohort_id?: string;
  data: Record<string, any>;
  timestamp: number;
}

// ============================================================================
// Components
// ============================================================================

/**
 * MultiCohortEngine: Manages cohort allocation and progression
 * Responsible for assigning variants to cohorts and tracking stage progression
 */
class MultiCohortEngine {
  private cohorts: Map<string, CohortConfig> = new Map();

  addCohort(cohort: CohortConfig): void {
    this.cohorts.set(cohort.id, cohort);
  }

  getCohorts(): CohortConfig[] {
    return Array.from(this.cohorts.values()).sort((a, b) => a.size - b.size);
  }

  getNextCohort(currentCohort: CohortConfig): CohortConfig | undefined {
    const cohorts = this.getCohorts();
    const idx = cohorts.findIndex((c) => c.id === currentCohort.id);
    return idx >= 0 && idx < cohorts.length - 1 ? cohorts[idx + 1] : undefined;
  }

  assignCohort(
    proposalId: string,
    variantId: string,
    cohortSize: number
  ): CohortAssignment {
    const cohorts = this.getCohorts();
    let targetCohort = cohorts[0];

    for (const cohort of cohorts) {
      if (Math.abs(cohort.size - cohortSize) < 0.01) {
        targetCohort = cohort;
        break;
      }
    }

    return {
      proposal_id: proposalId,
      variant_id: variantId,
      cohort_id: targetCohort.id,
      cohort_size: targetCohort.size,
      assigned_at: Date.now(),
    };
  }
}

/**
 * ABTestEngine: Variant registration and decision tree management
 * Tracks all registered variants and creates decision paths
 */
class ABTestEngine {
  private variants: Map<string, ABVariant> = new Map();

  registerVariant(variant: ABVariant): void {
    this.variants.set(variant.variant_id, variant);
  }

  getVariant(variantId: string): ABVariant | undefined {
    return this.variants.get(variantId);
  }

  listVariants(): ABVariant[] {
    return Array.from(this.variants.values());
  }

  createDecisionTree(proposalId: string): string {
    return `proposal:${proposalId}->variant->cohort->evaluate`;
  }
}

/**
 * CustomMetricsEngine: Metric registration and threshold evaluation
 * Collects observations, aggregates, and evaluates thresholds
 */
class CustomMetricsEngine {
  private metrics: Map<string, CustomMetric> = new Map();
  private observations: Map<string, VariantMetrics[]> = new Map();

  registerMetric(metric: CustomMetric): void {
    this.metrics.set(metric.name, metric);
  }

  recordObservation(observation: VariantMetrics): void {
    const key = `${observation.variant_id}:${observation.cohort_id}`;
    if (!this.observations.has(key)) {
      this.observations.set(key, []);
    }
    this.observations.get(key)!.push(observation);
  }

  evaluateThreshold(metricName: string, value: number): boolean {
    const metric = this.metrics.get(metricName);
    if (!metric) return true;

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

  getAggregateMetrics(variantId: string, cohortId: string): Record<string, number> {
    const key = `${variantId}:${cohortId}`;
    const observations = this.observations.get(key) || [];

    if (observations.length === 0) return {};

    const aggregate: Record<string, number> = {};
    const allMetricNames = new Set<string>();

    for (const obs of observations) {
      for (const [name, value] of Object.entries(obs.custom_metrics)) {
        allMetricNames.add(name);
        if (!aggregate[name]) aggregate[name] = 0;
        aggregate[name] += value;
      }
    }

    for (const name of Array.from(allMetricNames)) {
      aggregate[name] /= observations.length;
    }

    return aggregate;
  }

  allMetricsPass(variantId: string, cohortId: string): boolean {
    const aggregate = this.getAggregateMetrics(variantId, cohortId);

    for (const [name, value] of Object.entries(aggregate)) {
      if (!this.evaluateThreshold(name, value)) {
        return false;
      }
    }

    return true;
  }

  clearObservations(variantId: string): void {
    const keys = Array.from(this.observations.keys());
    for (const key of keys) {
      if (key.startsWith(`${variantId}:`)) {
        this.observations.delete(key);
      }
    }
  }
}

/**
 * CohortPromotionEngine: Decision logic for promotion/rollback/continue
 * Evaluates metrics and recommends next action
 */
class CohortPromotionEngine {
  evaluatePromotion(
    proposalId: string,
    variantId: string,
    currentCohort: CohortConfig,
    metricsPass: boolean,
    nextCohort?: CohortConfig
  ): CohortDecision {
    if (!metricsPass) {
      return {
        proposal_id: proposalId,
        variant_id: variantId,
        current_cohort: currentCohort,
        decision: 'rollback',
        reason: 'Custom metrics failed threshold evaluation',
        recommendation: 'Revert variant, analyze failure, resubmit',
        timestamp: Date.now(),
      };
    }

    if (nextCohort) {
      return {
        proposal_id: proposalId,
        variant_id: variantId,
        current_cohort: currentCohort,
        next_cohort: nextCohort,
        decision: 'promote_cohort',
        reason: `Metrics pass. Proceed to ${nextCohort.size * 100}% cohort.`,
        recommendation: `Scale from ${currentCohort.size * 100}% to ${nextCohort.size * 100}%`,
        timestamp: Date.now(),
      };
    }

    return {
      proposal_id: proposalId,
      variant_id: variantId,
      current_cohort: currentCohort,
      decision: 'promote_all',
      reason: 'Final cohort metrics pass. Promote to 100%.',
      recommendation: 'Roll out to all users',
      timestamp: Date.now(),
    };
  }
}

/**
 * GovernanceLog: Immutable audit trail of all decisions
 * Thread-safe append-only log for governance compliance
 */
class GovernanceLog {
  private entries: GovernanceLogEntry[] = [];

  record(entry: GovernanceLogEntry): void {
    this.entries.push({ ...entry, timestamp: Date.now() });
  }

  getEntries(proposalId?: string, variantId?: string): GovernanceLogEntry[] {
    return this.entries.filter(
      (e) =>
        (!proposalId || e.proposal_id === proposalId) &&
        (!variantId || e.variant_id === variantId)
    );
  }

  getByEventType(eventType: string): GovernanceLogEntry[] {
    return this.entries.filter((e) => e.event_type === eventType);
  }
}

// ============================================================================
// Tests: A/B Testing E2E Flows
// ============================================================================

describe('Phase 5: A/B Testing E2E Flow', () => {
  let multiCohortEngine: MultiCohortEngine;
  let abTestEngine: ABTestEngine;
  let metricsEngine: CustomMetricsEngine;
  let promotionEngine: CohortPromotionEngine;
  let governanceLog: GovernanceLog;

  beforeEach(() => {
    multiCohortEngine = new MultiCohortEngine();
    abTestEngine = new ABTestEngine();
    metricsEngine = new CustomMetricsEngine();
    promotionEngine = new CohortPromotionEngine();
    governanceLog = new GovernanceLog();

    // Setup standard cohorts: 10%, 25%, 50%, 100%
    multiCohortEngine.addCohort({
      id: 'cohort-10pct',
      size: 0.1,
      duration_minutes: 30,
    });
    multiCohortEngine.addCohort({
      id: 'cohort-25pct',
      size: 0.25,
      duration_minutes: 45,
    });
    multiCohortEngine.addCohort({
      id: 'cohort-50pct',
      size: 0.5,
      duration_minutes: 60,
    });
    multiCohortEngine.addCohort({
      id: 'cohort-100pct',
      size: 1.0,
      duration_minutes: 0,
    });

    // Register standard metrics
    metricsEngine.registerMetric({
      name: 'error_rate',
      type: 'gauge',
      threshold: 0.02,
      operator: '<',
      unit: 'ratio',
    });
    metricsEngine.registerMetric({
      name: 'cost_delta',
      type: 'gauge',
      threshold: 0.002,
      operator: '<',
      unit: 'ratio',
    });
    metricsEngine.registerMetric({
      name: 'latency_p99',
      type: 'gauge',
      threshold: 500,
      operator: '<',
      unit: 'ms',
    });
  });

  // ========================================================================
  // Test 1: Single Variant Full Rollout (10% → 25% → 50% → 100%)
  // ========================================================================

  describe('Test 1: Single Variant Full Rollout', () => {
    it('executes single variant through complete 10% → 25% → 50% → 100% promotion chain', () => {
      const proposalId = 'proposal-single-variant';
      const variantId = 'variant-optimized-v1';

      // Register variant
      const variant: ABVariant = {
        variant_id: variantId,
        name: 'Optimized Strategy V1',
        description: 'Single variant for full rollout test',
        treatment_config: { strategy: 'optimized', version: 1 },
        created_at: Date.now(),
      };

      abTestEngine.registerVariant(variant);
      governanceLog.record({
        event_type: 'variant_registered',
        proposal_id: proposalId,
        variant_id: variantId,
        data: { variant_name: variant.name },
        timestamp: Date.now(),
      });

      // Stage 1: 10% Cohort
      let assignment = multiCohortEngine.assignCohort(proposalId, variantId, 0.1);
      expect(assignment.cohort_size).toBe(0.1);

      governanceLog.record({
        event_type: 'cohort_assigned',
        proposal_id: proposalId,
        variant_id: variantId,
        cohort_id: assignment.cohort_id,
        data: { size: 0.1 },
        timestamp: Date.now(),
      });

      metricsEngine.recordObservation({
        variant_id: variantId,
        cohort_id: assignment.cohort_id,
        custom_metrics: {
          error_rate: 0.01,
          cost_delta: 0.001,
          latency_p99: 300,
        },
        timestamp: Date.now(),
      });

      let pass = metricsEngine.allMetricsPass(variantId, assignment.cohort_id);
      expect(pass).toBe(true);

      let currentCohort = {
        id: assignment.cohort_id,
        size: 0.1,
        duration_minutes: 30,
      };
      let nextCohort = multiCohortEngine.getNextCohort(currentCohort);
      let decision = promotionEngine.evaluatePromotion(
        proposalId,
        variantId,
        currentCohort,
        pass,
        nextCohort
      );
      expect(decision.decision).toBe('promote_cohort');
      expect(decision.next_cohort?.size).toBe(0.25);

      governanceLog.record({
        event_type: 'promotion_decided',
        proposal_id: proposalId,
        variant_id: variantId,
        cohort_id: assignment.cohort_id,
        data: { decision: decision.decision, reason: decision.reason },
        timestamp: Date.now(),
      });

      // Stage 2: 25% Cohort
      assignment = multiCohortEngine.assignCohort(proposalId, variantId, 0.25);
      expect(assignment.cohort_size).toBe(0.25);

      governanceLog.record({
        event_type: 'cohort_assigned',
        proposal_id: proposalId,
        variant_id: variantId,
        cohort_id: assignment.cohort_id,
        data: { size: 0.25 },
        timestamp: Date.now(),
      });

      metricsEngine.recordObservation({
        variant_id: variantId,
        cohort_id: assignment.cohort_id,
        custom_metrics: {
          error_rate: 0.012,
          cost_delta: 0.0012,
          latency_p99: 320,
        },
        timestamp: Date.now(),
      });

      pass = metricsEngine.allMetricsPass(variantId, assignment.cohort_id);
      expect(pass).toBe(true);

      currentCohort = {
        id: assignment.cohort_id,
        size: 0.25,
        duration_minutes: 45,
      };
      nextCohort = multiCohortEngine.getNextCohort(currentCohort);
      decision = promotionEngine.evaluatePromotion(
        proposalId,
        variantId,
        currentCohort,
        pass,
        nextCohort
      );
      expect(decision.decision).toBe('promote_cohort');
      expect(decision.next_cohort?.size).toBe(0.5);

      governanceLog.record({
        event_type: 'promotion_decided',
        proposal_id: proposalId,
        variant_id: variantId,
        cohort_id: assignment.cohort_id,
        data: { decision: decision.decision, reason: decision.reason },
        timestamp: Date.now(),
      });

      // Stage 3: 50% Cohort
      assignment = multiCohortEngine.assignCohort(proposalId, variantId, 0.5);
      expect(assignment.cohort_size).toBe(0.5);

      governanceLog.record({
        event_type: 'cohort_assigned',
        proposal_id: proposalId,
        variant_id: variantId,
        cohort_id: assignment.cohort_id,
        data: { size: 0.5 },
        timestamp: Date.now(),
      });

      metricsEngine.recordObservation({
        variant_id: variantId,
        cohort_id: assignment.cohort_id,
        custom_metrics: {
          error_rate: 0.015,
          cost_delta: 0.0018,
          latency_p99: 350,
        },
        timestamp: Date.now(),
      });

      pass = metricsEngine.allMetricsPass(variantId, assignment.cohort_id);
      expect(pass).toBe(true);

      currentCohort = {
        id: assignment.cohort_id,
        size: 0.5,
        duration_minutes: 60,
      };
      nextCohort = multiCohortEngine.getNextCohort(currentCohort);
      decision = promotionEngine.evaluatePromotion(
        proposalId,
        variantId,
        currentCohort,
        pass,
        nextCohort
      );
      expect(decision.decision).toBe('promote_cohort');
      expect(decision.next_cohort?.size).toBe(1.0);

      governanceLog.record({
        event_type: 'promotion_decided',
        proposal_id: proposalId,
        variant_id: variantId,
        cohort_id: assignment.cohort_id,
        data: { decision: decision.decision, reason: decision.reason },
        timestamp: Date.now(),
      });

      // Stage 4: 100% (Final)
      assignment = multiCohortEngine.assignCohort(proposalId, variantId, 1.0);
      expect(assignment.cohort_size).toBe(1.0);

      governanceLog.record({
        event_type: 'cohort_assigned',
        proposal_id: proposalId,
        variant_id: variantId,
        cohort_id: assignment.cohort_id,
        data: { size: 1.0 },
        timestamp: Date.now(),
      });

      metricsEngine.recordObservation({
        variant_id: variantId,
        cohort_id: assignment.cohort_id,
        custom_metrics: {
          error_rate: 0.018,
          cost_delta: 0.002,
          latency_p99: 400,
        },
        timestamp: Date.now(),
      });

      pass = metricsEngine.allMetricsPass(variantId, assignment.cohort_id);
      expect(pass).toBe(true);

      currentCohort = {
        id: assignment.cohort_id,
        size: 1.0,
        duration_minutes: 0,
      };
      nextCohort = multiCohortEngine.getNextCohort(currentCohort);
      decision = promotionEngine.evaluatePromotion(
        proposalId,
        variantId,
        currentCohort,
        pass,
        nextCohort
      );
      expect(decision.decision).toBe('promote_all');
      expect(decision.recommendation).toContain('Roll out to all users');

      governanceLog.record({
        event_type: 'promotion_decided',
        proposal_id: proposalId,
        variant_id: variantId,
        cohort_id: assignment.cohort_id,
        data: { decision: decision.decision, reason: decision.reason },
        timestamp: Date.now(),
      });

      // Verify audit trail
      const entries = governanceLog.getEntries(proposalId, variantId);
      expect(entries.length).toBeGreaterThan(0);
      const promotionDecisions = entries.filter((e) => e.event_type === 'promotion_decided');
      expect(promotionDecisions.length).toBe(4); // One per stage
    });
  });

  // ========================================================================
  // Test 2: Multiple Variants Parallel (Independent Cohort Decisions)
  // ========================================================================

  describe('Test 2: Multiple Variants Parallel Rollout', () => {
    it('executes multiple variants in parallel with independent promotion decisions', () => {
      const proposalIds = ['proposal-variant-a', 'proposal-variant-b'];
      const variantIds = ['variant-a-optimized', 'variant-b-optimized'];

      // Register both variants
      for (let i = 0; i < 2; i++) {
        const variant: ABVariant = {
          variant_id: variantIds[i],
          name: `Variant ${String.fromCharCode(65 + i)}`,
          description: `Variant ${String.fromCharCode(65 + i)} for parallel testing`,
          treatment_config: { strategy: `strategy-${i}`, variant_index: i },
          created_at: Date.now(),
        };

        abTestEngine.registerVariant(variant);
        governanceLog.record({
          event_type: 'variant_registered',
          proposal_id: proposalIds[i],
          variant_id: variantIds[i],
          data: { variant_name: variant.name },
          timestamp: Date.now(),
        });
      }

      // Assign both to 10% cohort
      const assignments = [];
      for (let i = 0; i < 2; i++) {
        const assignment = multiCohortEngine.assignCohort(
          proposalIds[i],
          variantIds[i],
          0.1
        );
        assignments.push(assignment);
        expect(assignment.cohort_size).toBe(0.1);

        governanceLog.record({
          event_type: 'cohort_assigned',
          proposal_id: proposalIds[i],
          variant_id: variantIds[i],
          cohort_id: assignment.cohort_id,
          data: { size: 0.1 },
          timestamp: Date.now(),
        });
      }

      // Variant A: Good metrics (should promote)
      metricsEngine.recordObservation({
        variant_id: variantIds[0],
        cohort_id: assignments[0].cohort_id,
        custom_metrics: {
          error_rate: 0.01,
          cost_delta: 0.001,
          latency_p99: 300,
        },
        timestamp: Date.now(),
      });

      // Variant B: Bad metrics (should rollback)
      metricsEngine.recordObservation({
        variant_id: variantIds[1],
        cohort_id: assignments[1].cohort_id,
        custom_metrics: {
          error_rate: 0.05, // Exceeds threshold
          cost_delta: 0.001,
          latency_p99: 300,
        },
        timestamp: Date.now(),
      });

      // Evaluate both
      const passA = metricsEngine.allMetricsPass(variantIds[0], assignments[0].cohort_id);
      const passB = metricsEngine.allMetricsPass(variantIds[1], assignments[1].cohort_id);

      expect(passA).toBe(true);
      expect(passB).toBe(false);

      // Decision A: promote
      const currentCohortA = {
        id: assignments[0].cohort_id,
        size: 0.1,
        duration_minutes: 30,
      };
      const nextCohortA = multiCohortEngine.getNextCohort(currentCohortA);
      const decisionA = promotionEngine.evaluatePromotion(
        proposalIds[0],
        variantIds[0],
        currentCohortA,
        passA,
        nextCohortA
      );
      expect(decisionA.decision).toBe('promote_cohort');

      // Decision B: rollback
      const currentCohortB = {
        id: assignments[1].cohort_id,
        size: 0.1,
        duration_minutes: 30,
      };
      const decisionB = promotionEngine.evaluatePromotion(
        proposalIds[1],
        variantIds[1],
        currentCohortB,
        passB,
        undefined
      );
      expect(decisionB.decision).toBe('rollback');

      governanceLog.record({
        event_type: 'promotion_decided',
        proposal_id: proposalIds[0],
        variant_id: variantIds[0],
        cohort_id: assignments[0].cohort_id,
        data: { decision: decisionA.decision },
        timestamp: Date.now(),
      });

      governanceLog.record({
        event_type: 'promotion_decided',
        proposal_id: proposalIds[1],
        variant_id: variantIds[1],
        cohort_id: assignments[1].cohort_id,
        data: { decision: decisionB.decision },
        timestamp: Date.now(),
      });

      // Verify independent decisions are recorded
      const entriesA = governanceLog.getEntries(proposalIds[0], variantIds[0]);
      const entriesB = governanceLog.getEntries(proposalIds[1], variantIds[1]);

      expect(entriesA.length).toBeGreaterThan(0);
      expect(entriesB.length).toBeGreaterThan(0);

      const decisionEntriesA = entriesA.filter((e) => e.event_type === 'promotion_decided');
      const decisionEntriesB = entriesB.filter((e) => e.event_type === 'promotion_decided');

      expect(decisionEntriesA[0].data.decision).toBe('promote_cohort');
      expect(decisionEntriesB[0].data.decision).toBe('rollback');
    });
  });

  // ========================================================================
  // Test 3: Rollback Flow (Variant Fails → Atomic Revert All Cohorts)
  // ========================================================================

  describe('Test 3: Rollback on Metric Failure', () => {
    it('initiates rollback when variant fails threshold, atomically reverts all cohorts', () => {
      const proposalId = 'proposal-rollback-test';
      const variantId = 'variant-rollback-failure';

      // Register variant
      const variant: ABVariant = {
        variant_id: variantId,
        name: 'Variant With Rollback',
        description: 'Variant that will fail and rollback',
        treatment_config: { risky_strategy: true },
        created_at: Date.now(),
      };

      abTestEngine.registerVariant(variant);
      governanceLog.record({
        event_type: 'variant_registered',
        proposal_id: proposalId,
        variant_id: variantId,
        data: { variant_name: variant.name },
        timestamp: Date.now(),
      });

      // Stage 1: 10% - Success
      let assignment = multiCohortEngine.assignCohort(proposalId, variantId, 0.1);
      governanceLog.record({
        event_type: 'cohort_assigned',
        proposal_id: proposalId,
        variant_id: variantId,
        cohort_id: assignment.cohort_id,
        data: { size: 0.1 },
        timestamp: Date.now(),
      });

      metricsEngine.recordObservation({
        variant_id: variantId,
        cohort_id: assignment.cohort_id,
        custom_metrics: {
          error_rate: 0.01,
          cost_delta: 0.001,
          latency_p99: 300,
        },
        timestamp: Date.now(),
      });

      let pass = metricsEngine.allMetricsPass(variantId, assignment.cohort_id);
      expect(pass).toBe(true);

      // Promote to 25%
      let currentCohort = {
        id: assignment.cohort_id,
        size: 0.1,
        duration_minutes: 30,
      };
      let nextCohort = multiCohortEngine.getNextCohort(currentCohort);
      let decision = promotionEngine.evaluatePromotion(
        proposalId,
        variantId,
        currentCohort,
        pass,
        nextCohort
      );
      expect(decision.decision).toBe('promote_cohort');

      governanceLog.record({
        event_type: 'promotion_decided',
        proposal_id: proposalId,
        variant_id: variantId,
        cohort_id: assignment.cohort_id,
        data: { decision: decision.decision },
        timestamp: Date.now(),
      });

      // Stage 2: 25% - Failure
      assignment = multiCohortEngine.assignCohort(proposalId, variantId, 0.25);
      governanceLog.record({
        event_type: 'cohort_assigned',
        proposal_id: proposalId,
        variant_id: variantId,
        cohort_id: assignment.cohort_id,
        data: { size: 0.25 },
        timestamp: Date.now(),
      });

      metricsEngine.recordObservation({
        variant_id: variantId,
        cohort_id: assignment.cohort_id,
        custom_metrics: {
          error_rate: 0.08, // FAIL: exceeds 0.02 threshold
          cost_delta: 0.001,
          latency_p99: 300,
        },
        timestamp: Date.now(),
      });

      pass = metricsEngine.allMetricsPass(variantId, assignment.cohort_id);
      expect(pass).toBe(false);

      // Rollback decision
      currentCohort = {
        id: assignment.cohort_id,
        size: 0.25,
        duration_minutes: 45,
      };

      decision = promotionEngine.evaluatePromotion(
        proposalId,
        variantId,
        currentCohort,
        pass,
        undefined
      );
      expect(decision.decision).toBe('rollback');
      expect(decision.reason).toContain('metrics failed');

      governanceLog.record({
        event_type: 'rollback_initiated',
        proposal_id: proposalId,
        variant_id: variantId,
        cohort_id: assignment.cohort_id,
        data: {
          decision: decision.decision,
          reason: decision.reason,
          failed_at_stage: 0.25,
        },
        timestamp: Date.now(),
      });

      // Clear all observations for this variant (atomic revert)
      metricsEngine.clearObservations(variantId);

      // Verify all cohort data cleared
      const cohort10Agg = metricsEngine.getAggregateMetrics(variantId, 'cohort-10pct');
      const cohort25Agg = metricsEngine.getAggregateMetrics(variantId, 'cohort-25pct');

      expect(cohort10Agg).toEqual({});
      expect(cohort25Agg).toEqual({});

      // Verify rollback logged
      const entries = governanceLog.getEntries(proposalId, variantId);
      const rollbackEntries = entries.filter((e) => e.event_type === 'rollback_initiated');
      expect(rollbackEntries.length).toBe(1);
      expect(rollbackEntries[0].data.failed_at_stage).toBe(0.25);
    });
  });

  // ========================================================================
  // Test 4: Full 100% Promotion (Complete End-to-End Flow)
  // ========================================================================

  describe('Test 4: Full 100% Promotion End-to-End', () => {
    it('completes full variant promotion flow through all four cohort stages to 100%', () => {
      const proposalId = 'proposal-full-100';
      const variantId = 'variant-full-promotion';

      // Register variant
      const variant: ABVariant = {
        variant_id: variantId,
        name: 'Full Promotion Variant',
        description: 'Complete end-to-end flow to 100% rollout',
        treatment_config: { full_rollout: true },
        created_at: Date.now(),
      };

      abTestEngine.registerVariant(variant);
      governanceLog.record({
        event_type: 'variant_registered',
        proposal_id: proposalId,
        variant_id: variantId,
        data: { variant_name: variant.name },
        timestamp: Date.now(),
      });

      const stages = [
        { size: 0.1, metrics: { error_rate: 0.01, cost_delta: 0.001, latency_p99: 300 } },
        { size: 0.25, metrics: { error_rate: 0.012, cost_delta: 0.0012, latency_p99: 320 } },
        { size: 0.5, metrics: { error_rate: 0.015, cost_delta: 0.0018, latency_p99: 350 } },
        { size: 1.0, metrics: { error_rate: 0.018, cost_delta: 0.002, latency_p99: 400 } },
      ];

      let lastAssignment;

      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];

        // Assign to cohort
        const assignment = multiCohortEngine.assignCohort(proposalId, variantId, stage.size);
        expect(assignment.cohort_size).toBe(stage.size);

        governanceLog.record({
          event_type: 'cohort_assigned',
          proposal_id: proposalId,
          variant_id: variantId,
          cohort_id: assignment.cohort_id,
          data: { size: stage.size, stage_index: i },
          timestamp: Date.now(),
        });

        // Record metrics
        metricsEngine.recordObservation({
          variant_id: variantId,
          cohort_id: assignment.cohort_id,
          custom_metrics: stage.metrics,
          timestamp: Date.now(),
        });

        // Evaluate
        const pass = metricsEngine.allMetricsPass(variantId, assignment.cohort_id);
        expect(pass).toBe(true);

        // Promote or finalize
        const currentCohort = {
          id: assignment.cohort_id,
          size: stage.size,
          duration_minutes: stage.size === 1.0 ? 0 : stage.size * 100 + 10,
        };

        const nextCohort = multiCohortEngine.getNextCohort(currentCohort);
        const decision = promotionEngine.evaluatePromotion(
          proposalId,
          variantId,
          currentCohort,
          pass,
          nextCohort
        );

        if (i < stages.length - 1) {
          expect(decision.decision).toBe('promote_cohort');
          expect(decision.next_cohort?.size).toBe(stages[i + 1].size);
        } else {
          expect(decision.decision).toBe('promote_all');
        }

        governanceLog.record({
          event_type: 'promotion_decided',
          proposal_id: proposalId,
          variant_id: variantId,
          cohort_id: assignment.cohort_id,
          data: {
            stage_index: i,
            decision: decision.decision,
            stage_size: stage.size,
          },
          timestamp: Date.now(),
        });

        lastAssignment = assignment;
      }

      // Final verification
      expect(lastAssignment!.cohort_size).toBe(1.0);

      const entries = governanceLog.getEntries(proposalId, variantId);
      expect(entries.length).toBeGreaterThan(0);

      const promotions = entries.filter((e) => e.event_type === 'promotion_decided');
      expect(promotions.length).toBe(4);

      // Last promotion should be promote_all
      const lastPromotion = promotions[promotions.length - 1];
      expect(lastPromotion.data.decision).toBe('promote_all');
      expect(lastPromotion.data.stage_size).toBe(1.0);
    });
  });
});
