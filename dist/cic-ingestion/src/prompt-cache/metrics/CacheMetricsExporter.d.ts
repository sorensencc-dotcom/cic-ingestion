/**
 * Prometheus metrics exporter for prompt cache statistics
 * Converts CacheSummary to Prometheus text format
 * Metrics: hits, misses, hit_rate, tokens_saved, documents
 */
import { CacheSummary } from '../registry';
export interface PrometheusMetric {
    name: string;
    type: 'gauge' | 'counter' | 'histogram';
    help: string;
    value: number;
    labels?: Record<string, string>;
}
export declare class CacheMetricsExporter {
    /**
     * Export cache metrics in Prometheus text format
     */
    static exportPrometheus(summary: CacheSummary): string;
    /**
     * Format metrics as Prometheus text (0.0.4 format)
     * Each metric has HELP and TYPE header, followed by metric lines
     */
    private static formatPrometheusText;
    /**
     * Format labels as {label1="value1",label2="value2"}
     */
    private static formatLabels;
    /**
     * Escape label values (quote and backslash-escape)
     */
    private static escapeLabel;
    /**
     * Export cache metrics as structured JSON
     */
    static exportJSON(summary: CacheSummary): Record<string, unknown>;
    /**
     * Calculate estimated cost savings at Claude pricing
     * Cache read: $0.30 per 1M tokens
     */
    private static calculateCostSavings;
}
//# sourceMappingURL=CacheMetricsExporter.d.ts.map