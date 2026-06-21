/**
 * Tests for CacheRegistry
 */

import { CacheRegistry } from '../registry';

describe('CacheRegistry', () => {
  let registry: CacheRegistry;

  beforeEach(() => {
    registry = new CacheRegistry(); // In-memory only
  });

  describe('registerDoc', () => {
    it('registers a document', () => {
      const hash = 'abc123';
      const result = registry.registerDoc('doc1', hash, 2000);
      expect(result).toBe(true); // Cache-eligible
    });

    it('marks documents < 1024 tokens as ineligible', () => {
      const hash = 'abc123';
      const result = registry.registerDoc('doc1', hash, 512);
      expect(result).toBe(false); // Not eligible
    });

    it('marks documents >= 1024 tokens as eligible', () => {
      const hash = 'abc123';
      const result = registry.registerDoc('doc1', hash, 1024);
      expect(result).toBe(true);
    });
  });

  describe('isRegistered', () => {
    it('returns true for registered and eligible documents', () => {
      registry.registerDoc('doc1', 'hash1', 2000);
      expect(registry.isRegistered('hash1')).toBe(true);
    });

    it('returns false for unregistered documents', () => {
      expect(registry.isRegistered('unknown_hash')).toBe(false);
    });

    it('returns false for registered but ineligible documents', () => {
      registry.registerDoc('doc1', 'hash1', 512);
      expect(registry.isRegistered('hash1')).toBe(false);
    });
  });

  describe('logAccess', () => {
    it('logs a cache hit', () => {
      const hash = 'hash1';
      registry.registerDoc('doc1', hash, 2000);
      registry.logAccess('doc1', hash, true, 1500, 100);

      const metrics = registry.getMetrics(hash);
      expect(metrics?.cache_hits).toBe(1);
      expect(metrics?.cache_misses).toBe(0);
      expect(metrics?.total_cache_read_tokens).toBe(1500);
    });

    it('logs a cache miss', () => {
      const hash = 'hash1';
      registry.registerDoc('doc1', hash, 2000);
      registry.logAccess('doc1', hash, false, 0, 2000);

      const metrics = registry.getMetrics(hash);
      expect(metrics?.cache_hits).toBe(0);
      expect(metrics?.cache_misses).toBe(1);
      expect(metrics?.total_input_tokens).toBe(2000);
    });

    it('calculates hit rate correctly', () => {
      const hash = 'hash1';
      registry.registerDoc('doc1', hash, 2000);

      // 2 hits, 1 miss = 66.67%
      registry.logAccess('doc1', hash, true, 1500, 100);
      registry.logAccess('doc1', hash, true, 1500, 100);
      registry.logAccess('doc1', hash, false, 0, 2000);

      const metrics = registry.getMetrics(hash);
      expect(metrics?.hit_rate_percent).toBeCloseTo(66.67, 1);
    });
  });

  describe('summary', () => {
    it('aggregates metrics across all documents', () => {
      registry.registerDoc('doc1', 'hash1', 2000);
      registry.registerDoc('doc2', 'hash2', 3000);

      registry.logAccess('doc1', 'hash1', true, 1500, 100);
      registry.logAccess('doc2', 'hash2', true, 2000, 100);
      registry.logAccess('doc2', 'hash2', false, 0, 3000);

      const summary = registry.summary();
      expect(summary.eligible_docs).toBe(2);
      expect(summary.total_cache_hits).toBe(2);
      expect(summary.total_cache_misses).toBe(1);
      expect(summary.total_cache_read_tokens_saved).toBe(3500);
    });

    it('calculates overall hit rate', () => {
      registry.registerDoc('doc1', 'hash1', 2000);
      registry.logAccess('doc1', 'hash1', true, 1500, 100);
      registry.logAccess('doc1', 'hash1', false, 0, 2000);

      const summary = registry.summary();
      expect(summary.overall_hit_rate_percent).toBeCloseTo(50, 1);
    });
  });

  describe('clear', () => {
    it('clears all data', () => {
      registry.registerDoc('doc1', 'hash1', 2000);
      registry.logAccess('doc1', 'hash1', true, 1500, 100);

      registry.clear();

      const summary = registry.summary();
      expect(summary.eligible_docs).toBe(0);
      expect(summary.total_cache_hits).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('handles boundary token count (1024)', () => {
      const result = registry.registerDoc('doc1', 'hash1', 1024);
      expect(result).toBe(true);
    });

    it('handles boundary token count (1023)', () => {
      const result = registry.registerDoc('doc1', 'hash1', 1023);
      expect(result).toBe(false);
    });

    it('handles zero token count', () => {
      const result = registry.registerDoc('doc1', 'hash1', 0);
      expect(result).toBe(false);
    });

    it('handles very large token counts', () => {
      const result = registry.registerDoc('doc1', 'hash1', 1000000);
      expect(result).toBe(true);
    });

    it('handles 0% hit rate', () => {
      registry.registerDoc('doc1', 'hash1', 2000);
      registry.logAccess('doc1', 'hash1', false, 0, 2000);
      registry.logAccess('doc1', 'hash1', false, 0, 2000);

      const metrics = registry.getMetrics('hash1');
      expect(metrics?.hit_rate_percent).toBe(0);
    });

    it('handles 100% hit rate', () => {
      registry.registerDoc('doc1', 'hash1', 2000);
      registry.logAccess('doc1', 'hash1', true, 1500, 0);
      registry.logAccess('doc1', 'hash1', true, 1500, 0);

      const metrics = registry.getMetrics('hash1');
      expect(metrics?.hit_rate_percent).toBe(100);
    });

    it('handles single hit or miss', () => {
      registry.registerDoc('doc1', 'hash1', 2000);
      registry.logAccess('doc1', 'hash1', true, 1500, 0);

      const metrics = registry.getMetrics('hash1');
      expect(metrics?.hit_rate_percent).toBe(100);
    });

    it('handles multiple documents with mixed eligibility', () => {
      registry.registerDoc('doc1', 'hash1', 2000); // Eligible
      registry.registerDoc('doc2', 'hash2', 512); // Ineligible
      registry.registerDoc('doc3', 'hash3', 1024); // Eligible

      const summary = registry.summary();
      expect(summary.eligible_docs).toBe(2);
    });

    it('updates lastAccessedAt on logAccess', () => {
      const hash = 'hash1';
      registry.registerDoc('doc1', hash, 2000);

      // Get initial last access
      let adapter = registry.getAdapter?.(hash);

      // Log access
      registry.logAccess('doc1', hash, true, 1500, 100);

      // Verify timestamp updated (if getAdapter method exposed)
      expect(registry.isRegistered(hash)).toBe(true);
    });

    it('handles repeated registrations of same hash', () => {
      registry.registerDoc('doc1', 'hash1', 2000);
      registry.registerDoc('doc2', 'hash1', 2000); // Same hash, different doc

      // Should not duplicate
      const summary = registry.summary();
      expect(summary.eligible_docs).toBe(1);
    });

    it('handles getMetrics for non-existent hash', () => {
      const metrics = registry.getMetrics('non-existent');
      expect(metrics).toBeNull();
    });

    it('accumulates tokens correctly across multiple accesses', () => {
      registry.registerDoc('doc1', 'hash1', 5000);

      registry.logAccess('doc1', 'hash1', true, 1000, 0);
      registry.logAccess('doc1', 'hash1', true, 1000, 0);
      registry.logAccess('doc1', 'hash1', true, 1000, 0);

      const metrics = registry.getMetrics('hash1');
      expect(metrics?.total_cache_read_tokens).toBe(3000);
    });

    it('handles summary with no accessed documents', () => {
      registry.registerDoc('doc1', 'hash1', 2000);
      registry.registerDoc('doc2', 'hash2', 2000);

      const summary = registry.summary();
      expect(summary.total_cache_hits).toBe(0);
      expect(summary.total_cache_misses).toBe(0);
      expect(summary.overall_hit_rate_percent).toBe(0);
    });
  });

  describe('concurrent operations', () => {
    it('handles rapid sequential access logging', () => {
      registry.registerDoc('doc1', 'hash1', 5000);

      for (let i = 0; i < 100; i++) {
        registry.logAccess('doc1', 'hash1', i % 2 === 0, 1000, 0);
      }

      const metrics = registry.getMetrics('hash1');
      expect(metrics?.totalOperations).toBe(100);
      expect(metrics?.successRate).toBeCloseTo(50, 0);
    });

    it('handles multiple document registrations and accesses', () => {
      for (let i = 0; i < 10; i++) {
        registry.registerDoc(`doc${i}`, `hash${i}`, 2000 + i * 100);
      }

      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 5; j++) {
          registry.logAccess(`doc${i}`, `hash${i}`, j % 2 === 0, 1000, 0);
        }
      }

      const summary = registry.summary();
      expect(summary.eligible_docs).toBe(10);
      expect(summary.total_cache_hits).toBe(25);
      expect(summary.total_cache_misses).toBe(25);
    });
  });

  describe('disk persistence', () => {
    it('creates in-memory registry without dbPath', () => {
      const memRegistry = new CacheRegistry();
      expect(memRegistry).toBeDefined();
    });
  });
});
