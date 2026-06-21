/**
 * Autonomy signal types and data models (Phase 23.7)
 * Signals triggered by drift, instability, regression, or opportunity detection
 */
/**
 * Decision thresholds for signal generation
 */
export const SIGNAL_THRESHOLDS = {
    DRIFT_CRITICAL: 0.75, // drift score > 75%
    DRIFT_WARNING: 0.5,
    INSTABILITY_ERROR_RATE: 0.15, // error rate > 15%
    INSTABILITY_LATENCY: 2.0, // latency increased 2x
    REGRESSION_LATENCY_FACTOR: 2.0, // 2x increase triggers regression signal
    REGRESSION_SUCCESS_DECLINE: 0.1, // 10% decline
    OPPORTUNITY_SUCCESS_RATE: 0.95, // >95% success = opportunity
    OPPORTUNITY_CONSISTENCY: 0.9, // >90% consistency
    MIN_EVIDENCE_EVENTS: 3, // minimum events to support signal
    SIGNAL_CONFIDENCE_MIN: 0.6, // discard signals <60% confidence
};
/**
 * Severity mapping based on signal type and metrics
 */
export function classifySignalSeverity(signal) {
    if (signal.confidence < 0.5)
        return 'info';
    switch (signal.type) {
        case 'drift':
            const driftSig = signal;
            if (driftSig.driftMetrics.combined_score > 0.75)
                return 'critical';
            if (driftSig.driftMetrics.combined_score > 0.5)
                return 'warning';
            return 'info';
        case 'instability':
            const instabilitySig = signal;
            if (instabilitySig.instabilityMetrics.error_rate > 0.3)
                return 'critical';
            if (instabilitySig.instabilityMetrics.error_rate > 0.15)
                return 'warning';
            return 'info';
        case 'regression':
            const regressionSig = signal;
            if (regressionSig.regressionMetrics.latency_increase_factor > 3) {
                return 'critical';
            }
            if (regressionSig.regressionMetrics.latency_increase_factor > 1.5) {
                return 'warning';
            }
            return 'info';
        case 'opportunity':
            return 'info'; // opportunities are always informational
        default:
            return 'info';
    }
}
/**
 * Check if signal meets minimum evidence threshold
 */
export function isSignalValid(signal) {
    return (signal.evidence.length >= SIGNAL_THRESHOLDS.MIN_EVIDENCE_EVENTS &&
        signal.confidence >= SIGNAL_THRESHOLDS.SIGNAL_CONFIDENCE_MIN);
}
//# sourceMappingURL=AutonomySignal.js.map
