/**
 * Roadmap proposal types and data models (Phase 23.7)
 * Proposals generated from autonomy signals to adjust CIC roadmap
 */
import { AutonomySignal } from './AutonomySignal';
export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'executed';
export type ProposalActionType = 'reprioritize' | 'allocate_resources' | 'add_phase' | 'defer_phase' | 'accelerate_phase' | 'split_phase' | 'merge_phases';
export interface ProposalAction {
    type: ProposalActionType;
    phase: string;
    description: string;
    estimatedDurationChange?: number;
    resourceRequirements?: Record<string, number>;
    newPosition?: number;
    newTargetDate?: string;
    targetPhase?: string;
}
export interface ProposalImpact {
    affectedPhases: string[];
    estimatedDurationChange: number;
    riskLevel: 'low' | 'medium' | 'high';
    dependencies: string[];
    rationale: string;
}
export interface RoadmapProposal {
    id: string;
    timestamp: string;
    triggeredBy: AutonomySignal[];
    actions: ProposalAction[];
    impact: ProposalImpact;
    confidence: number;
    status: ProposalStatus;
    approvalStatus?: {
        requestedAt: string;
        votesRequired: number;
        votesReceived: number;
        councilVotes?: VoteRecord[];
    };
    rejectionReason?: string;
    executedAt?: string;
    metadata: Record<string, any>;
}
export interface VoteRecord {
    voterId: string;
    decision: 'approve' | 'reject' | 'abstain';
    reason?: string;
    timestamp: string;
}
export interface SimulationResult {
    proposalId: string;
    simulationType: string;
    outcomes: {
        phaseDurations: Record<string, number>;
        riskScore: number;
        estimatedCompletion: string;
        criticalPath: string[];
    };
    confidence: number;
}
/**
 * Proposal priority scoring based on signals and impact
 */
export declare function scoreProposalPriority(proposal: RoadmapProposal): number;
/**
 * Check if proposal requires governance approval
 */
export declare function requiresGovernanceApproval(proposal: RoadmapProposal): boolean;
/**
 * Estimate roadmap completion date after proposal execution
 */
export declare function estimateCompletionAfterProposal(baseCompletionDate: Date, proposal: RoadmapProposal): Date;
//# sourceMappingURL=RoadmapProposal.d.ts.map