/**
 * CIC Prompt Cache Router
 * Main integration point for autonomy agents to leverage prompt caching
 *
 * Usage:
 *   const router = new CICPromptCacheRouter();
 *   const { response, metadata } = await router.generateWithCache({
 *     docId: 'kroll_batch_001',
 *     docText: longArchivalText,
 *     userPrompt: 'Analyze this batch...',
 *   });
 */
import { CacheMetrics, CacheSummary } from './registry';
export interface GenerateOptions {
    docId: string;
    docText: string;
    userPrompt: string;
    model?: string;
    maxTokens?: number;
    registryDbPath?: string;
}
export interface GenerateResult {
    response: string;
    metadata: {
        docId: string;
        cacheHit: boolean;
        cacheReadTokens: number;
        inputTokens: number;
        outputTokens: number;
        costWithCache: number;
        costWithoutCache: number;
        costSavings: number;
        timestamp: string;
    };
}
export declare class CICPromptCacheRouter {
    private client;
    private registry;
    private model;
    constructor(registryDbPath?: string);
    generateWithCache(opts: GenerateOptions): Promise<GenerateResult>;
    getMetrics(contentHash: string): CacheMetrics | null;
    getSummary(): CacheSummary;
    clearRegistry(): void;
}
//# sourceMappingURL=router.d.ts.map