/**
 * Batch document operations for prompt caching.
 * Handles bulk registration and analysis with controlled parallelism.
 */
import { CacheRegistry } from './registry.js';
import { SQLiteRegistry } from './persistence/SQLiteRegistry.js';
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
    parallelism?: number;
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
 * Batch operations manager.
 * Handles bulk document registration and analysis with rate limiting.
 */
export declare class BatchOperationsManager {
    private registry;
    private rateLimiter;
    constructor(registry: CacheRegistry | SQLiteRegistry, maxParallelism?: number);
    /**
     * Register multiple documents in a single transaction.
     */
    registerDocuments(docs: Array<{
        docId: string;
        hash: string;
        tokens: number;
    }>): Promise<void>;
    /**
     * Log multiple cache accesses in a single transaction.
     */
    logBatchAccesses(accesses: Array<{
        docId: string;
        hash: string;
        hit: boolean;
        cacheReadTokens?: number;
        inputTokens?: number;
    }>): Promise<void>;
    /**
     * Generate analysis for a batch of documents with rate limiting.
     * This is a stub for Phase 2.2 integration with AutonomyService.
     */
    generateBatchWithCache(req: BatchAnalysisRequest, analysisCallback: (doc: BatchDocument, task: AnalysisTask) => Promise<{
        analysis: string;
        hit: boolean;
        costSavings: number;
    }>): Promise<BatchAnalysisResult>;
}
/**
 * Estimate cost savings for a cache hit.
 * Cache reads cost $0.30/1M tokens vs $3.00/1M for normal input.
 */
export declare function estimateCacheSavings(tokenCount: number): number;
/**
 * Calculate batch summary statistics.
 */
export declare function calculateBatchStats(results: BatchAnalysisResult['results']): {
    hitRate: number;
    totalSavings: number;
    avgCostPerDoc: number;
};
//# sourceMappingURL=batch.d.ts.map