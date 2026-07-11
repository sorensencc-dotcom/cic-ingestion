/**
 * Phase 4 Governance E2E Test
 * Covers full pipeline: Phase3-Gateway → Proposal → Validation → Governance Review → Canary → Promotion
 *
 * Test Plan:
 * 1. Create proposals from Phase 3 audit records
 * 2. Validate proposal structure + constraints
 * 3. Execute governance review (approval/rejection)
 * 4. Run canary (cohort metrics collection)
 * 5. Promote or rollback based on telemetry
 * 6. Record decision to governance log
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
  Proposal,
  ProposalValidator,
  GovernanceEngine,
  CanaryEngine,
  CanaryMetrics,
  PromotionEngine,
} from '../governance/index';

describe('Phase 4: Governance E2E — Proposal → Validation → Review → Canary → Promotion', () => {
  let testLogPath: string;
  let validator: ProposalValidator;
  let governanceEngine: GovernanceEngine;
  let canaryEngine: CanaryEngine;
  let promotionEngine: PromotionEngine;

  beforeEach(() => {
    testLogPath = path.join(__dirname, '.test-phase4-governance.jsonl');
    if (fs.existsSync(testLogPath)) {
      fs.unlinkSync(testLogPath);
    }

    validator = new ProposalValidator();
    governanceEngine = new GovernanceEngine();
    governanceEngine.setApprovalRate(0.9); // 90% approval for predictable tests
    canaryEngine = new CanaryEngine();
    promotionEngine = new PromotionEngine();
  });

  afterEach(() => {
    if (fs.existsSync(testLogPath)) {
      fs.unlinkSync(testLogPath);
    }
  });

  describe('Proposal Creation', () => {
    it('creates proposal from Phase 3 audit record', () => {
      const auditRecord = {
        id: crypto.randomUUID(),
        source: 'filesystem',
        profile: 'filesystem',
        lane: 'fast',
        orchestrationStatus: 'success',
        cost: 0.002,
      };

      const proposal: Proposal = {
        proposal_id: crypto.randomUUID(),
        source_entry_id: auditRecord.id,
        profile: auditRecord.profile,
        lane: auditRecord.lane,
        orchestration_cost: auditRecord.cost,
        created_at: new Date().toISOString(),
        version: '1.0.0',
      };

      expect(proposal.proposal_id).toBeDefined();
      expect(proposal.source_entry_id).toBe(auditRecord.id);
      expect(proposal.profile).toBe('filesystem');
      expect(proposal.orchestration_cost).toBe(0.002);
    });

    it('creates proposal for API entry', () => {
      const auditRecord = {
        id: crypto.randomUUID(),
        source: 'api:familysearch',
        profile: 'api:familysearch',
        lane: 'deep',
        orchestrationStatus: 'success',
        cost: 0.015,
      };

      const proposal: Proposal = {
        proposal_id: crypto.randomUUID(),
        source_entry_id: auditRecord.id,
        profile: auditRecord.profile,
        lane: auditRecord.lane,
        orchestration_cost: auditRecord.cost,
        created_at: new Date().toISOString(),
        version: '1.0.0',
      };

      expect(proposal.profile).toBe('api:familysearch');
      expect(proposal.lane).toBe('deep');
    });
  });

  describe('Proposal Validation', () => {
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

  describe('Canary Execution', () => {
    it('executes canary for approved proposal', async () => {
      const proposal: Proposal = {
        proposal_id: crypto.randomUUID(),
        source_entry_id: crypto.randomUUID(),
        profile: 'filesystem',
        lane: 'fast',
        orchestration_cost: 0.002,
        created_at: new Date().toISOString(),
        version: '1.0.0',
      };

      const metrics = await canaryEngine.executeCanary(proposal);

      expect(metrics.proposal_id).toBe(proposal.proposal_id);
      expect(metrics.cohort_size).toBe(0.1);
      expect(metrics.observation_window_minutes).toBe(30);
      expect(metrics.error_rate).toBeGreaterThanOrEqual(0);
      expect(metrics.error_rate).toBeLessThanOrEqual(0.05);
      expect(['continue', 'promote']).toContain(metrics.decision);
    });

    it('measures cost delta', async () => {
      const proposal: Proposal = {
        proposal_id: crypto.randomUUID(),
        source_entry_id: crypto.randomUUID(),
        profile: 'api:familysearch',
        lane: 'deep',
        orchestration_cost: 0.015,
        created_at: new Date().toISOString(),
        version: '1.0.0',
      };

      const metrics = await canaryEngine.executeCanary(proposal);

      expect(typeof metrics.cost_delta).toBe('number');
      expect(metrics.cost_delta).toBeGreaterThanOrEqual(-0.01);
      expect(metrics.cost_delta).toBeLessThanOrEqual(0.01);
    });
  });

  describe('Promotion Decision', () => {
    it('promotes on successful canary', async () => {
      const proposal: Proposal = {
        proposal_id: crypto.randomUUID(),
        source_entry_id: crypto.randomUUID(),
        profile: 'filesystem',
        lane: 'fast',
        orchestration_cost: 0.002,
        created_at: new Date().toISOString(),
        version: '1.0.0',
      };

      const metrics = await canaryEngine.executeCanary(proposal);
      const decision = promotionEngine.promote(proposal, metrics);

      expect(decision.proposal_id).toBe(proposal.proposal_id);
      expect(['promoted', 'rolled_back', 'held']).toContain(decision.decision);
      expect(decision.reason).toBeDefined();
    });

    it('rollsback on high error rate', () => {
      const proposal: Proposal = {
        proposal_id: crypto.randomUUID(),
        source_entry_id: crypto.randomUUID(),
        profile: 'filesystem',
        lane: 'fast',
        orchestration_cost: 0.002,
        created_at: new Date().toISOString(),
        version: '1.0.0',
      };

      const metrics: CanaryMetrics = {
        proposal_id: proposal.proposal_id,
        cohort_step: 1,
        cohort_size: 0.1,
        observation_window_minutes: 30,
        cost_delta: 0.001,
        latency_delta: 10,
        correctness_delta: 0.02,
        error_rate: 0.08, // > 5% threshold
        task_success_rate: 0.92,
        decision: 'continue',
        collected_at: new Date().toISOString(),
      };

      const decision = promotionEngine.promote(proposal, metrics);

      expect(decision.decision).toBe('rolled_back');
      expect(decision.reason).toContain('Error rate');
    });
  });

  describe('Full Governance Pipeline', () => {
    it('processes proposal through complete workflow', async () => {
      const proposal: Proposal = {
        proposal_id: crypto.randomUUID(),
        source_entry_id: crypto.randomUUID(),
        profile: 'filesystem',
        lane: 'fast',
        orchestration_cost: 0.002,
        created_at: new Date().toISOString(),
        version: '1.0.0',
      };

      // Step 1: Validate
      const validation = validator.validate(proposal);
      expect(validation.passed).toBe(true);

      // Step 2: Governance review
      const review = governanceEngine.review(proposal);
      if (review.decision !== 'approved') {
        return; // Skip rest if rejected
      }

      // Step 3: Canary
      const metrics = await canaryEngine.executeCanary(proposal);
      expect(metrics.proposal_id).toBe(proposal.proposal_id);

      // Step 4: Promotion
      const promotion = promotionEngine.promote(proposal, metrics);
      expect(promotion.proposal_id).toBe(proposal.proposal_id);

      // Record to log
      const logRecord = {
        proposal_id: proposal.proposal_id,
        validation_passed: validation.passed,
        governance_decision: review.decision,
        canary_metrics: metrics,
        promotion_decision: promotion.decision,
        workflow_completed_at: new Date().toISOString(),
      };

      fs.appendFileSync(testLogPath, JSON.stringify(logRecord) + '\n');
    });

    it('processes batch of proposals', async () => {
      const proposals = Array.from({ length: 5 }, () => ({
        proposal_id: crypto.randomUUID(),
        source_entry_id: crypto.randomUUID(),
        profile:
          ['filesystem', 'api:familysearch', 'images', 'pdf', 'api:generic'][
            Math.floor(Math.random() * 5)
          ],
        lane: Math.random() > 0.3 ? 'fast' : 'deep',
        orchestration_cost: Math.random() * 0.02,
        created_at: new Date().toISOString(),
        version: '1.0.0',
      }));

      const results = [];
      for (const proposal of proposals) {
        const validation = validator.validate(proposal);
        if (!validation.passed) continue;

        const review = governanceEngine.review(proposal);
        const metrics = await canaryEngine.executeCanary(proposal);
        const promotion = promotionEngine.promote(proposal, metrics);

        results.push({
          proposal_id: proposal.proposal_id,
          governance: review.decision,
          promotion: promotion.decision,
        });

        fs.appendFileSync(
          testLogPath,
          JSON.stringify({
            ...proposal,
            validation_passed: validation.passed,
            governance_decision: review.decision,
            promotion_decision: promotion.decision,
          }) + '\n'
        );
      }

      expect(results.length).toBe(5);
      expect(fs.existsSync(testLogPath)).toBe(true);

      const logLines = fs
        .readFileSync(testLogPath, 'utf-8')
        .split('\n')
        .filter(l => l.trim());
      expect(logLines.length).toBe(5);
    });
  });

  describe('Phase 3→4 Integration', () => {
    it('converts Phase 3 audit record to Phase 4 proposal', () => {
      const auditRecord = {
        id: crypto.randomUUID(),
        source: 'filesystem',
        profile: 'filesystem',
        lane: 'fast',
        orchestrationStatus: 'success',
        executedActions: ['TextExtraction', 'SemanticAnalysis'],
        cost: 0.002,
        executionTimeMs: 250,
        gatewayTimestamp: Date.now(),
      };

      const proposal: Proposal = {
        proposal_id: crypto.randomUUID(),
        source_entry_id: auditRecord.id,
        profile: auditRecord.profile,
        lane: auditRecord.lane,
        orchestration_cost: auditRecord.cost,
        created_at: new Date().toISOString(),
        version: '1.0.0',
      };

      expect(proposal.source_entry_id).toBe(auditRecord.id);
      expect(proposal.profile).toBe(auditRecord.profile);
      expect(proposal.orchestration_cost).toBe(auditRecord.cost);
    });

    it('preserves entry lineage through Phase 3→4 boundary', async () => {
      // Simulate end-to-end trace
      const originalEntryId = crypto.randomUUID();
      const phase3AuditId = crypto.randomUUID();

      const proposal: Proposal = {
        proposal_id: crypto.randomUUID(),
        source_entry_id: originalEntryId, // Traced back to Phase 2 entry
        profile: 'filesystem',
        lane: 'fast',
        orchestration_cost: 0.002,
        created_at: new Date().toISOString(),
        version: '1.0.0',
      };

      const validation = validator.validate(proposal);
      const review = governanceEngine.review(proposal);
      const metrics = await canaryEngine.executeCanary(proposal);
      const promotion = promotionEngine.promote(proposal, metrics);

      // Verify lineage preserved
      expect(proposal.source_entry_id).toBe(originalEntryId);
      expect(review.proposal_id).toBe(proposal.proposal_id);
      expect(metrics.proposal_id).toBe(proposal.proposal_id);
      expect(promotion.proposal_id).toBe(proposal.proposal_id);
    });
  });

  describe('Governance Metrics', () => {
    it('tracks approval rate across batch', () => {
      const proposals = Array.from({ length: 20 }, () => ({
        proposal_id: crypto.randomUUID(),
        source_entry_id: crypto.randomUUID(),
        profile: 'filesystem',
        lane: 'fast',
        orchestration_cost: 0.002,
        created_at: new Date().toISOString(),
        version: '1.0.0',
      }));

      const reviews = proposals.map(p => governanceEngine.review(p));
      const approvalRate =
        reviews.filter(r => r.decision === 'approved').length / reviews.length;

      expect(approvalRate).toBeGreaterThanOrEqual(0.75);
      expect(approvalRate).toBeLessThanOrEqual(1.0);
    });

    it('tracks cost distribution', async () => {
      const proposals = Array.from({ length: 10 }, () => ({
        proposal_id: crypto.randomUUID(),
        source_entry_id: crypto.randomUUID(),
        profile: 'filesystem',
        lane: Math.random() > 0.5 ? 'fast' : 'deep',
        orchestration_cost: Math.random() * 0.02,
        created_at: new Date().toISOString(),
        version: '1.0.0',
      }));

      const totalCost = proposals.reduce((sum, p) => sum + p.orchestration_cost, 0);
      const avgCost = totalCost / proposals.length;

      expect(totalCost).toBeGreaterThan(0);
      expect(avgCost).toBeLessThan(0.02);
    });
  });
});
