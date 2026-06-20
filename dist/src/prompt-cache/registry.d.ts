/**
 * Cache Registry — SQLite-backed store for prompt cache metadata
 * Tracks documents eligible for caching, hit/miss rates, cost savings
 */
export interface CacheMetrics {
    cache_hits: number;
    cache_misses: number;
    hit_rate_percent: number;
    total_cache_read_tokens: number;
    total_input_tokens: number;
}
export interface CacheSummary {
    eligible_docs: number;
    total_cache_hits: number;
    total_cache_misses: number;
    overall_hit_rate_percent: number;
    total_cache_read_tokens_saved: number;
}
/**
 * In-memory cache registry (production: replace with SQLite)
 * Simpler for Week 1 MVP; can migrate to SQLite in Week 2
 */
export declare class CacheRegistry {
    private dbPath?;
    private docs;
    private metrics;
    private accessLog;
    constructor(dbPath?: string | undefined);
    registerDoc(docId: string, contentHash: string, lengthTokens: number): boolean;
    isRegistered(contentHash: string): boolean;
    logAccess(docId: string, contentHash: string, cacheHit: boolean, cacheReadTokens: number, inputTokens: number): void;
    getMetrics(contentHash: string): CacheMetrics | null;
    summary(): CacheSummary;
    private saveToDisk;
    private loadFromDisk;
    clear(): void;
}
//# sourceMappingURL=registry.d.ts.map