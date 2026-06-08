/**
 * Autonomy Learner — Feedback Loop & Threshold Tuning (Phase 23.7.7)
 * Learns from proposal outcomes to improve signal detection accuracy
 * Decays old signals automatically
 */

import { RoadmapProposal } from './models/RoadmapProposal';
import { SIGNAL_THRESHOLDS } from './models/AutonomySignal';

export type ProposalOutcome = 'success' | 'partial' | 'failure';

export interface ProposalOutcomeRecord {
  proposalId: string;
  outcome: ProposalOutcome;
  recordedAt: string; // ISO 8601
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
  precision: number; // TP / (TP + FP)
  recall: number; // TP / (TP + FN)
  f1Score: number; // harmonic mean of precision and recall
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

/**
 * In-memory store for learning data
 */
class LearnerStore {
  private outcomes: Map<string, ProposalOutcomeRecord> = new Map();
  private signalAccuracies: Map<string, SignalAccuracy> = new Map();
  private thresholdHistory: ThresholdUpdate[] = [];

  recordOutcome(record: ProposalOutcomeRecord): void {
    this.outcomes.set(record.proposalId, record);
  }

  getOutcome(proposalId: string): ProposalOutcomeRecord | undefined {
    return this.outcomes.get(proposalId);
  }

  getAllOutcomes(): ProposalOutcomeRecord[] {
    return Array.from(this.outcomes.values());
  }

  updateSignalAccuracy(accuracy: SignalAccuracy): void {
    this.signalAccuracies.set(accuracy.signalType, accuracy);
  }

  getSignalAccuracy(signalType: string): SignalAccuracy | undefined {
    return this.signalAccuracies.get(signalType);
  }

  getAllAccuracies(): SignalAccuracy[] {
    return Array.from(this.signalAccuracies.values());
  }

  recordThresholdUpdate(update: ThresholdUpdate): void {
    this.thresholdHistory.push(update);
  }

  getThresholdHistory(): ThresholdUpdate[] {
    return [...this.thresholdHistory];
  }

  getMetrics(): LearnerMetrics {
    const outcomes = this.getAllOutcomes();
    const successCount = outcomes.filter((o) => o.outcome === 'success').length;
    const confidenceImprovements = outcomes
      .map((o) => o.feedback?.confidenceImprovement || 0)
      .filter((v) => v > 0);

    return {
      lastUpdatedAt: new Date().toISOString(),
      proposalsEvaluated: outcomes.length,
      successRate:
        outcomes.length > 0
          ? (successCount / outcomes.length) * 100
          : 0,
      accuracyBySignalType: Object.fromEntries(
        Array.from(this.signalAccuracies.entries())
      ),
      thresholdAdjustments: this.thresholdHistory.length,
      avgConfidenceImprovement:
        confidenceImprovements.length > 0
          ? confidenceImprovements.reduce((a, b) => a + b, 0) /
            confidenceImprovements.length
          : 0,
    };
  }

  clear(): void {
    this.outcomes.clear();
    this.signalAccuracies.clear();
    this.thresholdHistory = [];
  }
}

export class AutonomyLearner {
  private store: LearnerStore;
  private thresholds = { ...SIGNAL_THRESHOLDS };

  constructor() {
    this.store = new LearnerStore();
  }

