/**
 * Signal detection engine for Memory-Driven Autonomy (Phase 23.7)
 * Detects drift, instability, regression, and opportunity signals from event history
 */
import { TimelineEvent, DriftMetric, HealthMetric } from '../ui/models/TimelineEvent.js';
import { AutonomySignal } from './models/AutonomySignal.js';
export interface SignalDetectionContext {
    events: TimelineEvent[];
    driftMetrics?: DriftMetric[];
    healthMetrics?: HealthMetric[];
    baselineMetrics?: {
        latency: number;
        successRate: number;
        errorRate: number;
    };
}
export declare class SignalDetectionEngine {
    /**
     * Detect all signals from event history and metrics
     */
    detectSignals(context: SignalDetectionContext): Promise<AutonomySignal[]>;
    /**
     * Detect drift signals from drift metrics
     */
    private detectDriftSignals;
    /**
     * Detect instability signals from health metrics
     */
    private detectInstabilitySignals;
    /**
     * Detect regression signals by comparing to baseline
     */
    private detectRegressionSignals;
    /**
     * Detect opportunity signals (consistently high success)
     */
    private detectOpportunitySignals;
    /**
     * Helper: Calculate average drift across metrics
     */
    private averageDrift;
    /**
     * Helper: Calculate failure rate from health metrics
     */
    private calculateFailureRate;
    /**
     * Helper: Calculate latency variance
     */
    private calculateLatencyVariance;
    /**
     * Helper: Calculate confidence score based on evidence
     */
    private calculateConfidence;
    /**
     * Helper: Extract affected phases from events metadata
     */
    private extractAffectedPhases;
}
//# sourceMappingURL=SignalDetection.d.ts.map