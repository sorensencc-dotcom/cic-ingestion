/**
 * Phase 4: ProposalParser — DSL text → Proposal object.
 * CI gate rule 4: All proposals via ProposalParser.
 */

import { Proposal, ProposalDelta } from './ProposalTypes';
import { Result, Ok, Err } from '../support/Result';

export interface ProposalParseError {
  readonly code: string;
  readonly line?: number;
  readonly message: string;
}

export class ProposalParser {
  /**
   * Parse DSL text into Proposal.
   * Grammar: compact JSON-like syntax (TBD in implementation phase)
   */
  parse(dslText: string): Result<Proposal, ProposalParseError> {
    // Skeleton: placeholder implementation
    try {
      // TODO: Implement DSL grammar parsing
      // For now, accept JSON Proposal format
      const parsed = JSON.parse(dslText);
      if (!parsed.proposalId || !parsed.submittedBy || !Array.isArray(parsed.deltas)) {
        return new Err({
          code: 'INVALID_PROPOSAL_STRUCTURE',
          message: 'Missing required fields: proposalId, submittedBy, deltas',
        });
      }
      return new Ok(parsed as Proposal);
    } catch (e) {
      return new Err({
        code: 'PARSE_ERROR',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  /**
   * Validate delta structure (high-level only, no MAAL logic).
   */
  validateDelta(delta: ProposalDelta): { valid: boolean; errors: string[] } {
    // Skeleton: placeholder validation
    const errors: string[] = [];

    if (!delta.type || !['regime', 'constraint', 'fallback', 'reward', 'simulator'].includes(delta.type)) {
      errors.push(`Invalid delta type: ${(delta as any).type}`);
    }

    return { valid: errors.length === 0, errors };
  }
}
