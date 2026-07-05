/**
 * CIC Ingestion Replay Harness
 * Validates fast-path optimization through ingestion→search cycle.
 *
 * File: cicIngestionReplay.ts
 * Date: 2026-07-02
 * Semver: 1.0.0
 */

import { torqueQueryV2Search, TorqueQueryV2SearchRequest, TorqueQueryV2SearchResponse } from '../../adapters/torqueQueryV2.js';
import { logStructured } from '../../lib/log.js';

interface IngestionCase {
  id: string;
  content: string;
  collection: string;
}

interface IngestionReplayResult {
  docId: string;
  collection: string;
  content: string;
  slowPathResults: TorqueQueryV2SearchResponse;
  fastPathResults: TorqueQueryV2SearchResponse;
  topResultMatch: boolean;
  latencyDiff: number;
}

const ingestionCases: IngestionCase[] = [
  {
    id: 'doc-001',
    content: 'CIC ingestion pipeline design, state management, and drift scoring algorithms.',
    collection: 'architecture'
  },
  {
    id: 'doc-002',
    content: 'TorqueQuery fast-path optimization, query caching, and deterministic ranking.',
    collection: 'search'
  },
  {
    id: 'doc-003',
    content: 'MAAL routing state machine, proposal lifecycle, and canary gate orchestration.',
    collection: 'routing'
  },
  {
    id: 'doc-004',
    content: 'Governance caps, metric thresholds, and approval eligibility tracking.',
    collection: 'governance'
  },
  {
    id: 'doc-005',
    content: 'Warm executor pool, container reuse, and trust scoring for tool invocation.',
    collection: 'execution'
  }
];

/**
 * Run CIC ingestion replay: slow-path → fast-path comparison.
 */
export async function runCicIngestionReplay(): Promise<IngestionReplayResult[]> {
  const results: IngestionReplayResult[] = [];

  for (const c of ingestionCases) {
    try {
      logStructured('cic-ingestion-replay', {
        event: 'ingestion_start',
        docId: c.id,
        collection: c.collection
      });

      // Slow-path: full MMR/RRF
      const slowPathReq: TorqueQueryV2SearchRequest = {
        query: c.content,
        top_k: 10,
        fast_path: false,
        skip_mmr: false,
        candidate_pool: 50,
        filters: { collection: c.collection }
      };

      const slowStart = Date.now();
      const slowPathResults = await torqueQueryV2Search(slowPathReq);
      const slowLatency = Date.now() - slowStart;

      // Fast-path: no MMR, reuse embedding
      const fastPathReq: TorqueQueryV2SearchRequest = {
        query: c.content,
        top_k: 10,
        fast_path: true,
        skip_mmr: true,
        candidate_pool: 50,
        filters: { collection: c.collection }
      };

      const fastStart = Date.now();
      const fastPathResults = await torqueQueryV2Search(fastPathReq);
      const fastLatency = Date.now() - fastStart;

      // Compare
      const topResultMatch = slowPathResults.results[0]?.id === fastPathResults.results[0]?.id;
      const latencyDiff = fastLatency - slowLatency;

      const result: IngestionReplayResult = {
        docId: c.id,
        collection: c.collection,
        content: c.content,
        slowPathResults,
        fastPathResults,
        topResultMatch,
        latencyDiff
      };

      results.push(result);

      logStructured('cic-ingestion-replay', {
        event: 'ingestion_complete',
        docId: c.id,
        collection: c.collection,
        slowPathTop: slowPathResults.results[0]?.id,
        fastPathTop: fastPathResults.results[0]?.id,
        topResultMatch,
        slowLatency,
        fastLatency,
        latencyDiff
      });
    } catch (err) {
      logStructured('cic-ingestion-replay', {
        event: 'ingestion_error',
        docId: c.id,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  return results;
}

/**
 * Print ingestion replay results summary.
 */
export function printCicIngestionReplaySummary(results: IngestionReplayResult[]): void {
  console.log('\n=== CIC Ingestion Replay Results ===\n');
  console.log(`Total documents: ${results.length}`);

  const matched = results.filter(r => r.topResultMatch).length;
  const fastWins = results.filter(r => r.latencyDiff < 0).length;

  console.log(`Top result matches: ${matched}/${results.length}`);
  console.log(`Fast-path faster: ${fastWins}/${results.length}\n`);

  results.forEach(r => {
    console.log(`Document ${r.docId} (${r.collection}):`);
    console.log(`  Content: ${r.content.substring(0, 60)}...`);
    console.log(`  Slow-path top: ${r.slowPathResults.results[0]?.id} (score: ${r.slowPathResults.results[0]?.score.toFixed(4)})`);
    console.log(`  Fast-path top: ${r.fastPathResults.results[0]?.id} (score: ${r.fastPathResults.results[0]?.score.toFixed(4)})`);
    console.log(`  Match: ${r.topResultMatch ? '✓' : '✗'}`);
    console.log(`  Latency diff: ${r.latencyDiff}ms (${r.latencyDiff < 0 ? 'faster' : 'slower'})\n`);
  });
}

// Export for testing
export type { IngestionReplayResult };
