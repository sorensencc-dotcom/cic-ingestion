/**
 * Phase 4→5 Lineage Verification
 *
 * Responsibilities:
 * - Trace any cohort decision back to original Phase 4 proposal
 * - Verify chain of custody: Proposal → Variant → CohortAssignment → CohortDecision
 * - Validate immutability of audit trail (decisions frozen, append-only)
 * - Ensure traceability for governance compliance
 *
 * Data Flow:
 * 1. Proposal (Phase 4 ProposalCreation) with proposal_id
 * 2. Variant (ABTestEngine) with variant_id + proposal_id link
 * 3. CohortAssignment (MultiCohortEngine) with cohort_id + proposal_id link
 * 4. CohortDecision (CohortPromotionEngine) with decision_id + cohort_id link
 * 5. GovernanceLog (Phase 4/5) records immutable audit trail
 */

import { Proposal } from './proposal-validator';
import { ABVariant } from './ab-test-engine';
import { CohortAssignment } from './multi-cohort-engine';
import { CohortDecision } from './cohort-promotion-engine';
import { GovernanceLogEntry } from './governance-log';

/**
 * Lineage chain: traces a cohort decision back to original proposal
 */
export interface LineageChain {
  proposal_id: string;
  variant_id?: string;
  cohort_id?: string;
  decision_id?: string;
  chain_path: string;
  verified_at: string;
}

/**
 * Decision audit record: immutable record of a decision with verification
 */
export interface AuditRecord {
  decision_id: string;
  proposal_id: string;
  cohort_id: string;
  decision: 'promote' | 'rollback' | 'hold' | 'idle';
  decided_at: string;
  chain_verified: boolean;
  immutable: boolean;
  order_verified: boolean;
}

/**
 * Audit trail verification result
 */
export interface AuditTrailVerification {
  valid: boolean;
  total_decisions: number;
  verified_decisions: number;
  immutable_decisions: number;
  order_violations: number;
  errors: string[];
  audit_records: AuditRecord[];
}

/**
 * Phase 4→5 Lineage Verifier
 *
 * Ensures traceability and immutability across governance phases
 */
export class Phase45LineageVerifier {
  /**
   * Trace a cohort decision back to original proposal
   *
   * Verifies the chain:
   * CohortDecision → CohortAssignment → Variant → Proposal
   *
   * @param cohortDecision Decision to trace
   * @param variant Variant for this decision
   * @param cohortAssignment Cohort assignment for this decision
   * @param proposal Original proposal
   * @returns LineageChain if traceability verified
   */
  traceDecisionToProposal(
    cohortDecision: CohortDecision,
    variant: ABVariant | undefined,
    cohortAssignment: CohortAssignment,
    proposal: Proposal
  ): LineageChain {
    // Validate chain links
    const errors: string[] = [];

    // Link 1: Proposal exists and has proposal_id
    if (!proposal || !proposal.proposal_id) {
      errors.push('Proposal missing or lacks proposal_id');
    }

    // Link 2: CohortAssignment links to proposal
    if (cohortAssignment.proposal_id !== proposal.proposal_id) {
      errors.push(
        `CohortAssignment proposal_id (${cohortAssignment.proposal_id}) does not match proposal_id (${proposal.proposal_id})`
      );
    }

    // Link 3: CohortDecision links to proposal
    if (cohortDecision.proposal_id !== proposal.proposal_id) {
      errors.push(
        `CohortDecision proposal_id (${cohortDecision.proposal_id}) does not match proposal_id (${proposal.proposal_id})`
      );
    }

    // Link 4: CohortDecision links to cohort_id
    if (cohortDecision.cohort_id !== cohortAssignment.cohort_id) {
      errors.push(
        `CohortDecision cohort_id (${cohortDecision.cohort_id}) does not match assignment cohort_id (${cohortAssignment.cohort_id})`
      );
    }

    if (errors.length > 0) {
      throw new Error(`Lineage chain broken: ${errors.join('; ')}`);
    }

    // Build chain path
    const variantId = variant?.variant_id || 'unassigned';
    const chainPath = `proposal:${proposal.proposal_id} → variant:${variantId} → cohort:${cohortAssignment.cohort_id} → decision:${cohortDecision.decision_id}`;

    return {
      proposal_id: proposal.proposal_id,
      variant_id: variantId,
      cohort_id: cohortAssignment.cohort_id,
      decision_id: cohortDecision.decision_id,
      chain_path: chainPath,
      verified_at: new Date().toISOString(),
    };
  }

