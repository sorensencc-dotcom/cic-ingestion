import { SQLiteRegistry } from '../persistence/SQLiteRegistry';
import * as fs from 'fs';
import * as path from 'path';
import { mkdirSync } from 'fs';

// Test database path (in temp directory)
const testDbDir = path.join(__dirname, '../../.test-sqlite');
const testDbPath = path.join(testDbDir, 'test-cache.db');

describe('SQLiteRegistry', () => {
  let registry: SQLiteRegistry;

  beforeEach(async () => {
    // Clean up previous test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    mkdirSync(testDbDir, { recursive: true });

    registry = new SQLiteRegistry(testDbPath);
    await registry.migrate();
  });

  afterEach(async () => {
    await registry.close();
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  // Test 1: Constructor and migration
  it('should create database and migrate schema', async () => {
    expect(fs.existsSync(testDbPath)).toBe(true);
    // If we got here without error, migration succeeded
  });

  // Test 2: Register document
  it('should register a document', async () => {
    const docId = 'test-doc-1';
    const hash = 'abc123';
    const tokens = 1500;

    await registry.registerDoc(docId, hash, tokens);
    const isRegistered = await registry.isRegistered(docId);

    expect(isRegistered).toBe(true);
  });

  // Test 3: Check unregistered document
  it('should return false for unregistered document', async () => {
    const isRegistered = await registry.isRegistered('nonexistent');
    expect(isRegistered).toBe(false);
  });

  // Test 4: Log cache hit
  it('should log cache hit', async () => {
    const docId = 'test-doc-2';
    const hash = 'hash-abc';
    const tokens = 2000;

    await registry.registerDoc(docId, hash, tokens);
    await registry.logAccess(docId, hash, true, 1500, 500);

    const metrics = await registry.getMetrics(hash);
    expect(metrics).not.toBeNull();
    expect(metrics!.totalHits).toBe(1);
    expect(metrics!.totalMisses).toBe(0);
  });

  // Test 5: Log cache miss
  it('should log cache miss', async () => {
    const docId = 'test-doc-3';
    const hash = 'hash-def';
    const tokens = 2000;

    await registry.registerDoc(docId, hash, tokens);
    await registry.logAccess(docId, hash, false, 0, 2000);

    const metrics = await registry.getMetrics(hash);
    expect(metrics).not.toBeNull();
    expect(metrics!.totalHits).toBe(0);
    expect(metrics!.totalMisses).toBe(1);
  });

  // Test 6: Mixed hits and misses
  it('should track mixed hits and misses', async () => {
    const docId = 'test-doc-4';
    const hash = 'hash-mixed';

    await registry.registerDoc(docId, hash, 2000);
    await registry.logAccess(docId, hash, true, 1500, 500);
    await registry.logAccess(docId, hash, true, 1500, 500);
    await registry.logAccess(docId, hash, false, 0, 2000);

    const metrics = await registry.getMetrics(hash);
    expect(metrics!.totalHits).toBe(2);
    expect(metrics!.totalMisses).toBe(1);
  });

  // Test 7: Summary with eligible documents
  it('should calculate summary correctly', async () => {
    await registry.registerDoc('doc-1', 'hash-1', 1500);
    await registry.registerDoc('doc-2', 'hash-2', 500); // Below min (1024)
    await registry.registerDoc('doc-3', 'hash-3', 2000);

    await registry.logAccess('doc-1', 'hash-1', true, 1500, 0);
    await registry.logAccess('doc-3', 'hash-3', false, 0, 2000);

    const summary = await registry.summary();

    expect(summary.eligible_docs).toBe(2); // Only >= 1024 tokens
    expect(summary.total_hits).toBe(1);
    expect(summary.total_misses).toBe(1);
    expect(summary.overall_hit_rate_percent).toBe(50);
  });

  // Test 8: Hit rate calculation
  it('should calculate hit rate percentage', async () => {
    const hash = 'hash-hitrate';
    await registry.registerDoc('doc', hash, 2000);

    // 4 hits, 1 miss = 80% hit rate
    await registry.logAccess('doc', hash, true, 1500, 0);
    await registry.logAccess('doc', hash, true, 1500, 0);
    await registry.logAccess('doc', hash, true, 1500, 0);
    await registry.logAccess('doc', hash, true, 1500, 0);
    await registry.logAccess('doc', hash, false, 0, 2000);

    const summary = await registry.summary();
    expect(summary.overall_hit_rate_percent).toBeCloseTo(80, 1);
  });

  // Test 9: Clear cache
  it('should clear all cache data', async () => {
    await registry.registerDoc('doc-1', 'hash-1', 2000);
    await registry.registerDoc('doc-2', 'hash-2', 2000);
    await registry.logAccess('doc-1', 'hash-1', true, 1500, 0);

    await registry.clear();

    const summary = await registry.summary();
    expect(summary.eligible_docs).toBe(0);
    expect(summary.total_hits).toBe(0);
    expect(summary.total_misses).toBe(0);
  });

  // Test 10: Bulk register documents
  it('should bulk register multiple documents', async () => {
    const docs = [
      { docId: 'bulk-1', hash: 'hash-bulk-1', tokens: 2000 },
      { docId: 'bulk-2', hash: 'hash-bulk-2', tokens: 1500 },
      { docId: 'bulk-3', hash: 'hash-bulk-3', tokens: 3000 },
    ];

    await registry.registerDocuments(docs);

    const check1 = await registry.isRegistered('bulk-1');
    const check2 = await registry.isRegistered('bulk-2');
    const check3 = await registry.isRegistered('bulk-3');

    expect(check1).toBe(true);
    expect(check2).toBe(true);
    expect(check3).toBe(true);
  });

  // Test 11: Bulk log accesses
  it('should bulk log multiple accesses', async () => {
    const docId = 'doc-batch';
    const hash = 'hash-batch';

    await registry.registerDoc(docId, hash, 2000);

    const accesses = [
      { docId, hash, hit: true, cacheReadTokens: 1500, inputTokens: 0 },
      { docId, hash, hit: true, cacheReadTokens: 1500, inputTokens: 0 },
      { docId, hash, hit: false, cacheReadTokens: 0, inputTokens: 2000 },
      { docId, hash, hit: true, cacheReadTokens: 1500, inputTokens: 0 },
    ];

    await registry.logBatchAccesses(accesses);

    const metrics = await registry.getMetrics(hash);
    expect(metrics!.totalHits).toBe(3);
    expect(metrics!.totalMisses).toBe(1);
  });

  // Test 12: Persistence across restarts
  it('should persist data across close and reopen', async () => {
    const docId = 'persist-test';
    const hash = 'hash-persist';

    await registry.registerDoc(docId, hash, 2000);
    await registry.logAccess(docId, hash, true, 1500, 0);
    await registry.close();

    // Reopen same database
    const registry2 = new SQLiteRegistry(testDbPath);
    const isRegistered = await registry2.isRegistered(docId);
    const metrics = await registry2.getMetrics(hash);

    expect(isRegistered).toBe(true);
    expect(metrics!.totalHits).toBe(1);

    await registry2.close();
  });

  // Test 13: Null metrics for unknown hash
  it('should return null for unknown hash metrics', async () => {
    const metrics = await registry.getMetrics('nonexistent-hash');
    expect(metrics).toBeNull();
  });

  // Test 14: Summary with no data
  it('should handle empty summary gracefully', async () => {
    const summary = await registry.summary();

    expect(summary.eligible_docs).toBe(0);
    expect(summary.total_hits).toBe(0);
    expect(summary.total_misses).toBe(0);
    expect(summary.overall_hit_rate_percent).toBe(0);
    expect(summary.estimated_weekly_savings).toBe(0);
  });

  // Test 15: Unique hash constraint
  it('should enforce hash uniqueness', async () => {
    const hash = 'duplicate-hash';

    await registry.registerDoc('doc-1', hash, 2000);

    // Registering same hash should replace, not error
    await registry.registerDoc('doc-2', hash, 2500);

    const isRegistered = await registry.isRegistered('doc-2');
    expect(isRegistered).toBe(true);
  });
});
