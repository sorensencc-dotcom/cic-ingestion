/**
 * CIC Prompt Cache Router
 * Manages prompt cache state and metrics
 */
export class CICPromptCacheRouter {
    config;
    summary;
    constructor(config) {
        this.config = config;
        this.summary = {
            eligible_docs: 0,
            overall_hit_rate_percent: 0,
            total_cache_hits: 0,
            total_cache_misses: 0,
            total_cache_read_tokens_saved: 0,
        };
    }
    getSummary() {
        return this.summary;
    }
    clearRegistry() {
        this.summary = {
            eligible_docs: 0,
            overall_hit_rate_percent: 0,
            total_cache_hits: 0,
            total_cache_misses: 0,
            total_cache_read_tokens_saved: 0,
        };
    }
}
//# sourceMappingURL=router.js.map