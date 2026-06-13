/**
 * Autonomy Learner Test Suite (Phase 23.7.7)
 */

import { AutonomyLearner } from '../AutonomyLearner';
import { createMockProposal, createMockDriftSignal } from '../bridges/__tests__/fixtures';

describe('AutonomyLearner', () => {
  let learner: AutonomyLearner;

  beforeEach(() => {
    learner = new AutonomyLearner();
  });

  describe('Proposal Outcome Evaluation', () => {
    it('records successful proposal outcome', async () => {
      const proposal = createMockProposal('executed');
      await learner.evaluateProposalOutcome(proposal, 'success');

      const metrics = learner.getMetrics();
      expect(metrics.proposalsEvaluated).toBe(1);
      expect(metrics.successRate).toBe(100);
    });

    it('records failed proposal outcome', async () => {
      const proposal = createMockProposal('executed');
      await learner.evaluateProposalOutcome(proposal, 'failure', undefined, 'Phase blocked');

      const metrics = learner.getMetrics();
      expect(metrics.proposalsEvaluated).toBe(1);
      expect(metrics.successRate).toBe(0);
    });

    it('records partial outcome', async () => {
      const proposal = createMockProposal('executed');
      await learner.evaluateProposalOutcome(proposal, 'partial', 48, 'Delayed but successful');

      const metrics = learner.getMetrics();
      expect(metrics.proposalsEvaluated).toBe(1);
      expect(metrics.successRate).toBeLessThan(100);
      expect(metrics.successRate).toBeGreaterThan(0);
    });

    it('stores actual duration change', async () => {
      const proposal = createMockProposal('executed');
      await learner.evaluateProposalOutcome(proposal, 'success', 72);

      const outcomes = learner.getAllOutcomes();
      expect(outcomes[0].actualDurationChange).toBe(72);
    });

    it('stores feedback details', async () => {
      const proposal = createMockProposal('executed');
      await learner.evaluateProposalOutcome(
        proposal,
        'success',
        undefined,
        'Mitigation worked well'
      );

      const outcomes = learner.getAllOutcomes();
      expect(outcomes.length).toBeGreaterThan(0);
      expect(outcomes[0].reason).toBe('Mitigation worked well');
      expect(outcomes[0].feedback).toBeDefined();
      expect(outcomes[0].feedback?.confidence).toBe(proposal.confidence);
    });
  });

  describe('Signal Accuracy Tracking', () => {
    it('tracks accuracy for drift signals', async () => {
      const proposal = createMockProposal('executed');
      proposal.triggeredBy = [createMockDriftSignal('critical')];

      await learner.evaluateProposalOutcome(proposal, 'success');

      const accuracy = learner.getSignalAccuracy('drift');
      expect(accuracy).toBeDefined();
      expect(accuracy?.totalDetected).toBe(1);
      expect(accuracy?.truePositives).toBe(1);
      expect(accuracy?.precision).toBe(1);
    });

    it('calculates precision (TP / (TP + FP))', async () => {
      const proposal1 = createMockProposal('executed');
      proposal1.triggeredBy = [createMockDriftSignal('critical')];
      const proposal2 = createMockProposal('executed');
      proposal2.triggeredBy = [createMockDriftSignal('critical')];

      await learner.evaluateProposalOutcome(proposal1, 'success'); // TP
      await learner.evaluateProposalOutcome(proposal2, 'failure'); // FP

      const accuracy = learner.getSignalAccuracy('drift');
      expect(accuracy?.precision).toBe(0.5); // 1 / (1 + 1)
    });

    it('calculates recall (TP / (TP + FN))', async () => {
      const proposal = createMockProposal('executed');
      proposal.triggeredBy = [createMockDriftSignal('critical')];

      await learner.evaluateProposalOutcome(proposal, 'success'); // TP

      const accuracy = learner.getSignalAccuracy('drift');
      expect(accuracy?.recall).toBeGreaterThan(0);
    });

    it('calculates F1 score (harmonic mean)', async () => {
      const proposal = createMockProposal('executed');
      proposal.triggeredBy = [createMockDriftSignal('critical')];

      await learner.evaluateProposalOutcome(proposal, 'success');

      const accuracy = learner.getSignalAccuracy('drift');
      expect(accuracy?.f1Score).toBeGreaterThan(0);
      // F1 = 2 * (precision * recall) / (precision + recall)
      if (accuracy?.precision && accuracy?.recall) {
        const expected =
          (2 * accuracy.precision * accuracy.recall) /
          (accuracy.precision + accuracy.recall);
        expect(accuracy.f1Score).toBeCloseTo(expected, 2);
      }
    });

    it('handles partial outcomes as 0.5 TP', async () => {
      const proposal = createMockProposal('executed');
      proposal.triggeredBy = [createMockDriftSignal('critical')];

      await learner.evaluateProposalOutcome(proposal, 'partial');

      const accuracy = learner.getSignalAccuracy('drift');
      expect(accuracy?.truePositives).toBe(0.5);
      expect(accuracy?.falsePositives).toBe(0.5);
    });
  });

  describe('Threshold Adjustment', () => {
    it('increases drift threshold on failed proposals', async () => {
      const proposal = createMockProposal('executed');
      proposal.triggeredBy = [createMockDriftSignal('critical')];
      const baseThresholds = learner.getCurrentThresholds();
      const baseDriftThreshold = baseThresholds.DRIFT_CRITICAL;

      await learner.evaluateProposalOutcome(proposal, 'failure');

      const newThresholds = learner.getCurrentThresholds();
      expect(newThresholds.DRIFT_CRITICAL).toBeGreaterThan(baseDriftThreshold);
    });

    it('decreases drift threshold on successful high-confidence proposals', async () => {
      const proposal = createMockProposal('executed');
      proposal.triggeredBy = [createMockDriftSignal('critical')];
      proposal.confidence = 0.95; // high confidence
      const baseThresholds = learner.getCurrentThresholds();
      const baseDriftThreshold = baseThresholds.DRIFT_CRITICAL;

      await learner.evaluateProposalOutcome(proposal, 'success');

      const newThresholds = learner.getCurrentThresholds();
      expect(newThresholds.DRIFT_CRITICAL).toBeLessThan(baseDriftThreshold);
    });

    it('records threshold adjustment history', async () => {
      const proposal = createMockProposal('executed');
      proposal.triggeredBy = [createMockDriftSignal('critical')];

      await learner.evaluateProposalOutcome(proposal, 'failure');

      const history = learner.getThresholdHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].metric).toBeDefined();
      expect(history[0].oldValue).toBeDefined();
      expect(history[0].newValue).toBeDefined();
      expect(history[0].reason).toContain('failed');
    });

    it('does not adjust thresholds beyond safe bounds', async () => {
      const proposal = createMockProposal('executed');
      proposal.triggeredBy = [createMockDriftSignal('critical')];

      // Multiple failures should not push threshold beyond bounds
      for (let i = 0; i < 10; i++) {
        await learner.evaluateProposalOutcome(proposal, 'failure');
      }

      const newThresholds = learner.getCurrentThresholds();
      expect(newThresholds.DRIFT_CRITICAL).toBeLessThanOrEqual(1.0);
      expect(newThresholds.DRIFT_CRITICAL).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('Metrics Reporting', () => {
    it('calculates success rate correctly', async () => {
      const proposal = createMockProposal('executed');

      await learner.evaluateProposalOutcome(proposal, 'success');
      await learner.evaluateProposalOutcome(proposal, 'success');
      await learner.evaluateProposalOutcome(proposal, 'failure');

      const metrics = learner.getMetrics();
      expect(metrics.proposalsEvaluated).toBe(3);
      expect(metrics.successRate).toBeCloseTo(66.67, 1);
    });

    it('provides metrics for all signal types', async () => {
      const proposal = createMockProposal('executed');
      proposal.triggeredBy = [createMockDriftSignal('critical')];

      await learner.evaluateProposalOutcome(proposal, 'success');

      const metrics = learner.getMetrics();
      expect(metrics.accuracyBySignalType).toBeDefined();
      expect(metrics.accuracyBySignalType['drift']).toBeDefined();
    });

    it('calculates average confidence improvement', async () => {
      const proposal = createMockProposal('executed');
      proposal.confidence = 0.8;

      await learner.evaluateProposalOutcome(proposal, 'success');

      const metrics = learner.getMetrics();
      expect(metrics.avgConfidenceImprovement).toBeDefined();
    });

    it('includes threshold adjustment count in metrics', async () => {
      const proposal = createMockProposal('executed');
      proposal.triggeredBy = [createMockDriftSignal('critical')];

      await learner.evaluateProposalOutcome(proposal, 'failure');

      const metrics = learner.getMetrics();
      expect(metrics.thresholdAdjustments).toBeGreaterThan(0);
    });

    it('provides timestamp in metrics', async () => {
      const metrics = learner.getMetrics();
      expect(metrics.lastUpdatedAt).toBeDefined();
      expect(new Date(metrics.lastUpdatedAt).getTime()).toBeLessThanOrEqual(
        Date.now()
      );
    });
  });

  describe('Signal Decay', () => {
    it('returns count of decayed signals', async () => {
      const proposal = createMockProposal('executed');

      // Record some outcomes
      await learner.evaluateProposalOutcome(proposal, 'success');
      await learner.evaluateProposalOutcome(proposal, 'success');

      // Decay with very small window (should decay existing records)
      const decayedCount = await learner.decayOldSignals(0);

      expect(decayedCount).toBeGreaterThanOrEqual(0);
    });

    it('accepts maxAgeDays parameter', async () => {
      const proposal = createMockProposal('executed');
      await learner.evaluateProposalOutcome(proposal, 'success');

      // Should not throw with valid parameters
      await expect(learner.decayOldSignals(30)).resolves.toBeGreaterThanOrEqual(
        0
      );
      await expect(learner.decayOldSignals(7)).resolves.toBeGreaterThanOrEqual(0);
      await expect(learner.decayOldSignals(365)).resolves.toBeGreaterThanOrEqual(0);
    });
  });

  describe('State Management', () => {
    it('retrieves all recorded outcomes', async () => {
      const proposal = createMockProposal('executed');

      await learner.evaluateProposalOutcome(proposal, 'success');
      await learner.evaluateProposalOutcome(proposal, 'failure');

      const outcomes = learner.getAllOutcomes();
      expect(outcomes).toHaveLength(2);
      expect(outcomes[0].outcome).toBe('success');
      expect(outcomes[1].outcome).toBe('failure');
    });

    it('retrieves threshold history', async () => {
      const proposal = createMockProposal('executed');
      proposal.triggeredBy = [createMockDriftSignal('critical')];

      await learner.evaluateProposalOutcome(proposal, 'failure');

      const history = learner.getThresholdHistory();
      expect(history.length).toBeGreaterThan(0);
    });

    it('resets learner state', async () => {
      const proposal = createMockProposal('executed');

      await learner.evaluateProposalOutcome(proposal, 'success');
      expect(learner.getMetrics().proposalsEvaluated).toBe(1);

      learner.reset();

      expect(learner.getMetrics().proposalsEvaluated).toBe(0);
      expect(learner.getAllOutcomes()).toHaveLength(0);
    });

    it('restores default thresholds on reset', async () => {
      const proposal = createMockProposal('executed');
      proposal.triggeredBy = [createMockDriftSignal('critical')];

      const originalThresholds = learner.getCurrentThresholds();
      await learner.evaluateProposalOutcome(proposal, 'failure');

      learner.reset();

      const restoredThresholds = learner.getCurrentThresholds();
      expect(restoredThresholds.DRIFT_CRITICAL).toBe(originalThresholds.DRIFT_CRITICAL);
    });
  });

  describe('Multiple Signal Types', () => {
    it('tracks accuracy separately for each signal type', async () => {
      const { createMockInstabilitySignal } = require('../bridges/__tests__/fixtures');

      const proposal1 = createMockProposal('executed');
      proposal1.triggeredBy = [createMockDriftSignal('critical')];

      const proposal2 = createMockProposal('executed');
      proposal2.triggeredBy = [createMockInstabilitySignal('critical')];

      await learner.evaluateProposalOutcome(proposal1, 'success');
      await learner.evaluateProposalOutcome(proposal2, 'failure');

      const driftAccuracy = learner.getSignalAccuracy('drift');
      const instabilityAccuracy = learner.getSignalAccuracy('instability');

      expect(driftAccuracy?.totalDetected).toBe(1);
      expect(instabilityAccuracy?.totalDetected).toBe(1);
      expect(driftAccuracy?.truePositives).toBe(1);
      expect(instabilityAccuracy?.falsePositives).toBe(1);
    });
  });
});
