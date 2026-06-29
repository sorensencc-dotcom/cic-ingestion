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

export class CacheMetricsExporter {
  static exportJSON(summary: CacheSummary): JSONMetrics {
    const weeklySavings = (summary.total_cache_read_tokens_saved / 1_000_000) * 0.3;

    return {
      eligible_docs: summary.eligible_docs,
      hit_rate_percent: summary.overall_hit_rate_percent,
      total_hits: summary.total_cache_hits,
      total_misses: summary.total_cache_misses,
      tokens_saved: summary.total_cache_read_tokens_saved,
      estimated_weekly_savings: `$${weeklySavings.toFixed(2)}`,
    };
  }

  static exportPrometheus(summary: CacheSummary): string {
    const weeklySavings = (summary.total_cache_read_tokens_saved / 1_000_000) * 0.3;

    return `
# HELP cic_cache_eligible_docs Number of eligible documents
# TYPE cic_cache_eligible_docs gauge
cic_cache_eligible_docs ${summary.eligible_docs}

# HELP cic_cache_hit_rate Cache hit rate as percentage
# TYPE cic_cache_hit_rate gauge
cic_cache_hit_rate ${summary.overall_hit_rate_percent.toFixed(2)}

# HELP cic_cache_hits Total cache hits
# TYPE cic_cache_hits counter
cic_cache_hits ${summary.total_cache_hits}

# HELP cic_cache_misses Total cache misses
# TYPE cic_cache_misses counter
cic_cache_misses ${summary.total_cache_misses}

# HELP cic_cache_tokens_saved Total tokens saved through caching
# TYPE cic_cache_tokens_saved counter
cic_cache_tokens_saved ${summary.total_cache_read_tokens_saved}

# HELP cic_cache_weekly_savings Estimated weekly savings in USD
# TYPE cic_cache_weekly_savings gauge
cic_cache_weekly_savings ${weeklySavings.toFixed(2)}
`.trim();
  }
}
