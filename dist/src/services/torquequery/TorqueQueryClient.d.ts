/**
 * TorqueQuery HTTP Client
 * Communicates with TorqueQuery service for Console v3 data
 * Phase 4: Fast-path optimization for simple queries
 */
export interface TorqueQueryClientConfig {
    url?: string;
    timeout?: number;
}
export declare class TorqueQueryClient {
    private url;
    private timeout;
    private queryCache;
    private readonly QUERY_CACHE_TTL;
    private normalizedEmbeddingCache;
    constructor(config?: TorqueQueryClientConfig);
    /**
     * Pre-normalize embedding vector to avoid recomputation.
     * Cache normalized vectors (magnitude already computed).
     */
    private normalizeEmbedding;
    /**
     * Check if query is eligible for fast-path (simple top-k without MMR).
     * Fast-path criteria: top-k only, no diversity scoring, fewer candidates needed.
     */
    private isEligibleForFastPath;
    /**
     * Execute fast-path query (top-k without MMR).
     * Skips diversity scoring, uses pre-normalized embeddings, reduced candidates.
     */
    private executeOptimizedQuery;
    private fetch;
    queryHealth(): Promise<any>;
    queryPipelines(): Promise<any>;
    queryAlerts(): Promise<any>;
    queryWorkspace(): Promise<any>;
    queryAgents(): Promise<any>;
    queryAgentDetail(agentId: string): Promise<any>;
    invokeAgent(agentId: string, payload: any): Promise<any>;
    pauseAgent(agentId: string): Promise<any>;
    restartAgent(agentId: string): Promise<any>;
    snapshotAgent(agentId: string): Promise<any>;
    executeAction(action: string, options?: any): Promise<any>;
    /**
     * Query metrics with fast-path optimization.
     * Caches results for 1s, uses fast-path for eligible queries.
     */
    queryMetrics(queryParams?: any): Promise<any>;
}
//# sourceMappingURL=TorqueQueryClient.d.ts.map