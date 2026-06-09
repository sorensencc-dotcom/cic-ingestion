/**
 * Autonomy signal types and data models (Phase 23.7)
 * Signals triggered by drift, instability, regression, or opportunity detection
 */
import { TimelineEvent } from '../../ui/models/TimelineEvent';
export type SignalType = 'drift' | 'instability' | 'regression' | 'opportunity';
export type SignalSeverity = 'info' | 'warning' | 'critical';
export interface AutonomySignal {
    id: string;
    type: SignalType;
    severity: SignalSeverity;
    confidence: number;
    affectedPhases: string[];
    evidence: TimelineEvent[];
    timestamp: string;
    description: string;
    recommendation?: string;
    metadata: Record<string, any>;
}
export interface DriftSignal extends AutonomySignal {
    type: 'drift';
    driftMetrics: {
        semantic_drift: number;
        temporal_drift: number;
        narrative_drift: number;
        causal_drift: number;
        combined_score: number;
    };
}
export interface InstabilitySignal extends AutonomySignal {
    type: 'instability';
    instabilityMetrics: {
        error_rate: number;
        failure_rate: number;
        latency_variance: number;
        throughput_variance: number;
    };
}
export interface RegressionSignal extends AutonomySignal {
    type: 'regression';
    regressionMetrics: {
        baseline_latency: number;
        current_latency: number;
        latency_increase_factor: number;
        baseline_success_rate: number;
        current_success_rate: number;
        success_rate_decline: number;
    };
}
export interface OpportunitySignal extends AutonomySignal {
    type: 'opportunity';
    opportunityMetrics: {
        success_rate: number;
        consistency: number;
        potential_improvement: string;
    };
}
/**
 * Decision thresholds for signal generation
 */
export declare const SIGNAL_THRESHOLDS: {
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
 * Severity mapping based on signal type and metrics
 */
export declare function classifySignalSeverity(signal: AutonomySignal): SignalSeverity;
/**
 * Check if signal meets minimum evidence threshold
 */
export declare function isSignalValid(signal: AutonomySignal): boolean;
//# sourceMappingURL=AutonomySignal.d.ts.map