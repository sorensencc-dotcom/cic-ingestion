/**
 * Autonomy Service — orchestrates signal detection and proposal generation
 * Sits between API routes and business logic (Phase 23.7.3)
 */
import { AutonomySignal } from './models/AutonomySignal';
import { RoadmapProposal } from './models/RoadmapProposal';
import { RoadmapContext } from './RoadmapProposalEngine';
export interface AutonomyServiceConfig {
    memoryQueryApiUrl: string;
    roadmapContext: RoadmapContext;
}
export interface SignalQuery {
    type?: string[];
    severity?: string[];
    phase?: string[];
    minConfidence?: number;
    limit?: number;
    offset?: number;
}
export interface ProposalQuery {
    status?: ('pending' | 'approved' | 'rejected' | 'executed')[];
    minPriority?: number;
    limit?: number;
    offset?: number;
}
export declare class AutonomyService {
    private config;
    private signalEngine;
    private proposalEngine;
    private store;
    constructor(config: AutonomyServiceConfig);
    /**
     * Detect signals from event history
     * Fetches events/metrics from MemoryQueryAPI and runs detection
     */
    detectSignals(startDate: Date, endDate: Date): Promise<AutonomySignal[]>;
    /**
     * Generate proposals from signals
     */
    generateProposals(signals?: AutonomySignal[]): Promise<RoadmapProposal[]>;
    /**
     * Query signals with filters
     */
    querySignals(query: SignalQuery): AutonomySignal[];
    /**
     * Query proposals with filters
     */
    queryProposals(query: ProposalQuery): RoadmapProposal[];
    /**
     * Get signal by ID
     */
    getSignal(id: string): AutonomySignal | undefined;
    /**
     * Get proposal by ID
     */
    getProposal(id: string): RoadmapProposal | undefined;
    /**
     * Update proposal status (e.g., approve, reject, execute)
     */
    updateProposalStatus(id: string, status: RoadmapProposal['status']): RoadmapProposal | undefined;
    /**
     * Run full autonomy cycle: detect signals → generate proposals
     */
    runFullCycle(startDate: Date, endDate: Date): Promise<{
        signals: AutonomySignal[];
        proposals: RoadmapProposal[];
    }>;
    /**
     * Helper: Fetch events from MemoryQueryAPI
     */
    private fetchEvents;
    /**
     * Helper: Fetch drift metrics from MemoryQueryAPI
     */
    private fetchDriftMetrics;
    /**
     * Helper: Fetch health metrics from MemoryQueryAPI
     */
    private fetchHealthMetrics;
}
//# sourceMappingURL=AutonomyService.d.ts.map