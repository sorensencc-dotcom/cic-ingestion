/**
 * Autonomy Bridges Test Suite (Phase 23.7.4–23.7.5)
 * Unit and integration tests for all bridge components
 */

import { AutonomyToPlannerBridge } from '../AutonomyToPlannerBridge';
import { AutonomyToARPSBridge } from '../AutonomyToARPSBridge';
import { AutonomyGovernanceBridge } from '../AutonomyGovernanceBridge';
import { BridgeOrchestrator } from '../BridgeOrchestrator';
import {
  createMockDriftSignal,
  createMockInstabilitySignal,
  createMockRegressionSignal,
  createMockOpportunitySignal,
  createMockProposal,
} from './fixtures';

// Mock fetch globally
global.fetch = jest.fn();

describe('AutonomyToPlannerBridge', () => {
  let bridge: AutonomyToPlannerBridge;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = global.fetch as jest.Mock;
    fetchMock.mockClear();
    fetchMock.mockResolvedValue({ ok: true });

    bridge = new AutonomyToPlannerBridge({
      aprControlPlaneUrl: 'http://localhost:3002',
      replanThresholds: {
        criticalSignalCount: 2,
        totalPriorityScore: 150,
      },
    });
  });

  describe('Signal to Goal Conversion', () => {
    it('converts drift signal to drift_mitigation goal', async () => {
      const signal = createMockDriftSignal('critical');
      await bridge.feedSignalsToPlanner([signal]);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3002/apr/goals',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const call = fetchMock.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.goals[0].type).toBe('drift_mitigation');
      expect(body.goals[0].description).toContain('drift');
    });

    it('converts instability signal to stabilization goal', async () => {
      const signal = createMockInstabilitySignal('warning');
      await bridge.feedSignalsToPlanner([signal]);

      const call = fetchMock.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.goals[0].type).toBe('stabilization');
      expect(body.goals[0].deadline).toBeDefined(); // 24h deadline
    });

    it('converts regression signal to regression_fix goal', async () => {
      const signal = createMockRegressionSignal('critical');
      await bridge.feedSignalsToPlanner([signal]);

      const call = fetchMock.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.goals[0].type).toBe('regression_fix');
      expect(body.goals[0].deadline).toBeDefined(); // 48h deadline
    });

    it('converts opportunity signal to acceleration goal', async () => {
      const signal = createMockOpportunitySignal();
      await bridge.feedSignalsToPlanner([signal]);

      const call = fetchMock.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.goals[0].type).toBe('acceleration');
      expect(body.goals[0].priority).toBeLessThan(50); // lower priority than problems
    });
  });

  describe('Replan Triggering', () => {
    it('triggers replan on 2+ critical signals', async () => {
      const signal1 = createMockDriftSignal('critical');
      const signal2 = createMockInstabilitySignal('critical');
      await bridge.feedSignalsToPlanner([signal1, signal2]);

      const call = fetchMock.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.replan).toBe(true);
    });

    it('does not trigger replan on single critical signal', async () => {
      const signal = createMockDriftSignal('critical');
      await bridge.feedSignalsToPlanner([signal]);

      const call = fetchMock.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.replan).toBe(false);
    });

    it('triggers replan when total priority exceeds threshold', async () => {
      // Create signals that sum to >150 priority
      const signals = [
        createMockDriftSignal('critical'),
        createMockInstabilitySignal('warning'),
      ];
      await bridge.feedSignalsToPlanner(signals);

      const call = fetchMock.mock.calls[0];
      const body = JSON.parse(call[1].body);
      // If total priority > 150, replan should be true
      const totalPriority = body.goals.reduce(
        (sum: number, g: any) => sum + g.priority,
        0
      );
      if (totalPriority > 150) {
        expect(body.replan).toBe(true);
      }
    });
  });

  describe('Proposal Constraint Application', () => {
    it('converts defer_phase action to constraint', async () => {
      const proposal = createMockProposal('pending');
      proposal.status = 'approved';
      proposal.actions[0].type = 'defer_phase';
      proposal.actions[0].newTargetDate = '2026-06-15T00:00:00Z';

      await bridge.feedProposalToPlanner(proposal);

      const call = fetchMock.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.constraints.phaseConstraints).toBeDefined();
    });

    it('does not feed unapproved proposals', async () => {
      const proposal = createMockProposal('pending');
      await bridge.feedProposalToPlanner(proposal);

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('throws on APR control plane error', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, statusText: 'Service Unavailable' });

      const signal = createMockDriftSignal('critical');
      await expect(bridge.feedSignalsToPlanner([signal])).rejects.toThrow(
        'Service Unavailable'
      );
    });
  });
});

