/**
 * Memory Router (Phase 5b)
 * Exposes memory store queries through autonomy API
 * Routes all memory-related queries to the memory backend
 */
import { Router } from 'express';
export interface MemoryRouterConfig {
    memoryStoreUrl?: string;
}
export declare function createMemoryRouter(config?: MemoryRouterConfig): Router;
//# sourceMappingURL=memory.d.ts.map