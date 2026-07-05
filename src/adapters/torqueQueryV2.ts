/**
 * TorqueQuery v2 Adapter — CIC integration
 * Supports fast-path (no MMR) and slow-path (full MMR/RRF).
 *
 * File: torqueQueryV2.ts
 * Date: 2026-07-02
 * Semver: 2.0.0
 */

import fetch from 'node-fetch';

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
