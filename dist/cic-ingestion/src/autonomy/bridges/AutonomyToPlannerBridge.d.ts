/**
 * Autonomy → APR (Planner) Bridge (Phase 23.7.4)
 * Converts autonomy signals into planner goals and triggers replanning
 * Feeds memory-driven autonomy into the autonomous planner (Phase 25)
 */
import { AutonomySignal } from '../models/AutonomySignal';
import { RoadmapProposal } from '../models/RoadmapProposal';
export interface PlannerGoal {
    id: string;
    type: 'drift_mitigation' | 'stabilization' | 'regression_fix' | 'acceleration';
    description: string;
    priority: number;
    targetPhase: string;
    requiredActions: string[];
    deadline?: string;
    confidence: number;
    source: 'autonomy';
    timestamp: string;
    relatedSignals: string[];
}
export interface APRPlanRequest {
    goals: PlannerGoal[];
    replan: boolean;
    context: {
        triggeredBy: 'signal_detection' | 'proposal_approval';
        timestamp: string;
    };
}
export interface PlannerBridgeConfig {
    aprControlPlaneUrl: string;
    replanThresholds: {
        criticalSignalCount: number;
        totalPriorityScore: number;
    };
}
export declare class AutonomyToPlannerBridge {
    private config;
    constructor(config: PlannerBridgeConfig);
    /**
     * Convert signals to planner goals
     */
    feedSignalsToPlanner(signals: AutonomySignal[]): Promise<void>;
    /**
     * Feed approved proposals back to planner as constraints/updates
     */
    feedProposalToPlanner(proposal: RoadmapProposal): Promise<void>;
    /**
     * Helper: Convert signals to planner goals
     */
    private convertSignalsToGoals;
    /**
     * Helper: Determine if signals warrant replanning
     */
    private shouldTriggerReplan;
    /**
     * Helper: Convert proposal actions to planner constraints
     */
    private convertProposalToConstraints;
    /**
     * Helper: Map signal severity to priority score
     */
    private signalSeverityToPriority;
    /**
     * Send goals to APR control plane
     */
    private sendToPlannerControlPlane;
    /**
     * Send proposal constraints to APR control plane
     */
    private sendConstraintsToPlannerControlPlane;
}
//# sourceMappingURL=AutonomyToPlannerBridge.d.ts.map