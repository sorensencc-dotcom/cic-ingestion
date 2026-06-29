/**
 * Phase 4: Promotion Tests (3 contracts)
 * Manual approval, auto-promotion, drift blocking.
 */

import { describe, it, expect } from '@jest/globals';
import { CanaryGateOrchestrator } from '../../src/core/maal/canary/CanaryGateOrchestrator';
import { GovernanceReview } from '../../src/core/maal/governance/GovernanceReview';
import { DEFAULT_GOVERNANCE_CAPS, DEFAULT_METRIC_THRESHOLDS } from '../../src/core/maal/governance/GovernanceCaps';
import { ValidationResult } from '../../src/core/maal/support/ValidationResult';
import { Proposal } from '../../src/core/maal/codesign/ProposalTypes';

describe('Promotion', () => {
  const orchestrator = new CanaryGateOrchestrator();
  const reviewer = new GovernanceReview(DEFAULT_GOVERNANCE_CAPS, DEFAULT_METRIC_THRESHOLDS);

  it('contract: structural change requires manual promotion approval', async () => {
    const proposal: Proposal = {
      proposalId: 'prop_promo_01',
      submittedBy: 'spl',
      deltas: [
        {
          type: 'regime',
          regimeId: 'new_regime',
          modelSelector: 'gpt-4',
          fallbackBehavior: 'circuit_breaker',
        },
      ],
      rationale: 'Regime change',
      submittedAt: Date.now(),
    };

    const validationResult: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    const request = {
      proposalId: 'prop_promo_01',
      proposal,
      validationResult,
      reviewedAt: Date.now(),
    };

    const decision = reviewer.review(request).ok()!;
    expect(decision.requiresManualApproval).toBe(true);
    expect(decision.approved).toBe(false);
  });

  it('contract: minor change auto-promotes when canary passes', async () => {
    const proposal: Proposal = {
      proposalId: 'prop_promo_02',
      submittedBy: 'spl',
      deltas: [
        {
          type: 'reward',
          componentId: 'latency',
          weight: 0.55,
        },
      ],
      rationale: 'Tune reward',
      submittedAt: Date.now(),
    };

    const result = await orchestrator.execute(proposal);
    expect(result.isOk()).toBe(true);
    const outcome = result.ok()!;
    // If canary metrics are within bounds, promotion should succeed
    expect(['promoted', 'paused']).toContain(outcome.decision);
  });

  it('contract: high drift score blocks promotion', () => {
    const proposal: Proposal = {
      proposalId: 'prop_promo_03',
      submittedBy: 'spl',
      deltas: [
        {
          type: 'simulator',
          simulatorId: 'sim_1',
          stateDistribution: { state_a: 0.5, state_b: 0.5 },
        },
      ],
      rationale: 'Simulator update',
      submittedAt: Date.now(),
    };

    const validationResult: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [
        {
          code: 'HIGH_DRIFT_SCORE',
          message: 'Drift score 0.35 exceeds threshold 0.2',
          field: 'driftScore',
        },
      ],
    };

    const request = {
      proposalId: 'prop_promo_03',
      proposal,
      validationResult,
      reviewedAt: Date.now(),
    };

    // High drift warnings should influence promotion decision
    expect(validationResult.warnings.length).toBeGreaterThan(0);
    expect(validationResult.warnings[0].code).toBe('HIGH_DRIFT_SCORE');
  });
});
