import { describe, it, expect, beforeEach } from '@jest/globals';
import { BatchOperationsManager, estimateCacheSavings, calculateBatchStats } from '../batch';
import { CacheRegistry } from '../registry';
import { SQLiteRegistry } from '../persistence/SQLiteRegistry';
import { join } from 'path';
import { rmSync } from 'fs';

describe('BatchOperationsManager', () => {
  let manager: BatchOperationsManager;
  let registry: CacheRegistry;

  beforeEach(() => {
    registry = new CacheRegistry();
    manager = new BatchOperationsManager(registry, 3);
  });

  it('should register multiple documents in batch', async () => {
    const docs = [
      { docId: 'doc1', hash: 'hash1', tokens: 1024 },
      { docId: 'doc2', hash: 'hash2', tokens: 2048 },
      { docId: 'doc3', hash: 'hash3', tokens: 1536 },
    ];

    await manager.registerDocuments(docs);

    for (const doc of docs) {
      const registered = await registry.isRegistered(doc.hash);
      expect(registered).toBe(true);
    }
  });

  it('should handle empty batch registration', async () => {
    await expect(manager.registerDocuments([])).resolves.not.toThrow();
  });

  it('should log multiple cache accesses in batch', async () => {
    // First register documents
    await manager.registerDocuments([
      { docId: 'doc1', hash: 'hash1', tokens: 1024 },
      { docId: 'doc2', hash: 'hash2', tokens: 2048 },
    ]);

    // Then log accesses
    const accesses = [
      { docId: 'doc1', hash: 'hash1', hit: true, cacheReadTokens: 1024, inputTokens: 0 },
      { docId: 'doc2', hash: 'hash2', hit: false, cacheReadTokens: 0, inputTokens: 2048 },
      { docId: 'doc1', hash: 'hash1', hit: true, cacheReadTokens: 1024, inputTokens: 0 },
    ];

    await manager.logBatchAccesses(accesses);

    const metrics1 = await registry.getMetrics('hash1');
    const metrics2 = await registry.getMetrics('hash2');

    expect(metrics1?.cache_hits).toBe(2);
    expect(metrics2?.cache_misses).toBe(1);
  });

  it('should handle empty batch access logging', async () => {
    await expect(manager.logBatchAccesses([])).resolves.not.toThrow();
  });

  it('should respect parallelism limit during generation', async () => {
    const documents = Array.from({ length: 10 }, (_, i) => ({
      docId: `doc${i}`,
      docText: `Document ${i} content`,
    }));

    const concurrencyTracker = { max: 0, current: 0 };
    let completedCount = 0;

    const slowAnalysis = async (_doc: any) => {
      concurrencyTracker.current++;
      concurrencyTracker.max = Math.max(concurrencyTracker.max, concurrencyTracker.current);

      await new Promise((resolve) => setTimeout(resolve, 100));
      completedCount++;

      concurrencyTracker.current--;
      return {
        analysis: `Analysis of doc`,
        hit: Math.random() > 0.5,
        costSavings: 0.1,
      };
    };

    const manager2 = new BatchOperationsManager(registry, 3);
    const result = await manager2.generateBatchWithCache(
      {
        documents,
        task: { name: 'test', systemPrompt: 'test' },
        parallelism: 3,
      },
      slowAnalysis
    );

    expect(result.results.length).toBe(10);
    expect(completedCount).toBe(10);
    expect(concurrencyTracker.max).toBeLessThanOrEqual(3);
  });

  it('should calculate cost savings correctly', () => {
    const tokens = 1_000_000; // 1M tokens
    const savings = estimateCacheSavings(tokens);

    // Cost without cache: $3.00 for 1M input tokens
    // Cost with cache: $0.30 for 1M cache-read tokens
    // Savings: $2.70
    expect(savings).toBeCloseTo(2.7, 1);
  });

  it('should calculate batch statistics', async () => {
    // Create results with 3 hits, 2 misses
    const results = [
      { docId: 'doc1', analysis: 'a1', cacheMetadata: { cacheHit: true, costSavings: 0.5 } },
      { docId: 'doc2', analysis: 'a2', cacheMetadata: { cacheHit: true, costSavings: 0.6 } },
      { docId: 'doc3', analysis: 'a3', cacheMetadata: { cacheHit: true, costSavings: 0.7 } },
      { docId: 'doc4', analysis: 'a4', cacheMetadata: { cacheHit: false, costSavings: 0 } },
      { docId: 'doc5', analysis: 'a5', cacheMetadata: { cacheHit: false, costSavings: 0 } },
    ];

    const stats = calculateBatchStats(results);

    expect(stats.hitRate).toBeCloseTo(0.6, 1); // 3/5
    expect(stats.totalSavings).toBeCloseTo(1.8, 1); // 0.5 + 0.6 + 0.7
    expect(stats.avgCostPerDoc).toBeCloseTo(0.36, 2); // 1.8 / 5
  });

  it('should track hits and misses across batch', async () => {
    await manager.registerDocuments([
      { docId: 'doc1', hash: 'hash1', tokens: 1024 },
      { docId: 'doc2', hash: 'hash2', tokens: 2048 },
      { docId: 'doc3', hash: 'hash3', tokens: 1536 },
    ]);

    await manager.logBatchAccesses([
      { docId: 'doc1', hash: 'hash1', hit: true },
      { docId: 'doc1', hash: 'hash1', hit: true },
      { docId: 'doc2', hash: 'hash2', hit: false },
      { docId: 'doc3', hash: 'hash3', hit: true },
      { docId: 'doc3', hash: 'hash3', hit: false },
    ]);

    const m1 = await registry.getMetrics('hash1');
    const m2 = await registry.getMetrics('hash2');
    const m3 = await registry.getMetrics('hash3');

    expect(m1?.cache_hits).toBe(2);
    expect(m2?.cache_misses).toBe(1);
    expect(m3?.cache_hits).toBe(1);
    expect(m3?.cache_misses).toBe(1);
  });

  it('should handle 50-document batch', async () => {
    const docs = Array.from({ length: 50 }, (_, i) => ({
      docId: `doc${i}`,
      hash: `hash${i}`,
      tokens: 1024 + i * 10,
    }));

    const startTime = Date.now();
    await manager.registerDocuments(docs);
    const duration = Date.now() - startTime;

    // Bulk insert should be fast (< 500ms for 50 docs)
    expect(duration).toBeLessThan(500);

    // Verify all registered
    const metrics = await registry.summary();
    expect(metrics.eligible_docs).toBe(50);
  });

  it('should handle documents with missing optional fields', async () => {
    const accesses = [
      { docId: 'doc1', hash: 'hash1', hit: true },
      { docId: 'doc2', hash: 'hash2', hit: false },
    ];

    await manager.registerDocuments([
      { docId: 'doc1', hash: 'hash1', tokens: 1024 },
      { docId: 'doc2', hash: 'hash2', tokens: 2048 },
    ]);

    await expect(manager.logBatchAccesses(accesses)).resolves.not.toThrow();
  });

  it('should support different parallelism levels', async () => {
    const manager1 = new BatchOperationsManager(registry, 1);
    const manager3 = new BatchOperationsManager(registry, 3);
    const manager5 = new BatchOperationsManager(registry, 5);

    expect(manager1).toBeDefined();
    expect(manager3).toBeDefined();
    expect(manager5).toBeDefined();
  });
});

