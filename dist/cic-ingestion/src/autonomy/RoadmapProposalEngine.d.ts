/**
 * Roadmap proposal engine for Memory-Driven Autonomy (Phase 23.7)
 * Converts autonomy signals into actionable roadmap proposals
 */
import { AutonomySignal } from './models/AutonomySignal';
import { RoadmapProposal } from './models/RoadmapProposal';
export interface RoadmapContext {
    currentPhases: PhaseInfo[];
    criticalPathPhases: string[];
    estimatedCompletionDate: Date;
}
export interface PhaseInfo {
    name: string;
    status: 'pending' | 'in_progress' | 'complete';
    estimatedDuration: number;
    dependencies: string[];
    estimatedStartDate: Date;
    estimatedEndDate: Date;
}
export declare class RoadmapProposalEngine {
    /**
     * Generate proposals from autonomy signals
     */
    generateProposals(signals: AutonomySignal[], context: RoadmapContext): Promise<RoadmapProposal[]>;
    /**
     * Generate a single proposal from grouped signals for a phase
     */
    private proposalFromSignals;
    /**
     * Calculate proposal impact on roadmap
     */
    private calculateImpact;
    /**
     * Calculate affected dependencies
     */
    private calculateAffectedDependencies;
    /**
     * Generate human-readable rationale
     */
    private generateRationale;
    /**
     * Calculate overall proposal confidence
     */
    private calculateProposalConfidence;
    /**
     * Helper: Group signals by affected phase
     */
    private groupSignalsByPhase;
}
//# sourceMappingURL=RoadmapProposalEngine.d.ts.map