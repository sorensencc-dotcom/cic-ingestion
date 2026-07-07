/**
 * Phase 4: BridgeOrchestrator — MAAL + SPL integration hub.
 * Extends Phase 1 routing with Phase 4 proposal lifecycle hooks.
 * All hooks use Result<T,E> monad pattern.
 */

import { Result, Ok, Err } from './support/Result';
import { Proposal } from './codesign/ProposalTypes';
import { ProposalParser, ProposalParseError } from './codesign/ProposalParser';
import { ProposalValidationEngine } from './codesign/ProposalValidationEngine';
import { ProposalValidationEngineImpl } from './codesign/ProposalValidationEngineImpl';
import { ValidationResult } from './support/ValidationResult';
import { GovernanceReview } from './governance/GovernanceReview';
import { DEFAULT_GOVERNANCE_CAPS, DEFAULT_METRIC_THRESHOLDS } from './governance/GovernanceCaps';
import { CanaryGateOrchestrator, CanaryGateOrchestrationResult, CanaryGateOrchestrationError } from './canary/CanaryGateOrchestrator';

export interface SubmitProposalError {
  code: string;
  message: string;
}

export interface ValidateProposalError {
  code: string;
  message: string;
}

export interface GovernanceReviewError {
  code: string;
  message: string;
}

export interface ExecuteCanaryError {
  code: string;
  message: string;
}

export interface PromoteOrRollbackError {
  code: string;
  message: string;
}

export interface GovernanceDecision {
  approved: boolean;
  requiresManualApproval: boolean;
  reason: string;
}

export interface PromotionDecision {
  proposalId: string;
  action: 'promoted' | 'rolled_back' | 'paused';
  rationale: string;
  appliedAt: number;
}

export class BridgeOrchestrator {
  private parser: ProposalParser;
  private validator: ProposalValidationEngine;
  private reviewer: GovernanceReview;
  private orchestrator: CanaryGateOrchestrator;

  constructor() {
    this.parser = new ProposalParser();
    this.validator = new ProposalValidationEngineImpl();
    this.reviewer = new GovernanceReview(DEFAULT_GOVERNANCE_CAPS, DEFAULT_METRIC_THRESHOLDS);
    this.orchestrator = new CanaryGateOrchestrator();
  }

  /**
   * Hook 1: Submit proposal from DSL.
   * Parses JSON DSL → Proposal object.
   */
  submitProposal(dsl: string): Result<Proposal, SubmitProposalError> {
    try {
      const parseResult = this.parser.parse(dsl);

      if (parseResult.isErr) {
        const err = parseResult.unwrapErr();
        return new Err({
          code: err.code,
          message: err.message,
        });
      }

      return new Ok(parseResult.unwrap());
    } catch (e) {
      return new Err({
        code: 'SUBMIT_PROPOSAL_ERROR',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  /**
   * Hook 2: Validate proposal against Phase 1/2 invariants.
   * Returns validation result with errors/warnings.
   */
  validateProposal(proposal: Proposal): Result<ValidationResult, ValidateProposalError> {
    try {
      const result = this.validator.validate(proposal);
      return new Ok(result);
    } catch (e) {
      return new Err({
        code: 'VALIDATE_PROPOSAL_ERROR',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  /**
   * Hook 3: Review proposal for governance approval.
   * Structural changes require manual approval.
   * Minor changes auto-approve if within caps.
   */
  governanceReview(proposal: Proposal, validationResult: ValidationResult): Result<GovernanceDecision, GovernanceReviewError> {
    try {
      const request = {
        proposalId: proposal.proposalId,
        proposal,
        validationResult,
        reviewedAt: Date.now(),
      };

      const reviewResult = this.reviewer.review(request);

      if (reviewResult.isErr) {
        return reviewResult;
      }

      const decision = reviewResult.unwrap()!;
      return new Ok({
        approved: decision.approved,
        requiresManualApproval: decision.requiresManualApproval,
        reason: decision.reason,
      });
    } catch (e) {
      return new Err({
        code: 'GOVERNANCE_REVIEW_ERROR',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  /**
   * Hook 4: Execute canary lifecycle.
   * Assigns 1% cohort, observes metrics, decides grow/pause/rollback.
   */
  async executeCanary(proposal: Proposal): Promise<Result<CanaryGateOrchestrationResult, ExecuteCanaryError>> {
    try {
      const result = await this.orchestrator.execute(proposal);

      if (result.isErr) {
        const err = result.unwrapErr()!;
        return new Err({
          code: err.code,
          message: err.message,
        });
      }

      return new Ok(result.unwrap()!);
    } catch (e) {
      return new Err({
        code: 'EXECUTE_CANARY_ERROR',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  /**
   * Hook 5: Promote to production or trigger rollback.
   * Applies canary decision (promoted/rolled_back/paused).
   */
  async promoteOrRollback(proposal: Proposal, canaryResult: CanaryGateOrchestrationResult): Promise<Result<PromotionDecision, PromoteOrRollbackError>> {
    try {
      let action: 'promoted' | 'rolled_back' | 'paused' = canaryResult.decision as any;

      // Validate action
      if (!['promoted', 'rolled_back', 'paused'].includes(action)) {
        return new Err({
          code: 'INVALID_CANARY_DECISION',
          message: `Invalid canary decision: ${action}`,
        });
      }

      // Apply decision (TODO: actual MAAL state mutation in production)
      const decision: PromotionDecision = {
        proposalId: proposal.proposalId,
        action,
        rationale: canaryResult.rationale,
        appliedAt: Date.now(),
      };

      return new Ok(decision);
    } catch (e) {
      return new Err({
        code: 'PROMOTE_OR_ROLLBACK_ERROR',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  /**
   * Orchestrated end-to-end flow (for testing/CLI).
   * Parse → Validate → Review → Canary → Promote.
   */
  async executeFullFlow(dsl: string): Promise<Result<PromotionDecision, string>> {
    // Step 1: Submit
    const submitResult = this.submitProposal(dsl);
    if (submitResult.isErr) {
      return new Err(`Submit failed: ${submitResult.unwrapErr()!.message}`);
    }
    const proposal = submitResult.unwrap()!;

    // Step 2: Validate
    const validateResult = this.validateProposal(proposal);
    if (validateResult.isErr) {
      return new Err(`Validate failed: ${validateResult.unwrapErr()!.message}`);
    }
    const validationResult = validateResult.unwrap()!;

    // Step 3: Review
    const reviewResult = this.governanceReview(proposal, validationResult);
    if (reviewResult.isErr) {
      return new Err(`Review failed: ${reviewResult.unwrapErr()!.message}`);
    }
    const reviewDecision = reviewResult.unwrap()!;

    // If manual approval required, stop here
    if (reviewDecision.requiresManualApproval && !reviewDecision.approved) {
      return new Err(`Governance approval required: ${reviewDecision.reason}`);
    }

    // Step 4: Canary
    const canaryResult = await this.executeCanary(proposal);
    if (canaryResult.isErr) {
      return new Err(`Canary execution failed: ${canaryResult.unwrapErr()!.message}`);
    }
    const canaryOutcome = canaryResult.unwrap()!;

    // Step 5: Promote
    const promoteResult = await this.promoteOrRollback(proposal, canaryOutcome);
    if (promoteResult.isErr) {
      return new Err(`Promotion failed: ${promoteResult.unwrapErr()!.message}`);
    }

    return new Ok(promoteResult.unwrap()!);
  }
}
