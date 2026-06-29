/**
 * Phase 4: ProposalValidationEngineImpl — validates proposals against Phase 1/2 invariants.
 */

import { Proposal, RegimeDelta, ConstraintDelta, FallbackDelta, RewardDelta, SimulatorDelta } from './ProposalTypes';
import { ProposalValidationEngine } from './ProposalValidationEngine';
import { ValidationResult, ValidationResultBuilder } from '../support/ValidationResult';
import { GLOBAL_ROUTING_BOUNDS } from './GlobalRoutingBounds';

export class ProposalValidationEngineImpl implements ProposalValidationEngine {
  validate(proposal: Proposal): ValidationResult {
    const builder = new ValidationResultBuilder();

    for (const delta of proposal.deltas) {
      this.validateDelta(delta, builder);
    }

    return builder.build();
  }

  private validateDelta(delta: any, builder: ValidationResultBuilder): void {
    switch (delta.type) {
      case 'regime':
        this.validateRegimeDelta(delta as RegimeDelta, builder);
        break;
      case 'constraint':
        this.validateConstraintDelta(delta as ConstraintDelta, builder);
        break;
      case 'fallback':
        this.validateFallbackDelta(delta as FallbackDelta, builder);
        break;
      case 'reward':
        this.validateRewardDelta(delta as RewardDelta, builder);
        break;
      case 'simulator':
        this.validateSimulatorDelta(delta as SimulatorDelta, builder);
        break;
    }
  }

  private validateRegimeDelta(delta: RegimeDelta, builder: ValidationResultBuilder): void {
    // Skeleton: placeholder checks
    if (!delta.regimeId) {
      builder.addError('REGIME_MISSING_ID', 'Regime delta missing regimeId', 'regimeId');
    }
  }

  private validateConstraintDelta(delta: ConstraintDelta, builder: ValidationResultBuilder): void {
    if (!delta.constraintId) {
      builder.addError('CONSTRAINT_MISSING_ID', 'Constraint delta missing constraintId', 'constraintId');
    }
    if (!['add', 'modify', 'remove'].includes(delta.action)) {
      builder.addError('CONSTRAINT_INVALID_ACTION', `Invalid action: ${delta.action}`, 'action');
    }
  }

  private validateFallbackDelta(delta: FallbackDelta, builder: ValidationResultBuilder): void {
    if (!delta.fallbackId) {
      builder.addError('FALLBACK_MISSING_ID', 'Fallback delta missing fallbackId', 'fallbackId');
    }
    // TODO: Check for cycles in fallback graph (Phase 1 DAG invariant)
  }

  private validateRewardDelta(delta: RewardDelta, builder: ValidationResultBuilder): void {
    if (!delta.componentId) {
      builder.addError('REWARD_MISSING_ID', 'Reward delta missing componentId', 'componentId');
    }
    if (delta.weight !== undefined && (delta.weight < 0 || delta.weight > 1)) {
      builder.addError('REWARD_WEIGHT_OUT_OF_RANGE', 'Weight must be in [0, 1]', 'weight', delta.weight);
    }
  }

  private validateSimulatorDelta(delta: SimulatorDelta, builder: ValidationResultBuilder): void {
    if (!delta.simulatorId) {
      builder.addError('SIMULATOR_MISSING_ID', 'Simulator delta missing simulatorId', 'simulatorId');
    }
    // TODO: Validate simulator state distribution sums to 1
  }
}
