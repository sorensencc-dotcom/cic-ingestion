/**
 * Orchestrate all Phase 5 validation harnesses.
 * Runs MAAL routing, CIC ingestion, drift scoring in sequence.
 * Generates JSON report for canary rollout decision.
 *
 * File: runAllHarnesses.ts
 * Date: 2026-07-02
 * Semver: 1.0.0
 */

import { runMaalRoutingReplay, printMaalRoutingReplaySummary } from './maalRoutingReplay.js';
import { runCicIngestionReplay, printCicIngestionReplaySummary } from './cicIngestionReplay.js';
import { runDriftScoringHarness, printDriftScoringHarnessSummary } from './driftScoringHarness.js';
import { logStructured } from '../../lib/log.js';
import * as fs from 'fs';

interface HarnessReport {
  timestamp: string;
  phase: string;
  summary: {
    maalRouting: {
      passCount: number;
      failCount: number;
      avgDriftScore: number;
      verdict: 'PASS' | 'FAIL';
    };
    cicIngestion: {
      docCount: number;
      topMatchCount: number;
      fastPathWins: number;
      verdict: 'PASS' | 'FAIL';
    };
    driftScoring: {
      passCount: number;
      warnCount: number;
      failCount: number;
      verdict: 'PASS' | 'WARN' | 'FAIL';
    };
  };
  canaryGate: {
    approved: boolean;
    reason: string;
    nextStep: string;
  };
}

async function checkTorqueQueryHealth(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:8000/health', { timeout: 5000 } as any);
    return response.ok;
  } catch (err) {
    logStructured('harness-orchestrator', {
      event: 'health_check_failed',
      error: err instanceof Error ? err.message : String(err)
    });
    return false;
  }
}

export async function runAllHarnesses(): Promise<HarnessReport> {
  const timestamp = new Date().toISOString();

  logStructured('harness-orchestrator', {
    event: 'phase_5_validation_start',
    timestamp
  });

  // Health check
  const torqueQueryHealthy = await checkTorqueQueryHealth();
  if (!torqueQueryHealthy) {
    throw new Error('TorqueQuery v2 /health endpoint not responding. Deploy with: cd cic-ingestion/src/services/torquequery && python TorqueQueryV2Server.py');
  }

  logStructured('harness-orchestrator', {
    event: 'torque_query_healthy',
    timestamp
  });

  // Run MAAL routing replay
  console.log('\n[1/3] Running MAAL Routing Replay...\n');
  const maalResults = await runMaalRoutingReplay();
  printMaalRoutingReplaySummary(maalResults);

  const maalPasses = maalResults.filter(r => r.driftScore <= 0.2).length;
  const maalAvgDrift = maalResults.reduce((sum, r) => sum + r.driftScore, 0) / maalResults.length;
  const maalVerdict = maalResults.every(r => r.driftScore <= 0.2) ? 'PASS' : 'FAIL';

  // Run CIC ingestion replay
  console.log('\n[2/3] Running CIC Ingestion Replay...\n');
  const cicResults = await runCicIngestionReplay();
  printCicIngestionReplaySummary(cicResults);

  const cicMatches = cicResults.filter(r => r.topResultMatch).length;
  const cicFastWins = cicResults.filter(r => r.latencyDiff < 0).length;
  const cicVerdict = cicFastWins >= cicResults.length * 0.6 ? 'PASS' : 'FAIL';

  // Run drift scoring harness
  console.log('\n[3/3] Running Drift Scoring Harness...\n');
  const driftResults = await runDriftScoringHarness();
  printDriftScoringHarnessSummary(driftResults);

  const driftPasses = driftResults.filter(r => r.verdict === 'PASS').length;
  const driftWarns = driftResults.filter(r => r.verdict === 'WARN').length;
  const driftFails = driftResults.filter(r => r.verdict === 'FAIL').length;
  const driftVerdict = driftFails === 0 ? 'PASS' : 'FAIL';

  // Canary gate decision
  const allPass = maalVerdict === 'PASS' && cicVerdict === 'PASS' && driftVerdict === 'PASS';
  const canaryApproved = allPass;
  const canaryReason = allPass
    ? 'All harnesses PASS. Phase 4 schema valid, determinism verified, latency improved.'
    : `Failures: MAAL=${maalVerdict}, CIC=${cicVerdict}, Drift=${driftVerdict}. Investigate before canary.`;

  const report: HarnessReport = {
    timestamp,
    phase: 'Phase 5 (TorqueQuery v2 + Cloud Gateway)',
    summary: {
      maalRouting: {
        passCount: maalPasses,
        failCount: maalResults.length - maalPasses,
        avgDriftScore: maalAvgDrift,
        verdict: maalVerdict as 'PASS' | 'FAIL'
      },
      cicIngestion: {
        docCount: cicResults.length,
        topMatchCount: cicMatches,
        fastPathWins: cicFastWins,
        verdict: cicVerdict as 'PASS' | 'FAIL'
      },
      driftScoring: {
        passCount: driftPasses,
        warnCount: driftWarns,
        failCount: driftFails,
        verdict: driftVerdict as 'PASS' | 'WARN' | 'FAIL'
      }
    },
    canaryGate: {
      approved: canaryApproved,
      reason: canaryReason,
      nextStep: canaryApproved
        ? 'Proceed to Canary A (10%) with monitoring gates.'
        : 'Fix failing harnesses, re-run validation.'
    }
  };

  // Log report
  logStructured('harness-orchestrator', {
    event: 'phase_5_validation_complete',
    canaryGate: report.canaryGate,
    maalVerdict,
    cicVerdict,
    driftVerdict
  });

  // Write report to JSON
  const reportPath = './phase-5-harness-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n✅ Report written to ${reportPath}\n`);

  return report;
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllHarnesses()
    .then(report => {
      console.log('\n=== PHASE 5 VALIDATION SUMMARY ===\n');
      console.log(`Timestamp: ${report.timestamp}`);
      console.log(`Phase: ${report.phase}`);
      console.log(`Canary Gate: ${report.canaryGate.approved ? '✅ APPROVED' : '❌ BLOCKED'}`);
      console.log(`Reason: ${report.canaryGate.reason}`);
      console.log(`Next: ${report.canaryGate.nextStep}\n`);
      process.exit(report.canaryGate.approved ? 0 : 1);
    })
    .catch(err => {
      console.error('❌ Harness orchestration failed:', err.message);
      process.exit(1);
    });
}

export type { HarnessReport };
