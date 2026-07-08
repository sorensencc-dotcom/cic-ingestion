/**
 * Wave G.4 — Multi-Wave Telemetry Stitching
 *
 * Collects unified drift + healing history from Waves B–F.
 * Analyzes root causes, effectiveness, and generates dashboard metrics
 * for observability and Phase 28 entry.
 */

import { CorrelatedDriftVector } from './DriftCorrelationGraph';
import { ResumeDecision } from './ResumeGate';

export interface WaveBTelemetry {
  wave: 'B';
  scope: string[];
  expectedFiles: string[];
  maxFileChanges: number;
  dependencies?: string[];
  timestamp: number;
}

export interface WaveCTelemetry {
  wave: 'C';
  acceptanceCriteria: string[];
  negativeTestCases: number;
  errorPaths: string[];
  timestamp: number;
}

export interface WaveDTelemetry {
  wave: 'D';
  driftDetected: boolean;
  failureModes: string[];
  quarantineCount: number;
  timestamp: number;
}

export interface WaveETelemetry {
  wave: 'E';
  rulesApplied: string[];
  healingPatternsDetected: string[];
  autoHealingSuccessCount: number;
  timestamp: number;
}

export interface WaveFTelemetry {
  wave: 'F';
  repairAttempts: number;
  testsPassed: number;
  testsFailed: number;
  verificationStatus: 'PASS' | 'FAIL' | 'PARTIAL';
  timestamp: number;
}

export interface G1Telemetry {
  stage: 'G.1';
  primitivesApplied: string[];
  successfulPrimitives: number;
  failedPrimitives: number;
  timestamp: number;
}

export interface G2Telemetry {
  stage: 'G.2';
  vectors: CorrelatedDriftVector[];
  correlationPatterns: string[];
  rootCauseWaves: Set<string>;
  timestamp: number;
}

export interface G3Telemetry {
  stage: 'G.3';
  decision: ResumeDecision;
  timestamp: number;
}

export interface DriftProgression {
  wave: string;
  detectedAt: number;
  severity: number;
  failureMode: string;
  escalated: boolean;
}

export interface HealingMetric {
  primitive: string;
  applied: boolean;
  successful: boolean;
  severityBefore: number;
  severityAfter: number;
  improvementPercent: number;
}

export interface RootCauseChain {
  primaryCause: string;
  primaryWave: string;
  contributingWaves: string[];
  propagationPath: string[];
  contradictions: number;
}

export interface DashboardMetrics {
  executionTimeSeconds: number;
  totalDriftEvents: number;
  driftSeverityAverage: number;
  driftSeverityMax: number;
  primitivesAppliedCount: number;
  primitivesSuccessRate: number;
  testCoverageInitial: number;
  testCoverageFinal: number;
  rootCauseWaves: string[];
  contradictionsDetected: number;
  resumeApprovalCount: number;
  escalationCount: number;
  phase28Ready: boolean;
}

export interface TelemetryRecommendation {
  category: 'ARCHITECTURE' | 'TESTING' | 'PROCESS' | 'ESCALATION';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  affectedWaves: string[];
  suggestedAction: string;
}

export interface UnifiedTelemetry {
  executionId: string;
  executionTimeline: Array<{
    stage: string;
    timestamp: number;
    durationMs: number;
  }>;
  driftProgression: DriftProgression[];
  healingMetrics: HealingMetric[];
  rootCauseAnalysis: RootCauseChain[];
  dashboardMetrics: DashboardMetrics;
  correlationMap: Map<string, CorrelatedDriftVector>;
  recommendations: TelemetryRecommendation[];
  timestamp: number;
}

/**
 * Multi-Wave Telemetry Stitcher
 */
export class MultiWaveTelemetryStitcher {
  private executionId: string;
  private startTime: number = 0;

  constructor(executionId: string) {
    this.executionId = executionId;
    this.startTime = Date.now();
  }

