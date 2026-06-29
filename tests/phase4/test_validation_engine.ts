/**
 * Phase 4: Validation Engine Tests (5 contracts)
 * Cost/latency ceilings, graph cycles, reward ranges, simulator coverage.
 */

import { describe, it, expect } from '@jest/globals';
import { ProposalValidationEngineImpl } from '../../src/core/maal/codesign/ProposalValidationEngineImpl';
import { Proposal } from '../../src/core/maal/codesign/ProposalTypes';

describe('Validation Engine', () => {
  const validator = new ProposalValidationEngineImpl();

  it('contract: cost ceiling exceeded → error', () => {
    const proposal: Proposal = {
      proposalId: 'prop_ceil_01',
      submittedBy: 'tester',
      deltas: [
        {
          type: 'constraint',
          constraintId: 'cost_limit',
          action: 'modify',
          constraintType: 'cost',
          bounds: { min: 0, max: 0.5 }, // Exceeds GLOBAL_ROUTING_BOUNDS.maxCostPerTask (0.10)
        },
      ],
      rationale: 'Test cost ceiling',
      submittedAt: Date.now(),
    };

    const result = validator.validate(proposal);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code.includes('COST_CEILING'))).toBe(true);
  });

  it('contract: latency ceiling exceeded → error', () => {
    const proposal: Proposal = {
      proposalId: 'prop_lat_01',
      submittedBy: 'tester',
      deltas: [
        {
          type: 'constraint',
          constraintId: 'latency_limit',
          action: 'modify',
          constraintType: 'latency',
          bounds: { min: 0, max: 10000 }, // Exceeds GLOBAL_ROUTING_BOUNDS.maxLatencyPerTask (5000)
        },
      ],
      rationale: 'Test latency ceiling',
      submittedAt: Date.now(),
    };

    const result = validator.validate(proposal);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code.includes('LATENCY_CEILING'))).toBe(true);
  });

  it('contract: fallback weight normalized [0,1]', () => {
    const proposal: Proposal = {
      proposalId: 'prop_fb_01',
      submittedBy: 'tester',
      deltas: [
        {
          type: 'fallback',
          fallbackId: 'fb_1',
          weight: 0.8, // Valid
        },
      ],
      rationale: 'Test fallback bounds',
      submittedAt: Date.now(),
    };

    const result = validator.validate(proposal);
    // Should pass or have warnings, not hard errors
    expect(result.errors.length).toBe(0);
  });

  it('contract: reward weight bounds [0,1] enforced', () => {
    const proposal: Proposal = {
      proposalId: 'prop_rew_01',
      submittedBy: 'tester',
      deltas: [
        {
          type: 'reward',
          componentId: 'success',
          weight: 1.2, // Out of bounds
        },
      ],
      rationale: 'Test reward bounds',
      submittedAt: Date.now(),
    };

    const result = validator.validate(proposal);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code.includes('REWARD_WEIGHT_OUT_OF_RANGE'))).toBe(true);
  });

  it('contract: simulator state distribution sum ≈ 1.0', () => {
    const proposal: Proposal = {
      proposalId: 'prop_sim_01',
      submittedBy: 'tester',
      deltas: [
        {
          type: 'simulator',
          simulatorId: 'sim_1',
          stateDistribution: {
            state_a: 0.5,
            state_b: 0.4, // Sums to 0.9, not 1.0
          },
        },
      ],
      rationale: 'Test simulator distribution',
      submittedAt: Date.now(),
    };

    const result = validator.validate(proposal);
    // Should produce warning, not error (1% tolerance)
    expect(result.warnings.some((w) => w.code.includes('STATE_DIST'))).toBe(true);
  });
});