  /**
   * Verify immutability of a cohort decision
   *
   * Checks that decision record is frozen and cannot be modified
   *
   * @param cohortDecision Decision to verify
   * @returns Immutability status
   */
  verifyDecisionImmutability(cohortDecision: CohortDecision): {
    immutable: boolean;
    error?: string;
  } {
    // Check if decision object is frozen
    if (!Object.isFrozen(cohortDecision)) {
      return {
        immutable: false,
        error: `Decision object is not frozen: ${cohortDecision.decision_id}`,
      };
    }

    // Check if metrics array is frozen
    if (!Object.isFrozen(cohortDecision.metrics)) {
      return {
        immutable: false,
        error: `Decision metrics array is not frozen: ${cohortDecision.decision_id}`,
      };
    }

    return { immutable: true };
  }

  /**
   * Verify append-only audit trail ordering
   *
   * Validates that decisions are time-ordered and cannot be modified
   *
   * @param decisions Decision sequence to verify
   * @returns Ordering verification result
   */
  verifyAuditTrailOrdering(decisions: readonly CohortDecision[]): {
    valid: boolean;
    violations: Array<{ index: number; reason: string }>;
  } {
    const violations: Array<{ index: number; reason: string }> = [];

    // Check chronological ordering
    for (let i = 1; i < decisions.length; i++) {
      const prevTime = new Date(decisions[i - 1].decided_at).getTime();
      const currTime = new Date(decisions[i].decided_at).getTime();

      // Allow same timestamp (within 1ms)
      if (currTime < prevTime - 1) {
        violations.push({
          index: i,
          reason: `Timestamp violation: decision[${i}] (${decisions[i].decided_at}) is before decision[${i - 1}] (${decisions[i - 1].decided_at})`,
        });
      }

      // Verify both decisions are immutable
      const immutCheck1 = this.verifyDecisionImmutability(decisions[i - 1]);
      if (!immutCheck1.immutable) {
        violations.push({
          index: i - 1,
          reason: immutCheck1.error || 'Decision is not immutable',
        });
      }

      const immutCheck2 = this.verifyDecisionImmutability(decisions[i]);
      if (!immutCheck2.immutable) {
        violations.push({
          index: i,
          reason: immutCheck2.error || 'Decision is not immutable',
        });
      }
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  /**
   * Verify complete audit trail: immutability + ordering + traceability
   *
   * @param decisions Decision sequence
   * @param proposalId Expected proposal_id for all decisions
   * @returns Comprehensive audit trail verification
   */
  verifyAuditTrail(
    decisions: readonly CohortDecision[],
    proposalId: string
  ): AuditTrailVerification {
    const errors: string[] = [];
    const auditRecords: AuditRecord[] = [];

    // Verify ordering first
    const orderingCheck = this.verifyAuditTrailOrdering(decisions);
    if (!orderingCheck.valid) {
      errors.push(
        `Audit trail ordering violated: ${orderingCheck.violations.length} violations`
      );
      orderingCheck.violations.forEach((v) => {
        errors.push(`  [${v.index}] ${v.reason}`);
      });
    }

    let verifiedCount = 0;
    let immutableCount = 0;

    // Verify each decision
    for (const decision of decisions) {
      // Check proposal_id linkage
      if (decision.proposal_id === proposalId) {
        verifiedCount++;
      } else {
        errors.push(
          `Decision ${decision.decision_id} proposal_id (${decision.proposal_id}) does not match expected (${proposalId})`
        );
      }

      // Check immutability
      const immutCheck = this.verifyDecisionImmutability(decision);
      if (immutCheck.immutable) {
        immutableCount++;
      } else {
        errors.push(immutCheck.error || `Decision ${decision.decision_id} is not immutable`);
      }

      // Create audit record
      const auditRecord: AuditRecord = {
        decision_id: decision.decision_id,
        proposal_id: decision.proposal_id,
        cohort_id: decision.cohort_id,
        decision: decision.decision,
        decided_at: decision.decided_at,
        chain_verified: decision.proposal_id === proposalId,
        immutable: immutCheck.immutable,
        order_verified: orderingCheck.valid,
      };

      auditRecords.push(auditRecord);
    }

    return {
      valid: errors.length === 0 && orderingCheck.valid,
      total_decisions: decisions.length,
      verified_decisions: verifiedCount,
      immutable_decisions: immutableCount,
      order_violations: orderingCheck.violations.length,
      errors,
      audit_records: auditRecords,
    };
  }

  /**
   * Verify governance log entry immutability
   *
   * @param entry Log entry to verify
   * @returns Immutability status
   */
  verifyGovernanceLogImmutability(entry: GovernanceLogEntry): {
    immutable: boolean;
    error?: string;
  } {
    // Check if entry is frozen
    if (!Object.isFrozen(entry)) {
      return {
        immutable: false,
        error: `GovernanceLogEntry is not frozen for proposal: ${entry.proposal_id}`,
      };
    }

    return { immutable: true };
  }

  /**
   * Build complete lineage report for a proposal
   *
   * Traces proposal through all phases and verifies chain integrity
   *
   * @param proposal Proposal to trace
   * @param variant Associated variant (if any)
   * @param cohortAssignments Assignments for this proposal
   * @param cohortDecisions Decisions for this proposal
   * @returns Lineage report with verification status
   */
  buildLineageReport(
    proposal: Proposal,
    variant: ABVariant | undefined,
    cohortAssignments: CohortAssignment[],
    cohortDecisions: CohortDecision[]
  ): {
    proposal_id: string;
    lineage_chains: LineageChain[];
    audit_trail_valid: boolean;
    total_decisions: number;
    verified_decisions: number;
    immutable_decisions: number;
    errors: string[];
  } {
    const errors: string[] = [];
    const lineageChains: LineageChain[] = [];

    // Verify each decision traces back to proposal
    for (const decision of cohortDecisions) {
      try {
        // Find matching cohort assignment
        const assignment = cohortAssignments.find(
          (a) => a.cohort_id === decision.cohort_id
        );

        if (!assignment) {
          errors.push(
            `No cohort assignment found for decision cohort: ${decision.cohort_id}`
          );
          continue;
        }

        // Trace decision to proposal
        const chain = this.traceDecisionToProposal(
          decision,
          variant,
          assignment,
          proposal
        );

        lineageChains.push(chain);
      } catch (error) {
        errors.push(
          `Lineage trace failed for decision ${decision.decision_id}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Verify audit trail
    const auditTrailCheck = this.verifyAuditTrail(
      cohortDecisions as readonly CohortDecision[],
      proposal.proposal_id
    );

    if (!auditTrailCheck.valid) {
      errors.push(
        `Audit trail invalid: ${auditTrailCheck.errors.join('; ')}`
      );
    }

    return {
      proposal_id: proposal.proposal_id,
      lineage_chains: lineageChains,
      audit_trail_valid: auditTrailCheck.valid,
      total_decisions: cohortDecisions.length,
      verified_decisions: auditTrailCheck.verified_decisions,
      immutable_decisions: auditTrailCheck.immutable_decisions,
      errors,
    };
  }
}
