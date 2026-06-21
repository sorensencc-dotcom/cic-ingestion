/**
 * Autonomy Signals Routes (Phase 23.7.3)
 * POST /autonomy/signals — detect signals
 * GET /autonomy/signals — query signals
 */
import { Router } from 'express';
import { CavemanCompressor } from '../CavemanCompressor.js';
import { ObservabilityManager } from '../ObservabilityManager.js';
export function createSignalsRouter(service) {
    const router = Router();
    const caveman = new CavemanCompressor();
    const observability = ObservabilityManager.getInstance();
    /**
     * POST /autonomy/signals
     * Detect signals from event history
     *
     * Query params:
     *   startDate (ISO 8601) - default: 7 days ago
     *   endDate (ISO 8601) - default: now
     *
     * Response: { signals: AutonomySignal[], count: number, detectedAt: ISO8601, CAVEMAN_STATS? }
     */
    router.post('/signals', async (req, res) => {
        try {
            const { startDate, endDate } = req.query;
            // Parse dates
            const start = startDate
                ? new Date(startDate)
                : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const end = endDate ? new Date(endDate) : new Date();
            // Validate dates
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return res.status(400).json({
                    error: 'Invalid date format. Use ISO 8601 (YYYY-MM-DDTHH:mm:ssZ)',
                });
            }
            if (start >= end) {
                return res.status(400).json({
                    error: 'startDate must be before endDate',
                });
            }
            // Detect signals
            const signals = await service.detectSignals(start, end);
            // Apply Caveman compression
            const { data: compressedSignals, stats } = caveman.compress(signals, [
                'description',
                'rationale',
            ]);
            // Record compression stats with observability
            observability.recordCavemanStats(stats);
            observability.setActiveSignals(signals.length);
            return res.json({
                signals: compressedSignals,
                count: compressedSignals.length,
                window: {
                    startDate: start.toISOString(),
                    endDate: end.toISOString(),
                },
                detectedAt: new Date().toISOString(),
                CAVEMAN_STATS: stats,
            });
        }
        catch (err) {
            console.error('POST /autonomy/signals error:', err);
            let sanitized = 'Internal server error';
            if (err instanceof Error && !err.message.includes('/') && !err.message.includes('\\')) {
                sanitized = err.message;
            }
            return res.status(500).json({
                error: sanitized,
            });
        }
    });
    /**
     * GET /autonomy/signals
     * Query stored signals with filters
     *
     * Query params:
     *   type (comma-separated) - filter by signal type (drift, instability, regression, opportunity)
     *   severity (comma-separated) - filter by severity (info, warning, critical)
     *   phase (comma-separated) - filter by affected phase (Phase 24, Phase 25, etc.)
     *   minConfidence (0.0-1.0) - filter by minimum confidence
     *   limit (default: 100) - pagination limit
     *   offset (default: 0) - pagination offset
     *
     * Response: { signals: AutonomySignal[], count: number, total: number, query: SignalQuery }
     */
    router.get('/signals', (req, res) => {
        try {
            // Parse and sanitize query parameters
            const query = {
                type: req.query.type
                    ? req.query.type
                        .split(',')
                        .map((s) => s.trim())
                        .filter((s) => s.length > 0)
                    : undefined,
                severity: req.query.severity
                    ? req.query.severity
                        .split(',')
                        .map((s) => s.trim())
                        .filter((s) => s.length > 0)
                    : undefined,
                phase: req.query.phase
                    ? req.query.phase
                        .split(',')
                        .map((s) => s.trim())
                        .filter((s) => s.length > 0)
                    : undefined,
                minConfidence: req.query.minConfidence
                    ? parseFloat(req.query.minConfidence.trim())
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
            // Validate confidence
            if (query.minConfidence !== undefined &&
                (query.minConfidence < 0 || query.minConfidence > 1)) {
                return res.status(400).json({
                    error: 'minConfidence must be between 0.0 and 1.0',
                });
            }
            // Query signals with total count (single pass)
            const { results: signals, total } = service.querySignalsWithTotal(query);
            // Apply Caveman compression
            const { data: compressedSignals, stats } = caveman.compress(signals, [
                'description',
                'rationale',
            ]);
            // Record compression stats with observability
            observability.recordCavemanStats(stats);
            observability.setActiveSignals(total);
            return res.json({
                signals: compressedSignals,
                count: compressedSignals.length,
                total,
                query,
                queriedAt: new Date().toISOString(),
                CAVEMAN_STATS: stats,
            });
        }
        catch (err) {
            console.error('GET /autonomy/signals error:', err);
            return res.status(500).json({
                error: err instanceof Error ? err.message : 'Unknown error',
            });
        }
    });
    /**
     * GET /autonomy/signals/:id
     * Get a specific signal by ID
     *
     * Response: { signal: AutonomySignal } or 404 if not found
     */
    router.get('/signals/:id', (req, res) => {
        try {
            const { id } = req.params;
            const signal = service.getSignal(id);
            if (!signal) {
                return res.status(404).json({
                    error: `Signal not found: ${id}`,
                });
            }
            return res.json({ signal });
        }
        catch (err) {
            console.error(`GET /autonomy/signals/${req.params.id} error:`, err);
            return res.status(500).json({
                error: err instanceof Error ? err.message : 'Unknown error',
            });
        }
    });
    /**
     * GET /autonomy/signals/trends/:metric
     * Get signal trends over time
     *
     * Query params:
     *   window (hourly, daily, weekly) - default: daily
     *   days (default: 7) - days back to analyze
     *
     * Response: { trends: Array<{ timestamp, value }>, metric, window }
     */
    router.get('/signals/trends/:metric', (req, res) => {
        try {
            const { metric } = req.params;
            const window = req.query.window || 'daily';
            const days = parseInt(req.query.days || '7', 10);
            if (!['hourly', 'daily', 'weekly'].includes(window)) {
                return res.status(400).json({
                    error: 'window must be one of: hourly, daily, weekly',
                });
            }
            if (days < 1 || days > 365) {
                return res.status(400).json({
                    error: 'days must be between 1 and 365',
                });
            }
            // Calculate trends from stored signals
            const allSignals = service.querySignals({});
            const recentSignals = allSignals.filter((s) => new Date(s.timestamp).getTime() >
                Date.now() - days * 24 * 60 * 60 * 1000);
            // Group and aggregate by window
            const trends = calculateTrends(recentSignals, metric, window);
            return res.json({
                trends,
                metric,
                window,
                days,
                queriedAt: new Date().toISOString(),
            });
        }
        catch (err) {
            console.error(`GET /autonomy/signals/trends/${req.params.metric} error:`, err);
            return res.status(500).json({
                error: err instanceof Error ? err.message : 'Unknown error',
            });
        }
    });
    return router;
}
/**
 * Helper: Calculate signal trends over time
 */
function calculateTrends(signals, _metric, window) {
    const grouped = {};
    for (const signal of signals) {
        const date = new Date(signal.timestamp);
        let key = '';
        if (window === 'hourly') {
            key = date.toISOString().slice(0, 13) + ':00:00Z';
        }
        else if (window === 'daily') {
            key = date.toISOString().slice(0, 10);
        }
        else if (window === 'weekly') {
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            key = weekStart.toISOString().slice(0, 10);
        }
        if (!grouped[key]) {
            grouped[key] = [];
        }
        grouped[key].push(signal);
    }
    return Object.entries(grouped)
        .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
        .map(([timestamp, items]) => ({
        timestamp,
        count: items.length,
        avgConfidence: items.reduce((sum, s) => sum + s.confidence, 0) /
            items.length,
    }));
}
//# sourceMappingURL=signals.js.map
