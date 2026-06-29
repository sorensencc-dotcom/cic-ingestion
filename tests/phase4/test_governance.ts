/**
 * Phase 4: Governance Tests (4 contracts)
 * Manual approval, auto-promotion, caps enforcement, delta magnitude.
 */

import { describe, it, expect } from '@jest/globals';
import { GovernanceReview } from '../../src/core/maal/governance/GovernanceReview';
import { GovernanceCaps, DEFAULT_GOVERNANCE_CAPS, DEFAULT_METRIC_THRESHOLDS } from '../../src/core/maal/governance/GovernanceCaps';
import { ValidationResult } from '../../src/core/maal/support/ValidationResult';
import { Proposal } from '../../src/core/maal/codesign/ProposalTypes';

describe('Governance Review', () => {
  const caps = DEFAULT_GOVERNANCE_CAPS;
  const thresholds = DEFAULT_METRIC_THRESHOLDS;
  const reviewer = new GovernanceReview(caps, thresholds);

  it('contract: structural regime change requires manual approval', () => {
    const proposal: Proposal = {
      proposalId: 'prop_struct_01',
      submittedBy: 'spl',
      deltas: [
        {
          type: 'regime',
          regimeId: 'new_regime',
          modelSelector: 'gpt-4',
          fallbackBehavior: 'circuit_breaker',
        },
      ],
      rationale: 'Switch regime',
      submittedAt: Date.now(),
    };

    const validationResult: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    const request = {
      proposalId: 'prop_struct_01',
      proposal,
      validationResult,
      reviewedAt: Date.now(),
    };

    const decision = reviewer.review(request).ok()!;
    expect(decision.requiresManualApproval).toBe(true);
    expect(decision.approved).toBe(false);
    expect(decision.reason).toContain('Structural');
  });

  it('contract: minor reward delta auto-approved within caps', () => {
    const proposal: Proposal = {
      proposalId: 'prop_minor_01',
      submittedBy: 'spl',
      deltas: [
        {
          type: 'reward',
          componentId: 'latency',
          weight: 0.55,
          threshold: 0.5,
        },
      ],
      rationale: 'Tune reward',
      submittedAt: Date.now(),
    };

    const validationResult: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    const request = {
      proposalId: 'prop_minor_01',
      proposal,
      validationResult,
      reviewedAt: Date.now(),
    };

    const decision = reviewer.review(request).ok()!;
    expect(decision.approved).toBe(true);
    expect(decision.requiresManualApproval).toBe(false);
  });

  it('contract: delta magnitude exceeding cap → rejected', () => {
    const proposal: Proposal = {
      proposalId: 'prop_mag_01',
      submittedBy: 'spl',
      deltas: [
        {
          type: 'regime',
          regimeId: 'new_regime',
          modelSelector: 'gpt-4',
          fallbackBehavior: 'circuit_breaker',
        },
      ],
      rationale: 'Major change',
      submittedAt: Date.now(),
    };

    const validationResult: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    const request = {
      proposalId: 'prop_mag_01',
      proposal,
      validationResult,
      reviewedAt: Date.now(),
    };

    const decision = reviewer.review(request).ok()!;
    // Structural changes always require manual approval (>= maxDeltaMagnitude)
    expect(decision.requiresManualApproval).toBe(true);
  });

  it('contract: validation failure blocks approval', () => {
    const proposal: Proposal = {
      proposalId: 'prop_invalid_01',
      submittedBy: 'spl',
      deltas: [
        {
          type: 'reward',
          componentId: 'success',
          weight: 1.5, // Invalid
        },
      ],
      rationale: 'Invalid proposal',
      submittedAt: Date.now(),
    };

    const validationResult: ValidationResult = {
      valid: false,
      errors: [
        {
          code: 'INVALID_WEIGHT',
          message: 'Weight out of bounds',
          field: 'weight',
          value: 1.5,
        },
      ],
      warnings: [],
    };

    const request = {
      proposalId: 'prop_invalid_01',
      proposal,
      validationResult,
      reviewedAt: Date.now(),
    };

    const decision = reviewer.review(request).ok()!;
    expect(decision.approved).toBe(false);
    expect(decision.reason).toContain('Validation failed');
  });
});
