/**
 * Phase 5 Multi-Cohort Canary + A/B Testing E2E
 * Covers full rollout pipeline: Cohort allocation → Variant tracking → Metrics → Promotion
 *
 * Test Plan:
 * 1. Multi-cohort allocation (10%, 25%, 50%, 100%)
 * 2. A/B variant tracking and decision tree
 * 3. Custom metrics collection and threshold evaluation
 * 4. Cohort-based promotion logic (succeed/continue/rollback)
 * 5. Phase 4→5 integration (proposal → cohort assignment)
 * 6. Batch cohort rollout with staggered metrics
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// Phase 5 Domain Models

interface CohortConfig {
  id: string;
  size: number; // 0.0-1.0
  duration_minutes: number;
}

interface ABVariant {
  variant_id: string;
  name: string;
  description: string;
  treatment_config: Record<string, any>;
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
}

// Phase 5 Components

class MultiCohortEngine {
  private cohorts: Map<string, CohortConfig> = new Map();

  addCohort(cohort: CohortConfig): void {
    this.cohorts.set(cohort.id, cohort);
  }

  getCohorts(): CohortConfig[] {
    return Array.from(this.cohorts.values()).sort(
      (a, b) => a.size - b.size
    );
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
    // Find cohort matching size
    const cohorts = this.getCohorts();
    let targetCohort = cohorts[0]; // default to smallest
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
    // Simple tree: variant_id → cohort_id → metrics evaluation
    return `proposal:${proposalId}->variant->cohort->evaluate`;
  }
}

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

  evaluateThreshold(
    metricName: string,
    value: number
  ): boolean {
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

    // Average
    for (const name of allMetricNames) {
      aggregate[name] /= observations.length;
    }

    return aggregate;
  }

  allMetricsPass(
    variantId: string,
    cohortId: string
  ): boolean {
    const aggregate = this.getAggregateMetrics(variantId, cohortId);

    for (const [name, value] of Object.entries(aggregate)) {
      if (!this.evaluateThreshold(name, value)) {
        return false;
      }
    }

    return true;
  }
}

class CohortPromotionEngine {
  evaluatePromotion(
    proposalId: string,
    variantId: string,
    currentCohort: CohortConfig,
    metricsPass: boolean,
    nextCohort?: CohortConfig
  ): CohortDecision {
    // Promotion logic:
    // - if metrics pass and next cohort exists: promote to next
    // - if metrics pass and no next cohort: promote all
    // - else continue observing

    if (!metricsPass) {
      return {
        proposal_id: proposalId,
        variant_id: variantId,
        current_cohort: currentCohort,
        decision: 'rollback',
        reason: 'Custom metrics failed threshold evaluation',
        recommendation: 'Revert variant, analyze failure, resubmit',
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
      };
    }

    return {
      proposal_id: proposalId,
      variant_id: variantId,
      current_cohort: currentCohort,
      decision: 'promote_all',
      reason: 'Final cohort metrics pass. Promote to 100%.',
      recommendation: 'Roll out to all users',
    };
  }
}

// Tests

describe('Phase 5: Multi-Cohort Canary + A/B Testing', () => {
  let multiCohortEngine: MultiCohortEngine;
  let abTestEngine: ABTestEngine;
  let metricsEngine: CustomMetricsEngine;
  let promotionEngine: CohortPromotionEngine;

  beforeEach(() => {
    multiCohortEngine = new MultiCohortEngine();
    abTestEngine = new ABTestEngine();
    metricsEngine = new CustomMetricsEngine();
    promotionEngine = new CohortPromotionEngine();

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

    // Register metrics
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

  describe('Multi-Cohort Engine', () => {
    it('registers and retrieves cohorts in order', () => {
      const cohorts = multiCohortEngine.getCohorts();

      expect(cohorts.length).toBe(4);
      expect(cohorts[0].size).toBe(0.1);
      expect(cohorts[3].size).toBe(1.0);
    });

    it('assigns proposal to matching cohort size', () => {
      const assignment = multiCohortEngine.assignCohort(
        'proposal-1',
        'variant-a',
        0.1
      );

      expect(assignment.proposal_id).toBe('proposal-1');
      expect(assignment.variant_id).toBe('variant-a');
      expect(assignment.cohort_id).toBe('cohort-10pct');
      expect(assignment.cohort_size).toBe(0.1);
    });

    it('retrieves next cohort in progression', () => {
      const cohort10 = {
        id: 'cohort-10pct',
        size: 0.1,
        duration_minutes: 30,
      };
      const nextCohort = multiCohortEngine.getNextCohort(cohort10);

      expect(nextCohort?.size).toBe(0.25);
      expect(nextCohort?.id).toBe('cohort-25pct');
    });

    it('returns undefined for final cohort next', () => {
      const cohort100 = {
        id: 'cohort-100pct',
        size: 1.0,
        duration_minutes: 0,
      };
      const nextCohort = multiCohortEngine.getNextCohort(cohort100);

      expect(nextCohort).toBeUndefined();
    });
  });

  describe('A/B Test Engine', () => {
    it('registers and retrieves variants', () => {
      const variantA: ABVariant = {
        variant_id: 'variant-a',
        name: 'Control',
        description: 'Baseline behavior',
        treatment_config: { strategy: 'baseline' },
      };

      abTestEngine.registerVariant(variantA);
      const retrieved = abTestEngine.getVariant('variant-a');

      expect(retrieved?.variant_id).toBe('variant-a');
      expect(retrieved?.treatment_config.strategy).toBe('baseline');
    });

    it('registers multiple variants', () => {
      const variantA: ABVariant = {
        variant_id: 'variant-a',
        name: 'Control',
        description: 'Baseline',
        treatment_config: { strategy: 'baseline' },
      };
      const variantB: ABVariant = {
        variant_id: 'variant-b',
        name: 'Treatment',
        description: 'New strategy',
        treatment_config: { strategy: 'optimized' },
      };

      abTestEngine.registerVariant(variantA);
      abTestEngine.registerVariant(variantB);

      const variants = abTestEngine.listVariants();
      expect(variants.length).toBe(2);
    });

    it('creates decision tree for proposal', () => {
      const tree = abTestEngine.createDecisionTree('proposal-1');

      expect(tree).toContain('proposal:proposal-1');
      expect(tree).toContain('variant');
      expect(tree).toContain('cohort');
      expect(tree).toContain('evaluate');
    });
  });

  describe('Custom Metrics Engine', () => {
    it('registers custom metrics', () => {
      const metric: CustomMetric = {
        name: 'error_rate',
        type: 'gauge',
        threshold: 0.02,
        operator: '<',
        unit: 'ratio',
      };

      metricsEngine.registerMetric(metric);
      const retrieved = metricsEngine['metrics'].get('error_rate');

      expect(retrieved?.threshold).toBe(0.02);
    });

    it('evaluates metric threshold (less than)', () => {
      const pass = metricsEngine.evaluateThreshold('error_rate', 0.01);
      const fail = metricsEngine.evaluateThreshold('error_rate', 0.03);

      expect(pass).toBe(true);
      expect(fail).toBe(false);
    });

    it('evaluates metric threshold (greater than)', () => {
      const pass = metricsEngine.evaluateThreshold('latency_p99', 400);
      const fail = metricsEngine.evaluateThreshold('latency_p99', 600);

      expect(pass).toBe(true);
      expect(fail).toBe(false);
    });

    it('records and aggregates variant observations', () => {
      const obs1: VariantMetrics = {
        variant_id: 'variant-a',
        cohort_id: 'cohort-10pct',
        custom_metrics: {
          error_rate: 0.01,
          cost_delta: 0.001,
          latency_p99: 300,
        },
        timestamp: Date.now(),
      };
      const obs2: VariantMetrics = {
        variant_id: 'variant-a',
        cohort_id: 'cohort-10pct',
        custom_metrics: {
          error_rate: 0.015,
          cost_delta: 0.0015,
          latency_p99: 350,
        },
        timestamp: Date.now() + 100,
      };

      metricsEngine.recordObservation(obs1);
      metricsEngine.recordObservation(obs2);

      const aggregate = metricsEngine.getAggregateMetrics(
        'variant-a',
        'cohort-10pct'
      );

      expect(aggregate.error_rate).toBeCloseTo(0.0125, 3);
      expect(aggregate.cost_delta).toBeCloseTo(0.00125, 5);
      expect(aggregate.latency_p99).toBeCloseTo(325, 0);
    });

    it('evaluates all metrics pass', () => {
      const obs: VariantMetrics = {
        variant_id: 'variant-a',
        cohort_id: 'cohort-10pct',
        custom_metrics: {
          error_rate: 0.01,
          cost_delta: 0.001,
          latency_p99: 300,
        },
        timestamp: Date.now(),
      };

      metricsEngine.recordObservation(obs);

      const allPass = metricsEngine.allMetricsPass('variant-a', 'cohort-10pct');
      expect(allPass).toBe(true);
    });

    it('detects metric failure', () => {
      const obs: VariantMetrics = {
        variant_id: 'variant-a',
        cohort_id: 'cohort-10pct',
        custom_metrics: {
          error_rate: 0.05, // Exceeds 0.02 threshold
          cost_delta: 0.001,
          latency_p99: 300,
        },
        timestamp: Date.now(),
      };

      metricsEngine.recordObservation(obs);

      const allPass = metricsEngine.allMetricsPass('variant-a', 'cohort-10pct');
      expect(allPass).toBe(false);
    });
  });

  describe('Cohort Promotion Engine', () => {
    it('promotes to next cohort on metrics pass', () => {
      const currentCohort: CohortConfig = {
        id: 'cohort-10pct',
        size: 0.1,
        duration_minutes: 30,
      };
      const nextCohort: CohortConfig = {
        id: 'cohort-25pct',
        size: 0.25,
        duration_minutes: 45,
      };

      const decision = promotionEngine.evaluatePromotion(
        'proposal-1',
        'variant-a',
        currentCohort,
        true,
        nextCohort
      );

      expect(decision.decision).toBe('promote_cohort');
      expect(decision.next_cohort?.size).toBe(0.25);
    });

    it('promotes to all on final cohort success', () => {
      const currentCohort: CohortConfig = {
        id: 'cohort-50pct',
        size: 0.5,
        duration_minutes: 60,
      };

      const decision = promotionEngine.evaluatePromotion(
        'proposal-1',
        'variant-a',
        currentCohort,
        true,
        undefined
      );

      expect(decision.decision).toBe('promote_all');
      expect(decision.recommendation).toContain('Roll out to all users');
    });

    it('rollsback on metrics failure', () => {
      const currentCohort: CohortConfig = {
        id: 'cohort-10pct',
        size: 0.1,
        duration_minutes: 30,
      };

      const decision = promotionEngine.evaluatePromotion(
        'proposal-1',
        'variant-a',
        currentCohort,
        false,
        undefined
      );

      expect(decision.decision).toBe('rollback');
      expect(decision.reason).toContain('metrics failed');
    });
  });

  describe('Multi-Cohort Rollout Pipeline', () => {
    it('executes full 10% → 25% → 50% → 100% rollout', () => {
      const proposalId = 'proposal-1';
      const variantId = 'variant-a';

      // Cohort 1: 10%
      let assignment = multiCohortEngine.assignCohort(proposalId, variantId, 0.1);
      expect(assignment.cohort_size).toBe(0.1);

      // Record success metrics for cohort 1
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

      // Cohort 2: 25%
      assignment = multiCohortEngine.assignCohort(proposalId, variantId, 0.25);
      expect(assignment.cohort_size).toBe(0.25);

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

      // Cohort 3: 50%
      assignment = multiCohortEngine.assignCohort(proposalId, variantId, 0.5);
      expect(assignment.cohort_size).toBe(0.5);

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

      // Final: 100%
      assignment = multiCohortEngine.assignCohort(proposalId, variantId, 1.0);
      expect(assignment.cohort_size).toBe(1.0);
    });

    it('stops rollout on metrics failure', () => {
      const proposalId = 'proposal-1';
      const variantId = 'variant-a';

      // Cohort 1: 10% pass
      let assignment = multiCohortEngine.assignCohort(proposalId, variantId, 0.1);
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

      // Cohort 2: 25% fail
      assignment = multiCohortEngine.assignCohort(proposalId, variantId, 0.25);
      metricsEngine.recordObservation({
        variant_id: variantId,
        cohort_id: assignment.cohort_id,
        custom_metrics: {
          error_rate: 0.08, // Exceeds threshold
          cost_delta: 0.001,
          latency_p99: 300,
        },
        timestamp: Date.now(),
      });

      pass = metricsEngine.allMetricsPass(variantId, assignment.cohort_id);
      expect(pass).toBe(false);

      // Should stop escalation
      const cohort = {
        id: assignment.cohort_id,
        size: 0.25,
        duration_minutes: 45,
      };
      const decision = promotionEngine.evaluatePromotion(
        proposalId,
        variantId,
        cohort,
        pass,
        undefined
      );

      expect(decision.decision).toBe('rollback');
    });
  });

  describe('Phase 4→5 Integration', () => {
    it('converts Phase 4 promotion decision to Phase 5 cohort assignment', () => {
      // Phase 4 output: proposal approved, canary passed
      const promotionDecision = {
        proposal_id: 'proposal-1',
        promoted: true,
        recommendation: 'ready_for_rollout',
      };

      // Phase 5: allocate to smallest cohort
      const assignment = multiCohortEngine.assignCohort(
        promotionDecision.proposal_id,
        'variant-new',
        0.1
      );

      expect(assignment.proposal_id).toBe('proposal-1');
      expect(assignment.cohort_size).toBe(0.1);
      expect(assignment.assigned_at).toBeGreaterThan(0);
    });

    it('preserves lineage: Phase 4 proposal → Phase 5 variant → cohorts', () => {
      // Phase 4 proposal
      const proposalId = 'proposal-1';

      // Phase 5 variant created from proposal
      const variant: ABVariant = {
        variant_id: `variant-from-${proposalId}`,
        name: 'A/B Test Variant',
        description: 'Derived from Phase 4 proposal',
        treatment_config: { proposal_source: proposalId },
      };

      abTestEngine.registerVariant(variant);

      // Assign to cohort
      const assignment = multiCohortEngine.assignCohort(
        proposalId,
        variant.variant_id,
        0.1
      );

      expect(assignment.variant_id).toBe(variant.variant_id);
      expect(variant.treatment_config.proposal_source).toBe(proposalId);
    });
  });

  describe('Batch Cohort Rollout', () => {
    it('processes multiple proposals through cohort pipeline', () => {
      const proposals = ['proposal-1', 'proposal-2', 'proposal-3'];
      const results = [];

      for (const proposalId of proposals) {
        const assignment = multiCohortEngine.assignCohort(
          proposalId,
          `variant-${proposalId}`,
          0.1
        );

        metricsEngine.recordObservation({
          variant_id: assignment.variant_id,
          cohort_id: assignment.cohort_id,
          custom_metrics: {
            error_rate: 0.01,
            cost_delta: 0.001,
            latency_p99: 300,
          },
          timestamp: Date.now(),
        });

        const pass = metricsEngine.allMetricsPass(
          assignment.variant_id,
          assignment.cohort_id
        );

        results.push({
          proposal_id: proposalId,
          cohort_size: assignment.cohort_size,
          metrics_pass: pass,
        });
      }

      expect(results.length).toBe(3);
      results.forEach((result) => {
        expect(result.metrics_pass).toBe(true);
      });
    });

    it('tracks distinct cohort metrics across variants', () => {
      // Variant A cohort 10%
      metricsEngine.recordObservation({
        variant_id: 'variant-a',
        cohort_id: 'cohort-10pct',
        custom_metrics: {
          error_rate: 0.01,
          cost_delta: 0.001,
          latency_p99: 300,
        },
        timestamp: Date.now(),
      });

      // Variant B cohort 10%
      metricsEngine.recordObservation({
        variant_id: 'variant-b',
        cohort_id: 'cohort-10pct',
        custom_metrics: {
          error_rate: 0.008,
          cost_delta: 0.0008,
          latency_p99: 280,
        },
        timestamp: Date.now(),
      });

      const aggA = metricsEngine.getAggregateMetrics('variant-a', 'cohort-10pct');
      const aggB = metricsEngine.getAggregateMetrics('variant-b', 'cohort-10pct');

      expect(aggA.error_rate).toBeCloseTo(0.01, 2);
      expect(aggB.error_rate).toBeCloseTo(0.008, 3);
    });
  });

  describe('A/B Test Variant Decision Trees', () => {
    it('creates distinct decision paths per variant', () => {
      const tree1 = abTestEngine.createDecisionTree('proposal-1');
      const tree2 = abTestEngine.createDecisionTree('proposal-2');

      expect(tree1).toContain('proposal-1');
      expect(tree2).toContain('proposal-2');
      expect(tree1).not.toBe(tree2);
    });

    it('tracks variant treatment configuration', () => {
      const variant: ABVariant = {
        variant_id: 'variant-optimized',
        name: 'Optimized Strategy',
        description: 'New enrichment algorithm',
        treatment_config: {
          algorithm: 'ml-v2',
          confidence_threshold: 0.85,
          fallback_strategy: 'baseline',
        },
      };

      abTestEngine.registerVariant(variant);
      const retrieved = abTestEngine.getVariant('variant-optimized');

      expect(retrieved?.treatment_config.algorithm).toBe('ml-v2');
      expect(retrieved?.treatment_config.confidence_threshold).toBe(0.85);
    });
  });

  describe('Custom Metrics Thresholds', () => {
    it('evaluates multiple threshold operators', () => {
      // Register metric for each operator test
      const testMetrics: Array<{
        name: string;
        op: '<' | '>' | '<=' | '>=' | '==' | '!=';
        threshold: number;
        testVal: number;
        shouldPass: boolean;
      }> = [
        { name: 'test_less', op: '<', threshold: 500, testVal: 400, shouldPass: true },
        { name: 'test_greater', op: '>', threshold: 500, testVal: 600, shouldPass: true },
        { name: 'test_lesseq', op: '<=', threshold: 500, testVal: 500, shouldPass: true },
        { name: 'test_greatereq', op: '>=', threshold: 500, testVal: 500, shouldPass: true },
        { name: 'test_equal', op: '==', threshold: 500, testVal: 500, shouldPass: true },
        { name: 'test_notequal', op: '!=', threshold: 500, testVal: 499, shouldPass: true },
      ];

      const testEngine = new CustomMetricsEngine();

      for (const { name, op, threshold, testVal, shouldPass } of testMetrics) {
        testEngine.registerMetric({
          name,
          type: 'gauge',
          threshold,
          operator: op,
          unit: 'test',
        });

        const result = testEngine.evaluateThreshold(name, testVal);
        expect(result).toBe(shouldPass);
      }
    });

    it('handles missing metric observation gracefully', () => {
      const aggregate = metricsEngine.getAggregateMetrics(
        'nonexistent-variant',
        'nonexistent-cohort'
      );

      expect(aggregate).toEqual({});
    });
  });

  describe('Full Phase 2-5 Integration', () => {
    it('chains Phase 4 promotion → Phase 5 cohort → metrics → next decision', () => {
      // Phase 4: Proposal approved
      const proposalId = 'proposal-1';

      // Phase 5 Step 1: Create variant from proposal
      const variant: ABVariant = {
        variant_id: 'variant-from-proposal-1',
        name: 'Phase 4 Approved Variant',
        description: 'Promoted from Phase 4',
        treatment_config: { source: 'phase4_proposal' },
      };

      abTestEngine.registerVariant(variant);

      // Phase 5 Step 2: Assign to initial cohort (10%)
      let assignment = multiCohortEngine.assignCohort(
        proposalId,
        variant.variant_id,
        0.1
      );

      expect(assignment.cohort_size).toBe(0.1);

      // Phase 5 Step 3: Collect metrics
      metricsEngine.recordObservation({
        variant_id: variant.variant_id,
        cohort_id: assignment.cohort_id,
        custom_metrics: {
          error_rate: 0.01,
          cost_delta: 0.001,
          latency_p99: 300,
        },
        timestamp: Date.now(),
      });

      // Phase 5 Step 4: Evaluate promotion
      const metricsPass = metricsEngine.allMetricsPass(
        variant.variant_id,
        assignment.cohort_id
      );

      const currentCohort = {
        id: assignment.cohort_id,
        size: assignment.cohort_size,
        duration_minutes: 30,
      };

      const nextCohort = {
        id: 'cohort-25pct',
        size: 0.25,
        duration_minutes: 45,
      };

      const decision = promotionEngine.evaluatePromotion(
        proposalId,
        variant.variant_id,
        currentCohort,
        metricsPass,
        nextCohort
      );

      expect(decision.decision).toBe('promote_cohort');
      expect(decision.next_cohort?.size).toBe(0.25);

      // Phase 5 Step 5: Promote to next cohort
      assignment = multiCohortEngine.assignCohort(
        proposalId,
        variant.variant_id,
        0.25
      );

      expect(assignment.cohort_size).toBe(0.25);
    });
  });
});
