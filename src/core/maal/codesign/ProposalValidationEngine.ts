/**
 * Phase 4: ProposalValidationEngine interface.
 */

import { Proposal } from './ProposalTypes';
import { ValidationResult } from '../support/ValidationResult';

export interface ProposalValidationEngine {
  /**
   * Validate proposal against MAAL invariants.
   * Checks:
   * - Cost ceilings (global bounds)
   * - Latency ceilings (global bounds)
   * - Graph cycles (fallback DAG)
   * - Reward ranges (normalized weights)
   * - Simulator coverage (state space)
   */
  validate(proposal: Proposal): ValidationResult;
}
