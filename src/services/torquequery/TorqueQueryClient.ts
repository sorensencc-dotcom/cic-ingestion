/**
 * TorqueQuery HTTP Client
 * Communicates with TorqueQuery service for Console v3 data
 * Phase 4: Fast-path optimization for simple queries
 * Phase 27: Counterfactual reasoning queries
 */

import type { CICQueryResponse } from '../../types/search';

interface QueryCache {
  timestamp: number;
  result: any;
}

interface NormalizedEmbedding {
  vector: number[];
  magnitude: number;
}

export interface TorqueQueryClientConfig {
  url?: string;
  timeout?: number;
}

export class TorqueQueryClient {
  private url: string;
  private timeout: number;
  private queryCache: Map<string, QueryCache> = new Map();
  private readonly QUERY_CACHE_TTL = 1000; // 1s for fast-path results
  private normalizedEmbeddingCache: Map<string, NormalizedEmbedding> = new Map();

  constructor(config: TorqueQueryClientConfig = {}) {
    this.url = config.url || process.env.TORQUE_QUERY_URL || 'http://localhost:3110';
    this.timeout = config.timeout || 5000;
  }

  /**
   * Pre-normalize embedding vector to avoid recomputation.
   * Cache normalized vectors (magnitude already computed).
   */
  private normalizeEmbedding(vector: number[]): NormalizedEmbedding {
    const key = JSON.stringify(vector);

    // Check cache
    if (this.normalizedEmbeddingCache.has(key)) {
      return this.normalizedEmbeddingCache.get(key)!;
    }

    // Compute magnitude and normalize
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    const normalized: NormalizedEmbedding = {
      vector: magnitude > 0 ? vector.map(v => v / magnitude) : vector,
      magnitude,
    };

    // Cache result
    this.normalizedEmbeddingCache.set(key, normalized);
    return normalized;
  }

  /**
   * Check if query is eligible for fast-path (simple top-k without MMR).
   * Fast-path criteria: top-k only, no diversity scoring, fewer candidates needed.
   */
  private isEligibleForFastPath(queryParams: any): boolean {
    // Fast path for simple top-k queries
    return (
      !queryParams.mmr_enabled &&
      !queryParams.diversify &&
      queryParams.k && queryParams.k <= 50
    );
  }

  /**
   * Execute fast-path query (top-k without MMR).
   * Skips diversity scoring, uses pre-normalized embeddings, reduced candidates.
   */
  private async executeOptimizedQuery(queryParams: any): Promise<any> {
    // Use pre-normalized embedding if provided
    if (queryParams.embedding) {
      queryParams.normalized_embedding = this.normalizeEmbedding(queryParams.embedding);
      delete queryParams.embedding; // Use normalized version
    }

    // Reduce MMR candidate pool for speed (50% reduction)
    if (queryParams.candidates) {
      queryParams.candidates = Math.ceil(queryParams.candidates * 0.5);
    }

    // Add fast-path flag to server
    queryParams.fast_path = true;

    return this.fetch('/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queryParams),
    });
  }

  private async fetch(path: string, options: RequestInit = {}): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.url}${path}`, {
        ...options,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`TorqueQuery ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async queryHealth(): Promise<any> {
    return this.fetch('/health');
  }

  async queryPipelines(): Promise<any> {
    return this.fetch('/pipelines');
  }

  async queryAlerts(): Promise<any> {
    return this.fetch('/alerts');
  }

  async queryWorkspace(): Promise<any> {
    return this.fetch('/workspace');
  }

  async queryAgents(): Promise<any> {
    return this.fetch('/agents');
  }

  async queryAgentDetail(agentId: string): Promise<any> {
    return this.fetch(`/agents/${agentId}`);
  }

  async invokeAgent(agentId: string, payload: any): Promise<any> {
    return this.fetch(`/agents/${agentId}/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  async pauseAgent(agentId: string): Promise<any> {
    return this.fetch(`/agents/${agentId}/pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  }

  async restartAgent(agentId: string): Promise<any> {
    return this.fetch(`/agents/${agentId}/restart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  }

  async snapshotAgent(agentId: string): Promise<any> {
    return this.fetch(`/agents/${agentId}/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  }

  async executeAction(action: string, options: any = {}): Promise<any> {
    return this.fetch('/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...options }),
    });
  }

  /**
   * CIC counterfactual reasoning query.
   * Finds governance decisions with similar reasoning.
   */
  async cicQuery(req: {
    query: string;
    phase_ids?: string[];
    confidence_min?: number;
    limit?: number;
  }): Promise<CICQueryResponse> {
    return this.fetch('/search/cic-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
  }

  /**
   * Query metrics with fast-path optimization.
   * Caches results for 1s, uses fast-path for eligible queries.
   */
  async queryMetrics(queryParams: any = {}): Promise<any> {
    const cacheKey = JSON.stringify(queryParams);
    const now = Date.now();

    // Check query cache (1s TTL)
    if (this.queryCache.has(cacheKey)) {
      const cached = this.queryCache.get(cacheKey)!;
      if (now - cached.timestamp < this.QUERY_CACHE_TTL) {
        return cached.result;
      }
    }

    // Execute query (fast-path if eligible)
    let result: any;
    if (this.isEligibleForFastPath(queryParams)) {
      result = await this.executeOptimizedQuery(queryParams);
    } else {
      result = await this.fetch('/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queryParams),
      });
    }

    // Update cache
    this.queryCache.set(cacheKey, { timestamp: now, result });
    return result;
  }
}
