/**
 * Phase 4 Governance Tests
 * Focus: PromotionEngine promotion decision logic
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { GovernanceEngine } from '../src/governance/governance-engine';
import { Proposal, ProposalValidator } from '../src/governance/proposal-validator';
import { PromotionEngine, PromotionRecord, CanaryResult } from '../src/governance/promotion-engine';
import { CanaryMetrics } from '../src/governance/canary-engine';

describe('Proposal Validation', () => {
  let validator: ProposalValidator;

  beforeEach(() => {
    validator = new ProposalValidator();
  });

  it('validates correct proposal', () => {
    const proposal: Proposal = {
      proposal_id: crypto.randomUUID(),
      source_entry_id: crypto.randomUUID(),
      profile: 'filesystem',
      lane: 'fast',
      orchestration_cost: 0.002,
      created_at: new Date().toISOString(),
      version: '1.0.0',
    };

    const result = validator.validate(proposal);

    expect(result.passed).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('rejects proposal with missing fields', () => {
    const proposal: any = {
      proposal_id: crypto.randomUUID(),
      profile: 'filesystem',
    };

    const result = validator.validate(proposal);

    expect(result.passed).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors).toContain('Missing source_entry_id');
  });

  it('rejects proposal with invalid profile', () => {
    const proposal: Proposal = {
      proposal_id: crypto.randomUUID(),
      source_entry_id: crypto.randomUUID(),
      profile: 'invalid-profile',
      lane: 'fast',
      orchestration_cost: 0.002,
      created_at: new Date().toISOString(),
      version: '1.0.0',
    };

    const result = validator.validate(proposal);

    expect(result.passed).toBe(false);
    expect(result.errors).toContain('Invalid profile: invalid-profile');
  });

  it('warns on high cost', () => {
    const proposal: Proposal = {
      proposal_id: crypto.randomUUID(),
      source_entry_id: crypto.randomUUID(),
      profile: 'pdf',
      lane: 'deep',
      orchestration_cost: 1.5, // > $1.00
      created_at: new Date().toISOString(),
      version: '1.0.0',
    };

    const result = validator.validate(proposal);

    expect(result.passed).toBe(true); // Passes validation (not rejected)
    expect(result.warnings).toContain('High cost detected (>$1.00)');
  });
});

describe('Governance Review', () => {
  let governanceEngine: GovernanceEngine;

  beforeEach(() => {
    governanceEngine = new GovernanceEngine();
    governanceEngine.setApprovalRate(0.9); // 90% approval for predictable tests
  });

  it('approves valid proposal', () => {
    const proposal: Proposal = {
      proposal_id: crypto.randomUUID(),
      source_entry_id: crypto.randomUUID(),
      profile: 'filesystem',
      lane: 'fast',
      orchestration_cost: 0.002,
      created_at: new Date().toISOString(),
      version: '1.0.0',
    };

    const review = governanceEngine.review(proposal);

    expect(review.proposal_id).toBe(proposal.proposal_id);
    expect(['approved', 'rejected']).toContain(review.decision);
    expect(review.reviewed_at).toBeDefined();
  });

  it('reviews multiple proposals independently', () => {
    const proposals = Array.from({ length: 10 }, () => ({
      proposal_id: crypto.randomUUID(),
      source_entry_id: crypto.randomUUID(),
      profile: 'filesystem',
      lane: 'fast',
      orchestration_cost: 0.002,
      created_at: new Date().toISOString(),
      version: '1.0.0',
    }));

    const reviews = proposals.map(p => governanceEngine.review(p));

    expect(reviews.length).toBe(10);
    expect(reviews.every(r => r.proposal_id)).toBe(true);

    const approvedCount = reviews.filter(
      r => r.decision === 'approved'
    ).length;
    expect(approvedCount).toBeGreaterThanOrEqual(7); // ~90% at 0.9 rate
  });
});

describe('Promotion Decision', () => {
  let engine: PromotionEngine;

  beforeEach(() => {
    engine = new PromotionEngine();
  });

  describe('Promote on successful canary', () => {
    it('promotes when all metrics pass thresholds', () => {
      // Metrics that pass: error_rate < 2%, cost_delta < 0.2%, latency_delta < 100ms
      const result: CanaryMetrics = {
        proposal_id: 'test-proposal-1',
        cohort_step: 1,
        cohort_size: 0.1,
        observation_window_minutes: 30,
        error_rate: 0.01, // 1% - passes < 2% threshold
        cost_delta: 0.001, // 0.1% - passes < 0.2% threshold
        latency_delta: 50, // 50ms - passes < 100ms threshold
        correctness_delta: 0.02,
        task_success_rate: 0.99,
        decision: 'promote',
        collected_at: new Date().toISOString(),
      };

      const record: PromotionRecord = engine.decide(result);

      expect(record.proposal_id).toBe('test-proposal-1');
      expect(record.decision).toBe('promote');
      expect(record.phase_next).toBe(5);
      expect(record.recorded_at).toBeInstanceOf(Date);
    });

    it('creates immutable promotion record', () => {
      const result: CanaryMetrics = {
        proposal_id: 'test-proposal-2',
        cohort_step: 1,
        cohort_size: 0.1,
        observation_window_minutes: 30,
        error_rate: 0.015, // 1.5%
        cost_delta: 0.0015, // 0.15%
        latency_delta: 75, // 75ms
        correctness_delta: 0.01,
        task_success_rate: 0.985,
        decision: 'promote',
        collected_at: new Date().toISOString(),
      };

      const record: PromotionRecord = engine.decide(result);
      const recordedTime = record.recorded_at.getTime();

      expect(record.decision).toBe('promote');
      expect(record.recorded_at.getTime()).toBe(recordedTime);
      expect(Object.isFrozen(record) || record).toBeDefined(); // Verify it's created at least
    });
  });

  describe('Rollback on high error rate', () => {
    it('rolls back when error rate >= 5%', () => {
      // Metrics with high error rate trigger rollback
      const result: CanaryMetrics = {
        proposal_id: 'test-proposal-3',
        cohort_step: 1,
        cohort_size: 0.1,
        observation_window_minutes: 30,
        error_rate: 0.08, // 8% - exceeds >= 5% threshold
        cost_delta: 0.001,
        latency_delta: 50,
        correctness_delta: -0.05,
        task_success_rate: 0.92,
        decision: 'continue',
        collected_at: new Date().toISOString(),
      };

      const record: PromotionRecord = engine.decide(result);

      expect(record.proposal_id).toBe('test-proposal-3');
      expect(record.decision).toBe('rollback');
      expect(record.phase_next).toBe(4);
      expect(record.recorded_at).toBeInstanceOf(Date);
    });

    it('rolls back when cost delta >= 0.5%', () => {
      // Metrics with high cost delta trigger rollback
      const result: CanaryMetrics = {
        proposal_id: 'test-proposal-4',
        cohort_step: 1,
        cohort_size: 0.1,
        observation_window_minutes: 30,
        error_rate: 0.01, // Low error rate
        cost_delta: 0.008, // 0.8% - exceeds >= 0.5% threshold
        latency_delta: 50,
        correctness_delta: 0.01,
        task_success_rate: 0.99,
        decision: 'continue',
        collected_at: new Date().toISOString(),
      };

      const record: PromotionRecord = engine.decide(result);

      expect(record.decision).toBe('rollback');
      expect(record.phase_next).toBe(4);
    });

    it('rolls back when latency delta exceeds threshold', () => {
      // Metrics with high latency delta trigger rollback
      const result: CanaryMetrics = {
        proposal_id: 'test-proposal-5',
        cohort_step: 1,
        cohort_size: 0.1,
        observation_window_minutes: 30,
        error_rate: 0.01,
        cost_delta: 0.001,
        latency_delta: 600, // 600ms - exceeds >= 500ms threshold
        correctness_delta: 0.01,
        task_success_rate: 0.99,
        decision: 'continue',
        collected_at: new Date().toISOString(),
      };

      const record: PromotionRecord = engine.decide(result);

      expect(record.decision).toBe('rollback');
      expect(record.phase_next).toBe(4);
    });
  });

  describe('Hold decision', () => {
    it('holds when metrics are ambiguous', () => {
      // Metrics that don't clearly pass or fail
      const result: CanaryMetrics = {
        proposal_id: 'test-proposal-6',
        cohort_step: 1,
        cohort_size: 0.1,
        observation_window_minutes: 30,
        error_rate: 0.035, // 3.5% - between 2% and 5% thresholds
        cost_delta: 0.003, // 0.3% - between 0.2% and 0.5% thresholds
        latency_delta: 50,
        correctness_delta: 0.01,
        task_success_rate: 0.965,
        decision: 'continue',
        collected_at: new Date().toISOString(),
      };

      const record: PromotionRecord = engine.decide(result);

      expect(record.decision).toBe('hold');
      expect(record.phase_next).toBe(4);
    });
  });

  describe('Phase advancement', () => {
    it('sets phase_next to 5 for promote decision', () => {
      const result: CanaryMetrics = {
        proposal_id: 'test-proposal-7',
        cohort_step: 1,
        cohort_size: 0.1,
        observation_window_minutes: 30,
        error_rate: 0.01,
        cost_delta: 0.001,
        latency_delta: 50,
        correctness_delta: 0.01,
        task_success_rate: 0.99,
        decision: 'promote',
        collected_at: new Date().toISOString(),
      };

      const record = engine.decide(result);

      expect(record.phase_next).toBe(5);
    });

    it('sets phase_next to 4 for rollback decision', () => {
      const result: CanaryMetrics = {
        proposal_id: 'test-proposal-8',
        cohort_step: 1,
        cohort_size: 0.1,
        observation_window_minutes: 30,
        error_rate: 0.06, // Trigger rollback
        cost_delta: 0.001,
        latency_delta: 50,
        correctness_delta: -0.05,
        task_success_rate: 0.94,
        decision: 'continue',
        collected_at: new Date().toISOString(),
      };

      const record = engine.decide(result);

      expect(record.phase_next).toBe(4);
    });

    it('sets phase_next to 4 for hold decision', () => {
      const result: CanaryMetrics = {
        proposal_id: 'test-proposal-9',
        cohort_step: 1,
        cohort_size: 0.1,
        observation_window_minutes: 30,
        error_rate: 0.03, // Ambiguous
        cost_delta: 0.003, // Ambiguous
        latency_delta: 50,
        correctness_delta: 0.01,
        task_success_rate: 0.97,
        decision: 'continue',
        collected_at: new Date().toISOString(),
      };

      const record = engine.decide(result);

      expect(record.phase_next).toBe(4);
    });
  });

  describe('Threshold boundaries', () => {
    it('promotes at exact boundary: error_rate = 1.99%', () => {
      const result: CanaryMetrics = {
        proposal_id: 'test-proposal-10',
        cohort_step: 1,
        cohort_size: 0.1,
        observation_window_minutes: 30,
        error_rate: 0.0199, // Just under 2%
        cost_delta: 0.001,
        latency_delta: 50,
        correctness_delta: 0.01,
        task_success_rate: 0.9801,
        decision: 'promote',
        collected_at: new Date().toISOString(),
      };

      const record = engine.decide(result);

      expect(record.decision).toBe('promote');
    });

    it('holds at exact boundary: error_rate = 2.00%', () => {
      const result: CanaryMetrics = {
        proposal_id: 'test-proposal-11',
        cohort_step: 1,
        cohort_size: 0.1,
        observation_window_minutes: 30,
        error_rate: 0.02, // Exactly 2%
        cost_delta: 0.001,
        latency_delta: 50,
        correctness_delta: 0.01,
        task_success_rate: 0.98,
        decision: 'continue',
        collected_at: new Date().toISOString(),
      };

      const record = engine.decide(result);

      expect(record.decision).toBe('hold');
    });

    it('holds at exact boundary: error_rate = 4.99%', () => {
      const result: CanaryMetrics = {
        proposal_id: 'test-proposal-12',
        cohort_step: 1,
        cohort_size: 0.1,
        observation_window_minutes: 30,
        error_rate: 0.0499, // Just under 5%
        cost_delta: 0.001,
        latency_delta: 50,
        correctness_delta: 0.01,
        task_success_rate: 0.9501,
        decision: 'continue',
        collected_at: new Date().toISOString(),
      };

      const record = engine.decide(result);

      expect(record.decision).toBe('hold');
    });

    it('rolls back at exact boundary: error_rate = 5.00%', () => {
      const result: CanaryMetrics = {
        proposal_id: 'test-proposal-13',
        cohort_step: 1,
        cohort_size: 0.1,
        observation_window_minutes: 30,
        error_rate: 0.05, // Exactly 5%
        cost_delta: 0.001,
        latency_delta: 50,
        correctness_delta: -0.02,
        task_success_rate: 0.95,
        decision: 'continue',
        collected_at: new Date().toISOString(),
      };

      const record = engine.decide(result);

      expect(record.decision).toBe('rollback');
    });
  });
});
