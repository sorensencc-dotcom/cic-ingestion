/**
 * Autonomy Learner — Feedback Loop & Threshold Tuning (Phase 23.7.7)
 * Learns from proposal outcomes to improve signal detection accuracy
 * Decays old signals automatically
 */
import { RoadmapProposal } from './models/RoadmapProposal';
export type ProposalOutcome = 'success' | 'partial' | 'failure';
export interface ProposalOutcomeRecord {
    proposalId: string;
    outcome: ProposalOutcome;
    recordedAt: string;
    reason?: string;
    actualDurationChange?: number;
    actualRiskLevel?: 'low' | 'medium' | 'high';
    feedback?: Record<string, any>;
}
export interface SignalAccuracy {
    signalType: 'drift' | 'instability' | 'regression' | 'opportunity';
    totalDetected: number;
    truePositives: number;
    falsePositives: number;
    falseNegatives: number;
    precision: number;
    recall: number;
    f1Score: number;
}
export interface LearnerMetrics {
    lastUpdatedAt: string;
    proposalsEvaluated: number;
    successRate: number;
    accuracyBySignalType: Record<string, SignalAccuracy>;
    thresholdAdjustments: number;
    avgConfidenceImprovement: number;
}
export interface ThresholdUpdate {
    metric: string;
    oldValue: number;
    newValue: number;
    reason: string;
    timestamp: string;
}
export declare class AutonomyLearner {
    private store;
    private thresholds;
    constructor();
    /**
     * Record and evaluate proposal outcome
     */
    evaluateProposalOutcome(proposal: RoadmapProposal, outcome: ProposalOutcome, actualDurationChange?: number, reason?: string): Promise<void>;
    /**
     * Update signal type accuracies based on proposal outcomes
     */
    private updateSignalAccuracies;
    /**
     * Evaluate whether thresholds should be adjusted
     */
    private evaluateThresholdAdjustment;
    /**
     * Adjust a threshold and record the change
     */
    private adjustThreshold;
    /**
     * Decay old signals (archive signals >30 days old)
     */
    decayOldSignals(maxAgeDays?: number): Promise<number>;
    /**
     * Get current metrics
     */
    getMetrics(): LearnerMetrics;
    /**
     * Get signal accuracy for a specific type
     */
    getSignalAccuracy(signalType: string): SignalAccuracy | undefined;
    /**
     * Get all recorded outcomes
     */
    getAllOutcomes(): ProposalOutcomeRecord[];
    /**
     * Get threshold history
     */
    getThresholdHistory(): ThresholdUpdate[];
    /**
     * Get current thresholds
     */
    getCurrentThresholds(): {
        DRIFT_CRITICAL: number;
        DRIFT_WARNING: number;
        INSTABILITY_ERROR_RATE: number;
        INSTABILITY_LATENCY: number;
        REGRESSION_LATENCY_FACTOR: number;
        REGRESSION_SUCCESS_DECLINE: number;
        OPPORTUNITY_SUCCESS_RATE: number;
        OPPORTUNITY_CONSISTENCY: number;
        MIN_EVIDENCE_EVENTS: number;
        SIGNAL_CONFIDENCE_MIN: number;
    };
    /**
     * Reset learner (for testing)
     */
    reset(): void;
}
//# sourceMappingURL=AutonomyLearner.d.ts.map