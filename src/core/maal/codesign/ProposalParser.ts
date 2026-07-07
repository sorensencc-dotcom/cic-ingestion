/**
 * Phase 4: ProposalParser — DSL text → Proposal object.
 * CI gate rule 4: All proposals via ProposalParser.
 * DSL grammar: JSON-based, high-level deltas only (no MAAL internals exposed).
 */

import { Proposal, ProposalDelta, RegimeDelta, ConstraintDelta, RewardDelta, SimulatorDelta, FallbackDelta } from './ProposalTypes';
import { Result, Ok, Err } from '../support/Result';

export interface ProposalParseError {
  readonly code: string;
  readonly line?: number;
  readonly message: string;
}

export class ProposalParser {
  /**
   * Parse DSL text into Proposal.
   * Accepts JSON with structure:
   * {
   *   "proposalId": "prop_123",
   *   "submittedBy": "spl_service",
   *   "rationale": "reason",
   *   "deltas": [
   *     { "type": "regime", "regimeId": "r1", ... },
   *     { "type": "reward", "componentId": "success", "weight": 0.45 },
   *     ...
   *   ]
   * }
   */
  parse(dslText: string): Result<Proposal, ProposalParseError> {
    try {
      const parsed = JSON.parse(dslText);

      // Validate required fields
      if (!parsed.proposalId || typeof parsed.proposalId !== 'string') {
        return new Err({
          code: 'MISSING_PROPOSAL_ID',
          message: 'proposalId (string) required',
        });
      }

      if (!parsed.submittedBy || typeof parsed.submittedBy !== 'string') {
        return new Err({
          code: 'MISSING_SUBMITTED_BY',
          message: 'submittedBy (string) required',
        });
      }

      if (!Array.isArray(parsed.deltas) || parsed.deltas.length === 0) {
        return new Err({
          code: 'INVALID_DELTAS',
          message: 'deltas (non-empty array) required',
        });
      }

      // Parse deltas
      const deltas: ProposalDelta[] = [];
      for (let i = 0; i < parsed.deltas.length; i++) {
        const deltaResult = this.parseDelta(parsed.deltas[i]);
        if (deltaResult.isErr) {
          return deltaResult as any;
        }
        deltas.push(deltaResult.unwrap());
      }

      const proposal: Proposal = {
        proposalId: parsed.proposalId,
        submittedBy: parsed.submittedBy,
        deltas,
        rationale: parsed.rationale || '',
        submittedAt: Date.now(),
        targetRegime: parsed.targetRegime,
      };

      return new Ok(proposal);
    } catch (e) {
      return new Err({
        code: 'PARSE_ERROR',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  private parseDelta(delta: any): Result<ProposalDelta, ProposalParseError> {
    if (!delta.type || typeof delta.type !== 'string') {
      return new Err({
        code: 'MISSING_DELTA_TYPE',
        message: 'Delta missing type field',
      });
    }

    switch (delta.type) {
      case 'regime':
        return this.parseRegimeDelta(delta);
      case 'constraint':
        return this.parseConstraintDelta(delta);
      case 'fallback':
        return this.parseFallbackDelta(delta);
      case 'reward':
        return this.parseRewardDelta(delta);
      case 'simulator':
        return this.parseSimulatorDelta(delta);
      default:
        return new Err({
          code: 'INVALID_DELTA_TYPE',
          message: `Unknown delta type: ${delta.type}`,
        });
    }
  }

  private parseRegimeDelta(delta: any): Result<RegimeDelta, ProposalParseError> {
    if (!delta.regimeId || typeof delta.regimeId !== 'string') {
      return new Err({
        code: 'INVALID_REGIME_DELTA',
        message: 'regimeId (string) required',
      });
    }

    return new Ok({
      type: 'regime',
      regimeId: delta.regimeId,
      modelSelector: delta.modelSelector,
      fallbackBehavior: delta.fallbackBehavior,
      constraints: delta.constraints,
    });
  }

  private parseConstraintDelta(delta: any): Result<ConstraintDelta, ProposalParseError> {
    if (!delta.constraintId || typeof delta.constraintId !== 'string') {
      return new Err({
        code: 'INVALID_CONSTRAINT_DELTA',
        message: 'constraintId (string) required',
      });
    }

    if (!['add', 'modify', 'remove'].includes(delta.action)) {
      return new Err({
        code: 'INVALID_CONSTRAINT_ACTION',
        message: "action must be 'add', 'modify', or 'remove'",
      });
    }

    return new Ok({
      type: 'constraint',
      constraintId: delta.constraintId,
      action: delta.action,
      constraintType: delta.constraintType || '',
      bounds: delta.bounds,
    });
  }

  private parseFallbackDelta(delta: any): Result<FallbackDelta, ProposalParseError> {
    if (!delta.fallbackId || typeof delta.fallbackId !== 'string') {
      return new Err({
        code: 'INVALID_FALLBACK_DELTA',
        message: 'fallbackId (string) required',
      });
    }

    return new Ok({
      type: 'fallback',
      fallbackId: delta.fallbackId,
      predecessors: Array.isArray(delta.predecessors) ? delta.predecessors : undefined,
      successors: Array.isArray(delta.successors) ? delta.successors : undefined,
      weight: delta.weight,
    });
  }

  private parseRewardDelta(delta: any): Result<RewardDelta, ProposalParseError> {
    if (!delta.componentId || typeof delta.componentId !== 'string') {
      return new Err({
        code: 'INVALID_REWARD_DELTA',
        message: 'componentId (string) required',
      });
    }

    if (delta.weight !== undefined && (typeof delta.weight !== 'number' || delta.weight < 0 || delta.weight > 1)) {
      return new Err({
        code: 'INVALID_WEIGHT',
        message: 'weight must be number in [0, 1]',
      });
    }

    return new Ok({
      type: 'reward',
      componentId: delta.componentId,
      weight: delta.weight,
      threshold: delta.threshold,
    });
  }

  private parseSimulatorDelta(delta: any): Result<SimulatorDelta, ProposalParseError> {
    if (!delta.simulatorId || typeof delta.simulatorId !== 'string') {
      return new Err({
        code: 'INVALID_SIMULATOR_DELTA',
        message: 'simulatorId (string) required',
      });
    }

    return new Ok({
      type: 'simulator',
      simulatorId: delta.simulatorId,
      modelPerformanceMatrix: delta.modelPerformanceMatrix,
      stateDistribution: delta.stateDistribution,
      observationWindow: delta.observationWindow,
    });
  }

  /**
   * Validate delta structure (high-level only, no MAAL logic).
   */
  validateDelta(delta: ProposalDelta): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!delta.type || !['regime', 'constraint', 'fallback', 'reward', 'simulator'].includes(delta.type)) {
      errors.push(`Invalid delta type: ${(delta as any).type}`);
    }

    // Forbidden fields check (Phase 4 constraint)
    const forbiddenFields = ['__internal', '__maal_bypass', '__phase1_direct'];
    Object.keys(delta as any).forEach(key => {
      if (forbiddenFields.includes(key)) {
        errors.push(`Forbidden field: ${key}`);
      }
    });

    return { valid: errors.length === 0, errors };
  }
}
