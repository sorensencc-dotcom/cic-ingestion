/**
 * Signal detection engine for Memory-Driven Autonomy (Phase 23.7)
 * Detects drift, instability, regression, and opportunity signals from event history
 */
import { SIGNAL_THRESHOLDS, classifySignalSeverity, isSignalValid, } from './models/AutonomySignal';
export class SignalDetectionEngine {
    /**
     * Detect all signals from event history and metrics
     */
    async detectSignals(context) {
        const signals = [];
        // Detect drift signals
        if (context.driftMetrics) {
            signals.push(...this.detectDriftSignals(context));
        }
        // Detect instability signals
        if (context.healthMetrics) {
            signals.push(...this.detectInstabilitySignals(context));
        }
        // Detect regression signals
        if (context.baselineMetrics && context.healthMetrics) {
            signals.push(...this.detectRegressionSignals(context));
        }
        // Detect opportunity signals
        if (context.healthMetrics) {
            signals.push(...this.detectOpportunitySignals(context));
        }
        // Filter invalid signals
        return signals.filter((sig) => isSignalValid(sig));
    }
    /**
     * Detect drift signals from drift metrics
     */
    detectDriftSignals(context) {
        const signals = [];
        if (!context.driftMetrics || context.driftMetrics.length === 0) {
            return signals;
        }
        // Analyze recent drift metrics (last 7 days)
        const recentMetrics = context.driftMetrics.slice(-7);
        const avgDrift = this.averageDrift(recentMetrics);
        if (avgDrift.combined_score > SIGNAL_THRESHOLDS.DRIFT_CRITICAL) {
            const affectedEvents = context.events.filter((e) => new Date(e.timestamp).getTime() >
                Date.now() - 7 * 24 * 60 * 60 * 1000);
            const signal = {
                id: `drift_${Date.now()}`,
                type: 'drift',
                severity: 'critical',
                confidence: this.calculateConfidence(affectedEvents.length, 10),
                affectedPhases: this.extractAffectedPhases(affectedEvents),
                evidence: affectedEvents,
                timestamp: new Date().toISOString(),
                description: `Critical drift detected across multiple signal types: semantic=${(avgDrift.semantic_drift * 100).toFixed(1)}%, temporal=${(avgDrift.temporal_drift * 100).toFixed(1)}%, narrative=${(avgDrift.narrative_drift * 100).toFixed(1)}%, causal=${(avgDrift.causal_drift * 100).toFixed(1)}%`,
                recommendation: 'Review recent changes in ARPS, APR, and CRO. Consider roadmap adjustments.',
                driftMetrics: avgDrift,
                metadata: { window: '7d', metric_count: recentMetrics.length },
            };
            signal.severity = classifySignalSeverity(signal);
            signals.push(signal);
        }
        else if (avgDrift.combined_score > SIGNAL_THRESHOLDS.DRIFT_WARNING) {
            const affectedEvents = context.events.filter((e) => new Date(e.timestamp).getTime() >
                Date.now() - 3 * 24 * 60 * 60 * 1000);
            const signal = {
                id: `drift_warning_${Date.now()}`,
                type: 'drift',
                severity: 'warning',
                confidence: this.calculateConfidence(affectedEvents.length, 5),
                affectedPhases: this.extractAffectedPhases(affectedEvents),
                evidence: affectedEvents,
                timestamp: new Date().toISOString(),
                description: `Elevated drift detected: combined_score=${(avgDrift.combined_score * 100).toFixed(1)}%`,
                recommendation: 'Monitor drift trends over next 24 hours.',
                driftMetrics: avgDrift,
                metadata: { window: '3d', metric_count: recentMetrics.length },
            };
            signal.severity = classifySignalSeverity(signal);
            signals.push(signal);
        }
        return signals;
    }
    /**
     * Detect instability signals from health metrics
     */
    detectInstabilitySignals(context) {
        const signals = [];
        if (!context.healthMetrics || context.healthMetrics.length === 0) {
            return signals;
        }
        const recentMetrics = context.healthMetrics.filter((m) => new Date(m.timestamp).getTime() > Date.now() - 24 * 60 * 60 * 1000);
        const avgErrorRate = recentMetrics.reduce((sum, m) => sum + (1 - m.successRate), 0) /
            recentMetrics.length;
        if (avgErrorRate > SIGNAL_THRESHOLDS.INSTABILITY_ERROR_RATE) {
            const affectedEvents = context.events.filter((e) => new Date(e.timestamp).getTime() > Date.now() - 24 * 60 * 60 * 1000 &&
                (e.severity === 'error' || e.severity === 'critical'));
            const signal = {
                id: `instability_${Date.now()}`,
                type: 'instability',
                severity: 'warning',
                confidence: this.calculateConfidence(affectedEvents.length, 3),
                affectedPhases: this.extractAffectedPhases(affectedEvents),
                evidence: affectedEvents,
                timestamp: new Date().toISOString(),
                description: `Instability detected: error_rate=${(avgErrorRate * 100).toFixed(1)}%, threshold=${(SIGNAL_THRESHOLDS.INSTABILITY_ERROR_RATE * 100).toFixed(1)}%`,
                recommendation: 'Investigate recent errors. Check PIPELINE_RUN and CRO_RUN events for failures.',
                instabilityMetrics: {
                    error_rate: avgErrorRate,
                    failure_rate: this.calculateFailureRate(recentMetrics),
                    latency_variance: this.calculateLatencyVariance(recentMetrics),
                    throughput_variance: 0,
                },
                metadata: { window: '24h', metric_count: recentMetrics.length },
            };
            signal.severity = classifySignalSeverity(signal);
            signals.push(signal);
        }
        return signals;
    }
    /**
     * Detect regression signals by comparing to baseline
     */
    detectRegressionSignals(context) {
        const signals = [];
        if (!context.baselineMetrics ||
            !context.healthMetrics ||
            context.healthMetrics.length === 0) {
            return signals;
        }
        const recentMetrics = context.healthMetrics.slice(-7); // Last 7 data points
        const avgLatency = recentMetrics.reduce((sum, m) => sum + m.p99Latency, 0) /
            recentMetrics.length;
        const avgSuccessRate = recentMetrics.reduce((sum, m) => sum + m.successRate, 0) /
            recentMetrics.length;
        const latencyFactor = avgLatency / context.baselineMetrics.latency;
        const successDifference = context.baselineMetrics.successRate - avgSuccessRate;
        if (latencyFactor > SIGNAL_THRESHOLDS.REGRESSION_LATENCY_FACTOR) {
            const affectedEvents = context.events.filter((e) => new Date(e.timestamp).getTime() >
                Date.now() - 7 * 24 * 60 * 60 * 1000);
            const signal = {
                id: `regression_${Date.now()}`,
                type: 'regression',
                severity: 'warning',
                confidence: this.calculateConfidence(affectedEvents.length, 10),
                affectedPhases: this.extractAffectedPhases(affectedEvents),
                evidence: affectedEvents,
                timestamp: new Date().toISOString(),
                description: `Latency regression detected: baseline=${context.baselineMetrics.latency}ms, current=${avgLatency.toFixed(0)}ms (${(latencyFactor * 100 - 100).toFixed(1)}% increase)`,
                recommendation: 'Review PIPELINE_RUN events and runtime metrics. Check for resource contention.',
                regressionMetrics: {
                    baseline_latency: context.baselineMetrics.latency,
                    current_latency: avgLatency,
                    latency_increase_factor: latencyFactor,
                    baseline_success_rate: context.baselineMetrics.successRate,
                    current_success_rate: avgSuccessRate,
                    success_rate_decline: successDifference,
                },
                metadata: { window: '7d', metric_count: recentMetrics.length },
            };
            signal.severity = classifySignalSeverity(signal);
            signals.push(signal);
        }
        if (successDifference > SIGNAL_THRESHOLDS.REGRESSION_SUCCESS_DECLINE) {
            const affectedEvents = context.events.filter((e) => new Date(e.timestamp).getTime() >
                Date.now() - 7 * 24 * 60 * 60 * 1000 &&
                e.severity !== 'info');
            const signal = {
                id: `regression_success_${Date.now()}`,
                type: 'regression',
                severity: 'warning',
                confidence: this.calculateConfidence(affectedEvents.length, 5),
                affectedPhases: this.extractAffectedPhases(affectedEvents),
                evidence: affectedEvents,
                timestamp: new Date().toISOString(),
                description: `Success rate regression: baseline=${(context.baselineMetrics.successRate * 100).toFixed(1)}%, current=${(avgSuccessRate * 100).toFixed(1)}% (${(successDifference * 100).toFixed(1)}% decline)`,
                recommendation: 'Analyze recent errors and failures. Check governance signals (Phase 24) for policy changes.',
                regressionMetrics: {
                    baseline_latency: context.baselineMetrics.latency,
                    current_latency: avgLatency,
                    latency_increase_factor: latencyFactor,
                    baseline_success_rate: context.baselineMetrics.successRate,
                    current_success_rate: avgSuccessRate,
                    success_rate_decline: successDifference,
                },
                metadata: { window: '7d', metric_count: recentMetrics.length },
            };
            signal.severity = classifySignalSeverity(signal);
            signals.push(signal);
        }
        return signals;
    }
    /**
     * Detect opportunity signals (consistently high success)
     */
    detectOpportunitySignals(context) {
        const signals = [];
        if (!context.healthMetrics || context.healthMetrics.length < 7) {
            return signals; // Need at least 7 data points
        }
        const recentMetrics = context.healthMetrics.slice(-7);
        const avgSuccessRate = recentMetrics.reduce((sum, m) => sum + m.successRate, 0) /
            recentMetrics.length;
        const consistency = recentMetrics.reduce((sum, m) => sum + (m.successRate > 0.95 ? 1 : 0), 0) /
            recentMetrics.length;
        if (avgSuccessRate > SIGNAL_THRESHOLDS.OPPORTUNITY_SUCCESS_RATE &&
            consistency > SIGNAL_THRESHOLDS.OPPORTUNITY_CONSISTENCY) {
            const affectedEvents = context.events.filter((e) => new Date(e.timestamp).getTime() >
                Date.now() - 7 * 24 * 60 * 60 * 1000);
            const signal = {
                id: `opportunity_${Date.now()}`,
                type: 'opportunity',
                severity: 'info',
                confidence: this.calculateConfidence(affectedEvents.length, 7),
                affectedPhases: this.extractAffectedPhases(affectedEvents),
                evidence: affectedEvents,
                timestamp: new Date().toISOString(),
                description: `Opportunity for acceleration: consistently high success rate (${(avgSuccessRate * 100).toFixed(1)}%) with ${(consistency * 100).toFixed(1)}% consistency.`,
                recommendation: 'Consider accelerating dependent phases or increasing resource allocation.',
                opportunityMetrics: {
                    success_rate: avgSuccessRate,
                    consistency,
                    potential_improvement: 'Accelerate Phase 25–27 (APR/CRO/CKG) to capitalize on stability.',
                },
                metadata: { window: '7d', metric_count: recentMetrics.length },
            };
            signals.push(signal);
        }
        return signals;
    }
    /**
     * Helper: Calculate average drift across metrics
     */
    averageDrift(metrics) {
        const avg = {
            semantic_drift: 0,
            temporal_drift: 0,
            narrative_drift: 0,
            causal_drift: 0,
            combined_score: 0,
        };
        for (const metric of metrics) {
            avg.semantic_drift += metric.signals.semantic_drift;
            avg.temporal_drift += metric.signals.temporal_drift;
            avg.narrative_drift += metric.signals.narrative_drift;
            avg.causal_drift += metric.signals.causal_drift;
        }
        avg.semantic_drift /= metrics.length;
        avg.temporal_drift /= metrics.length;
        avg.narrative_drift /= metrics.length;
        avg.causal_drift /= metrics.length;
        avg.combined_score =
            (avg.semantic_drift +
                avg.temporal_drift +
                avg.narrative_drift +
                avg.causal_drift) /
                4;
        return avg;
    }
    /**
     * Helper: Calculate failure rate from health metrics
     */
    calculateFailureRate(metrics) {
        const failureCount = metrics.reduce((sum, m) => sum + m.errorCount, 0);
        const totalEvents = metrics.reduce((sum, m) => sum + m.eventCount, 0);
        return totalEvents > 0 ? failureCount / totalEvents : 0;
    }
    /**
     * Helper: Calculate latency variance
     */
    calculateLatencyVariance(metrics) {
        const latencies = metrics.map((m) => m.p99Latency);
        const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const variance = latencies.reduce((sum, lat) => sum + Math.pow(lat - mean, 2), 0) /
            latencies.length;
        return Math.sqrt(variance);
    }
    /**
     * Helper: Calculate confidence score based on evidence
     */
    calculateConfidence(eventCount, threshold) {
        if (eventCount < threshold) {
            return Math.max(0.5, (eventCount / threshold) * 0.9);
        }
        return Math.min(1.0, 0.9 + (Math.min(eventCount, threshold * 2) / (threshold * 2)) * 0.1);
    }
    /**
     * Helper: Extract affected phases from events metadata
     */
    extractAffectedPhases(events) {
        const phases = new Set();
        for (const event of events) {
            if (event.metadata) {
                if (event.metadata.phase) {
                    phases.add(event.metadata.phase);
                }
                if (event.metadata.affectedPhases && Array.isArray(event.metadata.affectedPhases)) {
                    event.metadata.affectedPhases.forEach((p) => phases.add(p));
                }
            }
        }
        return Array.from(phases);
    }
}
//# sourceMappingURL=SignalDetection.js.map