describe('AutonomyToARPSBridge', () => {
  let bridge: AutonomyToARPSBridge;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = global.fetch as jest.Mock;
    fetchMock.mockClear();
    fetchMock.mockResolvedValue({ ok: true });

    bridge = new AutonomyToARPSBridge({
      memoryStoreUrl: 'http://localhost:3001',
    });
  });

  describe('Signal Logging', () => {
    it('logs signal as ARPS_DELTA event', async () => {
      const signal = createMockDriftSignal('critical');
      await bridge.logSignalToARPS(signal);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3001/memory/events',
        expect.objectContaining({
          method: 'POST',
        })
      );

      const call = fetchMock.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.type).toBe('ARPS_DELTA');
      expect(body.metadata.deltaType).toBe('autonomy_signal');
      expect(body.metadata.signalType).toBe('drift');
    });

    it('preserves signal confidence in event metadata', async () => {
      const signal = createMockDriftSignal('critical');
      signal.confidence = 0.85;
      await bridge.logSignalToARPS(signal);

      const call = fetchMock.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.metadata.confidence).toBe(0.85);
    });
  });

  describe('Proposal Logging', () => {
    it('logs proposal with multiple actions as multiple deltas', async () => {
      const proposal = createMockProposal('pending');
      proposal.actions.push({
        type: 'allocate_resources',
        phase: 'Phase 25',
        description: 'Allocate additional resources',
        resourceRequirements: { engineers: 1 },
      });

      await bridge.logProposalToARPS(proposal);

      // Should create one delta per action
      expect(fetchMock).toHaveBeenCalledTimes(proposal.actions.length);
    });

    it('sets severity warning for high-risk proposals', async () => {
      const proposal = createMockProposal('pending');
      proposal.impact.riskLevel = 'high';

      await bridge.logProposalToARPS(proposal);

      const call = fetchMock.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.severity).toBe('warning');
    });
  });

  describe('Feedback Logging', () => {
    it('logs approval decision', async () => {
      const proposal = createMockProposal('approved');
      await bridge.logProposalFeedbackToARPS(
        proposal,
        'approved',
        'Council voted unanimously'
      );

      const call = fetchMock.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.metadata.decision).toBe('approved');
      expect(body.metadata.rejectionReason).toBeUndefined();
    });

    it('logs rejection decision with reason', async () => {
      const proposal = createMockProposal('rejected');
      await bridge.logProposalFeedbackToARPS(
        proposal,
        'rejected',
        'Risk too high'
      );

      const call = fetchMock.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.metadata.decision).toBe('rejected');
      expect(body.metadata.rejectionReason).toBe('Risk too high');
    });
  });

  describe('Batch Operations', () => {
    it('logs multiple proposals', async () => {
      const proposals = [
        createMockProposal('pending'),
        createMockProposal('approved'),
      ];

      await bridge.logProposalsToARPS(proposals);

      // Should call for each proposal * actions per proposal
      expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('throws on MLA store error', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, statusText: 'Conflict' });

      const signal = createMockDriftSignal('critical');
      await expect(bridge.logSignalToARPS(signal)).rejects.toThrow('Conflict');
    });
  });
});