describe('BatchOperationsManager with SQLiteRegistry', () => {
  let manager: BatchOperationsManager;
  let registry: SQLiteRegistry;
  const dbPath = join(process.cwd(), '.test-sqlite-batch');

  beforeEach(async () => {
    // Clean up from previous test
    try {
      rmSync(dbPath, { recursive: true, force: true });
    } catch {}

    registry = new SQLiteRegistry(dbPath);
    await registry.migrate();
    manager = new BatchOperationsManager(registry, 3);
  });

  afterEach(async () => {
    await registry.close();
    try {
      rmSync(dbPath, { recursive: true, force: true });
    } catch {}
  });

  it('should bulk insert with SQLiteRegistry in single transaction', async () => {
    const docs = Array.from({ length: 25 }, (_, i) => ({
      docId: `doc${i}`,
      hash: `hash${i}`,
      tokens: 1024 + i * 50,
    }));

    const startTime = Date.now();
    await manager.registerDocuments(docs);
    const duration = Date.now() - startTime;

    // SQLite bulk insert via transaction should be very fast
    expect(duration).toBeLessThan(200);

    // Verify all registered
    const summary = await registry.summary();
    expect(summary.eligible_docs).toBe(25);
  });

  it('should persist batch data across close and reopen', async () => {
    const docs = [
      { docId: 'doc1', hash: 'hash1', tokens: 1024 },
      { docId: 'doc2', hash: 'hash2', tokens: 2048 },
    ];

    await manager.registerDocuments(docs);
    await registry.close();

    // Reopen registry
    const registry2 = new SQLiteRegistry(dbPath);
    await registry2.migrate();

    const summary = await registry2.summary();
    expect(summary.eligible_docs).toBe(2);

    await registry2.close();
  });
});
