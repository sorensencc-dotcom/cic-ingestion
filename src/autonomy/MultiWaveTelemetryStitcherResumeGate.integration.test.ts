import {
  MultiWaveTelemetryStitcher,
  WaveBTelemetry,
  WaveCTelemetry,
  WaveDTelemetry,
  WaveETelemetry,
  WaveFTelemetry,
  G1Telemetry,
  G2Telemetry,
  G3Telemetry,
} from './MultiWaveTelemetryStitcher.ts';
import {
  ResumeGate,
  RevisedPlan,
  RevisedCriteria,
} from './ResumeGate.ts';
import { CorrelatedDriftVector } from './DriftCorrelationGraph.ts';

describe('MultiWaveTelemetryStitcher + ResumeGate Integration', () => {
  let stitcher: MultiWaveTelemetryStitcher;
  let resumeGate: ResumeGate;

  beforeEach(() => {
    stitcher = new MultiWaveTelemetryStitcher('exec-integration-test-001');
    resumeGate = new ResumeGate();
  });

  it('handles mid-stitch wave interruption, ResumeGate evaluation, and seamless resumed telemetry stitching without duplicates or missing segments', () => {
    const now = Date.now();

    // 1. Telemetry from initial waves B, C, D
    const waveB: WaveBTelemetry = {
      wave: 'B',
      scope: ['src/autonomy'],
      expectedFiles: ['src/autonomy/ExecutionPolicy.ts'],
      maxFileChanges: 3,
      timestamp: now + 100,
    };

    const waveC: WaveCTelemetry = {
      wave: 'C',
      acceptanceCriteria: ['Must handle drift gracefully in src/autonomy'],
      negativeTestCases: 2,
      errorPaths: ['invalid_input', 'timeout'],
      timestamp: now + 200,
    };

    const waveD: WaveDTelemetry = {
      wave: 'D',
      driftDetected: true,
      failureModes: ['WRONG_ABSTRACTION'],
      quarantineCount: 0,
      timestamp: now + 300,
    };

    // 2. Wave interrupted partway: Drift detected at Wave D, ResumeGate evaluates readiness to resume
    const driftVectors: CorrelatedDriftVector[] = [
      {
        sourceWave: 'D',
        failureMode: 'WRONG_ABSTRACTION',
        severity: 0.35,
        correlatedEvents: [],
        recommendedPrimitives: ['heal.require_abstraction_step'],
        confidence: 0.8,
        description: 'Duplicated logic detected during Wave D check',
        timestamp: now + 310,
      },
    ];

    const revisedPlan: RevisedPlan = {
      wave: 'D',
      scope: ['src/autonomy'],
      expectedFiles: ['src/autonomy/ExecutionPolicy.ts'],
      maxFileChanges: 3,
      timestamp: now + 320,
    };

    const revisedCriteria: RevisedCriteria = {
      acceptanceCriteria: ['src/autonomy module shared logic extracted'],
      negativeTestCases: 3,
      errorPaths: ['invalid_input', 'timeout', 'duplication_error'],
      dependencyJustifications: {},
      timestamp: now + 325,
    };

    const appliedPrimitives = ['heal.require_abstraction_step'];

    const decision = resumeGate.evaluate(driftVectors, revisedPlan, revisedCriteria, appliedPrimitives);

    expect(decision.allowed).toBe(true);
    expect(decision.driftClassification).toBe('SOFT');
    expect(decision.failedConditions).toEqual([]);

    // 3. Post-resume telemetry collection (Wave E, F, G1, G2, G3)
    const waveE: WaveETelemetry = {
      wave: 'E',
      rulesApplied: ['heal.require_abstraction_step'],
      healingPatternsDetected: ['WRONG_ABSTRACTION_HEALED'],
      autoHealingSuccessCount: 1,
      timestamp: now + 400,
    };

    const waveF: WaveFTelemetry = {
      wave: 'F',
      repairAttempts: 1,
      testsPassed: 15,
      testsFailed: 0,
      verificationStatus: 'PASS',
      timestamp: now + 500,
    };

    const g1: G1Telemetry = {
      stage: 'G.1',
      primitivesApplied: ['heal.require_abstraction_step'],
      successfulPrimitives: 1,
      failedPrimitives: 0,
      timestamp: now + 600,
    };

    const g2: G2Telemetry = {
      stage: 'G.2',
      vectors: driftVectors,
      correlationPatterns: [],
      rootCauseWaves: new Set(['D']),
      timestamp: now + 700,
    };

    const g3: G3Telemetry = {
      stage: 'G.3',
      decision,
      timestamp: now + 800,
    };

    // 4. Stitch complete telemetry
    const unified = stitcher.stitch(waveB, waveC, waveD, waveE, waveF, g1, g2, g3);

    // 5. Verification of stitched output
    expect(unified.executionId).toBe('exec-integration-test-001');

    // Timeline verification: all 8 stages present, in sequential timestamp order, NO missing or duplicate stages
    const stageNames = unified.executionTimeline.map((t) => t.stage);
    expect(stageNames).toEqual([
      'Wave B (Planning)',
      'Wave C (Acceptance)',
      'Wave D (Quarantine)',
      'Wave E (Healing)',
      'Wave F (Verification)',
      'Wave G.1 (Primitives)',
      'Wave G.2 (Correlation)',
      'Wave G.3 (Resume Gate)',
    ]);

    // Ensure no duplicate stage names exist
    const uniqueStages = new Set(stageNames);
    expect(uniqueStages.size).toBe(stageNames.length);

    // Dashboard metrics check
    expect(unified.dashboardMetrics.resumeApprovalCount).toBe(1);
    expect(unified.dashboardMetrics.phase28Ready).toBe(true);
    expect(unified.dashboardMetrics.testCoverageFinal).toBe(15);
    expect(unified.dashboardMetrics.totalDriftEvents).toBeGreaterThan(0);
  });
});
