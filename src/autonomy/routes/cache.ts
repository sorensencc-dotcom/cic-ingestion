/**
 * Cache metrics routes
 * GET /autonomy/cache/metrics — get aggregate statistics (JSON)
 * GET /autonomy/cache/metrics/prometheus — get metrics in Prometheus format
 * GET /autonomy/cache/status — get human-readable status
 */

import { Router, Request, Response } from 'express';
import { AutonomyPromptCacheAdapter } from '../AutonomyPromptCacheAdapter.js';
import { CacheMetricsExporter } from '../../prompt-cache/metrics/CacheMetricsExporter.js';

export function createCacheRouter(adapter: AutonomyPromptCacheAdapter): Router {
  const router = Router();

  // Get aggregate cache statistics
  router.get('/cache/metrics', (_req: Request, res: Response) => {
    const stats = adapter.getCacheStatistics();
    res.json({
      status: 'ok',
      data: stats,
      timestamp: new Date().toISOString(),
    });
  });

  // Get metrics in Prometheus format (Phase 2.3)
  router.get('/cache/metrics/prometheus', (_req: Request, res: Response) => {
    const stats = adapter.getCacheStatistics();
    const prometheusText = CacheMetricsExporter.exportPrometheus(stats);

    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(prometheusText);
  });

  // Get human-readable cache status
  router.get('/cache/status', (_req: Request, res: Response) => {
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

