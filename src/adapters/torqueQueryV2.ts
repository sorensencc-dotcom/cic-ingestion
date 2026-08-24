/**
 * TorqueQuery v2 Adapter — CIC integration
 * Supports fast-path (no MMR) and slow-path (full MMR/RRF).
 *
 * File: torqueQueryV2.ts
 * Date: 2026-07-02
 * Semver: 2.0.0
 *
 * Scope, confirmed per Tier 1 decision 2026-07-17 (Option i, split and
 * rename): this adapter talks ONLY to the memory/drift search service at
 * src/services/torquequery/TorqueQueryV2Server.py, which keeps the name
 * "TorqueQuery". It must never be repointed at or merged with the unrelated
 * documentation-RAG service ("torque-query-docs", in a different repo,
 * rewrite-docs/castironforge/torque-query-docs) — that service has its own
 * client (TorqueQueryDocsClient.ts) and is not wired into CIC via this file.
 */


import { FallbackChain } from '../resilience/fallbackChain';

export interface TorqueQueryV2SearchRequest {
  query: string;
  normalized_embedding?: number[];
  top_k?: number;
  fast_path?: boolean;
  skip_mmr?: boolean;
  candidate_pool?: number;
  filters?: Record<string, any>;
}

export interface TorqueQueryV2SearchResult {
  id: string;
  score: number;
  metadata: Record<string, any>;
}

export interface TorqueQueryV2SearchResponse {
  results: TorqueQueryV2SearchResult[];
  fast_path_used: boolean;
  query: string;
  candidate_pool: number;
}

export interface TorqueQueryV2HealthResponse {
  status: 'ok' | 'error';
  version: string;
}

/**
 * Search with TorqueQuery v2.
 * Automatically uses fast-path if all eligibility criteria met.
 */
export async function torqueQueryV2Search(
  payload: TorqueQueryV2SearchRequest,
  baseUrl: string = 'http://localhost:8000'
): Promise<TorqueQueryV2SearchResponse> {
  const url = `${baseUrl}/search`;

  const body = {
    query: payload.query,
    normalized_embedding: payload.normalized_embedding,
    top_k: payload.top_k || 10,
    fast_path: payload.fast_path || false,
    skip_mmr: payload.skip_mmr || false,
    candidate_pool: payload.candidate_pool || 50,
    filters: payload.filters || null
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      throw new Error(`TorqueQuery v2 /search failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as TorqueQueryV2SearchResponse;
    return data;
  } catch (err) {
    throw new Error(`TorqueQuery v2 search error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Health check.
 */
export async function torqueQueryV2Health(
  baseUrl: string = 'http://localhost:8000'
): Promise<TorqueQueryV2HealthResponse> {
  const url = `${baseUrl}/health`;

  try {
    const res = await fetch(url, { method: 'GET' });

    if (!res.ok) {
      return { status: 'error', version: 'unknown' };
    }

    return (await res.json()) as TorqueQueryV2HealthResponse;
  } catch (err) {
    return { status: 'error', version: 'unknown' };
  }
}

/**
 * Batch search for multiple queries.
 */
export async function torqueQueryV2BatchSearch(
  payloads: TorqueQueryV2SearchRequest[],
  baseUrl: string = 'http://localhost:8000'
): Promise<TorqueQueryV2SearchResponse[]> {
  const url = `${baseUrl}/batch-search`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloads)
    });

    if (!res.ok) {
      throw new Error(`TorqueQuery v2 batch search failed: ${res.status}`);
    }

    const data = (await res.json()) as { results: TorqueQueryV2SearchResponse[] };
    return data.results;
  } catch (err) {
    throw new Error(`TorqueQuery v2 batch search error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export interface ScoredSearchResult extends TorqueQueryV2SearchResult {
  relevanceScore?: number;
  relevanceReasoning?: string;
}

export interface PostSearchEvaluationInput {
  query: string;
  results: TorqueQueryV2SearchResult[];
  evaluationPrompt?: string;
}

export interface PostSearchEvaluationOutput {
  query: string;
  summary: string;
  scoredResults: ScoredSearchResult[];
  rawResponse?: string;
}

export interface EvaluateAndSummarizeOptions {
  chain?: FallbackChain<PostSearchEvaluationInput, PostSearchEvaluationOutput>;
  evaluationPrompt?: string;
  topNToScore?: number;
}

let defaultEvaluationChain: FallbackChain<PostSearchEvaluationInput, PostSearchEvaluationOutput> | null = null;

export function buildEvaluationPrompt(query: string, results: TorqueQueryV2SearchResult[]): string {
  const hitsDescription = results
    .map((r, i) => `[${i + 1}] ID: ${r.id} (Score: ${r.score.toFixed(4)})\nMetadata: ${JSON.stringify(r.metadata)}`)
    .join('\n\n');

  return `You are evaluating search results for query: "${query}"

Search hits:
${hitsDescription}

Please evaluate the relevance of each hit to the query (score 0.0 - 1.0) and produce a concise summary of the findings.`;
}

export function getDefaultEvaluationChain(): FallbackChain<PostSearchEvaluationInput, PostSearchEvaluationOutput> {
  if (!defaultEvaluationChain) {
    defaultEvaluationChain = new FallbackChain<PostSearchEvaluationInput, PostSearchEvaluationOutput>({
      name: 'TorqueQueryPostSearchEvaluation',
      providerFailureThreshold: 3,
      providerResetTimeoutMs: 30000,
    });

    defaultEvaluationChain.addProvider({
      name: 'heuristic-scoring-summary',
      priority: 100,
      execute: async (input: PostSearchEvaluationInput): Promise<PostSearchEvaluationOutput> => {
        const scoredResults: ScoredSearchResult[] = input.results.map((item) => {
          const score = typeof item.score === 'number' ? Math.min(Math.max(item.score, 0), 1) : 0.5;
          return {
            ...item,
            relevanceScore: score,
            relevanceReasoning: `Ranked with score ${score.toFixed(4)}`,
          };
        });

        const summary = scoredResults.length > 0
          ? `Found ${scoredResults.length} relevant hit(s) for "${input.query}". Top result: ${scoredResults[0].id}.`
          : `No results found for "${input.query}".`;

        return {
          query: input.query,
          summary,
          scoredResults,
        };
      },
    });
  }
  return defaultEvaluationChain;
}

export function resetDefaultEvaluationChain(): void {
  defaultEvaluationChain = null;
}

/**
 * Score relevance and synthesize summary for search results via FallbackChain.
 */
export async function evaluateAndSummarizeResults(
  searchResponse: TorqueQueryV2SearchResponse,
  options?: EvaluateAndSummarizeOptions
): Promise<PostSearchEvaluationOutput> {
  const chain = options?.chain ?? getDefaultEvaluationChain();
  const input: PostSearchEvaluationInput = {
    query: searchResponse.query,
    results: options?.topNToScore
      ? searchResponse.results.slice(0, options.topNToScore)
      : searchResponse.results,
    evaluationPrompt: options?.evaluationPrompt,
  };

  return await chain.execute(input);
}

