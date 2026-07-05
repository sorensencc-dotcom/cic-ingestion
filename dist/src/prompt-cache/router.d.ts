/**
 * CIC Prompt Cache Router
 * Manages prompt cache state and metrics
 */
export interface CacheSummary {
    eligible_docs: number;
    overall_hit_rate_percent: number;
    total_cache_hits: number;
    total_cache_misses: number;
    total_cache_read_tokens_saved: number;
}
export interface CacheConfig {
    [key: string]: any;
}
export declare class CICPromptCacheRouter {
    private config;
    private summary;
    constructor(config: CacheConfig);
    getSummary(): CacheSummary;
    clearRegistry(): void;
}
//# sourceMappingURL=router.d.ts.map