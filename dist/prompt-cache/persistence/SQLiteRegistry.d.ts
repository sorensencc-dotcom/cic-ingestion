export interface CacheMetrics {
    docId: string;
    hash: string;
    totalHits: number;
    totalMisses: number;
    totalTokensSaved: number;
    costWithCache: number;
    costWithoutCache: number;
}
export interface CacheSummary {
    eligible_docs: number;
    overall_hit_rate_percent: number;
    total_hits: number;
    total_misses: number;
    total_tokens_saved: number;
    estimated_weekly_savings: number;
}
/**
 * SQLite-backed cache registry for prompt caching.
 * Maintains same API as in-memory CacheRegistry but with persistence.
 */
export declare class SQLiteRegistry {
    private db;
    constructor(dbPath?: string);
    /**
     * Run schema migrations on first access.
     */
    migrate(): Promise<void>;
    /**
     * Register a document for caching.
     */
    registerDoc(docId: string, hash: string, tokens: number): Promise<void>;
    /**
     * Check if document is registered.
     */
    isRegistered(docId: string): Promise<boolean>;
    /**
     * Log cache access (hit or miss).
     */
    logAccess(docId: string, hash: string, hit: boolean, cacheReadTokens?: number, inputTokens?: number): Promise<void>;
    /**
     * Get metrics for a specific document hash.
     */
    getMetrics(hash: string): Promise<CacheMetrics | null>;
    /**
     * Get aggregate cache summary.
     */
    summary(): Promise<CacheSummary>;
    /**
     * Clear all cache data.
     */
    clear(): Promise<void>;
    /**
     * Close database connection.
     */
    close(): Promise<void>;
    /**
     * Bulk register documents (for batch operations).
     */
    registerDocuments(docs: Array<{
        docId: string;
        hash: string;
        tokens: number;
    }>): Promise<void>;
    /**
     * Bulk log accesses (for batch operations).
     */
    logBatchAccesses(accesses: Array<{
        docId: string;
        hash: string;
        hit: boolean;
        cacheReadTokens?: number;
        inputTokens?: number;
    }>): Promise<void>;
}
//# sourceMappingURL=SQLiteRegistry.d.ts.map