/**
 * Cache metrics routes
 * GET /autonomy/cache/metrics — get aggregate statistics (JSON)
 * GET /autonomy/cache/metrics/prometheus — get metrics in Prometheus format
 * GET /autonomy/cache/status — get human-readable status
 */
import { Router } from 'express';
import { AutonomyPromptCacheAdapter } from '../AutonomyPromptCacheAdapter.js';
export declare function createCacheRouter(adapter: AutonomyPromptCacheAdapter): Router;
//# sourceMappingURL=cache.d.ts.map