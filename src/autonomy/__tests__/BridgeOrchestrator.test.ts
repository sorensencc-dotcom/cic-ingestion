/**
 * BridgeOrchestrator Test Suite (Phase 23.7.4)
 * Tests signal/proposal routing, timeout handling, error recovery
 */

import { BridgeOrchestrator } from '../bridges/BridgeOrchestrator';
import {
  createMockProposal,
  createMockSignals,
  createMockProposals,
  createMockApprovedProposal,
} from '../bridges/__tests__/fixtures';

// Mock bridge classes
jest.mock('../bridges/AutonomyToPlannerBridge');
jest.mock('../bridges/AutonomyToARPSBridge');
jest.mock('../bridges/AutonomyGovernanceBridge');

describe('BridgeOrchestrator', () => {
  let orchestrator: BridgeOrchestrator;

  const mockConfig = {
    aprControlPlaneUrl: 'http://localhost:8080',
    replanThresholds: {
      criticalSignalCount: 2,
      totalPriorityScore: 80,
    },
    memoryStoreUrl: 'http://localhost:3050',
    governanceControlPlaneUrl: 'http://localhost:9000',
    councilSize: 3,
    approvalThreshold: 2,
    autoApproveThreshold: 90,
    plannerBridgeTimeoutMs: 1000,
    arpsBridgeTimeoutMs: 500,
    governanceBridgeTimeoutMs: 2000,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    orchestrator = new BridgeOrchestrator(mockConfig);
  });

  describe('Configuration', () => {
    it('applies default timeouts', () => {
      const config = {
        aprControlPlaneUrl: 'http://localhost:8080',
        replanThresholds: { criticalSignalCount: 2, totalPriorityScore: 80 },
        memoryStoreUrl: 'http://localhost:3050',
        governanceControlPlaneUrl: 'http://localhost:9000',
        councilSize: 3,
        approvalThreshold: 2,
        autoApproveThreshold: 90,
      };

      const orch = new BridgeOrchestrator(config);
      expect(orch['config'].plannerBridgeTimeoutMs).toBe(5000);
      expect(orch['config'].arpsBridgeTimeoutMs).toBe(3000);
      expect(orch['config'].governanceBridgeTimeoutMs).toBe(10000);
    });

    it('overrides default timeouts with provided values', () => {
      expect(orchestrator['config'].plannerBridgeTimeoutMs).toBe(1000);
      expect(orchestrator['config'].arpsBridgeTimeoutMs).toBe(500);
      expect(orchestrator['config'].governanceBridgeTimeoutMs).toBe(2000);
    });
  });

  describe('Signal Processing', () => {
    it('processes signals through planner and ARPS bridges', async () => {
      const signals = createMockSignals(2);
      const mockPlannerBridge = orchestrator['plannerBridge'];
      const mockARPSBridge = orchestrator['arpsBridge'];

      (mockPlannerBridge.feedSignalsToPlanner as jest.Mock).mockResolvedValue(undefined);
      (mockARPSBridge.logSignalToARPS as jest.Mock).mockResolvedValue(undefined);

      const result = await orchestrator.processSignals(signals);

      expect(result.signalsProcessed).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(mockPlannerBridge.feedSignalsToPlanner).toHaveBeenCalledWith(signals);
    });

    it('logs each signal to ARPS', async () => {
      const signals = createMockSignals(2);
      const mockARPSBridge = orchestrator['arpsBridge'];
      const mockPlannerBridge = orchestrator['plannerBridge'];

      (mockPlannerBridge.feedSignalsToPlanner as jest.Mock).mockResolvedValue(undefined);
      (mockARPSBridge.logSignalToARPS as jest.Mock).mockResolvedValue(undefined);

      await orchestrator.processSignals(signals);

      expect(mockARPSBridge.logSignalToARPS).toHaveBeenCalledTimes(2);
      expect(mockARPSBridge.logSignalToARPS).toHaveBeenNthCalledWith(1, signals[0]);
      expect(mockARPSBridge.logSignalToARPS).toHaveBeenNthCalledWith(2, signals[1]);
    });

    it('records bridge errors without stopping processing', async () => {
      const signals = createMockSignals(1);
      const mockPlannerBridge = orchestrator['plannerBridge'];
      const mockARPSBridge = orchestrator['arpsBridge'];

      (mockPlannerBridge.feedSignalsToPlanner as jest.Mock).mockRejectedValue(
        new Error('Planner unreachable')
      );
      (mockARPSBridge.logSignalToARPS as jest.Mock).mockResolvedValue(undefined);

      const result = await orchestrator.processSignals(signals);

      expect(result.signalsProcessed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].bridge).toBe('planner');
      expect(result.errors[0].error).toContain('Planner unreachable');
    });

    it('includes timestamp in result', async () => {
      const signals = createMockSignals(1);
      const mockPlannerBridge = orchestrator['plannerBridge'];
      const mockARPSBridge = orchestrator['arpsBridge'];

      (mockPlannerBridge.feedSignalsToPlanner as jest.Mock).mockResolvedValue(undefined);
      (mockARPSBridge.logSignalToARPS as jest.Mock).mockResolvedValue(undefined);

      const result = await orchestrator.processSignals(signals);

      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Proposal Processing', () => {
    it('routes proposals to governance bridge', async () => {
      const proposals = createMockProposals(1);
      const mockGovernanceBridge = orchestrator['governanceBridge'];
      const mockARPSBridge = orchestrator['arpsBridge'];
      const mockPlannerBridge = orchestrator['plannerBridge'];

      (mockGovernanceBridge.routeProposalToGovernance as jest.Mock).mockResolvedValue(undefined);
      (mockARPSBridge.logProposalToARPS as jest.Mock).mockResolvedValue(undefined);
      (mockPlannerBridge.feedProposalToPlanner as jest.Mock).mockResolvedValue(undefined);

      const result = await orchestrator.processProposals(proposals);

      expect(result.proposalsGenerated).toBe(1);
      expect(result.proposalsRouted).toBe(1);
      expect(mockGovernanceBridge.routeProposalToGovernance).toHaveBeenCalledWith(
        proposals[0]
      );
    });

    it('logs proposals to ARPS', async () => {
      const proposals = createMockProposals(1);
      const mockARPSBridge = orchestrator['arpsBridge'];
      const mockGovernanceBridge = orchestrator['governanceBridge'];

      (mockGovernanceBridge.routeProposalToGovernance as jest.Mock).mockResolvedValue(undefined);
      (mockARPSBridge.logProposalToARPS as jest.Mock).mockResolvedValue(undefined);

      await orchestrator.processProposals(proposals);

      expect(mockARPSBridge.logProposalToARPS).toHaveBeenCalledWith(proposals[0]);
    });

    it('feeds approved proposals to planner', async () => {
      const proposals = [createMockApprovedProposal()];
      const mockPlannerBridge = orchestrator['plannerBridge'];
      const mockARPSBridge = orchestrator['arpsBridge'];
      const mockGovernanceBridge = orchestrator['governanceBridge'];

      (mockGovernanceBridge.routeProposalToGovernance as jest.Mock).mockResolvedValue(undefined);
      (mockARPSBridge.logProposalToARPS as jest.Mock).mockResolvedValue(undefined);
      (mockPlannerBridge.feedProposalToPlanner as jest.Mock).mockResolvedValue(undefined);

      const result = await orchestrator.processProposals(proposals);

      expect(result.proposalsApproved).toBe(1);
      expect(mockPlannerBridge.feedProposalToPlanner).toHaveBeenCalledWith(proposals[0]);
    });

    it('skips planner feed for non-approved proposals', async () => {
      const proposals = createMockProposals(1); // pending by default
      const mockPlannerBridge = orchestrator['plannerBridge'];
      const mockARPSBridge = orchestrator['arpsBridge'];
      const mockGovernanceBridge = orchestrator['governanceBridge'];

      (mockGovernanceBridge.routeProposalToGovernance as jest.Mock).mockResolvedValue(undefined);
      (mockARPSBridge.logProposalToARPS as jest.Mock).mockResolvedValue(undefined);

      await orchestrator.processProposals(proposals);

      expect(mockPlannerBridge.feedProposalToPlanner).not.toHaveBeenCalled();
    });

    it('records multiple errors per proposal', async () => {
      const proposals = createMockProposals(1);
      const mockGovernanceBridge = orchestrator['governanceBridge'];
      const mockARPSBridge = orchestrator['arpsBridge'];
      const mockPlannerBridge = orchestrator['plannerBridge'];

      (mockGovernanceBridge.routeProposalToGovernance as jest.Mock).mockRejectedValue(
        new Error('Governance unavailable')
      );
      (mockARPSBridge.logProposalToARPS as jest.Mock).mockRejectedValue(
        new Error('ARPS unavailable')
      );
      (mockPlannerBridge.feedProposalToPlanner as jest.Mock).mockResolvedValue(undefined);

      const result = await orchestrator.processProposals(proposals);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.bridge === 'governance')).toBe(true);
      expect(result.errors.some((e) => e.bridge === 'arps')).toBe(true);
    });
  });

  describe('Governance Decision Processing', () => {
    it('logs approved decision to ARPS and planner', async () => {
      const proposal = createMockProposal('pending');
      const mockARPSBridge = orchestrator['arpsBridge'];
      const mockPlannerBridge = orchestrator['plannerBridge'];

      (mockARPSBridge.logProposalFeedbackToARPS as jest.Mock).mockResolvedValue(undefined);
      (mockPlannerBridge.feedProposalToPlanner as jest.Mock).mockResolvedValue(undefined);

      await orchestrator.processGovernanceDecision(proposal, 'approved', 'Council approved');

      expect(mockARPSBridge.logProposalFeedbackToARPS).toHaveBeenCalledWith(
        proposal,
        'approved',
        'Council approved'
      );
      expect(mockPlannerBridge.feedProposalToPlanner).toHaveBeenCalledWith(proposal);
    });

    it('logs rejected decision to ARPS only', async () => {
      const proposal = createMockProposal('pending');
      const mockARPSBridge = orchestrator['arpsBridge'];
      const mockPlannerBridge = orchestrator['plannerBridge'];

      (mockARPSBridge.logProposalFeedbackToARPS as jest.Mock).mockResolvedValue(undefined);

      await orchestrator.processGovernanceDecision(proposal, 'rejected', 'Risk too high');

      expect(mockARPSBridge.logProposalFeedbackToARPS).toHaveBeenCalledWith(
        proposal,
        'rejected',
        'Risk too high'
      );
      expect(mockPlannerBridge.feedProposalToPlanner).not.toHaveBeenCalled();
    });

    it('throws on ARPS failure', async () => {
      const proposal = createMockProposal('pending');
      const mockARPSBridge = orchestrator['arpsBridge'];

      (mockARPSBridge.logProposalFeedbackToARPS as jest.Mock).mockRejectedValue(
        new Error('ARPS failed')
      );

      await expect(
        orchestrator.processGovernanceDecision(proposal, 'approved')
      ).rejects.toThrow('ARPS failed');
    });

    it('throws on planner failure for approved', async () => {
      const proposal = createMockProposal('pending');
      const mockARPSBridge = orchestrator['arpsBridge'];
      const mockPlannerBridge = orchestrator['plannerBridge'];

      (mockARPSBridge.logProposalFeedbackToARPS as jest.Mock).mockResolvedValue(undefined);
      (mockPlannerBridge.feedProposalToPlanner as jest.Mock).mockRejectedValue(
        new Error('Planner failed')
      );

      await expect(
        orchestrator.processGovernanceDecision(proposal, 'approved')
      ).rejects.toThrow('Planner failed');
    });
  });

  describe('Full Integration Cycle', () => {
    it('runs signals and proposals through all bridges', async () => {
      const signals = createMockSignals(1);
      const proposals = createMockProposals(1);

      const mockPlannerBridge = orchestrator['plannerBridge'];
      const mockARPSBridge = orchestrator['arpsBridge'];
      const mockGovernanceBridge = orchestrator['governanceBridge'];

      (mockPlannerBridge.feedSignalsToPlanner as jest.Mock).mockResolvedValue(undefined);
      (mockPlannerBridge.feedProposalToPlanner as jest.Mock).mockResolvedValue(undefined);
      (mockARPSBridge.logSignalToARPS as jest.Mock).mockResolvedValue(undefined);
      (mockARPSBridge.logProposalToARPS as jest.Mock).mockResolvedValue(undefined);
      (mockGovernanceBridge.routeProposalToGovernance as jest.Mock).mockResolvedValue(undefined);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await orchestrator.runFullIntegrationCycle(signals, proposals);

      expect(result.signalsProcessed).toBe(1);
      expect(result.proposalsGenerated).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Starting full integration cycle/)
      );

      consoleSpy.mockRestore();
    });

    it('combines errors from both signal and proposal processing', async () => {
      const signals = createMockSignals(1);
      const proposals = createMockProposals(1);

      const mockPlannerBridge = orchestrator['plannerBridge'];
      const mockARPSBridge = orchestrator['arpsBridge'];
      const mockGovernanceBridge = orchestrator['governanceBridge'];

      (mockPlannerBridge.feedSignalsToPlanner as jest.Mock).mockRejectedValue(
        new Error('Error 1')
      );
      (mockARPSBridge.logSignalToARPS as jest.Mock).mockResolvedValue(undefined);
      (mockGovernanceBridge.routeProposalToGovernance as jest.Mock).mockRejectedValue(
        new Error('Error 2')
      );
      (mockARPSBridge.logProposalToARPS as jest.Mock).mockResolvedValue(undefined);

      const result = await orchestrator.runFullIntegrationCycle(signals, proposals);

      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Bridge Accessor Methods', () => {
    it('returns planner bridge instance', () => {
      const planner = orchestrator.getPlanner();
      expect(planner).toBeDefined();
      expect(planner).toBe(orchestrator['plannerBridge']);
    });

    it('returns ARPS bridge instance', () => {
      const arps = orchestrator.getARPS();
      expect(arps).toBeDefined();
      expect(arps).toBe(orchestrator['arpsBridge']);
    });

    it('returns governance bridge instance', () => {
      const governance = orchestrator.getGovernance();
      expect(governance).toBeDefined();
      expect(governance).toBe(orchestrator['governanceBridge']);
    });
  });

  describe('Timeout Handling', () => {
    it('rejects promise on timeout', async () => {
      const slowPromise = new Promise((resolve) => {
        setTimeout(resolve, 5000);
      });

      const withTimeout = orchestrator['withTimeout'](
        slowPromise as Promise<any>,
        100,
        'TestBridge'
      );

      await expect(withTimeout).rejects.toThrow('TestBridge timeout after 100ms');
    });

    it('resolves fast promise before timeout', async () => {
      const fastPromise = Promise.resolve({ success: true });

      const withTimeout = orchestrator['withTimeout'](fastPromise, 5000, 'TestBridge');

      await expect(withTimeout).resolves.toEqual({ success: true });
    });
  });
});
