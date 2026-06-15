/**
 * Autonomy Learner Routes (Phase 23.7.7)
 * GET /autonomy/learner/metrics — learning metrics
 * GET /autonomy/learner/thresholds — current thresholds
 * POST /autonomy/learner/feedback — record proposal outcome
 * POST /autonomy/learner/decay — decay old signals
 */
import { Router } from 'express';
export function createLearnerRouter(learner) {
    const router = Router();
    /**
     * GET /autonomy/learner/metrics
     * Get learning metrics (accuracy, success rate, threshold adjustments)
     *
     * Response: { metrics: LearnerMetrics }
     */
    router.get('/learner/metrics', (_req, res) => {
        try {
            const metrics = learner.getMetrics();
            return res.json({
                metrics,
                queriedAt: new Date().toISOString(),
            });
        }
        catch (err) {
            console.error('GET /autonomy/learner/metrics error:', err);
            return res.status(500).json({
                error: err instanceof Error ? err.message : 'Unknown error',
            });
        }
    });
    /**
     * GET /autonomy/learner/thresholds
     * Get current signal detection thresholds
     *
     * Response: { thresholds: SignalThresholds, history: ThresholdUpdate[] }
     */
    router.get('/learner/thresholds', (_req, res) => {
        try {
            const thresholds = learner.getCurrentThresholds();
            const history = learner.getThresholdHistory();
            return res.json({
                thresholds,
                history,
                adjustmentCount: history.length,
                queriedAt: new Date().toISOString(),
            });
        }
        catch (err) {
            console.error('GET /autonomy/learner/thresholds error:', err);
            return res.status(500).json({
                error: err instanceof Error ? err.message : 'Unknown error',
            });
        }
    });
    /**
     * GET /autonomy/learner/accuracy/:signalType
     * Get accuracy metrics for a specific signal type
     *
     * Path params:
     *   signalType — drift, instability, regression, opportunity
     *
     * Response: { accuracy: SignalAccuracy } or 404 if not found
     */
    router.get('/learner/accuracy/:signalType', (req, res) => {
        try {
            const { signalType } = req.params;
            const accuracy = learner.getSignalAccuracy(signalType);
            if (!accuracy) {
                return res.status(404).json({
                    error: `No accuracy data found for signal type: ${signalType}`,
                });
            }
            return res.json({
                accuracy,
                queriedAt: new Date().toISOString(),
            });
        }
        catch (err) {
            console.error(`GET /autonomy/learner/accuracy/${req.params.signalType} error:`, err);
            return res.status(500).json({
                error: err instanceof Error ? err.message : 'Unknown error',
            });
        }
    });
    /**
     * POST /autonomy/learner/feedback
     * Record proposal outcome and update learner
     *
     * Body:
     *   proposalId (required) — proposal ID
     *   outcome (required) — success, partial, failure
     *   actualDurationChange (optional) — actual hours
     *   reason (optional) — explanation
     *
     * Response: { metrics: LearnerMetrics, feedbackRecordedAt: ISO8601 }
     */
    router.post('/learner/feedback', async (req, res) => {
        try {
            const { proposalId, outcome, actualDurationChange, reason } = req.body;
            // Validate required fields
            if (!proposalId || !outcome) {
                return res.status(400).json({
                    error: 'proposalId and outcome are required',
                });
            }
            if (!['success', 'partial', 'failure'].includes(outcome)) {
                return res.status(400).json({
                    error: 'outcome must be one of: success, partial, failure',
                });
            }
            // Create mock proposal (in real implementation, fetch from database)
            const mockProposal = {
                id: proposalId,
                timestamp: new Date().toISOString(),
                triggeredBy: [],
                actions: [],
                impact: {
                    affectedPhases: [],
                    estimatedDurationChange: 0,
                    riskLevel: 'low',
                    dependencies: [],
                    rationale: '',
                },
                confidence: 0.8,
                status: 'executed',
                metadata: {},
            };
            // Record outcome
            await learner.evaluateProposalOutcome(mockProposal, outcome, actualDurationChange, reason);
            // Return updated metrics
            const metrics = learner.getMetrics();
            return res.status(201).json({
                metrics,
                feedbackRecordedAt: new Date().toISOString(),
            });
        }
        catch (err) {
            console.error('POST /autonomy/learner/feedback error:', err);
            return res.status(500).json({
                error: err instanceof Error ? err.message : 'Unknown error',
            });
        }
    });
    /**
     * POST /autonomy/learner/decay
     * Decay old signals (archive signals older than threshold)
     *
     * Body:
     *   maxAgeDays (optional, default: 30) — maximum age in days
     *
     * Response: { decayedCount: number, completedAt: ISO8601 }
     */
    router.post('/learner/decay', async (req, res) => {
        try {
            const { maxAgeDays } = req.body;
            // Validate parameters
            const age = maxAgeDays || 30;
            if (age < 1 || age > 365) {
                return res.status(400).json({
                    error: 'maxAgeDays must be between 1 and 365',
                });
            }
            // Run decay process
            const decayedCount = await learner.decayOldSignals(age);
            return res.json({
                decayedCount,
                maxAgeDays: age,
                completedAt: new Date().toISOString(),
            });
        }
        catch (err) {
            console.error('POST /autonomy/learner/decay error:', err);
            return res.status(500).json({
                error: err instanceof Error ? err.message : 'Unknown error',
            });
        }
    });
    /**
     * GET /autonomy/learner/outcomes
     * Get all recorded proposal outcomes
     *
     * Query params:
     *   limit (default: 100) — pagination limit
     *   offset (default: 0) — pagination offset
     *
     * Response: { outcomes: ProposalOutcomeRecord[], count: number, total: number }
     */
    router.get('/learner/outcomes', (req, res) => {
        try {
            const limit = Math.min(parseInt(req.query.limit || '100', 10), 1000);
            const offset = parseInt(req.query.offset || '0', 10);
            if (limit < 1 || offset < 0) {
                return res.status(400).json({
                    error: 'limit must be ≥1, offset must be ≥0',
                });
            }
            const allOutcomes = learner.getAllOutcomes();
            const total = allOutcomes.length;
            const outcomes = allOutcomes.slice(offset, offset + limit);
            return res.json({
                outcomes,
                count: outcomes.length,
                total,
                limit,
                offset,
                queriedAt: new Date().toISOString(),
            });
        }
        catch (err) {
            console.error('GET /autonomy/learner/outcomes error:', err);
            return res.status(500).json({
                error: err instanceof Error ? err.message : 'Unknown error',
            });
        }
    });
    /**
     * GET /autonomy/learner/summary
     * Get learner summary (quick overview)
     *
     * Response: { summary: LearnerSummary }
     */
    router.get('/learner/summary', (_req, res) => {
        try {
            const metrics = learner.getMetrics();
            const thresholds = learner.getCurrentThresholds();
            const thresholdHistory = learner.getThresholdHistory();
            const summary = {
                metrics: {
                    proposalsEvaluated: metrics.proposalsEvaluated,
                    successRate: metrics.successRate,
                    avgConfidenceImprovement: metrics.avgConfidenceImprovement,
                },
                thresholds: {
                    current: thresholds,
                    adjustmentCount: thresholdHistory.length,
                    lastAdjustment: thresholdHistory.length > 0
                        ? thresholdHistory[thresholdHistory.length - 1]
                        : null,
                },
                signalAccuracy: metrics.accuracyBySignalType,
            };
            return res.json({
                summary,
                queriedAt: new Date().toISOString(),
            });
        }
        catch (err) {
            console.error('GET /autonomy/learner/summary error:', err);
            return res.status(500).json({
                error: err instanceof Error ? err.message : 'Unknown error',
            });
        }
    });
    return router;
}
//# sourceMappingURL=learner.js.map