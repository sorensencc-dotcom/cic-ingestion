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

export class CacheMetricsExporter {
  /**
   * Export cache metrics in Prometheus text format
   */
  static exportPrometheus(summary: CacheSummary): string {
    const metrics: PrometheusMetric[] = [
      {
        name: 'prompt_cache_documents_total',
        type: 'gauge',
        help: 'Total number of documents in cache',
        value: summary.eligible_docs,
      },
      {
        name: 'prompt_cache_hits_total',
        type: 'counter',
        help: 'Total number of cache hits',
        value: summary.total_cache_hits,
      },
      {
        name: 'prompt_cache_misses_total',
        type: 'counter',
        help: 'Total number of cache misses',
        value: summary.total_cache_misses,
      },
      {
        name: 'prompt_cache_hit_ratio',
        type: 'gauge',
        help: 'Cache hit rate as percentage (0-100)',
        value: summary.overall_hit_rate_percent,
      },
      {
        name: 'prompt_cache_tokens_saved_total',
        type: 'counter',
        help: 'Total tokens saved via prompt caching',
        value: summary.total_cache_read_tokens_saved,
      },
    ];

    return this.formatPrometheusText(metrics);
  }

  /**
   * Format metrics as Prometheus text (0.0.4 format)
   * Each metric has HELP and TYPE header, followed by metric lines
   */
  private static formatPrometheusText(metrics: PrometheusMetric[]): string {
    const lines: string[] = [];

    // Group by name to output HELP and TYPE once per metric
    const metricMap = new Map<string, PrometheusMetric>();
    metrics.forEach((m) => {
      if (!metricMap.has(m.name)) {
        metricMap.set(m.name, m);
      }
    });

    metricMap.forEach((metric) => {
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);

      // Format metric line with optional labels
      const labelStr = metric.labels ? this.formatLabels(metric.labels) : '';
      lines.push(`${metric.name}${labelStr} ${metric.value}`);
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Format labels as {label1="value1",label2="value2"}
   */
  private static formatLabels(labels: Record<string, string>): string {
    const pairs = Object.entries(labels)
      .map(([k, v]) => `${k}="${this.escapeLabel(v)}"`)
      .join(',');
    return `{${pairs}}`;
  }

  /**
   * Escape label values (quote and backslash-escape)
   */
  private static escapeLabel(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }

  /**
   * Export cache metrics as structured JSON
   */
  static exportJSON(summary: CacheSummary): Record<string, unknown> {
    return {
      documents_eligible: summary.eligible_docs,
      cache_hits: summary.total_cache_hits,
      cache_misses: summary.total_cache_misses,
      hit_rate_percent: summary.overall_hit_rate_percent,
      tokens_saved: summary.total_cache_read_tokens_saved,
      cost_savings_usd: this.calculateCostSavings(summary.total_cache_read_tokens_saved),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Calculate estimated cost savings at Claude pricing
   * Cache read: $0.30 per 1M tokens
   */
  private static calculateCostSavings(tokensSaved: number): number {
    const CACHE_READ_COST_PER_MILLION = 0.3;
    return (tokensSaved / 1_000_000) * CACHE_READ_COST_PER_MILLION;
  }
}
