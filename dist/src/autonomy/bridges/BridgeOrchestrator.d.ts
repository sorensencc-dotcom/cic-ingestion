/**
 * Bridge Orchestrator (Phase 23.7.4–23.7.5)
 * Coordinates signal detection → governance routing → planner feedback → ARPS logging
 * Single integration point for autonomy → rest of CIC
 */
import { AutonomySignal } from '../models/AutonomySignal.js';
import { RoadmapProposal } from '../models/RoadmapProposal.js';
import { AutonomyToPlannerBridge } from './AutonomyToPlannerBridge.js';
import { AutonomyToARPSBridge } from './AutonomyToARPSBridge.js';
import { AutonomyGovernanceBridge } from './AutonomyGovernanceBridge.js';
export interface BridgeOrchestratorConfig {
    aprControlPlaneUrl: string;
    replanThresholds: {
        criticalSignalCount: number;
        totalPriorityScore: number;
    };
    memoryStoreUrl: string;
    governanceControlPlaneUrl: string;
    councilSize: number;
    approvalThreshold: number;
    autoApproveThreshold: number;
    plannerBridgeTimeoutMs?: number;
    arpsBridgeTimeoutMs?: number;
    governanceBridgeTimeoutMs?: number;
}
export interface BridgeIntegrationResult {
    signalsProcessed: number;
    proposalsGenerated: number;
    proposalsRouted: number;
    proposalsApproved: number;
    errors: Array<{
        bridge: string;
        error: string;
    }>;
    timestamp: string;
}
export declare class BridgeOrchestrator {
    private plannerBridge;
    private arpsBridge;
    private governanceBridge;
    private config;
    constructor(config: BridgeOrchestratorConfig);
    private withTimeout;
    /**
     * Process detected signals through all bridges
     * Flow: signals → planner goals + ARPS logging
     */
    processSignals(signals: AutonomySignal[]): Promise<BridgeIntegrationResult>;
    /**
     * Process generated proposals through all bridges
     * Flow: proposals → governance routing + planner constraints + ARPS logging
     */
    processProposals(proposals: RoadmapProposal[]): Promise<BridgeIntegrationResult>;
    /**
     * Process governance decision feedback
     * Flow: decision → update ARPS + learn
     */
    processGovernanceDecision(proposal: RoadmapProposal, decision: 'approved' | 'rejected', reason?: string): Promise<void>;
    /**
     * Full autonomy cycle: detect → propose → route → feedback
     */
    runFullIntegrationCycle(signals: AutonomySignal[], proposals: RoadmapProposal[]): Promise<BridgeIntegrationResult>;
    /**
     * Get bridge instances (for direct access if needed)
     */
    getPlanner(): AutonomyToPlannerBridge;
    getARPS(): AutonomyToARPSBridge;
    getGovernance(): AutonomyGovernanceBridge;
}
//# sourceMappingURL=BridgeOrchestrator.d.ts.map