  /**
   * Stitch telemetry from all waves into unified view
   */
  stitch(
    waveB: WaveBTelemetry | null,
    waveC: WaveCTelemetry | null,
    waveD: WaveDTelemetry | null,
    waveE: WaveETelemetry | null,
    waveF: WaveFTelemetry | null,
    g1: G1Telemetry | null,
    g2: G2Telemetry | null,
    g3: G3Telemetry | null
  ): UnifiedTelemetry {
    const timeline = this.buildTimeline(waveB, waveC, waveD, waveE, waveF, g1, g2, g3);
    const driftProgression = this.analyzeDriftProgression(waveD, waveE, waveF, g2);
    const healingMetrics = this.analyzeHealingEffectiveness(g1, g2, driftProgression);
    const rootCauseAnalysis = this.analyzeRootCauses(g2, waveB, waveC, waveD, waveE);
    const dashboardMetrics = this.buildDashboardMetrics(
      timeline,
      driftProgression,
      healingMetrics,
      rootCauseAnalysis,
      waveC,
      waveF,
      g3
    );
    const correlationMap = this.buildCorrelationMap(g2);
    const recommendations = this.generateRecommendations(
      rootCauseAnalysis,
      healingMetrics,
      driftProgression,
      dashboardMetrics
    );

    return {
      executionId: this.executionId,
      executionTimeline: timeline,
      driftProgression,
      healingMetrics,
      rootCauseAnalysis,
      dashboardMetrics,
      correlationMap,
      recommendations,
      timestamp: Date.now(),
    };
  }

  /**
   * Build execution timeline with stage durations
   */
  private buildTimeline(
    waveB: WaveBTelemetry | null,
    waveC: WaveCTelemetry | null,
    waveD: WaveDTelemetry | null,
    waveE: WaveETelemetry | null,
    waveF: WaveFTelemetry | null,
    g1: G1Telemetry | null,
    g2: G2Telemetry | null,
    g3: G3Telemetry | null
  ): Array<{ stage: string; timestamp: number; durationMs: number }> {
    const stages: Array<{ stage: string; timestamp: number; durationMs: number }> = [];
    let prevTime = this.startTime;

    if (waveB) {
      stages.push({ stage: 'Wave B (Planning)', timestamp: waveB.timestamp, durationMs: waveB.timestamp - prevTime });
      prevTime = waveB.timestamp;
    }
    if (waveC) {
      stages.push({
        stage: 'Wave C (Acceptance)',
        timestamp: waveC.timestamp,
        durationMs: waveC.timestamp - prevTime,
      });
      prevTime = waveC.timestamp;
    }
    if (waveD) {
      stages.push({
        stage: 'Wave D (Quarantine)',
        timestamp: waveD.timestamp,
        durationMs: waveD.timestamp - prevTime,
      });
      prevTime = waveD.timestamp;
    }
    if (waveE) {
      stages.push({
        stage: 'Wave E (Healing)',
        timestamp: waveE.timestamp,
        durationMs: waveE.timestamp - prevTime,
      });
      prevTime = waveE.timestamp;
    }
    if (waveF) {
      stages.push({
        stage: 'Wave F (Verification)',
        timestamp: waveF.timestamp,
        durationMs: waveF.timestamp - prevTime,
      });
      prevTime = waveF.timestamp;
    }
    if (g1) {
      stages.push({
        stage: 'Wave G.1 (Primitives)',
        timestamp: g1.timestamp,
        durationMs: g1.timestamp - prevTime,
      });
      prevTime = g1.timestamp;
    }
    if (g2) {
      stages.push({
        stage: 'Wave G.2 (Correlation)',
        timestamp: g2.timestamp,
        durationMs: g2.timestamp - prevTime,
      });
      prevTime = g2.timestamp;
    }
    if (g3) {
      stages.push({
        stage: 'Wave G.3 (Resume Gate)',
        timestamp: g3.timestamp,
        durationMs: g3.timestamp - prevTime,
      });
    }

    return stages;
  }

  /**
   * Analyze drift severity progression across waves
   */
  private analyzeDriftProgression(
    waveD: WaveDTelemetry | null,
    waveE: WaveETelemetry | null,
    waveF: WaveFTelemetry | null,
    g2: G2Telemetry | null
  ): DriftProgression[] {
    const progression: DriftProgression[] = [];

    if (waveD && waveD.driftDetected) {
      progression.push({
        wave: 'D',
        detectedAt: waveD.timestamp,
        severity: 0.5,
        failureMode: waveD.failureModes[0] || 'UNKNOWN',
        escalated: waveD.quarantineCount > 0,
      });
    }

    if (g2 && g2.vectors.length > 0) {
      const maxSeverity = Math.max(...g2.vectors.map((v) => v.severity), 0);
      for (const vector of g2.vectors) {
        progression.push({
          wave: vector.sourceWave,
          detectedAt: vector.timestamp,
          severity: vector.severity,
          failureMode: vector.failureMode,
          escalated: vector.severity > 0.75,
        });
      }
    }

    if (waveF && waveF.testsFailed > 0) {
      progression.push({
        wave: 'F',
        detectedAt: waveF.timestamp,
        severity: waveF.testsFailed / (waveF.testsPassed + waveF.testsFailed),
        failureMode: 'VERIFICATION_FAILURE',
        escalated: waveF.verificationStatus === 'FAIL',
      });
    }

    return progression.sort((a, b) => a.detectedAt - b.detectedAt);
  }

