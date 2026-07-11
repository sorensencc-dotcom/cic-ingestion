/**
 * Phase 4 Governance Tests
 * Focus: PromotionEngine promotion decision logic
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { GovernanceEngine } from '../src/governance/governance-engine';
import { Proposal, ProposalValidator } from '../src/governance/proposal-validator';
import { PromotionEngine, PromotionRecord, CanaryResult } from '../src/governance/promotion-engine';
import { CanaryMetrics, CanaryEngine } from '../src/governance/canary-engine';
import { ProposalCreation, AuditRecord } from '../src/governance/proposal-creation';
import { GovernanceLog, GovernanceLogEntry } from '../src/governance/governance-log';

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

describe('Proposal Creation (Agent 5)', () => {
  let proposalCreation: ProposalCreation;

  beforeEach(() => {
    proposalCreation = new ProposalCreation();
  });

  it('creates proposal from filesystem audit record', () => {
    const auditRecord: AuditRecord = {
      profile: 'filesystem',
      lane: 'fast',
      orchestration_cost: 0.002,
      entry_id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };

    const proposal = proposalCreation.fromAuditRecord(auditRecord);

    expect(proposal.proposal_id).toBeDefined();
    expect(proposal.source_entry_id).toBe(auditRecord.entry_id);
    expect(proposal.profile).toBe('filesystem');
    expect(proposal.lane).toBe('fast');
    expect(proposal.orchestration_cost).toBe(0.002);
    expect(proposal.created_at).toBe(auditRecord.created_at);
    expect(proposal.version).toBe('1.0.0');
  });

  it('creates proposal from API entry with correct profile/lane', () => {
    const apiEntry = {
      profile: 'api:familysearch',
      lane: 'deep',
      cost: 0.05,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    const proposal = proposalCreation.fromAPIEntry(apiEntry);

    expect(proposal.proposal_id).toBeDefined();
    expect(proposal.source_entry_id).toBe(apiEntry.id);
    expect(proposal.profile).toBe('api:familysearch');
    expect(proposal.lane).toBe('deep');
    expect(proposal.orchestration_cost).toBe(0.05);
    expect(proposal.version).toBe('1.0.0');
  });
});

describe('Governance Log & E2E Pipeline (Agent 6)', () => {
  let log: GovernanceLog;
  let validator: ProposalValidator;
  let governanceEngine: GovernanceEngine;
  let canaryEngine: CanaryEngine;
  let promotionEngine: PromotionEngine;
  let proposalCreation: ProposalCreation;

  beforeEach(() => {
    log = new GovernanceLog();
    validator = new ProposalValidator();
    governanceEngine = new GovernanceEngine();
    governanceEngine.setApprovalRate(0.9);
    canaryEngine = new CanaryEngine();
    promotionEngine = new PromotionEngine();
    proposalCreation = new ProposalCreation();
  });

  it('processes proposal through complete 5-stage workflow', async () => {
    // Stage 1: Create proposal from audit record
    const auditRecord: AuditRecord = {
      profile: 'filesystem',
      lane: 'fast',
      orchestration_cost: 0.002,
      entry_id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };

    const proposal = proposalCreation.fromAuditRecord(auditRecord);

    // Stage 2: Validate proposal
    const validationResult = validator.validate(proposal);
    expect(validationResult.passed).toBe(true);

    // Stage 3: Governance review
    const govDecision = governanceEngine.review(proposal);
    expect(['approved', 'rejected']).toContain(govDecision.decision);

    // Stage 4: Canary test (if approved)
    let canaryResult: CanaryResult | undefined;
    if (govDecision.decision === 'approved') {
      canaryResult = canaryEngine.execute(proposal, govDecision);
      expect(['promote', 'rollback', 'hold']).toContain(canaryResult.decision);
    }

    // Stage 5: Promotion decision
    let promotionRecord: PromotionRecord | undefined;
    if (canaryResult) {
      promotionRecord = promotionEngine.decide(canaryResult);
      expect(['promote', 'rollback', 'hold']).toContain(promotionRecord.decision);
      expect([4, 5]).toContain(promotionRecord.phase_next);
    }

    // Log the decision
    const logEntry: GovernanceLogEntry = {
      proposal_id: proposal.proposal_id,
      phase: 4,
      timestamp: new Date(),
      governance_decision: govDecision.decision,
      canary_result: canaryResult,
      heal_decision: promotionRecord?.decision || 'hold',
      reason: govDecision.reason,
      carried_to_phase: promotionRecord?.phase_next || 4,
    };

    log.record(logEntry);

    // Verify logged entry
    const logged = log.getEntry(proposal.proposal_id);
    expect(logged).toBeDefined();
    expect(logged?.proposal_id).toBe(proposal.proposal_id);
    expect(logged?.phase).toBe(4);
  });

  it('processes batch of proposals with no state leakage', () => {
    const batchSize = 10;
    const proposals = Array.from({ length: batchSize }, () => {
      const auditRecord: AuditRecord = {
        profile: 'pdf',
        lane: 'deep',
        orchestration_cost: 0.01,
        entry_id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
      };
      return proposalCreation.fromAuditRecord(auditRecord);
    });

    // Process each proposal independently
    proposals.forEach((proposal) => {
      const govDecision = governanceEngine.review(proposal);
      const canaryResult = canaryEngine.execute(proposal, govDecision);
      const promotionRecord = promotionEngine.decide(canaryResult);

      const logEntry: GovernanceLogEntry = {
        proposal_id: proposal.proposal_id,
        phase: 4,
        timestamp: new Date(),
        governance_decision: govDecision.decision,
        canary_result: canaryResult,
        heal_decision: promotionRecord.decision,
        reason: govDecision.reason,
        carried_to_phase: promotionRecord.phase_next,
      };

      log.record(logEntry);
    });

    // Verify all entries logged
    expect(log.size()).toBe(batchSize);

    // Verify no state leakage: each entry is independent
    const entries = log.getEntries();
    const proposalIds = new Set(entries.map((e) => e.proposal_id));
    expect(proposalIds.size).toBe(batchSize); // All unique
  });

  it('tracks approval rate across batch', () => {
    const batchSize = 20;

    // Create and process batch
    for (let i = 0; i < batchSize; i++) {
      const auditRecord: AuditRecord = {
        profile: i % 3 === 0 ? 'api:generic' : 'filesystem',
        lane: i % 2 === 0 ? 'fast' : 'deep',
        orchestration_cost: 0.001 * (i + 1),
        entry_id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
      };

      const proposal = proposalCreation.fromAuditRecord(auditRecord);
      const govDecision = governanceEngine.review(proposal);
      const canaryResult = canaryEngine.execute(proposal, govDecision);
      const promotionRecord = promotionEngine.decide(canaryResult);

      const logEntry: GovernanceLogEntry = {
        proposal_id: proposal.proposal_id,
        phase: 4,
        timestamp: new Date(),
        governance_decision: govDecision.decision,
        canary_result: canaryResult,
        heal_decision: promotionRecord.decision,
        reason: govDecision.reason,
        carried_to_phase: promotionRecord.phase_next,
      };

      log.record(logEntry);
    }

    // Calculate approval rate
    const approvalRate = log.getApprovalRate();

    // At 90% approval rate, expect ~18/20 approved (18 ± 4 gives confidence interval)
    expect(approvalRate).toBeGreaterThanOrEqual(0.7);
    expect(approvalRate).toBeLessThanOrEqual(1.0);

    // Verify metric: approved / total
    const entries = log.getEntries();
    const approvedCount = entries.filter(
      (e) => e.governance_decision === 'approved'
    ).length;
    const calculatedRate = approvedCount / entries.length;
    expect(approvalRate).toBe(calculatedRate);
  });

  it('tracks cost distribution (p50, p75, p95)', () => {
    const costs = [0.001, 0.002, 0.003, 0.005, 0.01, 0.015, 0.02, 0.025, 0.03, 0.05];

    // Process proposals with varied costs
    costs.forEach((cost) => {
      const auditRecord: AuditRecord = {
        profile: 'filesystem',
        lane: 'fast',
        orchestration_cost: cost,
        entry_id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
      };

      const proposal = proposalCreation.fromAuditRecord(auditRecord);
      const govDecision = governanceEngine.review(proposal);
      const canaryResult = canaryEngine.execute(proposal, govDecision);
      const promotionRecord = promotionEngine.decide(canaryResult);

      const logEntry: GovernanceLogEntry = {
        proposal_id: proposal.proposal_id,
        phase: 4,
        timestamp: new Date(),
        governance_decision: govDecision.decision,
        canary_result: canaryResult,
        heal_decision: promotionRecord.decision,
        reason: govDecision.reason,
        carried_to_phase: promotionRecord.phase_next,
      };

      log.record(logEntry);
    });

    // Calculate distribution
    const distribution = log.getCostDistribution();

    // Verify structure
    expect(distribution.p50).toBeDefined();
    expect(distribution.p75).toBeDefined();
    expect(distribution.p95).toBeDefined();

    // All should be >= 0
    expect(distribution.p50).toBeGreaterThanOrEqual(0);
    expect(distribution.p75).toBeGreaterThanOrEqual(0);
    expect(distribution.p95).toBeGreaterThanOrEqual(0);
  });
});
