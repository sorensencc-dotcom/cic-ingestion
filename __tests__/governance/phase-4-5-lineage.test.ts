/**
 * Phase 4→5 Lineage Verification Tests
 *
 * Test Coverage:
 * 1. proposal_variant_cohort_traceability: Trace any cohort decision back to original proposal
 * 2. decision_audit_trail: Record all decisions immutably, verify chain of custody
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { Phase45LineageVerifier } from '../../src/governance/phase-4-5-lineage';
import { Proposal } from '../../src/governance/proposal-validator';
import { ABVariant } from '../../src/governance/ab-test-engine';
import { CohortAssignment } from '../../src/governance/multi-cohort-engine';
import { CohortDecision, AggregatedMetric } from '../../src/governance/cohort-promotion-engine';

describe('Phase 4→5 Lineage Verification', () => {
  let verifier: Phase45LineageVerifier;

  beforeEach(() => {
    verifier = new Phase45LineageVerifier();
  });

  /**
   * TEST 1: proposal_variant_cohort_traceability
   * Scenario: Trace any cohort decision back to original proposal
   * - Create Proposal (Phase 4)
   * - Convert to Variant (ABTestEngine)
   * - Allocate to Cohort (MultiCohortEngine)
   * - Verify chain: proposal_id → variant_id → cohort_id
   * - Trace decision back to original proposal_id
   */
  it('proposal_variant_cohort_traceability: traces full chain from proposal to decision', () => {
    // Step 1: Create Phase 4 Proposal
    const proposal: Proposal = {
      proposal_id: 'proposal-enrichment-v2',
      source_entry_id: 'entry-123-abc',
      profile: 'api:familysearch',
      lane: 'deep',
      orchestration_cost: 0.15,
      created_at: new Date('2026-07-11T10:00:00Z').toISOString(),
      version: '1.0.0',
    };

    // Step 2: Convert to Variant (ABTestEngine)
    const variant: ABVariant = Object.freeze({
      variant_id: 'variant-ml-v3',
      name: 'ML v3 Strategy',
      description: 'Enhanced machine learning enrichment',
      treatment_config: Object.freeze({
        algorithm: 'ml-v3',
        confidence_threshold: 0.88,
        feature_set: 'expanded-v2',
      }),
      created_at: new Date('2026-07-11T10:30:00Z').toISOString(),
      created_by: 'system',
    });

    // Step 3: Allocate to Cohort (MultiCohortEngine)
    const cohortAssignment: CohortAssignment = {
      assignment_id: 'assign-proposal-enrichment-v2-123def456',
      proposal_id: proposal.proposal_id,
      user_id: 'user-test-001',
      cohort_id: 'cohort-10-percent',
      cohort_size: 0.1,
      assigned_at: new Date('2026-07-11T11:00:00Z').toISOString(),
      progression_stage: 0,
    };

    // Step 4: Create Cohort Decision (CohortPromotionEngine)
    const metrics: readonly AggregatedMetric[] = Object.freeze([
      { metric_name: 'error_rate', value: 0.01, status: 'pass' },
      { metric_name: 'cost_delta', value: 0.05, status: 'pass' },
    ]);

    const cohortDecision: CohortDecision = Object.freeze({
      decision_id: 'decision-cohort-10-percent-enrichment-v2',
      cohort_id: cohortAssignment.cohort_id,
      proposal_id: proposal.proposal_id,
      assignment_id: cohortAssignment.assignment_id,
      decision: 'promote',
      metrics: metrics,
      reason: 'All metrics passed threshold and observation window complete',
      observation_duration_ms: 3600000, // 1 hour
      elapsed_duration_ms: 3600000,
      decided_at: new Date('2026-07-11T12:00:00Z').toISOString(),
    });

    // ===== TRACEABILITY VERIFICATION =====

    // Verify 1: Trace decision back to proposal
    const lineageChain = verifier.traceDecisionToProposal(
      cohortDecision,
      variant,
      cohortAssignment,
      proposal
    );

    expect(lineageChain.proposal_id).toBe(proposal.proposal_id);
    expect(lineageChain.variant_id).toBe(variant.variant_id);
    expect(lineageChain.cohort_id).toBe(cohortAssignment.cohort_id);
    expect(lineageChain.decision_id).toBe(cohortDecision.decision_id);

    // Verify 2: Chain path contains all elements (proposal → variant → cohort → decision)
    expect(lineageChain.chain_path).toContain('proposal:proposal-enrichment-v2');
    expect(lineageChain.chain_path).toContain('variant:variant-ml-v3');
    expect(lineageChain.chain_path).toContain('cohort:cohort-10-percent');
    expect(lineageChain.chain_path).toContain('decision:decision-cohort-10-percent-enrichment-v2');
    expect(lineageChain.verified_at).toBeDefined();

    // Verify 3: Build complete lineage report
    const report = verifier.buildLineageReport(
      proposal,
      variant,
      [cohortAssignment],
      [cohortDecision]
    );

    expect(report.proposal_id).toBe(proposal.proposal_id);
    expect(report.lineage_chains.length).toBe(1);
    expect(report.lineage_chains[0].decision_id).toBe(cohortDecision.decision_id);
    expect(report.errors.length).toBe(0);
    expect(report.total_decisions).toBe(1);
    expect(report.verified_decisions).toBe(1);

    // Verify 4: Detect broken lineage (proposal_id mismatch)
    const brokenAssignment: CohortAssignment = {
      assignment_id: 'assign-wrong-proposal',
      proposal_id: 'proposal-wrong-id', // MISMATCH
      cohort_id: 'cohort-25-percent',
      cohort_size: 0.25,
      assigned_at: new Date().toISOString(),
      progression_stage: 1,
    };

    expect(() => {
      verifier.traceDecisionToProposal(cohortDecision, variant, brokenAssignment, proposal);
    }).toThrow('Lineage chain broken');
  });

  /**
   * TEST 2: decision_audit_trail
   * Scenario: Record all decisions immutably, verify chain of custody
   * - Record series of decisions (promote, continue, rollback)
   * - Verify immutability (decisions frozen, no modifications)
   * - Verify append-only log (decisions ordered by timestamp)
   * - Verify full chain: proposal → variant → cohort → decision
   */
  it('decision_audit_trail: records decisions immutably with append-only chain of custody', () => {
    // Step 1: Create a sequence of decisions in chronological order (immutable)
    const decisions: CohortDecision[] = [
      // Decision 1: Initial 10% cohort promoted
      Object.freeze({
        decision_id: 'decision-1-10pct',
        cohort_id: 'cohort-10-percent',
        proposal_id: 'proposal-multi-wave',
        assignment_id: 'assign-1',
        decision: 'promote' as const,
        metrics: Object.freeze([
          { metric_name: 'error_rate', value: 0.01, status: 'pass' as const },
        ]),
        reason: 'First cohort metrics pass',
        observation_duration_ms: 1800000,
        elapsed_duration_ms: 1800000,
        decided_at: new Date('2026-07-11T12:00:00Z').toISOString(),
      }),

      // Decision 2: 25% cohort promoted (time advances)
      Object.freeze({
        decision_id: 'decision-2-25pct',
        cohort_id: 'cohort-25-percent',
        proposal_id: 'proposal-multi-wave',
        assignment_id: 'assign-2',
        decision: 'promote' as const,
        metrics: Object.freeze([
          { metric_name: 'error_rate', value: 0.015, status: 'pass' as const },
        ]),
        reason: 'Second cohort metrics pass',
        observation_duration_ms: 1800000,
        elapsed_duration_ms: 1800000,
        decided_at: new Date('2026-07-11T12:30:00Z').toISOString(),
      }),

      // Decision 3: 50% cohort held (time advances)
      Object.freeze({
        decision_id: 'decision-3-50pct',
        cohort_id: 'cohort-50-percent',
        proposal_id: 'proposal-multi-wave',
        assignment_id: 'assign-3',
        decision: 'hold' as const,
        metrics: Object.freeze([
          { metric_name: 'error_rate', value: 0.025, status: 'fail' as const },
        ]),
        reason: 'Error rate exceeded threshold',
        observation_duration_ms: 1800000,
        elapsed_duration_ms: 900000,
        decided_at: new Date('2026-07-11T13:00:00Z').toISOString(),
      }),
    ];

    // ===== IMMUTABILITY VERIFICATION =====

    // Verify 1: Each decision is frozen (immutable)
    for (const decision of decisions) {
      expect(Object.isFrozen(decision)).toBe(true);
      expect(Object.isFrozen(decision.metrics)).toBe(true);

      const immutCheck = verifier.verifyDecisionImmutability(decision);
      expect(immutCheck.immutable).toBe(true);

      // Attempt to mutate should fail
      let mutationThrown = false;
      try {
        (decision as any).decision = 'rollback';
      } catch {
        mutationThrown = true;
      }
      expect(mutationThrown).toBe(true);
    }

    // ===== APPEND-ONLY LOG VERIFICATION =====

    // Verify 2: Decisions are ordered by timestamp (append-only)
    const orderingCheck = verifier.verifyAuditTrailOrdering(
      decisions as readonly CohortDecision[]
    );
    expect(orderingCheck.valid).toBe(true);
    expect(orderingCheck.violations.length).toBe(0);

    // Verify 3: Timestamps are monotonically increasing
    for (let i = 1; i < decisions.length; i++) {
      const prevTime = new Date(decisions[i - 1].decided_at).getTime();
      const currTime = new Date(decisions[i].decided_at).getTime();
      expect(currTime).toBeGreaterThanOrEqual(prevTime);
    }

    // ===== CHAIN OF CUSTODY VERIFICATION =====

    // Verify 4: Complete audit trail (ordering + immutability + traceability)
    const auditTrailCheck = verifier.verifyAuditTrail(
      decisions as readonly CohortDecision[],
      'proposal-multi-wave'
    );
    expect(auditTrailCheck.valid).toBe(true);
    expect(auditTrailCheck.total_decisions).toBe(3);
    expect(auditTrailCheck.verified_decisions).toBe(3);
    expect(auditTrailCheck.immutable_decisions).toBe(3);
    expect(auditTrailCheck.order_violations).toBe(0);
    expect(auditTrailCheck.errors.length).toBe(0);

    // Verify 5: All audit records show chain of custody verified
    expect(auditTrailCheck.audit_records.length).toBe(3);
    for (const record of auditTrailCheck.audit_records) {
      expect(record.proposal_id).toBe('proposal-multi-wave');
      expect(record.chain_verified).toBe(true);
      expect(record.immutable).toBe(true);
      expect(record.order_verified).toBe(true);
    }

    // ===== VIOLATION DETECTION =====

    // Verify 6: Detect out-of-order decisions
    const badOrderDecisions: CohortDecision[] = [
      Object.freeze({
        decision_id: 'bad-1',
        cohort_id: 'cohort-1',
        proposal_id: 'proposal-bad-order',
        assignment_id: 'assign-bad-1',
        decision: 'promote' as const,
        metrics: Object.freeze([]),
        reason: 'First',
        observation_duration_ms: 1000,
        elapsed_duration_ms: 1000,
        decided_at: new Date('2026-07-11T10:00:00Z').toISOString(),
      }),
      Object.freeze({
        decision_id: 'bad-2',
        cohort_id: 'cohort-2',
        proposal_id: 'proposal-bad-order',
        assignment_id: 'assign-bad-2',
        decision: 'hold' as const,
        metrics: Object.freeze([]),
        reason: 'Second (but earlier timestamp)',
        observation_duration_ms: 1000,
        elapsed_duration_ms: 500,
        decided_at: new Date('2026-07-11T09:00:00Z').toISOString(), // EARLIER - violates!
      }),
    ];

    const badOrderCheck = verifier.verifyAuditTrail(
      badOrderDecisions as readonly CohortDecision[],
      'proposal-bad-order'
    );
    expect(badOrderCheck.valid).toBe(false);
    expect(badOrderCheck.order_violations).toBeGreaterThan(0);

    // Verify 7: Detect broken lineage (proposal_id mismatch)
    const badLineageDecisions: CohortDecision[] = [
      Object.freeze({
        decision_id: 'good-lineage',
        cohort_id: 'cohort-1',
        proposal_id: 'proposal-correct',
        assignment_id: 'assign-good',
        decision: 'promote' as const,
        metrics: Object.freeze([]),
        reason: 'Correct',
        observation_duration_ms: 1000,
        elapsed_duration_ms: 1000,
        decided_at: new Date('2026-07-11T10:00:00Z').toISOString(),
      }),
      Object.freeze({
        decision_id: 'bad-lineage',
        cohort_id: 'cohort-2',
        proposal_id: 'proposal-different', // WRONG!
        assignment_id: 'assign-bad',
        decision: 'hold' as const,
        metrics: Object.freeze([]),
        reason: 'Wrong proposal',
        observation_duration_ms: 1000,
        elapsed_duration_ms: 1000,
        decided_at: new Date('2026-07-11T10:30:00Z').toISOString(),
      }),
    ];

    const badLineageCheck = verifier.verifyAuditTrail(
      badLineageDecisions as readonly CohortDecision[],
      'proposal-correct'
    );
    expect(badLineageCheck.valid).toBe(false);
    expect(badLineageCheck.verified_decisions).toBe(1); // Only first verified
    expect(badLineageCheck.audit_records[0].chain_verified).toBe(true);
    expect(badLineageCheck.audit_records[1].chain_verified).toBe(false);
  });
});