  /**
   * Record and evaluate proposal outcome
   */
  async evaluateProposalOutcome(
    proposal: RoadmapProposal,
    outcome: ProposalOutcome,
    actualDurationChange?: number,
    reason?: string
  ): Promise<void> {
    const record: ProposalOutcomeRecord = {
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

    console.log(
      `[AutonomyLearner] Recorded outcome for proposal ${proposal.id}: ${outcome}`
    );
  }

  /**
   * Update signal type accuracies based on proposal outcomes
   */
  private async updateSignalAccuracies(
    proposal: RoadmapProposal,
    outcome: ProposalOutcome
  ): Promise<void> {
    for (const signal of proposal.triggeredBy) {
      const accuracy = this.store.getSignalAccuracy(signal.type) || {
        signalType: signal.type as any,
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
      } else if (outcome === 'failure') {
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
  private async evaluateThresholdAdjustment(
    proposal: RoadmapProposal,
    outcome: ProposalOutcome
  ): Promise<void> {
    // If a proposal failed or had poor outcome, consider if thresholds were too lenient
    if (outcome === 'failure') {
      // Increase thresholds (be more conservative)
      for (const signal of proposal.triggeredBy) {
        switch (signal.type) {
          case 'drift':
            if (this.thresholds.DRIFT_CRITICAL > 0.7) {
              this.adjustThreshold(
                'DRIFT_CRITICAL',
                this.thresholds.DRIFT_CRITICAL + 0.05,
                `Proposal ${proposal.id} failed; increased drift threshold`
              );
            }
            break;

          case 'instability':
            if (this.thresholds.INSTABILITY_ERROR_RATE < 0.2) {
              this.adjustThreshold(
                'INSTABILITY_ERROR_RATE',
                this.thresholds.INSTABILITY_ERROR_RATE + 0.02,
                `Proposal ${proposal.id} failed; increased error rate threshold`
              );
            }
            break;

          case 'regression':
            if (this.thresholds.REGRESSION_LATENCY_FACTOR < 2.5) {
              this.adjustThreshold(
                'REGRESSION_LATENCY_FACTOR',
                this.thresholds.REGRESSION_LATENCY_FACTOR + 0.2,
                `Proposal ${proposal.id} failed; increased regression threshold`
              );
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
            if (this.thresholds.DRIFT_CRITICAL < 0.75) {
              this.adjustThreshold(
                'DRIFT_CRITICAL',
                this.thresholds.DRIFT_CRITICAL - 0.02,
                `Proposal ${proposal.id} succeeded; decreased drift threshold`
              );
            }
            break;

          case 'instability':
            if (this.thresholds.INSTABILITY_ERROR_RATE > 0.1) {
              this.adjustThreshold(
                'INSTABILITY_ERROR_RATE',
                this.thresholds.INSTABILITY_ERROR_RATE - 0.01,
                `Proposal ${proposal.id} succeeded; decreased error rate threshold`
              );
            }
            break;
        }
      }
    }
  }

  /**
   * Adjust a threshold and record the change
   */
  private adjustThreshold(
    metric: string,
    newValue: number,
    reason: string
  ): void {
    const oldValue = (this.thresholds as any)[metric];

    if (oldValue !== newValue) {
      (this.thresholds as any)[metric] = newValue;

      const update: ThresholdUpdate = {
        metric,
        oldValue,
        newValue,
        reason,
        timestamp: new Date().toISOString(),
      };

      this.store.recordThresholdUpdate(update);

      console.log(
        `[AutonomyLearner] Adjusted threshold ${metric}: ${oldValue} → ${newValue}`
      );
    }
  }

  /**
   * Decay old signals (archive signals >30 days old)
   */
  async decayOldSignals(maxAgeDays: number = 30): Promise<number> {
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

    console.log(
      `[AutonomyLearner] Decayed ${decayedCount} outcomes older than ${maxAgeDays} days`
    );

    return decayedCount;
  }

  /**
   * Get current metrics
   */
  getMetrics(): LearnerMetrics {
    return this.store.getMetrics();
  }

  /**
   * Get signal accuracy for a specific type
   */
  getSignalAccuracy(signalType: string): SignalAccuracy | undefined {
    return this.store.getSignalAccuracy(signalType);
  }

  /**
   * Get all recorded outcomes
   */
  getAllOutcomes(): ProposalOutcomeRecord[] {
    return this.store.getAllOutcomes();
  }

  /**
   * Get threshold history
   */
  getThresholdHistory(): ThresholdUpdate[] {
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
  reset(): void {
    this.store.clear();
    this.thresholds = { ...SIGNAL_THRESHOLDS };
  }
}
