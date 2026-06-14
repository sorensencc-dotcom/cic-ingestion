/**
 * Integration adapter: AutonomyService + Prompt Cache Router
 * Enables autonomy agents to use prompt caching for document analysis
 *
 * Usage (in AutonomyService):
 *   const adapter = new AutonomyPromptCacheAdapter();
 *   const result = await adapter.analyzeDocumentWithCache({
 *     docId: 'kroll_batch_001',
 *     docText: archivalContent,
 *     task: 'extract_findings',
 *   });
 */
export type AnalysisTask = 'extract_findings' | 'identify_gaps' | 'propose_actions' | 'summarize_content' | 'detect_patterns';
export interface DocumentAnalysisRequest {
    docId: string;
    docText: string;
    task: AnalysisTask;
    context?: string;
}
export interface DocumentAnalysisResult {
    analysis: string;
    task: AnalysisTask;
    cacheMetadata: {
        cacheHit: boolean;
        cacheReadTokens: number;
        inputTokens: number;
        outputTokens: number;
        costSavings: number;
    };
}
export declare class AutonomyPromptCacheAdapter {
    private router;
    constructor(registryDbPath?: string);
    analyzeDocumentWithCache(req: DocumentAnalysisRequest): Promise<DocumentAnalysisResult>;
    private buildPromptForTask;
    /**
     * Get metrics for a specific document
     */
    getDocumentMetrics(contentHash: string): import("../prompt-cache/registry").CacheMetrics | null;
    /**
     * Get aggregate cache statistics
     */
    getCacheStatistics(): import("../prompt-cache/registry").CacheSummary;
    /**
     * Clear registry (use carefully)
     */
    clearRegistry(): void;
    /**
     * Log current cache status
     */
    logCacheStatus(): void;
}
//# sourceMappingURL=AutonomyPromptCacheAdapter.d.ts.map