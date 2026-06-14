/**
 * Cache metrics routes
 * GET /autonomy/cache/metrics — get aggregate statistics
 * GET /autonomy/cache/status — get human-readable status
 */
import { Router } from 'express';
export function createCacheRouter(adapter) {
    const router = Router();
    // Get aggregate cache statistics
    router.get('/cache/metrics', (req, res) => {
        const stats = adapter.getCacheStatistics();
        res.json({
            status: 'ok',
            data: stats,
            timestamp: new Date().toISOString(),
        });
    });
    // Get human-readable cache status
    router.get('/cache/status', (req, res) => {
        const stats = adapter.getCacheStatistics();
        const status = {
            eligible_documents: stats.eligible_docs,
            cache_hit_rate: `${stats.overall_hit_rate_percent.toFixed(1)}%`,
            total_cache_hits: stats.total_cache_hits,
            total_cache_misses: stats.total_cache_misses,
            tokens_saved: stats.total_cache_read_tokens_saved,
            estimated_weekly_savings: `$${(stats.total_cache_read_tokens_saved * 0.0000003).toFixed(2)}`,
        };
        res.json({
            status: 'ok',
            data: status,
            timestamp: new Date().toISOString(),
        });
    });
    return router;
}
//# sourceMappingURL=cache.js.map