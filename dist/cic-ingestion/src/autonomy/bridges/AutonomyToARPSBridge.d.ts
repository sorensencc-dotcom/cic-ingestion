/**
 * Autonomy → ARPS (Roadmap State) Bridge (Phase 23.7.4)
 * Logs proposals as ARPS_DELTA events
 * Feeds memory-driven autonomy back into the roadmap state (Phase 22)
 */
import { RoadmapProposal } from '../models/RoadmapProposal';
import { AutonomySignal } from '../models/AutonomySignal';
export interface ARPSDelta {
    id: string;
    type: 'autonomy_proposal' | 'autonomy_signal' | 'autonomy_feedback';
    timestamp: string;
    phase?: string;
    proposalId?: string;
    signalId?: string;
    change: {
        action: string;
        from?: Record<string, any>;
        to: Record<string, any>;
        reason: string;
    };
    metadata: Record<string, any>;
}
export interface ARPSBridgeConfig {
    memoryStoreUrl: string;
}
export declare class AutonomyToARPSBridge {
    private config;
    constructor(config: ARPSBridgeConfig);
    /**
     * Log proposal as ARPS_DELTA event
     */
    logProposalToARPS(proposal: RoadmapProposal): Promise<void>;
    /**
     * Log signal as ARPS_DELTA event
     */
    logSignalToARPS(signal: AutonomySignal): Promise<void>;
    /**
     * Log proposal approval/rejection as feedback event
     */
    logProposalFeedbackToARPS(proposal: RoadmapProposal, decision: 'approved' | 'rejected', reason?: string): Promise<void>;
    /**
     * Batch log multiple proposals
     */
    logProposalsToARPS(proposals: RoadmapProposal[]): Promise<void>;
    /**
     * Helper: Send delta to ARPS (via MLA)
     */
    private sendDeltaToARPS;
    /**
     * Helper: Map delta to event severity
     */
    private getEventSeverity;
    /**
     * Helper: Calculate proposal priority (simplified)
     */
    private calculateProposalPriority;
}
//# sourceMappingURL=AutonomyToARPSBridge.d.ts.map