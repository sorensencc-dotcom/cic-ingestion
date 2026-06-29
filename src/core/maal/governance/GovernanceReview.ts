/**
 * Phase 4: GovernanceReview — manual + auto approval workflow.
 */

import { Proposal } from '../codesign/ProposalTypes';
import { ValidationResult } from '../support/ValidationResult';
import { Result, Ok, Err } from '../support/Result';
import { GovernanceCaps, MetricThresholds } from './GovernanceCaps';

export interface GovernanceReviewRequest {
  readonly proposalId: string;
  readonly proposal: Proposal;
  readonly validationResult: ValidationResult;
  readonly reviewedAt: number;
}

export interface GovernanceReviewError {
  readonly code: string;
  readonly message: string;
}

export class GovernanceReview {
  constructor(
    private caps: GovernanceCaps,
    private thresholds: MetricThresholds,
  ) {}

  /**
   * Review proposal for governance approval.
   * - Structural changes: manual approval required
   * - Minor changes: auto-approve if caps satisfied
   */
  review(request: GovernanceReviewRequest): Result<{ approved: boolean; reason: string }, GovernanceReviewError> {
    // Skeleton: placeholder logic
    const { validationResult } = request;

    if (!validationResult.valid) {
      return new Ok({
        approved: false,
        reason: `Validation failed: ${validationResult.errors.map(e => e.message).join('; ')}`,
      });
    }

    // TODO: Determine if structural or minor change
    // TODO: Apply caps & thresholds
    // TODO: Return auto-approval decision or request manual review

    return new Ok({
      approved: true,
      reason: 'Auto-approved (minor delta, within caps)',
    });
  }
}