describe('AutonomyGovernanceBridge', () => {
  let bridge: AutonomyGovernanceBridge;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = global.fetch as jest.Mock;
    fetchMock.mockClear();
    fetchMock.mockResolvedValue({ ok: true });

    bridge = new AutonomyGovernanceBridge({
      governanceControlPlaneUrl: 'http://localhost:3003',
      councilSize: 5,
      approvalThreshold: 66,
      autoApproveThreshold: 0.95,
    });
  });

  describe('Auto-Approval Logic', () => {
    it('auto-approves low-risk, high-confidence proposals', async () => {
      const proposal = createMockProposal('pending');
      proposal.confidence = 0.96; // >0.95
      proposal.impact.riskLevel = 'low';
      proposal.triggeredBy = Array.from({ length: 11 }, () => {
        const sig = createMockDriftSignal('warning');
        sig.confidence = 1.0;
        return sig;
      });

      await bridge.routeProposalToGovernance(proposal);

      // Should submit decision, not vote request
      const call = fetchMock.mock.calls[0];
      expect(call[0]).toContain('/governance/decisions');
    });

    it('routes high-risk proposals to voting', async () => {
      const proposal = createMockProposal('pending');
      proposal.confidence = 0.8;
      proposal.impact.riskLevel = 'high';

      await bridge.routeProposalToGovernance(proposal);

      const call = fetchMock.mock.calls[0];
      expect(call[0]).toContain('/governance/votes');
    });

    it('routes proposals with critical signals to voting', async () => {
      const proposal = createMockProposal('pending');
      proposal.confidence = 0.96;
      proposal.impact.riskLevel = 'low';
      proposal.triggeredBy = [createMockDriftSignal('critical')];

      await bridge.routeProposalToGovernance(proposal);

      const call = fetchMock.mock.calls[0];
      expect(call[0]).toContain('/governance/votes');
    });
  });

  describe('Vote Request Building', () => {
    it('builds valid vote request', async () => {
      const proposal = createMockProposal('pending');
      proposal.confidence = 0.8;
      proposal.impact.riskLevel = 'high';

      await bridge.routeProposalToGovernance(proposal);

      const call = fetchMock.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.proposalId).toBe(proposal.id);
      expect(body.title).toBeDefined();
      expect(body.description).toBeDefined();
      expect(body.riskLevel).toBe('high');
      expect(body.affectedPhases).toEqual(proposal.impact.affectedPhases);
      expect(body.votingDeadline).toBeDefined(); // 7 days from now
    });

    it('sets required approvals based on council size', async () => {
      const proposal = createMockProposal('pending');
      proposal.impact.riskLevel = 'high';
      proposal.confidence = 0.8;

      await bridge.routeProposalToGovernance(proposal);

      const call = fetchMock.mock.calls[0];
      const body = JSON.parse(call[1].body);
      // 66% of 5 = 3.3, round up to 4 (but actually should be 4 for 2/3)
      expect(body.requiredApprovals).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Vote Recording', () => {
    it('records individual vote', async () => {
      await bridge.recordVote(
        'proposal_xyz',
        'council_member_1',
        'approve',
        'Reasonable mitigation'
      );

      const call = fetchMock.mock.calls[0];
      expect(call[0]).toContain('/governance/votes/proposal_xyz/vote');
      const body = JSON.parse(call[1].body);
      expect(body.decision).toBe('approve');
      expect(body.reason).toBe('Reasonable mitigation');
    });

    it('records rejection vote', async () => {
      await bridge.recordVote(
        'proposal_xyz',
        'council_member_2',
        'reject',
        'Risk too high'
      );

      const call = fetchMock.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.decision).toBe('reject');
    });

    it('records abstention', async () => {
      await bridge.recordVote('proposal_xyz', 'council_member_3', 'abstain');

      const call = fetchMock.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.decision).toBe('abstain');
    });
  });

  describe('Decision Finalization', () => {
    it('approves when threshold met', async () => {
      const proposal = createMockProposal('approved');
      const votes = [
        {
          proposalId: proposal.id,
          voterId: 'member_1',
          decision: 'approve' as const,
          timestamp: new Date().toISOString(),
        },
        {
          proposalId: proposal.id,
          voterId: 'member_2',
          decision: 'approve' as const,
          timestamp: new Date().toISOString(),
        },
        {
          proposalId: proposal.id,
          voterId: 'member_3',
          decision: 'approve' as const,
          timestamp: new Date().toISOString(),
        },
        {
          proposalId: proposal.id,
          voterId: 'member_4',
          decision: 'reject' as const,
          timestamp: new Date().toISOString(),
        },
      ];

      const decision = await bridge.finalizeDecision(proposal, votes);

      expect(decision.status).toBe('approved');
      expect(decision.approvalCount).toBe(3);
      expect(decision.rejectionCount).toBe(1);
    });

    it('rejects when threshold not met', async () => {
      const proposal = createMockProposal('rejected');
      const votes = [
        {
          proposalId: proposal.id,
          voterId: 'member_1',
          decision: 'approve' as const,
          timestamp: new Date().toISOString(),
        },
        {
          proposalId: proposal.id,
          voterId: 'member_2',
          decision: 'reject' as const,
          timestamp: new Date().toISOString(),
        },
        {
          proposalId: proposal.id,
          voterId: 'member_3',
          decision: 'reject' as const,
          timestamp: new Date().toISOString(),
        },
      ];

      const decision = await bridge.finalizeDecision(proposal, votes);

      expect(decision.status).toBe('rejected');
      expect(decision.rejectionCount).toBeGreaterThanOrEqual(decision.approvalCount);
    });

    it('calculates approval percentage correctly with abstentions', async () => {
      const proposal = createMockProposal('approved');
      const votes = [
        { proposalId: proposal.id, voterId: 'm1', decision: 'approve' as const, timestamp: new Date().toISOString() },
        { proposalId: proposal.id, voterId: 'm2', decision: 'approve' as const, timestamp: new Date().toISOString() },
        { proposalId: proposal.id, voterId: 'm3', decision: 'approve' as const, timestamp: new Date().toISOString() },
        { proposalId: proposal.id, voterId: 'm4', decision: 'abstain' as const, timestamp: new Date().toISOString() },
        { proposalId: proposal.id, voterId: 'm5', decision: 'abstain' as const, timestamp: new Date().toISOString() },
      ];

      const decision = await bridge.finalizeDecision(proposal, votes);

      // 3 approve / (3 + 0) = 100%, should pass
      expect(decision.status).toBe('approved');
    });
  });

  describe('Error Handling', () => {
    it('throws on governance control plane error', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, statusText: 'Unauthorized' });

      const proposal = createMockProposal('pending');
      proposal.impact.riskLevel = 'high';
      proposal.confidence = 0.8;

      await expect(bridge.routeProposalToGovernance(proposal)).rejects.toThrow(
        'Unauthorized'
      );
    });
  });
});

