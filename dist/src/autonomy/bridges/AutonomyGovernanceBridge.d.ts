/**
 * Autonomy → Governance (Council) Bridge (Phase 23.7.5)
 * Routes proposals to Phase 24 Council for voting
 * Integrates memory-driven autonomy with governance (Phase 24)
 */
import { RoadmapProposal } from '../models/RoadmapProposal.js';
export interface GovernanceVoteRequest {
    proposalId: string;
    title: string;
    description: string;
    rationale: string;
    riskLevel: 'low' | 'medium' | 'high';
    affectedPhases: string[];
    requiredApprovals: number;
    votingDeadline: string;
    metadata: Record<string, any>;
}
export interface CouncilVote {
    proposalId: string;
    voterId: string;
    decision: 'approve' | 'reject' | 'abstain';
    reason?: string;
    timestamp: string;
}
export interface GovernanceDecision {
    proposalId: string;
    status: 'approved' | 'rejected';
    approvalCount: number;
    rejectionCount: number;
    abstainCount: number;
    votes: CouncilVote[];
    decidedAt: string;
    rationale: string;
}
export interface GovernanceBridgeConfig {
    governanceControlPlaneUrl: string;
    councilSize: number;
    approvalThreshold: number;
    autoApproveThreshold: number;
    cicToken?: string;
}
export declare class AutonomyGovernanceBridge {
    private config;
    constructor(config: GovernanceBridgeConfig);
    /**
     * Build request headers including the CIC governance token.
     * Token source priority: config.cicToken → CIC_GOVERNANCE_TOKEN env var.
     * All requests to the governance control plane must include this token.
     */
    private governanceHeaders;
    /**
     * Route proposal to governance if it requires approval
     */
    routeProposalToGovernance(proposal: RoadmapProposal): Promise<void>;
    /**
     * Record council vote
     */
    recordVote(proposalId: string, voterId: string, decision: 'approve' | 'reject' | 'abstain', reason?: string): Promise<void>;
    /**
     * Finalize governance decision
     */
    finalizeDecision(proposal: RoadmapProposal, votes: CouncilVote[]): Promise<GovernanceDecision>;
    /**
     * Helper: Check if proposal should be auto-approved
     */
    private shouldAutoApprove;
    /**
     * Helper: Auto-approve proposal (bypass council)
     */
    private autoApproveProposal;
    /**
     * Helper: Build governance vote request
     */
    private buildVoteRequest;
    /**
     * Submit vote request to governance control plane
     */
    private submitToGovernance;
    /**
     * Submit individual vote
     */
    private submitVote;
    /**
     * Record finalized decision
     */
    private recordDecision;
}
//# sourceMappingURL=AutonomyGovernanceBridge.d.ts.map