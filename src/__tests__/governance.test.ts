/**
 * Governance tests: Canary execution
 *
 * Test suite for Phase 4 Wave A CanaryEngine implementation
 */

import { CanaryEngine } from '../governance/canary-engine';
import { Proposal } from '../governance/proposal-validator';
import { GovernanceDecision } from '../core/maal/governance/GovernanceDecisions';

describe('CanaryEngine', () => {
  let canaryEngine: CanaryEngine;
  let testProposal: Proposal;
  let testApproval: GovernanceDecision;

  beforeEach(() => {
    canaryEngine = new CanaryEngine();

    // Setup test proposal
    testProposal = {
      proposal_id: 'prop-001',
      source_entry_id: 'entry-001',
      profile: 'api:generic',
      lane: 'fast',
      orchestration_cost: 0.05,
      created_at: new Date().toISOString(),
      version: '1.0',
    };

    // Setup test governance approval
    testApproval = {
      proposalId: 'prop-001',
      status: 'approved',
      decidedBy: 'reviewer-001',
      decidedAt: Date.now(),
      rationale: 'Approved for canary test',
    };
  });

  describe('Canary Execution', () => {
    test('Execute canary for approved proposal → collect metrics (error_rate, cost_delta, latency_p99)', () => {
      // Execute canary
      const result = canaryEngine.execute(testProposal, testApproval);

      // Verify result structure
      expect(result).toBeDefined();
      expect(result.proposal_id).toBe('prop-001');

      // Verify metrics are collected
      expect(result.metrics).toBeDefined();
      expect(result.metrics.error_rate).toBeDefined();
      expect(result.metrics.cost_delta).toBeDefined();
      expect(result.metrics.latency_p99_ms).toBeDefined();

      // Verify metric values are in expected range
      expect(result.metrics.error_rate).toBeGreaterThanOrEqual(0);
      expect(result.metrics.error_rate).toBeLessThanOrEqual(1);

      expect(result.metrics.cost_delta).toBeGreaterThanOrEqual(-0.05);
      expect(result.metrics.cost_delta).toBeLessThanOrEqual(0.05);

      expect(result.metrics.latency_p99_ms).toBeGreaterThan(0);

      // Verify decision is one of allowed values
      expect(['promote', 'rollback', 'hold']).toContain(result.decision);

      // Verify observed_at is a Date
      expect(result.observed_at).toBeInstanceOf(Date);
    });

    test('Measure cost delta correctly (Phase 3 baseline comparison)', () => {
      // Execute canary with test proposal
      const result = canaryEngine.execute(testProposal, testApproval);

      // For deterministic tests, cost_delta should be < 0.2% (0.002)
      // This simulates a successful Phase 3 baseline comparison
      expect(result.metrics.cost_delta).toBeLessThan(0.002);

      // Verify decision is promote (all metrics should pass for test data)
      expect(result.decision).toBe('promote');

      // Verify error_rate is < 2% (0.02)
      expect(result.metrics.error_rate).toBeLessThan(0.02);

      // Verify latency_p99_ms is < 500ms
      expect(result.metrics.latency_p99_ms).toBeLessThan(500);

      // Verify proposal_id is correctly attached to metrics context
      expect(result.proposal_id).toBe(testProposal.proposal_id);
    });
  });
});