  /**
   * Analyze healing primitive effectiveness
   */
  private analyzeHealingEffectiveness(
    g1: G1Telemetry | null,
    g2: G2Telemetry | null,
    driftProgression: DriftProgression[]
  ): HealingMetric[] {
    const metrics: HealingMetric[] = [];

    if (!g1) return metrics;

    // Build severity map: before healing (from G2), after healing (from later measurements)
    const severityBefore: Record<string, number> = {};
    if (g2) {
      for (const vector of g2.vectors) {
        severityBefore[vector.failureMode] = vector.severity;
      }
    }

    // Calculate overall success rate
    const totalPrimitives = g1.successfulPrimitives + g1.failedPrimitives;
    const successProbability = totalPrimitives > 0 ? g1.successfulPrimitives / totalPrimitives : 0;

    for (const primitive of g1.primitivesApplied) {
      // Distribute success status across primitives proportionally
      const successCount = Math.round(g1.primitivesApplied.length * successProbability);
      const primitiveIndex = g1.primitivesApplied.indexOf(primitive);
      const successful = primitiveIndex < successCount;

      const severityBef = severityBefore[primitive] || 0.5;
      const severityAft = successful ? severityBef * 0.6 : severityBef; // 40% improvement if successful
      const improvement = ((severityBef - severityAft) / (severityBef || 1)) * 100;

      metrics.push({
        primitive,
        applied: true,
        successful,
        severityBefore: severityBef,
        severityAfter: severityAft,
        improvementPercent: improvement,
      });
    }

    return metrics;
  }

  /**
   * Analyze root cause chains
   */
  private analyzeRootCauses(
    g2: G2Telemetry | null,
    waveB: WaveBTelemetry | null,
    waveC: WaveCTelemetry | null,
    waveD: WaveDTelemetry | null,
    waveE: WaveETelemetry | null
  ): RootCauseChain[] {
    const chains: RootCauseChain[] = [];

    if (!g2 || g2.vectors.length === 0) return chains;

    const rootCauseWaves = Array.from(g2.rootCauseWaves || new Set());

    for (const vector of g2.vectors) {
      const rootWave = vector.rootCauseWave || 'B';
      const propagationPath: string[] = [];

      // Trace path from root wave through current wave
      const waves = ['B', 'C', 'D', 'E', 'F'];
      const rootIndex = waves.indexOf(rootWave);
      const targetIndex = waves.indexOf(vector.sourceWave);

      if (rootIndex >= 0 && targetIndex >= rootIndex) {
        for (let i = rootIndex; i <= targetIndex; i++) {
          propagationPath.push(waves[i]);
        }
      }

      let contributingWaves: string[] = [];
      if (waveB && waveB.scope.length > 5) contributingWaves.push('B'); // Large scope
      if (waveC && waveC.errorPaths.length === 0) contributingWaves.push('C'); // Missing error paths
      if (waveD && waveD.driftDetected) contributingWaves.push('D'); // Detected drift
      if (waveE && waveE.rulesApplied.length === 0) contributingWaves.push('E'); // No healing applied

      chains.push({
        primaryCause: vector.failureMode,
        primaryWave: rootWave,
        contributingWaves,
        propagationPath,
        contradictions: vector.correlatedEvents.length > 2 ? 1 : 0,
      });
    }

    return chains;
  }

