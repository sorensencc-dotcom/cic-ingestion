/**
 * Memory Query Routes (Phase 23.2)
 * Expose MemoryStore as HTTP API
 *
 * Routes:
 * - GET /memory/events — query by type/agent/session/time
 * - GET /memory/summaries — signal summaries (drift/health metrics)
 * - GET /memory/stats — store statistics
 * - POST /memory/append — append event (internal use)
 */
import { Router } from 'express';
import { ObservabilityManager } from '../ObservabilityManager';
export function createMemoryRouter(config) {
    const router = Router();
    const observability = ObservabilityManager.getInstance();
    const { memoryStore, memoryQuery } = config;
    /**
     * GET /memory/events
     * Query events with filters
     *
     * Query params:
     *   eventType?: string — filter by event type
     *   sourceAgent?: string — filter by source agent
     *   sessionId?: string — filter by session ID
     *   correlationId?: string — filter by correlation ID
     *   startDate?: ISO8601 — filter by start timestamp
     *   endDate?: ISO8601 — filter by end timestamp
     *   limit?: number — max results (default: 1000)
     *   offset?: number — pagination offset (default: 0)
     *
     * Response: { events: MemoryEvent[], total: number, limit: number, offset: number }
     */
    router.get('/events', async (req, res) => {
        try {
            const { eventType, sourceAgent, sessionId, correlationId, startDate, endDate, limit = '1000', offset = '0', } = req.query;
            const queryOptions = {
                event_type: eventType,
                source_agent: sourceAgent,
                session_id: sessionId,
                correlation_id: correlationId,
                after_timestamp: startDate,
                before_timestamp: endDate,
                limit: Math.min(parseInt(limit) || 1000, 10000),
                offset: Math.max(parseInt(offset) || 0, 0),
            };
            const events = await memoryStore.query(queryOptions);
            const counts = await memoryStore.getEventCounts();
            observability.getLogger().info('memory', `Query: ${eventType || 'all'} returned ${events.length} events`);
            return res.json({
                events,
                total: counts[eventType] || 0,
                limit: queryOptions.limit,
                offset: queryOptions.offset,
                queried_at: new Date().toISOString(),
            });
        }
        catch (err) {
            console.error('GET /memory/events error:', err);
            return res.status(500).json({
                error: err instanceof Error ? err.message : 'Internal server error',
            });
        }
    });
    /**
     * GET /memory/summaries
     * Return metric summaries (for autonomy signal detection)
     *
     * Query params:
     *   window?: 'hourly' | 'daily' — aggregation window
     *   metric?: 'drift' | 'health' — metric type
     *
     * Response: { drift_metrics?: DriftMetric[], health_metrics?: HealthMetric[], aggregated_at: ISO8601 }
     */
    router.get('/summaries', async (req, res) => {
        try {
            const { window = 'hourly', metric = 'drift' } = req.query;
            // Fetch recent events for summary
            const recentEvents = await memoryStore.getRecent(7);
            if (metric === 'drift' || metric === 'all') {
                // Calculate drift metrics from ARPS_DELTA events
                const deltasEvents = recentEvents.filter((e) => e.event_type === 'ARPS_DELTA');
                const driftMetrics = deltasEvents.map((e) => ({
                    timestamp: e.timestamp,
                    value: e.payload.confidence || 0,
                    type: e.payload.change_type || 'unknown',
                }));
                return res.json({
                    drift_metrics: driftMetrics,
                    window,
                    aggregated_at: new Date().toISOString(),
                });
            }
            if (metric === 'health' || metric === 'all') {
                // Calculate health metrics from AGENT_TELEMETRY events
                const telemetryEvents = recentEvents.filter((e) => e.event_type === 'AGENT_TELEMETRY');
                const healthMetrics = telemetryEvents.map((e) => ({
                    timestamp: e.timestamp,
                    status: e.payload.status || 'unknown',
                    task_success_rate: e.payload.task_success_rate || 0,
                    uptime_seconds: e.payload.uptime_seconds || 0,
                }));
                return res.json({
                    health_metrics: healthMetrics,
                    window,
                    aggregated_at: new Date().toISOString(),
                });
            }
            return res.status(400).json({
                error: 'metric must be one of: drift, health, all',
            });
        }
        catch (err) {
            console.error('GET /memory/summaries error:', err);
            return res.status(500).json({
                error: err instanceof Error ? err.message : 'Internal server error',
            });
        }
    });
    /**
     * GET /memory/stats
     * Return store statistics
     *
     * Response: { total_events: number, event_types: Record<string, number>, store_size_bytes: number, ... }
     */
    router.get('/stats', async (_req, res) => {
        try {
            const stats = await memoryStore.getStats();
            return res.json(stats);
        }
        catch (err) {
            console.error('GET /memory/stats error:', err);
            return res.status(500).json({
                error: err instanceof Error ? err.message : 'Internal server error',
            });
        }
    });
    /**
     * POST /memory/append
     * Append a single event (internal use)
     *
     * Body: { event_type, source_agent, session_id, correlation_id, retention_days, payload }
     * Response: { id: string, timestamp: string, ... }
     */
    router.post('/append', async (req, res) => {
        try {
            const { event_type, source_agent, session_id, correlation_id, retention_days, payload } = req.body;
            // Validate required fields
            if (!event_type || !source_agent || !session_id || !correlation_id || !retention_days || !payload) {
                return res.status(400).json({
                    error: 'Missing required fields: event_type, source_agent, session_id, correlation_id, retention_days, payload',
                });
            }
            const appended = await memoryStore.append({
                event_type,
                source_agent,
                session_id,
                correlation_id,
                retention_days,
                payload,
            });
            observability.getLogger().info('memory', `Appended ${event_type} event: ${appended.id}`);
            return res.status(201).json(appended);
        }
        catch (err) {
            console.error('POST /memory/append error:', err);
            return res.status(400).json({
                error: err instanceof Error ? err.message : 'Validation error',
            });
        }
    });
    /**
     * GET /memory/query/type/:eventType
     * Query by event type using MemoryQuery (if available)
     */
    if (memoryQuery) {
        router.get('/query/type/:eventType', async (req, res) => {
            try {
                const { eventType } = req.params;
                const { limit = '100', offset = '0' } = req.query;
                const result = await memoryQuery.queryByType({
                    eventType: eventType,
                    timeRange: undefined,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                });
                return res.json(result);
            }
            catch (err) {
                console.error('GET /memory/query/type error:', err);
                return res.status(500).json({
                    error: err instanceof Error ? err.message : 'Internal server error',
                });
            }
        });
    }
    return router;
}
//# sourceMappingURL=memory.js.map