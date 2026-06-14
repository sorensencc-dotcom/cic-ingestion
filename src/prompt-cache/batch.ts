/**
 * Batch document operations for prompt caching.
 * Handles bulk registration and analysis with controlled parallelism.
 */

import { CacheRegistry } from './registry';
import { SQLiteRegistry } from './persistence/SQLiteRegistry';

export interface BatchDocument {
  docId: string;
  docText: string;
}

export interface AnalysisTask {
  name: string;
  systemPrompt: string;
  responseFormat?: string;
}

export interface BatchAnalysisRequest {
  documents: BatchDocument[];
  task: AnalysisTask;
  parallelism?: number; // Default: 3
}

export interface BatchAnalysisResult {
  results: Array<{
    docId: string;
    analysis: string;
    cacheMetadata: {
      cacheHit: boolean;
      costSavings: number;
    };
  }>;
  summary: {
    totalDocs: number;
    cacheHits: number;
    totalSavings: number;
  };
}

/**
 * Rate limiter for API calls.
 * Ensures we respect Anthropic rate limits (no burst > 3 req/sec).
 */
class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private inFlight = 0;
  private maxConcurrent: number;
  private minIntervalMs = 333; // ~3 req/sec = 333ms between requests

  constructor(maxConcurrent: number = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
      this.process();
    });
  }

  private async process(): Promise<void> {
    while (this.queue.length > 0 && this.inFlight < this.maxConcurrent) {
      const fn = this.queue.shift();
      if (fn) {
        this.inFlight++;
        try {
          await new Promise((resolve) => setTimeout(resolve, this.minIntervalMs));
          await fn();
        } finally {
          this.inFlight--;
          this.process();
        }
      }
    }
  }
}

/**
 * Batch operations manager.
 * Handles bulk document registration and analysis with rate limiting.
 */
export class BatchOperationsManager {
  private registry: CacheRegistry | SQLiteRegistry;
  private rateLimiter: RateLimiter;

  constructor(registry: CacheRegistry | SQLiteRegistry, maxParallelism: number = 3) {
    this.registry = registry;
    this.rateLimiter = new RateLimiter(maxParallelism);
  }

  /**
   * Register multiple documents in a single transaction.
   */
  async registerDocuments(
    docs: Array<{ docId: string; hash: string; tokens: number }>
  ): Promise<void> {
    if (docs.length === 0) {
      return;
    }

    if (this.registry instanceof SQLiteRegistry) {
      await (this.registry as SQLiteRegistry).registerDocuments(docs);
    } else {
      // Memory registry: sequential registration
      for (const doc of docs) {
        await this.registry.registerDoc(doc.docId, doc.hash, doc.tokens);
      }
    }
  }

  /**
   * Log multiple cache accesses in a single transaction.
   */
  async logBatchAccesses(
    accesses: Array<{
      docId: string;
      hash: string;
      hit: boolean;
      cacheReadTokens?: number;
      inputTokens?: number;
    }>
  ): Promise<void> {
    if (accesses.length === 0) {
      return;
    }

    if (this.registry instanceof SQLiteRegistry) {
      await (this.registry as SQLiteRegistry).logBatchAccesses(accesses);
    } else {
      // Memory registry: sequential logging
      for (const access of accesses) {
        await this.registry.logAccess(
          access.docId,
          access.hash,
          access.hit,
          access.cacheReadTokens || 0,
          access.inputTokens || 0
        );
      }
    }
  }

  /**
   * Generate analysis for a batch of documents with rate limiting.
   * This is a stub for Phase 2.2 integration with AutonomyService.
   */
  async generateBatchWithCache(
    req: BatchAnalysisRequest,
    analysisCallback: (doc: BatchDocument, task: AnalysisTask) => Promise<{
      analysis: string;
      hit: boolean;
      costSavings: number;
    }>
  ): Promise<BatchAnalysisResult> {
    const results: BatchAnalysisResult['results'] = [];
    let totalSavings = 0;
    let cacheHits = 0;

    // Process documents with rate limiting
    for (const doc of req.documents) {
      const result = await this.rateLimiter.run(async () => {
        return analysisCallback(doc, req.task);
      });

      results.push({
        docId: doc.docId,
        analysis: result.analysis,
        cacheMetadata: {
          cacheHit: result.hit,
          costSavings: result.costSavings,
        },
      });

      if (result.hit) {
        cacheHits++;
      }
      totalSavings += result.costSavings;
    }

    return {
      results,
      summary: {
        totalDocs: req.documents.length,
        cacheHits,
        totalSavings,
      },
    };
  }
}

/**
 * Estimate cost savings for a cache hit.
 * Cache reads cost $0.30/1M tokens vs $3.00/1M for normal input.
 */
export function estimateCacheSavings(tokenCount: number): number {
  const inputCost = (tokenCount / 1_000_000) * 3.0;
  const cacheReadCost = (tokenCount / 1_000_000) * 0.30;
  return inputCost - cacheReadCost;
}

/**
 * Calculate batch summary statistics.
 */
export function calculateBatchStats(results: BatchAnalysisResult['results']): {
  hitRate: number;
  totalSavings: number;
  avgCostPerDoc: number;
} {
  const hitRate = results.filter((r) => r.cacheMetadata.cacheHit).length / results.length;
  const totalSavings = results.reduce((sum, r) => sum + r.cacheMetadata.costSavings, 0);
  const avgCostPerDoc = totalSavings / results.length;

  return { hitRate, totalSavings, avgCostPerDoc };
}
