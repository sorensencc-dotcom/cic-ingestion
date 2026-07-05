/**
 * Cache Metrics Exporter
 * Exports cache metrics in JSON and Prometheus formats
 */
export interface CacheSummary {
    eligible_docs: number;
    overall_hit_rate_percent: number;
    total_cache_hits: number;
    total_cache_misses: number;
    total_cache_read_tokens_saved: number;
}
export interface JSONMetrics {
    eligible_docs: number;
    hit_rate_percent: number;
    total_hits: number;
    total_misses: number;
    tokens_saved: number;
    estimated_weekly_savings: string;
}
export declare class CacheMetricsExporter {
    static exportJSON(summary: CacheSummary): JSONMetrics;
    static exportPrometheus(summary: CacheSummary): string;
}
//# sourceMappingURL=CacheMetricsExporter.d.ts.map