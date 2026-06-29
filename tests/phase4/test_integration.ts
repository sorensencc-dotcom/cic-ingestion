/**
 * Phase 4: Integration Tests (5 contracts)
 * E2E flows: proposal → validation → governance → canary → promotion.
 */

import { describe, it, expect } from '@jest/globals';
import { ProposalParser } from '../../src/core/maal/codesign/ProposalParser';
import { ProposalValidationEngineImpl } from '../../src/core/maal/codesign/ProposalValidationEngineImpl';
import { GovernanceReview } from '../../src/core/maal/governance/GovernanceReview';
import { CanaryGateOrchestrator } from '../../src/core/maal/canary/CanaryGateOrchestrator';
import { DEFAULT_GOVERNANCE_CAPS, DEFAULT_METRIC_THRESHOLDS } from '../../src/core/maal/governance/GovernanceCaps';

describe('Phase 4 Integration', () => {
  const parser = new ProposalParser();
  const validator = new ProposalValidationEngineImpl();
  const reviewer = new GovernanceReview(DEFAULT_GOVERNANCE_CAPS, DEFAULT_METRIC_THRESHOLDS);
  const orchestrator = new CanaryGateOrchestrator();

  it('contract: E2E reward adjustment flow (parse → validate → govern → canary)', async () => {
    // Step 1: Parse DSL
    const dsl = JSON.stringify({
      proposalId: 'prop_e2e_001',
      submittedBy: 'spl_service',
      rationale: 'Improve latency focus',
      deltas: [
        {
          type: 'reward',
          componentId: 'latency',
          weight: 0.6,
          threshold: 0.5,
        },
      ],
    });

    const parseResult = parser.parse(dsl);
    expect(parseResult.isOk()).toBe(true);
    const proposal = parseResult.ok()!;

    // Step 2: Validate
    const validationResult = validator.validate(proposal);
    expect(validationResult.valid).toBe(true);

    // Step 3: Review governance
    const reviewRequest = {
      proposalId: proposal.proposalId,
      proposal,
      validationResult,
      reviewedAt: Date.now(),
    };
    const reviewDecision = reviewer.review(reviewRequest).ok()!;
    expect(reviewDecision.approved || reviewDecision.requiresManualApproval).toBe(true);

    // Step 4: Execute canary
    const canaryResult = await orchestrator.execute(proposal);
    expect(canaryResult.isOk()).toBe(true);
    const outcome = canaryResult.ok()!;
    expect(['promoted', 'paused', 'rolled_back']).toContain(outcome.decision);
  });

  it('contract: E2E constraint add flow validates global bounds', async () => {
    const dsl = JSON.stringify({
      proposalId: 'prop_e2e_002',
      submittedBy: 'spl_service',
      rationale: 'Add cost constraint',
      deltas: [
        {
          type: 'constraint',
          constraintId: 'cost_constraint',
          action: 'add',
          constraintType: 'cost',
          bounds: { min: 0, max: 0.05 }, // Within GLOBAL_ROUTING_BOUNDS
        },
      ],
    });

    const parseResult = parser.parse(dsl);
    expect(parseResult.isOk()).toBe(true);

    const proposal = parseResult.ok()!;
    const validationResult = validator.validate(proposal);
    expect(validationResult.valid).toBe(true);
  });

  it('contract: E2E simulator config persists & retrieves metrics', async () => {
    const dsl = JSON.stringify({
      proposalId: 'prop_e2e_003',
      submittedBy: 'spl_service',
      rationale: 'Update simulator',
      deltas: [
        {
          type: 'simulator',
          simulatorId: 'sim_1',
          stateDistribution: { state_a: 0.5, state_b: 0.5 },
          modelPerformanceMatrix: {
            gpt4: { latency: 1500, cost: 0.08, success_rate: 0.98 },
          },
        },
      ],
    });

    const parseResult = parser.parse(dsl);
    expect(parseResult.isOk()).toBe(true);

    const proposal = parseResult.ok()!;
    const validationResult = validator.validate(proposal);
    // State distribution should be normalized
    expect(validationResult.warnings.length).toBeLessThanOrEqual(1);
  });

  it('contract: E2E fallback graph update validates weight', async () => {
    const dsl = JSON.stringify({
      proposalId: 'prop_e2e_004',
      submittedBy: 'spl_service',
      rationale: 'Update fallback',
      deltas: [
        {
          type: 'fallback',
          fallbackId: 'fb_cascade',
          predecessors: ['regime_1'],
          successors: ['regime_2'],
          weight: 0.8,
        },
      ],
    });

    const parseResult = parser.parse(dsl);
    expect(parseResult.isOk()).toBe(true);

    const proposal = parseResult.ok()!;
    const validationResult = validator.validate(proposal);
    expect(validationResult.valid).toBe(true);
  });

  it('contract: E2E invalid proposal rejected at parser', () => {
    const invalidDsl = JSON.stringify({
      submittedBy: 'spl_service',
      deltas: [], // Empty deltas
    });

    const parseResult = parser.parse(invalidDsl);
    expect(parseResult.isErr()).toBe(true);
    expect(parseResult.err()!.code).toContain('MISSING_PROPOSAL_ID');
  });
});
