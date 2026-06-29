/**
 * Phase 4: DSL Validity Tests (5 contracts)
 * Grammar validation, missing fields, invalid types, bounds enforcement.
 */

import { describe, it, expect } from '@jest/globals';
import { ProposalParser } from '../../src/core/maal/codesign/ProposalParser';

describe('DSL Validity', () => {
  const parser = new ProposalParser();

  it('contract: parse valid proposal JSON', () => {
    const dsl = JSON.stringify({
      proposalId: 'prop_001',
      submittedBy: 'spl_service',
      rationale: 'Improve latency',
      deltas: [
        {
          type: 'reward',
          componentId: 'latency',
          weight: 0.6,
          threshold: 0.5,
        },
      ],
    });

    const result = parser.parse(dsl);
    expect(result.isOk()).toBe(true);
    expect(result.ok()!.proposalId).toBe('prop_001');
    expect(result.ok()!.deltas.length).toBe(1);
  });

  it('contract: reject missing proposalId', () => {
    const dsl = JSON.stringify({
      submittedBy: 'spl_service',
      deltas: [{ type: 'reward', componentId: 'success', weight: 0.5 }],
    });

    const result = parser.parse(dsl);
    expect(result.isErr()).toBe(true);
    expect(result.err()!.code).toBe('MISSING_PROPOSAL_ID');
  });

  it('contract: reject invalid delta type', () => {
    const dsl = JSON.stringify({
      proposalId: 'prop_002',
      submittedBy: 'spl_service',
      deltas: [
        {
          type: 'invalid_type',
          componentId: 'test',
        },
      ],
    });

    const result = parser.parse(dsl);
    expect(result.isErr()).toBe(true);
    expect(result.err()!.code).toBe('INVALID_DELTA_TYPE');
  });

  it('contract: enforce weight bounds [0, 1]', () => {
    const dsl = JSON.stringify({
      proposalId: 'prop_003',
      submittedBy: 'spl_service',
      deltas: [
        {
          type: 'reward',
          componentId: 'success',
          weight: 1.5, // Out of bounds
        },
      ],
    });

    const result = parser.parse(dsl);
    expect(result.isErr()).toBe(true);
    expect(result.err()!.code).toBe('INVALID_WEIGHT');
  });

  it('contract: forbid __internal and __maal_bypass fields', () => {
    const deltaValidation = parser.validateDelta({
      type: 'reward',
      componentId: 'success',
      __maal_bypass: true,
    } as any);

    expect(deltaValidation.valid).toBe(false);
    expect(deltaValidation.errors.some((e) => e.includes('Forbidden field'))).toBe(true);
  });
});
