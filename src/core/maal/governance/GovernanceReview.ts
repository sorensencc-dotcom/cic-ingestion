/**
 * Phase 4: GovernanceReview — manual + auto approval workflow.
 * Structural changes (regime, fallback) → manual approval required.
 * Minor changes (reward, constraint, simulator) → auto-approve if within caps.
 */

import { Proposal, ProposalDelta } from '../codesign/ProposalTypes';
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

export interface GovernanceReviewDecision {
  readonly approved: boolean;
  readonly requiresManualApproval: boolean;
  readonly reason: string;
}

export class GovernanceReview {
  constructor(
    private caps: GovernanceCaps,
    private thresholds: MetricThresholds,
  ) {}

  /**
   * Review proposal for governance approval.
   * - Structural changes (regime, fallback): manual approval required
   * - Minor changes (reward, constraint, simulator): auto-approve if within caps
   */
  review(request: GovernanceReviewRequest): Result<GovernanceReviewDecision, GovernanceReviewError> {
    const { proposal, validationResult } = request;

    // Fail if validation errors
    if (!validationResult.valid) {
      return new Ok({
        approved: false,
        requiresManualApproval: false,
        reason: `Validation failed: ${validationResult.errors.map(e => e.message).join('; ')}`,
      });
    }

    // Determine if structural change
    const isStructural = proposal.deltas.some(d => d.type === 'regime' || d.type === 'fallback');

    if (isStructural) {
      return new Ok({
        approved: false,
        requiresManualApproval: true,
        reason: 'Structural changes (regime/fallback) require manual governance approval',
      });
    }

    // Check caps for minor changes
    const capsCheck = this.checkCaps(proposal.deltas);
    if (!capsCheck.passed) {
      return new Ok({
        approved: false,
        requiresManualApproval: true,
        reason: `Caps violation: ${capsCheck.reason}`,
      });
    }

    // Auto-approve if within caps
    if (this.caps.autoApproveMinorDeltas) {
      return new Ok({
        approved: true,
        requiresManualApproval: false,
        reason: 'Auto-approved: minor changes within governance caps',
      });
    }

    return new Ok({
      approved: false,
      requiresManualApproval: true,
      reason: 'Auto-approval disabled',
    });
  }

  private checkCaps(deltas: ProposalDelta[]): { passed: boolean; reason: string } {
    for (const delta of deltas) {
      // Check delta magnitude
      const magnitude = this.estimateMagnitude(delta);
      if (magnitude > this.caps.maxDeltaMagnitude) {
        return {
          passed: false,
          reason: `Delta magnitude ${magnitude.toFixed(2)} exceeds cap ${this.caps.maxDeltaMagnitude}`,
        };
      }
    }

    return { passed: true, reason: '' };
  }

  private estimateMagnitude(delta: ProposalDelta): number {
    // Estimate change magnitude (0-1 scale)
    switch (delta.type) {
      case 'regime':
        return 0.5; // Regime change is substantial but not maximal
      case 'constraint':
        return 0.3; // Constraint adjustment is moderate
      case 'fallback':
        return 0.4; // Graph restructuring
      case 'reward':
        // Weight/threshold changes
        return Math.abs((delta.weight || 0) - 0.5) * 2; // Normalized to [0, 1]
      case 'simulator':
        return 0.2; // Simulator updates are low-impact
      default:
        return 0;
    }
  }
}