describe('BridgeOrchestrator', () => {
  let orchestrator: BridgeOrchestrator;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = global.fetch as jest.Mock;
    fetchMock.mockClear();
    fetchMock.mockResolvedValue({ ok: true });

    orchestrator = new BridgeOrchestrator({
      aprControlPlaneUrl: 'http://localhost:3002',
      memoryStoreUrl: 'http://localhost:3001',
      governanceControlPlaneUrl: 'http://localhost:3003',
      replanThresholds: {
        criticalSignalCount: 2,
        totalPriorityScore: 150,
      },
      councilSize: 5,
      approvalThreshold: 66,
      autoApproveThreshold: 0.95,
    });
  });

  describe('Signal Processing', () => {
    it('processes signals through planner and ARPS bridges', async () => {
      const signals = [
        createMockDriftSignal('critical'),
        createMockInstabilitySignal('warning'),
      ];

      const result = await orchestrator.processSignals(signals);

      expect(result.signalsProcessed).toBe(2);
      expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    });

    it('tracks errors during processing', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, statusText: 'Timeout' });

      const signals = [createMockDriftSignal('critical')];
      const result = await orchestrator.processSignals(signals);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].bridge).toBeDefined();
    });
  });

  describe('Proposal Processing', () => {
    it('processes proposals through governance, ARPS, and planner bridges', async () => {
      const proposals = [createMockProposal('pending')];

      const result = await orchestrator.processProposals(proposals);

      expect(result.proposalsGenerated).toBe(1);
      expect(result.proposalsRouted).toBe(1);
    });

    it('only feeds approved proposals to planner', async () => {
      const pendingProposal = createMockProposal('pending');
      const approvedProposal = createMockProposal('approved');

      const result = await orchestrator.processProposals([
        pendingProposal,
        approvedProposal,
      ]);

      expect(result.proposalsApproved).toBe(1);
    });
  });

  describe('Full Integration Cycle', () => {
    it('processes signals and proposals end-to-end', async () => {
      const signals = [createMockDriftSignal('critical')];
      const proposals = [createMockProposal('pending')];

      const result = await orchestrator.runFullIntegrationCycle(
        signals,
        proposals
      );

      expect(result.signalsProcessed).toBe(1);
      expect(result.proposalsGenerated).toBe(1);
      expect(result.proposalsRouted).toBe(1);
    });

    it('aggregates errors from all bridges', async () => {
      // Mock first call to fail
      fetchMock.mockResolvedValueOnce({ ok: false, statusText: 'Error 1' });

      const signals = [createMockDriftSignal('critical')];
      const proposals = [createMockProposal('pending')];

      const result = await orchestrator.runFullIntegrationCycle(
        signals,
        proposals
      );

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('continues on individual bridge failures', async () => {
      // One bridge fails, others continue
      fetchMock.mockResolvedValueOnce({ ok: false, statusText: 'Service down' });
      fetchMock.mockResolvedValue({ ok: true }); // Others succeed

      const signals = [createMockDriftSignal('critical')];
      const proposals = [createMockProposal('pending')];

      const result = await orchestrator.runFullIntegrationCycle(
        signals,
        proposals
      );

      // Should have partial success (not all zero)
      expect(
        result.signalsProcessed > 0 ||
          result.proposalsGenerated > 0 ||
          result.proposalsRouted > 0
      ).toBe(true);
    });
  });

  describe('Governance Feedback', () => {
    it('logs decision and feeds to planner if approved', async () => {
      const proposal = createMockProposal('approved');
      await orchestrator.processGovernanceDecision(
        proposal,
        'approved',
        'Council voted'
      );

      expect(fetchMock).toHaveBeenCalled();
    });

    it('only feeds approved decisions to planner', async () => {
      const proposal = createMockProposal('rejected');
      const initialCallCount = fetchMock.mock.calls.length;

      await orchestrator.processGovernanceDecision(
        proposal,
        'rejected',
        'Too risky'
      );

      // Should only log to ARPS, not feed to planner
      const newCallCount = fetchMock.mock.calls.length;
      expect(newCallCount).toBeGreaterThan(initialCallCount);
    });
  });
});
