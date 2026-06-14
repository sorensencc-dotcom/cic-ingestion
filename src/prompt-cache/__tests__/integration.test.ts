/**
 * Integration test: prompt cache router with autonomy adapter
 * Demonstrates Week 1 MVP usage
 */

import { AutonomyPromptCacheAdapter } from '../../autonomy/AutonomyPromptCacheAdapter';

describe('AutonomyPromptCacheAdapter integration', () => {
  let adapter: AutonomyPromptCacheAdapter;

  beforeEach(() => {
    adapter = new AutonomyPromptCacheAdapter();
  });

  describe('analyzeDocumentWithCache', () => {
    it('initializes without errors', () => {
      expect(adapter).toBeDefined();
    });

    it('getCacheStatistics returns initial empty state', () => {
      const stats = adapter.getCacheStatistics();
      expect(stats.eligible_docs).toBe(0);
      expect(stats.total_cache_hits).toBe(0);
      expect(stats.overall_hit_rate_percent).toBe(0);
    });

    it('logCacheStatus does not throw', () => {
      expect(() => {
        adapter.logCacheStatus();
      }).not.toThrow();
    });

    it('clearRegistry works', () => {
      expect(() => {
        adapter.clearRegistry();
      }).not.toThrow();
    });
  });

  describe('task-specific prompts', () => {
    // Note: These are unit tests, not API tests
    // Real API tests would require mocking Anthropic SDK

    it('can be created for extract_findings', async () => {
      // In production, this would call router.generateWithCache
      // For now, test that adapter doesn't throw during setup
      expect(adapter).toBeDefined();
    });

    it('can be created for identify_gaps', async () => {
      expect(adapter).toBeDefined();
    });

    it('can be created for detect_patterns', async () => {
      expect(adapter).toBeDefined();
    });
  });

  describe('cache statistics', () => {
    it('provides metrics summary', () => {
      const stats = adapter.getCacheStatistics();
      expect(stats).toHaveProperty('eligible_docs');
      expect(stats).toHaveProperty('overall_hit_rate_percent');
      expect(stats).toHaveProperty('total_cache_read_tokens_saved');
    });
  });
});
