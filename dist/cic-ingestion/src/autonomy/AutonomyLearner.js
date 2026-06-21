/**
 * Autonomy Learner — Feedback Loop & Threshold Tuning (Phase 23.7.7)
 * Learns from proposal outcomes to improve signal detection accuracy
 * Decays old signals automatically
 */
import { SIGNAL_THRESHOLDS } from './models/AutonomySignal.js';
/**
 * In-memory store for learning data
 */
class LearnerStore {
    constructor() {
        this.outcomes = new Map();
        this.signalAccuracies = new Map();
        this.thresholdHistory = [];
    }
    recordOutcome(record) {
        this.outcomes.set(record.proposalId, record);
    }
    getOutcome(proposalId) {
        return this.outcomes.get(proposalId);
    }
    getAllOutcomes() {
        return Array.from(this.outcomes.values());
    }
    updateSignalAccuracy(accuracy) {
        this.signalAccuracies.set(accuracy.signalType, accuracy);
    }
    getSignalAccuracy(signalType) {
        return this.signalAccuracies.get(signalType);
    }
    getAllAccuracies() {
        return Array.from(this.signalAccuracies.values());
    }
    recordThresholdUpdate(update) {
        this.thresholdHistory.push(update);
    }
    getThresholdHistory() {
        return [...this.thresholdHistory];
    }
    getMetrics() {
        const outcomes = this.getAllOutcomes();
        const successValue = outcomes.reduce((acc, o) => {
            if (o.outcome === 'success')
                return acc + 1;
            if (o.outcome === 'partial')
                return acc + 0.5;
            return acc;
        }, 0);
        const confidenceImprovements = outcomes
            .map((o) => o.feedback?.confidenceImprovement || 0)
            .filter((v) => v > 0);
        return {
            lastUpdatedAt: new Date().toISOString(),
            proposalsEvaluated: outcomes.length,
            successRate: outcomes.length > 0
                ? (successValue / outcomes.length) * 100
                : 0,
            accuracyBySignalType: Object.fromEntries(Array.from(this.signalAccuracies.entries())),
            thresholdAdjustments: this.thresholdHistory.length,
            avgConfidenceImprovement: confidenceImprovements.length > 0
                ? confidenceImprovements.reduce((a, b) => a + b, 0) /
                    confidenceImprovements.length
                : 0,
        };
    }
    clear() {
        this.outcomes.clear();
        this.signalAccuracies.clear();
        this.thresholdHistory = [];
    }
}
export class AutonomyLearner {
    constructor() {
        this.thresholds = { ...SIGNAL_THRESHOLDS };
        this.store = new LearnerStore();
    }
    /**
     * Record and evaluate proposal outcome
     */
    async evaluateProposalOutcome(proposal, outcome, actualDurationChange, reason) {
        const record = {
            proposalId: proposal.id,
            outcome,
            recordedAt: new Date().toISOString(),
            reason,
            actualDurationChange,
            actualRiskLevel: proposal.impact.riskLevel,
            feedback: {
                proposedDurationChange: proposal.impact.estimatedDurationChange,
                proposedRiskLevel: proposal.impact.riskLevel,
                signalTypes: proposal.triggeredBy.map((s) => s.type),
                confidence: proposal.confidence,
            },
        };
        this.store.recordOutcome(record);
        // Update signal accuracies based on outcome
        await this.updateSignalAccuracies(proposal, outcome);
        // Potentially adjust thresholds if accuracy is poor
        await this.evaluateThresholdAdjustment(proposal, outcome);
        console.log(`[AutonomyLearner] Recorded outcome for proposal ${proposal.id}: ${outcome}`);
    }
    /**
     * Update signal type accuracies based on proposal outcomes
     */
    async updateSignalAccuracies(proposal, outcome) {
        for (const signal of proposal.triggeredBy) {
            const accuracy = this.store.getSignalAccuracy(signal.type) || {
                signalType: signal.type,
                totalDetected: 0,
                truePositives: 0,
                falsePositives: 0,
                falseNegatives: 0,
                precision: 0,
                recall: 0,
                f1Score: 0,
            };
            accuracy.totalDetected++;
            // True positive: signal triggered, proposal succeeded
            if (outcome === 'success') {
                accuracy.truePositives++;
            }
            else if (outcome === 'failure') {
                // False positive: signal triggered, proposal failed
                accuracy.falsePositives++;
            }
            // Partial success: count as partial TP
            else if (outcome === 'partial') {
                accuracy.truePositives += 0.5;
                accuracy.falsePositives += 0.5;
            }
            // Recalculate metrics
            accuracy.precision =
                accuracy.truePositives + accuracy.falsePositives > 0
                    ? accuracy.truePositives /
                        (accuracy.truePositives + accuracy.falsePositives)
                    : 0;
            accuracy.recall =
                accuracy.truePositives + accuracy.falseNegatives > 0
                    ? accuracy.truePositives /
                        (accuracy.truePositives + accuracy.falseNegatives)
                    : 0;
            accuracy.f1Score =
                accuracy.precision + accuracy.recall > 0
                    ? (2 * accuracy.precision * accuracy.recall) /
                        (accuracy.precision + accuracy.recall)
                    : 0;
            this.store.updateSignalAccuracy(accuracy);
        }
    }
    /**
     * Evaluate whether thresholds should be adjusted
     */
    async evaluateThresholdAdjustment(proposal, outcome) {
        // If a proposal failed or had poor outcome, consider if thresholds were too lenient
        if (outcome === 'failure') {
            // Increase thresholds (be more conservative)
            for (const signal of proposal.triggeredBy) {
                switch (signal.type) {
                    case 'drift':
                        if (this.thresholds.DRIFT_CRITICAL < 1.0) {
                            this.adjustThreshold('DRIFT_CRITICAL', Math.min(1.0, this.thresholds.DRIFT_CRITICAL + 0.05), `Proposal ${proposal.id} failed; increased drift threshold`);
                        }
                        break;
                    case 'instability':
                        if (this.thresholds.INSTABILITY_ERROR_RATE < 0.2) {
                            this.adjustThreshold('INSTABILITY_ERROR_RATE', this.thresholds.INSTABILITY_ERROR_RATE + 0.02, `Proposal ${proposal.id} failed; increased error rate threshold`);
                        }
                        break;
                    case 'regression':
                        if (this.thresholds.REGRESSION_LATENCY_FACTOR < 2.5) {
                            this.adjustThreshold('REGRESSION_LATENCY_FACTOR', this.thresholds.REGRESSION_LATENCY_FACTOR + 0.2, `Proposal ${proposal.id} failed; increased regression threshold`);
                        }
                        break;
                }
            }
        }
        // If proposal succeeded with high confidence, consider if thresholds are too strict
        if (outcome === 'success' && proposal.confidence > 0.9) {
            for (const signal of proposal.triggeredBy) {
                switch (signal.type) {
                    case 'drift':
                        if (this.thresholds.DRIFT_CRITICAL > 0.5) {
                            this.adjustThreshold('DRIFT_CRITICAL', Math.max(0.5, this.thresholds.DRIFT_CRITICAL - 0.02), `Proposal ${proposal.id} succeeded; decreased drift threshold`);
                        }
                        break;
                    case 'instability':
                        if (this.thresholds.INSTABILITY_ERROR_RATE > 0.1) {
                            this.adjustThreshold('INSTABILITY_ERROR_RATE', this.thresholds.INSTABILITY_ERROR_RATE - 0.01, `Proposal ${proposal.id} succeeded; decreased error rate threshold`);
                        }
                        break;
                }
            }
        }
    }
    /**
     * Adjust a threshold and record the change
     */
    adjustThreshold(metric, newValue, reason) {
        const oldValue = this.thresholds[metric];
        if (oldValue !== newValue) {
            this.thresholds[metric] = newValue;
            const update = {
                metric,
                oldValue,
                newValue,
                reason,
                timestamp: new Date().toISOString(),
            };
            this.store.recordThresholdUpdate(update);
            console.log(`[AutonomyLearner] Adjusted threshold ${metric}: ${oldValue} → ${newValue}`);
        }
    }
    /**
     * Decay old signals (archive signals >30 days old)
     */
    async decayOldSignals(maxAgeDays = 30) {
        const cutoffTime = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
        const outcomes = this.store.getAllOutcomes();
        let decayedCount = 0;
        // In a real implementation, you would:
        // 1. Query MLA for signals older than cutoffTime
        // 2. Archive them to long-term storage
        // 3. Remove from active memory
        // 4. Update signal weights in detection engine
        // For now, just count old outcomes
        for (const outcome of outcomes) {
            if (new Date(outcome.recordedAt).getTime() < cutoffTime) {
                decayedCount++;
            }
        }
        console.log(`[AutonomyLearner] Decayed ${decayedCount} outcomes older than ${maxAgeDays} days`);
        return decayedCount;
    }
    /**
     * Get current metrics
     */
    getMetrics() {
        return this.store.getMetrics();
    }
    /**
     * Get signal accuracy for a specific type
     */
    getSignalAccuracy(signalType) {
        return this.store.getSignalAccuracy(signalType);
    }
    /**
     * Get all recorded outcomes
     */
    getAllOutcomes() {
        return this.store.getAllOutcomes();
    }
    /**
     * Get threshold history
     */
    getThresholdHistory() {
        return this.store.getThresholdHistory();
    }
    /**
     * Get current thresholds
     */
    getCurrentThresholds() {
        return { ...this.thresholds };
    }
    /**
     * Reset learner (for testing)
     */
    reset() {
        this.store.clear();
        this.thresholds = { ...SIGNAL_THRESHOLDS };
    }
}
//# sourceMappingURL=AutonomyLearner.js.map
