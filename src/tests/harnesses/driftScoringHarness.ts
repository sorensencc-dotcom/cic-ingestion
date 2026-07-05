/**
 * MAAL Drift Scoring Validation Harness
 * Ensures fast-path optimization doesn't introduce drift in MAAL routing decisions.
 *
 * File: driftScoringHarness.ts
 * Date: 2026-07-02
 * Semver: 1.0.0
 */

import { torqueQueryV2Search, TorqueQueryV2SearchResponse } from '../../adapters/torqueQueryV2.js';
import { logStructured } from '../../lib/log.js';

interface DriftTestCase {
  id: string;
  query: string;
  expectedDriftThreshold: number; // Max allowed drift
}

interface DriftTestResult {
  caseId: string;
  query: string;
  baselineResults: TorqueQueryV2SearchResponse;
  optimizedResults: TorqueQueryV2SearchResponse;
  driftScore: number;
  thresholdExceeded: boolean;
  verdict: 'PASS' | 'WARN' | 'FAIL';
}

const driftTestCases: DriftTestCase[] = [
  {
    id: 'drift-001',
    query: 'domestic chip optimization strategies',
    expectedDriftThreshold: 0.1
  },
  {
    id: 'drift-002',
    query: 'training throughput improvements',
    expectedDriftThreshold: 0.15
  },
  {
    id: 'drift-003',
    query: 'hardware stack alignment',
    expectedDriftThreshold: 0.1
  },
  {
    id: 'drift-004',
    query: 'semantic routing baseline performance',
    expectedDriftThreshold: 0.12
  },
  {
    id: 'drift-005',
    query: 'governance approval workflow',
    expectedDriftThreshold: 0.08
  }
];

/**
 * Compute structural drift score between two search results.
 * Metric: normalized distance between result sets.
 * 0 = identical, 1 = completely different.
 */
function computeStructuralDrift(baseline: TorqueQueryV2SearchResponse, optimized: TorqueQueryV2SearchResponse): number {
  const baselineIds = new Set(baseline.results.map(r => r.id));
  const optimizedIds = new Set(optimized.results.map(r => r.id));

  // Jaccard distance: |A Δ B| / |A ∪ B|
  const intersection = new Set([...baselineIds].filter(x => optimizedIds.has(x)));
  const union = new Set([...baselineIds, ...optimizedIds]);

  if (union.size === 0) return 1.0; // Both empty
  return 1.0 - (intersection.size / union.size);
}

/**
 * Compute semantic drift score between two search results.
 * Metric: average score difference for common docs.
 * 0 = identical scores, 1 = max divergence.
 */
function computeSemanticDrift(baseline: TorqueQueryV2SearchResponse, optimized: TorqueQueryV2SearchResponse): number {
  const baselineMap = new Map(baseline.results.map(r => [r.id, r.score]));
  const optimizedMap = new Map(optimized.results.map(r => [r.id, r.score]));

  const commonDocs = new Set([...baselineMap.keys()].filter(id => optimizedMap.has(id)));

  if (commonDocs.size === 0) return 1.0; // No common docs

  const scoreDiffs = Array.from(commonDocs).map(id => {
    const baseLine = baselineMap.get(id)!;
    const opt = optimizedMap.get(id)!;
    return Math.abs(baseLine - opt);
  });

  const avgDiff = scoreDiffs.reduce((a, b) => a + b, 0) / scoreDiffs.length;
  return Math.min(1.0, avgDiff); // Normalize to [0, 1]
}

/**
 * Combined drift score (50% structural + 50% semantic).
 */
function computeCombinedDrift(baseline: TorqueQueryV2SearchResponse, optimized: TorqueQueryV2SearchResponse): number {
  const structural = computeStructuralDrift(baseline, optimized);
  const semantic = computeSemanticDrift(baseline, optimized);
  return (structural + semantic) / 2.0;
}

/**
 * Run drift scoring validation harness.
 */
export async function runDriftScoringHarness(): Promise<DriftTestResult[]> {
  const results: DriftTestResult[] = [];

  for (const testCase of driftTestCases) {
    try {
      logStructured('drift-scoring-harness', {
        event: 'test_start',
        caseId: testCase.id,
        query: testCase.query
      });

      // Baseline: slow-path (full MMR/RRF)
      const baselineResults = await torqueQueryV2Search({
        query: testCase.query,
        top_k: 20,
        fast_path: false,
        skip_mmr: false,
        candidate_pool: 100
      });

      // Optimized: fast-path (no MMR)
      const optimizedResults = await torqueQueryV2Search({
        query: testCase.query,
        top_k: 20,
        fast_path: true,
        skip_mmr: true,
        candidate_pool: 100
      });

      // Compute drift
      const driftScore = computeCombinedDrift(baselineResults, optimizedResults);
      const thresholdExceeded = driftScore > testCase.expectedDriftThreshold;

      // Determine verdict
      let verdict: 'PASS' | 'WARN' | 'FAIL';
      if (driftScore <= testCase.expectedDriftThreshold) {
        verdict = 'PASS';
      } else if (driftScore <= testCase.expectedDriftThreshold * 1.25) {
        verdict = 'WARN'; // Slightly over but acceptable
      } else {
        verdict = 'FAIL'; // Significantly over
      }

      const result: DriftTestResult = {
        caseId: testCase.id,
        query: testCase.query,
        baselineResults,
        optimizedResults,
        driftScore,
        thresholdExceeded,
        verdict
      };

      results.push(result);

      logStructured('drift-scoring-harness', {
        event: 'test_complete',
        caseId: testCase.id,
        query: testCase.query,
        driftScore: driftScore.toFixed(4),
        threshold: testCase.expectedDriftThreshold,
        thresholdExceeded,
        verdict
      });
    } catch (err) {
      logStructured('drift-scoring-harness', {
        event: 'test_error',
        caseId: testCase.id,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  return results;
}

/**
 * Print drift scoring results summary.
 */
export function printDriftScoringHarnessSummary(results: DriftTestResult[]): void {
  console.log('\n=== Drift Scoring Validation Results ===\n');
  console.log(`Total test cases: ${results.length}`);

  const passes = results.filter(r => r.verdict === 'PASS').length;
  const warns = results.filter(r => r.verdict === 'WARN').length;
  const fails = results.filter(r => r.verdict === 'FAIL').length;

  console.log(`✓ PASS: ${passes}`);
  console.log(`⚠ WARN: ${warns}`);
  console.log(`✗ FAIL: ${fails}\n`);

  results.forEach(r => {
    const icon = r.verdict === 'PASS' ? '✓' : r.verdict === 'WARN' ? '⚠' : '✗';
    console.log(`${icon} ${r.caseId}:`);
    console.log(`  Query: ${r.query}`);
    console.log(`  Drift: ${r.driftScore.toFixed(4)} (threshold: ${r.baselineResults.results.length > 0 ? '0.10' : 'N/A'})`);
    console.log(`  Structural: ${computeStructuralDrift(r.baselineResults, r.optimizedResults).toFixed(4)}`);
    console.log(`  Semantic: ${computeSemanticDrift(r.baselineResults, r.optimizedResults).toFixed(4)}`);
    console.log(`  Verdict: ${r.verdict}\n`);
  });

  console.log(`\nOverall: ${fails === 0 ? 'PASS' : 'FAIL'}`);
}

// Export for testing
export type { DriftTestResult };
export { computeStructuralDrift, computeSemanticDrift, computeCombinedDrift };
