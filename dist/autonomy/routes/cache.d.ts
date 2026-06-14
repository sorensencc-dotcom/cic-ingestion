/**
 * Cache metrics routes
 * GET /autonomy/cache/metrics — get aggregate statistics
 * GET /autonomy/cache/status — get human-readable status
 */
import { Router } from 'express';
import { AutonomyPromptCacheAdapter } from '../AutonomyPromptCacheAdapter';
export declare function createCacheRouter(adapter: AutonomyPromptCacheAdapter): Router;
//# sourceMappingURL=cache.d.ts.map