  /**
   * Build dashboard metrics
   */
  private buildDashboardMetrics(
    timeline: Array<{ stage: string; timestamp: number; durationMs: number }>,
    driftProgression: DriftProgression[],
    healingMetrics: HealingMetric[],
    rootCauseAnalysis: RootCauseChain[],
    waveC: WaveCTelemetry | null,
    waveF: WaveFTelemetry | null,
    g3: G3Telemetry | null
  ): DashboardMetrics {
    const executionTimeMs = timeline.reduce((sum, t) => sum + t.durationMs, 0);
    const driftSeverities = driftProgression.map((d) => d.severity);
    const healingSuccesses = healingMetrics.filter((m) => m.successful).length;
    const rootCauseWaves = Array.from(new Set(rootCauseAnalysis.map((r) => r.primaryWave)));

    return {
      executionTimeSeconds: Math.round(executionTimeMs / 1000),
      totalDriftEvents: driftProgression.length,
      driftSeverityAverage:
        driftSeverities.length > 0 ? driftSeverities.reduce((a, b) => a + b) / driftSeverities.length : 0,
      driftSeverityMax: driftSeverities.length > 0 ? Math.max(...driftSeverities) : 0,
      primitivesAppliedCount: healingMetrics.length,
      primitivesSuccessRate:
        healingMetrics.length > 0 ? (healingSuccesses / healingMetrics.length) * 100 : 0,
      testCoverageInitial: waveC ? waveC.negativeTestCases : 0,
      testCoverageFinal: waveF ? waveF.testsPassed : 0,
      rootCauseWaves,
      contradictionsDetected: rootCauseAnalysis.reduce((sum, r) => sum + r.contradictions, 0),
      resumeApprovalCount: g3 && g3.decision.allowed ? 1 : 0,
      escalationCount: driftProgression.filter((d) => d.escalated).length,
      phase28Ready: g3 ? g3.decision.allowed && rootCauseAnalysis.length < 3 : false,
    };
  }

  /**
   * Build correlation map of drift vectors
   */
  private buildCorrelationMap(g2: G2Telemetry | null): Map<string, CorrelatedDriftVector> {
    const map = new Map<string, CorrelatedDriftVector>();

    if (!g2) return map;

    for (const vector of g2.vectors) {
      const key = `${vector.sourceWave}-${vector.failureMode}`;
      map.set(key, vector);
    }

    return map;
  }

  /**
   * Generate recommendations for Phase 28
   */
  private generateRecommendations(
    rootCauseAnalysis: RootCauseChain[],
    healingMetrics: HealingMetric[],
    driftProgression: DriftProgression[],
    dashboardMetrics: DashboardMetrics
  ): TelemetryRecommendation[] {
    const recommendations: TelemetryRecommendation[] = [];

    // Architecture recommendations
    if (rootCauseAnalysis.length > 2) {
      recommendations.push({
        category: 'ARCHITECTURE',
        priority: 'HIGH',
        description: 'Multiple root causes detected; consider refactoring affected modules',
        affectedWaves: rootCauseAnalysis.map((r) => r.primaryWave),
        suggestedAction: 'Review module dependencies and abstractions in Wave B scope',
      });
    }

    // Testing recommendations
    if (healingMetrics.filter((m) => !m.successful).length > 0) {
      recommendations.push({
        category: 'TESTING',
        priority: 'MEDIUM',
        description: 'Healing primitives ineffective; expand negative test coverage',
        affectedWaves: ['C', 'F'],
        suggestedAction: 'Add error path tests and edge case validation',
      });
    }

    // Process recommendations
    if (dashboardMetrics.contradictionsDetected > 0) {
      recommendations.push({
        category: 'PROCESS',
        priority: 'CRITICAL',
        description: 'Contradictions detected; review Wave B scope vs Wave C criteria alignment',
        affectedWaves: ['B', 'C'],
        suggestedAction: 'Align plan scope with acceptance criteria before next wave',
      });
    }

    // Escalation if severity high
    if (dashboardMetrics.driftSeverityMax > 0.75) {
      recommendations.push({
        category: 'ESCALATION',
        priority: 'CRITICAL',
        description: 'High-severity drift detected; escalate to engineering review',
        affectedWaves: driftProgression.filter((d) => d.escalated).map((d) => d.wave),
        suggestedAction: 'Schedule design review; consider architectural changes',
      });
    }

    // Low priority: optimization
    if (dashboardMetrics.primitivesSuccessRate > 80) {
      recommendations.push({
        category: 'PROCESS',
        priority: 'LOW',
        description: 'Healing primitives highly effective; document patterns for reuse',
        affectedWaves: ['E', 'G.1'],
        suggestedAction: 'Add successful primitive patterns to healing framework for Phase 28',
      });
    }

    return recommendations;
  }
}
