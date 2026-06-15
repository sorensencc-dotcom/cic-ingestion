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
import { MemoryStore } from '../../../../rewrite-mcp/src/memory/MemoryStore';
import { MemoryQuery } from '../../../../rewrite-mcp/projects/cic/memory/query/memory-query';
export interface MemoryRoutesConfig {
    memoryStore: MemoryStore;
    memoryQuery?: MemoryQuery;
}
export declare function createMemoryRouter(config: MemoryRoutesConfig): Router;
//# sourceMappingURL=memory.d.ts.map