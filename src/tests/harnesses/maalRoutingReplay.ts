/**
 * MAAL Routing Replay Harness
 * Validates deterministic routing decisions using TorqueQuery v2 fast-path vs slow-path.
 *
 * File: maalRoutingReplay.ts
 * Date: 2026-07-02
 * Semver: 1.0.0
 */

import { torqueQueryV2Search, TorqueQueryV2SearchRequest, TorqueQueryV2SearchResponse } from '../../adapters/torqueQueryV2.js';
import { logStructured } from '../../lib/log.js';

interface ReplayTask {
  id: string;
  query: string;
  expectedRoute: string;
}

interface ReplayResult {
  taskId: string;
  query: string;
  baselineResults: TorqueQueryV2SearchResponse;
  optimizedResults: TorqueQueryV2SearchResponse;
  resultsMatch: boolean;
  driftScore: number;
}

const replayTasks: ReplayTask[] = [
  {
    id: 't-001',
    query: 'governance caps for tool invocation',
    expectedRoute: 'governance'
  },
  {
    id: 't-002',
    query: 'docs ingestion pipeline architecture',
    expectedRoute: 'ingestion'
  },
  {
    id: 't-003',
    query: 'semantic search baseline performance',
    expectedRoute: 'search'
  },
  {
    id: 't-004',
    query: 'MAAL routing state machine',
    expectedRoute: 'routing'
  },
  {
    id: 't-005',
    query: 'canary gate promotion criteria',
    expectedRoute: 'governance'
  }
];

/**
 * Compare fast-path vs slow-path results.
 * Computes drift score (0 = identical, 1 = completely different).
 */
function computeDriftScore(baseline: TorqueQueryV2SearchResponse, optimized: TorqueQueryV2SearchResponse): number {
  if (baseline.results.length === 0 || optimized.results.length === 0) {
    return 1.0; // Complete drift if either is empty
  }

  // Compare top result
  const baselineTop = baseline.results[0];
  const optimizedTop = optimized.results[0];

  if (baselineTop.id === optimizedTop.id) {
    // Same doc, compare score similarity
    const scoreDiff = Math.abs(baselineTop.score - optimizedTop.score);
    return Math.min(1.0, scoreDiff); // Normalized to [0, 1]
  }

  // Different top docs = significant drift
  return 0.5;
}

/**
 * Run MAAL routing replay with baseline vs optimized (fast-path).
 */
export async function runMaalRoutingReplay(): Promise<ReplayResult[]> {
  const results: ReplayResult[] = [];

  for (const task of replayTasks) {
    try {
      logStructured('maal-routing-replay', {
        event: 'task_start',
        taskId: task.id,
        query: task.query
      });

      // Baseline: slow-path (full MMR/RRF)
      const baselineReq: TorqueQueryV2SearchRequest = {
        query: task.query,
        top_k: 10,
        fast_path: false,
        skip_mmr: false,
        candidate_pool: 50
      };

      const baselineResults = await torqueQueryV2Search(baselineReq);

      // Optimized: fast-path (no MMR)
      // Use embedding from baseline (deterministic reuse)
      const optimizedReq: TorqueQueryV2SearchRequest = {
        query: task.query,
        normalized_embedding: undefined, // Would need extraction from baseline
        top_k: 10,
        fast_path: true,
        skip_mmr: true,
        candidate_pool: 50
      };

      const optimizedResults = await torqueQueryV2Search(optimizedReq);

      // Compare results
      const resultsMatch = baselineResults.results[0]?.id === optimizedResults.results[0]?.id;
      const driftScore = computeDriftScore(baselineResults, optimizedResults);

      const result: ReplayResult = {
        taskId: task.id,
        query: task.query,
        baselineResults,
        optimizedResults,
        resultsMatch,
        driftScore
      };

      results.push(result);

      logStructured('maal-routing-replay', {
        event: 'task_complete',
        taskId: task.id,
        query: task.query,
        baselineTop: baselineResults.results[0]?.id,
        optimizedTop: optimizedResults.results[0]?.id,
        resultsMatch,
        driftScore
      });
    } catch (err) {
      logStructured('maal-routing-replay', {
        event: 'task_error',
        taskId: task.id,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  return results;
}

/**
 * Print replay results summary.
 */
export function printMaalRoutingReplaySummary(results: ReplayResult[]): void {
  console.log('\n=== MAAL Routing Replay Results ===\n');
  console.log(`Total tasks: ${results.length}`);

  const matched = results.filter(r => r.resultsMatch).length;
  const driftHigh = results.filter(r => r.driftScore > 0.2).length;

  console.log(`Matched results: ${matched}/${results.length}`);
  console.log(`High drift (>0.2): ${driftHigh}/${results.length}\n`);

  results.forEach(r => {
    console.log(`Task ${r.taskId}:`);
    console.log(`  Query: ${r.query}`);
    console.log(`  Baseline top: ${r.baselineResults.results[0]?.id} (score: ${r.baselineResults.results[0]?.score.toFixed(4)})`);
    console.log(`  Optimized top: ${r.optimizedResults.results[0]?.id} (score: ${r.optimizedResults.results[0]?.score.toFixed(4)})`);
    console.log(`  Match: ${r.resultsMatch ? '✓' : '✗'}`);
    console.log(`  Drift: ${r.driftScore.toFixed(4)}\n`);
  });
}

// Export for testing
export type { ReplayResult };
