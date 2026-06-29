/**
 * Phase 4: ProposalValidationEngineImpl — validates proposals against Phase 1/2 invariants.
 * Test spec contract: cost ceilings, latency ceilings, graph cycles, reward ranges, simulator coverage.
 */

import { Proposal, RegimeDelta, ConstraintDelta, FallbackDelta, RewardDelta, SimulatorDelta } from './ProposalTypes';
import { ProposalValidationEngine } from './ProposalValidationEngine';
import { ValidationResult, ValidationResultBuilder } from '../support/ValidationResult';
import { GLOBAL_ROUTING_BOUNDS } from './GlobalRoutingBounds';

export class ProposalValidationEngineImpl implements ProposalValidationEngine {
  validate(proposal: Proposal): ValidationResult {
    const builder = new ValidationResultBuilder();

    // Validate each delta against Phase 1/2 invariants
    for (const delta of proposal.deltas) {
      this.validateDelta(delta, builder);
    }

    // Cross-delta validation (e.g., graph integrity)
    this.validateCrossDeltaInvariants(proposal.deltas, builder);

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
    if (!delta.regimeId) {
      builder.addError('REGIME_MISSING_ID', 'Regime delta missing regimeId', 'regimeId');
    }
    // TODO: Validate regime references valid Phase 1 models
  }

  private validateConstraintDelta(delta: ConstraintDelta, builder: ValidationResultBuilder): void {
    if (!delta.constraintId) {
      builder.addError('CONSTRAINT_MISSING_ID', 'Constraint delta missing constraintId', 'constraintId');
    }

    if (!['add', 'modify', 'remove'].includes(delta.action)) {
      builder.addError('CONSTRAINT_INVALID_ACTION', `Invalid action: ${delta.action}`, 'action');
    }

    // Validate bounds against global constraints (Phase 1)
    if (delta.bounds) {
      if (delta.bounds.max !== undefined && delta.bounds.max > GLOBAL_ROUTING_BOUNDS.maxCostPerTask) {
        builder.addError(
          'CONSTRAINT_EXCEEDS_GLOBAL_COST_CEILING',
          `Constraint max (${delta.bounds.max}) exceeds global ceiling (${GLOBAL_ROUTING_BOUNDS.maxCostPerTask})`,
          'bounds.max',
          delta.bounds.max,
        );
      }

      if (delta.bounds.max !== undefined && delta.bounds.max > GLOBAL_ROUTING_BOUNDS.maxLatencyPerTask) {
        builder.addError(
          'CONSTRAINT_EXCEEDS_GLOBAL_LATENCY_CEILING',
          `Constraint max (${delta.bounds.max}) exceeds global ceiling (${GLOBAL_ROUTING_BOUNDS.maxLatencyPerTask})`,
          'bounds.max',
          delta.bounds.max,
        );
      }
    }
  }

  private validateFallbackDelta(delta: FallbackDelta, builder: ValidationResultBuilder): void {
    if (!delta.fallbackId) {
      builder.addError('FALLBACK_MISSING_ID', 'Fallback delta missing fallbackId', 'fallbackId');
    }

    // Structural validation: weight bounds
    if (delta.weight !== undefined) {
      if (delta.weight < 0 || delta.weight > 1) {
        builder.addError(
          'FALLBACK_WEIGHT_OUT_OF_RANGE',
          'Fallback weight must be in [0, 1]',
          'weight',
          delta.weight,
        );
      }
    }

    // TODO: Check for cycles in fallback graph via DFS (Phase 1 DAG invariant)
    // This will be deferred to graph integrity check
  }

  private validateRewardDelta(delta: RewardDelta, builder: ValidationResultBuilder): void {
    if (!delta.componentId) {
      builder.addError('REWARD_MISSING_ID', 'Reward delta missing componentId', 'componentId');
    }

    // Validate weight bounds (normalized)
    if (delta.weight !== undefined) {
      if (typeof delta.weight !== 'number' || delta.weight < 0 || delta.weight > 1) {
        builder.addError(
          'REWARD_WEIGHT_OUT_OF_RANGE',
          'Weight must be number in [0, 1]',
          'weight',
          delta.weight,
        );
      }
    }

    // Validate threshold bounds (if present)
    if (delta.threshold !== undefined) {
      if (typeof delta.threshold !== 'number' || delta.threshold < 0 || delta.threshold > 1) {
        builder.addError(
          'REWARD_THRESHOLD_OUT_OF_RANGE',
          'Threshold must be number in [0, 1]',
          'threshold',
          delta.threshold,
        );
      }
    }
  }

  private validateSimulatorDelta(delta: SimulatorDelta, builder: ValidationResultBuilder): void {
    if (!delta.simulatorId) {
      builder.addError('SIMULATOR_MISSING_ID', 'Simulator delta missing simulatorId', 'simulatorId');
    }

    // Validate state distribution sums to 1 (if provided)
    if (delta.stateDistribution) {
      const sum = Object.values(delta.stateDistribution).reduce((a: number, b: any) => a + (b as number), 0);
      if (Math.abs(sum - 1.0) > 0.01) {
        // Allow 1% tolerance for floating point
        builder.addWarning(
          'SIMULATOR_STATE_DIST_NOT_NORMALIZED',
          `State distribution sums to ${sum.toFixed(3)}, should be 1.0`,
          'stateDistribution',
        );
      }
    }

    // Validate model performance matrix bounds
    if (delta.modelPerformanceMatrix) {
      Object.entries(delta.modelPerformanceMatrix).forEach(([modelId, metrics]: [string, any]) => {
        Object.entries(metrics).forEach(([metricName, value]: [string, any]) => {
          if (typeof value === 'number') {
            if (metricName.includes('cost') && value > GLOBAL_ROUTING_BOUNDS.maxCostPerTask) {
              builder.addError(
                'SIMULATOR_COST_EXCEEDS_CEILING',
                `Model ${modelId} cost ${value} exceeds ceiling ${GLOBAL_ROUTING_BOUNDS.maxCostPerTask}`,
                `modelPerformanceMatrix.${modelId}.${metricName}`,
              );
            }
            if (metricName.includes('latency') && value > GLOBAL_ROUTING_BOUNDS.maxLatencyPerTask) {
              builder.addError(
                'SIMULATOR_LATENCY_EXCEEDS_CEILING',
                `Model ${modelId} latency ${value} exceeds ceiling ${GLOBAL_ROUTING_BOUNDS.maxLatencyPerTask}`,
                `modelPerformanceMatrix.${modelId}.${metricName}`,
              );
            }
          }
        });
      });
    }
  }

  private validateCrossDeltaInvariants(deltas: any[], builder: ValidationResultBuilder): void {
    // TODO: Implement cross-delta validation:
    // 1. Check fallback graph for cycles (DAG invariant)
    // 2. Check total cost/latency doesn't exceed global bounds
    // 3. Ensure all referenced models/regimes exist in Phase 1
  }
}
