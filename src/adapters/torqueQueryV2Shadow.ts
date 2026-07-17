/**
 * TorqueQuery v2 Shadow Adapter — opt-in comparison shadow calls.
 *
 * This targets the memory/drift semantic search service
 * (src/services/torquequery/TorqueQueryV2Server.py), NOT the
 * documentation-RAG service also informally called "TorqueQuery" in a
 * different repo. No naming/owner decision has been made across the two
 * services; see docs/meta/phases/torquequery-reconciliation-charter.md in
 * the main C:/dev repo for the pending Tier 1 decision.
 *
 * Purpose: when TORQUEQUERY_SHADOW_ENABLED is truthy, fire a parallel
 * search call alongside a real call site's own torqueQueryV2Search() call
 * and log a comparison (fast-path vs slow-path agreement, latency delta).
 * This NEVER affects the value returned to the real caller:
 *   - Off by default (env var unset/false): shadowSearch() is a no-op that
 *     resolves immediately and does nothing.
 *   - On: the shadow call runs fully in parallel/fire-and-forget; its
 *     result or failure is only logged, never thrown, never awaited by
 *     the caller's own return path.
 *
 * Existing callers (maalRoutingReplay.ts, driftScoringHarness.ts, and any
 * future call site) that use torqueQueryV2Search()/torqueQueryV2Health()
 * directly from torqueQueryV2.ts are completely untouched by this file --
 * this module does not modify, wrap, or re-export those functions.
 *
 * File: torqueQueryV2Shadow.ts
 * Date: 2026-07-17
 */

import {
  torqueQueryV2Search,
  TorqueQueryV2SearchRequest,
  TorqueQueryV2SearchResponse,
} from './torqueQueryV2.ts';

const SHADOW_ENV_VAR = 'TORQUEQUERY_SHADOW_ENABLED';

export interface ShadowComparisonResult {
  enabled: true;
  query: string;
  realLatencyMs: number;
  shadowLatencyMs: number | null;
  latencyDeltaMs: number | null;
  realFastPathUsed: boolean;
  shadowFastPathUsed: boolean | null;
  topResultAgrees: boolean | null;
  shadowError: string | null;
}

export interface ShadowDisabledResult {
  enabled: false;
}

export type ShadowOutcome = ShadowComparisonResult | ShadowDisabledResult;

/** Reads the flag fresh each call so tests can toggle it via process.env. */
export function isShadowEnabled(): boolean {
  const raw = process.env[SHADOW_ENV_VAR];
  if (!raw) return false;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function defaultLogger(payload: Record<string, unknown>): void {
  // Deliberately plain console logging, not wired into any existing
  // structured logger, to keep this adapter dependency-free and reversible.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ event: 'torquequery_shadow_comparison', ...payload }));
}

/**
 * Runs a shadow comparison call in parallel to a real search that the
 * caller is making independently. Does NOT return anything the caller is
 * expected to use for its actual response -- call this fire-and-forget
 * alongside (not instead of) the real torqueQueryV2Search() call at your
 * call site, and ignore/discard the resolved value if you don't need it
 * for your own diagnostics.
 *
 * @param realRequestPayload The exact payload the real call site is
 *   sending to torqueQueryV2Search(), reused here for the shadow call.
 * @param realResponse The response and latency already obtained from the
 *   real call, used purely for comparison/logging.
 * @param baseUrl Same base URL semantics as torqueQueryV2Search().
 * @param logger Injectable for tests; defaults to console.log(JSON...).
 */
export async function shadowCompare(
  realRequestPayload: TorqueQueryV2SearchRequest,
  realResponse: TorqueQueryV2SearchResponse,
  realLatencyMs: number,
  baseUrl: string = 'http://localhost:8000',
  logger: (payload: Record<string, unknown>) => void = defaultLogger
): Promise<ShadowOutcome> {
  if (!isShadowEnabled()) {
    return { enabled: false };
  }

  const shadowStart = Date.now();
  let shadowResponse: TorqueQueryV2SearchResponse | null = null;
  let shadowError: string | null = null;

  try {
    shadowResponse = await torqueQueryV2Search(realRequestPayload, baseUrl);
  } catch (err) {
    shadowError = err instanceof Error ? err.message : String(err);
  }

  const shadowLatencyMs = shadowResponse ? Date.now() - shadowStart : null;
  const topResultAgrees =
    shadowResponse
      ? (realResponse.results[0]?.id ?? null) === (shadowResponse.results[0]?.id ?? null)
      : null;

  const result: ShadowComparisonResult = {
    enabled: true,
    query: realRequestPayload.query,
    realLatencyMs,
    shadowLatencyMs,
    latencyDeltaMs: shadowLatencyMs !== null ? shadowLatencyMs - realLatencyMs : null,
    realFastPathUsed: realResponse.fast_path_used,
    shadowFastPathUsed: shadowResponse ? shadowResponse.fast_path_used : null,
    topResultAgrees,
    shadowError,
  };

  logger(result as unknown as Record<string, unknown>);

  return result;
}
