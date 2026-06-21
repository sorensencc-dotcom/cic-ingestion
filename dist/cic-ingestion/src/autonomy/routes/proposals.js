/**
 * Autonomy Proposals Routes (Phase 23.7.3)
 * GET /autonomy/proposals — query proposals
 * POST /autonomy/proposals — generate proposals from signals
 * PUT /autonomy/proposals/:id — update proposal status
 */
import { Router } from 'express';
import { scoreProposalPriority } from '../models/RoadmapProposal.js';
import { CavemanCompressor } from '../CavemanCompressor.js';
import { ObservabilityManager } from '../ObservabilityManager.js';
export function createProposalsRouter(service) {
    const router = Router();
    const caveman = new CavemanCompressor();
    const observability = ObservabilityManager.getInstance();
    /**
     * GET /autonomy/proposals
     * Query stored proposals with filters
     *
     * Query params:
     *   status (comma-separated) - filter by status (pending, approved, rejected, executed)
     *   minPriority (0-100) - filter by minimum priority score
     *   limit (default: 100) - pagination limit
     *   offset (default: 0) - pagination offset
     *
     * Response: { proposals: RoadmapProposal[], count: number, total: number, query: ProposalQuery }
     */
    router.get('/proposals', (req, res) => {
        try {
            // Parse and sanitize query parameters
            const statusValues = req.query.status
                ? req.query.status
                    .split(',')
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0 &&
                    ['pending', 'approved', 'rejected', 'executed'].includes(s))
                : [];
            const query = {
                status: statusValues.length > 0
                    ? statusValues
                    : undefined,
                minPriority: req.query.minPriority
                    ? parseFloat(req.query.minPriority.trim())
                    : undefined,
                limit: req.query.limit ? parseInt(req.query.limit.trim(), 10) : 100,
                offset: req.query.offset ? parseInt(req.query.offset.trim(), 10) : 0,
            };
            // Validate pagination
            if (query.limit < 1 || query.limit > 1000) {
                return res.status(400).json({
                    error: 'limit must be between 1 and 1000',
                });
            }
            if (query.offset < 0) {
                return res.status(400).json({
                    error: 'offset must be >= 0',
                });
            }
            // Validate priority
            if (query.minPriority !== undefined &&
                (query.minPriority < 0 || query.minPriority > 100)) {
                return res.status(400).json({
                    error: 'minPriority must be between 0 and 100',
                });
            }
            // Query proposals with total count (single pass)
            const { results: proposals, total } = service.queryProposalsWithTotal(query);
            // Add priority scores
            const proposalsWithPriority = proposals.map((p) => ({
                ...p,
                priority: scoreProposalPriority(p),
            }));
            // Apply Caveman compression
            const { data: compressedProposals, stats } = caveman.compress(proposalsWithPriority, [
                'description',
                'reasoning',
                'impact',
            ]);
            // Record compression stats with observability
            observability.recordCavemanStats(stats);
            observability.setActiveProposals(total);
            return res.json({
                proposals: compressedProposals,
                count: compressedProposals.length,
                total,
                query,
                queriedAt: new Date().toISOString(),
                CAVEMAN_STATS: stats,
            });
        }
        catch (err) {
            console.error('GET /autonomy/proposals error:', err);
            return res.status(500).json({
                error: err instanceof Error ? err.message : 'Unknown error',
            });
        }
    });
    /**
     * GET /autonomy/proposals/:id
     * Get a specific proposal by ID
     *
     * Response: { proposal: RoadmapProposal, priority: number } or 404 if not found
     */
    router.get('/proposals/:id', (req, res) => {
        try {
            const { id } = req.params;
            const proposal = service.getProposal(id);
            if (!proposal) {
                return res.status(404).json({
                    error: `Proposal not found: ${id}`,
                });
            }
            return res.json({
                proposal,
                priority: scoreProposalPriority(proposal),
            });
        }
        catch (err) {
            console.error(`GET /autonomy/proposals/${req.params.id} error:`, err);
            return res.status(500).json({
                error: err instanceof Error ? err.message : 'Unknown error',
            });
        }
    });
    /**
     * POST /autonomy/proposals
     * Generate proposals from stored signals
     *
     * Body (optional):
     *   signalIds - array of signal IDs to use (if omitted, use all signals)
     *
     * Response: { proposals: RoadmapProposal[], count: number, generatedAt: ISO8601 }
     */
    router.post('/proposals', async (req, res) => {
        try {
            const { signalIds } = req.body;
            // If signalIds provided, fetch those signals; otherwise generate from all
            let signals = undefined;
            if (signalIds && Array.isArray(signalIds)) {
                signals = signalIds
                    .map((id) => service.getSignal(id))
                    .filter((s) => s !== undefined);
                if (signals.length === 0) {
                    return res.status(400).json({
                        error: 'No valid signals found for provided IDs',
                    });
                }
            }
            // Generate proposals
            const proposals = await service.generateProposals(signals);
            // Add priority scores
            const proposalsWithPriority = proposals.map((p) => ({
                ...p,
                priority: scoreProposalPriority(p),
            }));
            // Record proposal count with observability
            observability.setActiveProposals(proposals.length);
            return res.status(201).json({
                proposals: proposalsWithPriority,
                count: proposals.length,
                generatedAt: new Date().toISOString(),
            });
        }
        catch (err) {
            console.error('POST /autonomy/proposals error:', err);
            return res.status(500).json({
                error: err instanceof Error ? err.message : 'Unknown error',
            });
        }
    });
    /**
     * PUT /autonomy/proposals/:id
     * Update proposal status (e.g., approve, reject, execute)
     *
     * Body:
     *   status (required) - new status: pending, approved, rejected, executed
     *
     * Response: { proposal: RoadmapProposal, updatedAt: ISO8601 }
     */
    router.put('/proposals/:id', (req, res) => {
        try {
            const { id } = req.params;
            const rawStatus = req.body.status;
            // Validate status
            if (!rawStatus) {
                return res.status(400).json({
                    error: 'status is required',
                });
            }
            // Trim whitespace
            const status = typeof rawStatus === 'string' ? rawStatus.trim() : rawStatus;
            if (!['pending', 'approved', 'rejected', 'executed'].includes(status)) {
                return res.status(400).json({
                    error: 'status must be one of: pending, approved, rejected, executed',
                });
            }
            // Update proposal
            const updated = service.updateProposalStatus(id, status);
            if (!updated) {
                return res.status(404).json({
                    error: `Proposal not found: ${id}`,
                });
            }
            return res.json({
                proposal: {
                    ...updated,
                    priority: scoreProposalPriority(updated),
                },
                updatedAt: new Date().toISOString(),
            });
        }
        catch (err) {
            console.error(`PUT /autonomy/proposals/${req.params.id} error:`, err);
            return res.status(500).json({
                error: err instanceof Error ? err.message : 'Unknown error',
            });
        }
    });
    /**
     * POST /autonomy/proposals/simulate
     * Simulate proposal execution (what-if analysis)
     *
     * Body:
     *   proposalId - proposal to simulate
     *
     * Response: { result: SimulationResult }
     */
    router.post('/proposals/simulate', (req, res) => {
        try {
            const { proposalId } = req.body;
            if (!proposalId) {
                return res.status(400).json({
                    error: 'proposalId is required',
                });
            }
            const proposal = service.getProposal(proposalId);
            if (!proposal) {
                return res.status(404).json({
                    error: `Proposal not found: ${proposalId}`,
                });
            }
            // Simulate execution
            const simulationResult = {
                proposalId,
                simulationType: 'what_if',
                outcomes: {
                    phaseDurations: computePhaseTimings(proposal),
                    riskScore: proposal.impact.riskLevel === 'high' ? 0.8 : proposal.impact.riskLevel === 'medium' ? 0.5 : 0.2,
                    estimatedCompletion: new Date(Date.now() + (proposal.impact.estimatedDurationChange * 3600000)).toISOString(),
                    criticalPath: proposal.impact.affectedPhases,
                },
                confidence: proposal.confidence,
            };
            return res.json({
                result: simulationResult,
                simulatedAt: new Date().toISOString(),
            });
        }
        catch (err) {
            console.error('POST /autonomy/proposals/simulate error:', err);
            return res.status(500).json({
                error: err instanceof Error ? err.message : 'Unknown error',
            });
        }
    });
    return router;
}
/**
 * Helper: Compute estimated phase durations after proposal
 */
function computePhaseTimings(proposal) {
    const timings = {};
    for (const phase of proposal.impact.affectedPhases) {
        // Base estimate (could come from real phase data)
        const baseDuration = 100; // hours
        const adjustment = proposal.impact.estimatedDurationChange;
        timings[phase] = Math.max(baseDuration + adjustment, 0);
    }
    return timings;
}
//# sourceMappingURL=proposals.js.map
