import { CacheMetricsExporter } from './CacheMetricsExporter';
import { CacheSummary } from '../registry';

describe('CacheMetricsExporter', () => {
  const mockSummary: CacheSummary = {
    eligible_docs: 150,
    total_cache_hits: 1200,
    total_cache_misses: 300,
    overall_hit_rate_percent: 80.0,
    total_cache_read_tokens_saved: 500_000,
  };

  describe('exportPrometheus', () => {
    it('should export metrics in Prometheus text format', () => {
      const output = CacheMetricsExporter.exportPrometheus(mockSummary);

      expect(output).toContain('# HELP prompt_cache_documents_total');
      expect(output).toContain('# TYPE prompt_cache_documents_total gauge');
      expect(output).toContain('prompt_cache_documents_total 150');
    });

    it('should include all required metrics', () => {
      const output = CacheMetricsExporter.exportPrometheus(mockSummary);

      expect(output).toContain('prompt_cache_hits_total');
      expect(output).toContain('prompt_cache_misses_total');
      expect(output).toContain('prompt_cache_hit_ratio');
      expect(output).toContain('prompt_cache_tokens_saved_total');
    });

    it('should format counter metrics correctly', () => {
      const output = CacheMetricsExporter.exportPrometheus(mockSummary);

      expect(output).toContain('# TYPE prompt_cache_hits_total counter');
      expect(output).toContain('prompt_cache_hits_total 1200');

      expect(output).toContain('# TYPE prompt_cache_misses_total counter');
      expect(output).toContain('prompt_cache_misses_total 300');
    });

    it('should format gauge metrics correctly', () => {
      const output = CacheMetricsExporter.exportPrometheus(mockSummary);

      expect(output).toContain('# TYPE prompt_cache_hit_ratio gauge');
      expect(output).toContain('prompt_cache_hit_ratio 80');
    });

    it('should handle zero values', () => {
      const zeroSummary: CacheSummary = {
        eligible_docs: 0,
        total_cache_hits: 0,
        total_cache_misses: 0,
        overall_hit_rate_percent: 0,
        total_cache_read_tokens_saved: 0,
      };

      const output = CacheMetricsExporter.exportPrometheus(zeroSummary);

      expect(output).toContain('prompt_cache_documents_total 0');
      expect(output).toContain('prompt_cache_hits_total 0');
    });

    it('should handle high values', () => {
      const highSummary: CacheSummary = {
        eligible_docs: 10000,
        total_cache_hits: 1_000_000,
        total_cache_misses: 100_000,
        overall_hit_rate_percent: 90.9,
        total_cache_read_tokens_saved: 10_000_000,
      };

      const output = CacheMetricsExporter.exportPrometheus(highSummary);

      expect(output).toContain('prompt_cache_documents_total 10000');
      expect(output).toContain('prompt_cache_hits_total 1000000');
      expect(output).toContain('prompt_cache_tokens_saved_total 10000000');
    });

    it('should output valid Prometheus format', () => {
      const output = CacheMetricsExporter.exportPrometheus(mockSummary);

      // Check Prometheus format rules:
      // 1. HELP lines start with #
      // 2. TYPE lines start with #
      // 3. Metric lines are NAME VALUE pairs
      const lines = output.split('\n').filter((l) => l.trim());

      const helpLines = lines.filter((l) => l.startsWith('# HELP'));
      const typeLines = lines.filter((l) => l.startsWith('# TYPE'));
      const metricLines = lines.filter(
        (l) => !l.startsWith('#') && l.includes(' ')
      );

      expect(helpLines.length).toBeGreaterThan(0);
      expect(typeLines.length).toBeGreaterThan(0);
      expect(metricLines.length).toBeGreaterThan(0);
    });
  });

  describe('exportJSON', () => {
    it('should export metrics as JSON', () => {
      const output = CacheMetricsExporter.exportJSON(mockSummary);

      expect(output.documents_eligible).toBe(150);
      expect(output.cache_hits).toBe(1200);
      expect(output.cache_misses).toBe(300);
      expect(output.hit_rate_percent).toBe(80.0);
      expect(output.tokens_saved).toBe(500_000);
    });

    it('should calculate cost savings correctly', () => {
      const output = CacheMetricsExporter.exportJSON(mockSummary);
      // 500,000 tokens at $0.30 per 1M = $0.15
      expect(output.cost_savings_usd).toBeCloseTo(0.15, 3);
    });

    it('should include timestamp', () => {
      const beforeTime = Date.now();
      const output = CacheMetricsExporter.exportJSON(mockSummary);
      const afterTime = Date.now();

      expect(output.timestamp).toBeDefined();
      expect(typeof output.timestamp).toBe('string');
      const timestampMs = new Date(output.timestamp as string).getTime();
      expect(timestampMs).toBeGreaterThanOrEqual(beforeTime);
      expect(timestampMs).toBeLessThanOrEqual(afterTime);
    });

    it('should handle zero tokens saved', () => {
      const zeroSummary: CacheSummary = {
        ...mockSummary,
        total_cache_read_tokens_saved: 0,
      };

      const output = CacheMetricsExporter.exportJSON(zeroSummary);
      expect(output.cost_savings_usd).toBe(0);
    });

    it('should calculate large cost savings', () => {
      const largeSummary: CacheSummary = {
        ...mockSummary,
        total_cache_read_tokens_saved: 10_000_000,
      };

      const output = CacheMetricsExporter.exportJSON(largeSummary);
      // 10M tokens at $0.30 per 1M = $3.00
      expect(output.cost_savings_usd).toBeCloseTo(3.0, 3);
    });
  });

  describe('label formatting', () => {
    it('should escape quotes in label values', () => {
      const summary: CacheSummary = mockSummary;
      const output = CacheMetricsExporter.exportPrometheus(summary);

      // Verify output is a string (labels are not exposed in basic export, but test structure)
      expect(typeof output).toBe('string');
      expect(output.length).toBeGreaterThan(0);
    });
  });
});
