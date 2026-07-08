import { MultiWaveTelemetryStitcher } from './MultiWaveTelemetryStitcher';

describe('MultiWaveTelemetryStitcher', () => {
  let stitcher: MultiWaveTelemetryStitcher;
  const now = Date.now();

  beforeEach(() => {
    stitcher = new MultiWaveTelemetryStitcher('exec-001');
  });

  describe('Data Collection', () => {
    it('collects telemetry from all waves', () => {
      const waveB = {
        wave: 'B' as const,
        scope: ['src/auth', 'src/db'],
        expectedFiles: ['auth.ts', 'db.ts'],
        maxFileChanges: 5,
        timestamp: now,
      };
      const waveC = {
        wave: 'C' as const,
        acceptanceCriteria: ['Auth tokens work', 'DB connection pooled'],
        negativeTestCases: 3,
        errorPaths: ['invalid_token', 'connection_timeout'],
        timestamp: now + 1000,
      };

      const result = stitcher.stitch(waveB, waveC, null, null, null, null, null, null);

      expect(result.executionTimeline).toHaveLength(2);
      expect(result.executionTimeline[0].stage).toBe('Wave B (Planning)');
      expect(result.executionTimeline[1].stage).toBe('Wave C (Acceptance)');
    });

    it('handles missing wave data gracefully', () => {
      const waveB = {
        wave: 'B' as const,
        scope: ['src/auth'],
        expectedFiles: ['auth.ts'],
        maxFileChanges: 5,
        timestamp: now,
      };

      const result = stitcher.stitch(waveB, null, null, null, null, null, null, null);

      expect(result.executionTimeline).toHaveLength(1);
      expect(result.driftProgression).toHaveLength(0);
    });

    it('handles null wave data', () => {
      const result = stitcher.stitch(null, null, null, null, null, null, null, null);

      expect(result.executionTimeline).toHaveLength(0);
      expect(result.driftProgression).toHaveLength(0);
      expect(result.healingMetrics).toHaveLength(0);
    });

    it('processes G.2 drift vectors correctly', () => {
      const g2 = {
        stage: 'G.2' as const,
        vectors: [
          {
            sourceWave: 'D' as const,
            failureMode: 'KITCHEN_SINK' as const,
            severity: 0.8,
            rootCauseWave: 'B' as const,
            correlatedEvents: [],
            recommendedPrimitives: ['consolidate_scope'],
            confidence: 0.85,
            description: 'Scope creep',
            timestamp: now + 5000,
          },
        ],
        correlationPatterns: [],
        rootCauseWaves: new Set(['B']),
        timestamp: now + 5000,
      };

      const result = stitcher.stitch(null, null, null, null, null, null, g2, null);

      expect(result.driftProgression).toHaveLength(1);
      expect(result.driftProgression[0].failureMode).toBe('KITCHEN_SINK');
      expect(result.driftProgression[0].severity).toBe(0.8);
    });

    it('processes G.1 healing primitives correctly', () => {
      const g1 = {
        stage: 'G.1' as const,
        primitivesApplied: ['consolidate_scope', 'fix_abstraction'],
        successfulPrimitives: 1,
        failedPrimitives: 1,
        timestamp: now + 4000,
      };

      const result = stitcher.stitch(null, null, null, null, null, g1, null, null);

      expect(result.healingMetrics).toHaveLength(2);
      expect(result.healingMetrics[0].applied).toBe(true);
    });

    it('builds execution timeline with durations', () => {
      const waveB = {
        wave: 'B' as const,
        scope: ['src'],
        expectedFiles: ['a.ts'],
        maxFileChanges: 1,
        timestamp: now + 1000,
      };
      const waveC = {
        wave: 'C' as const,
        acceptanceCriteria: ['works'],
        negativeTestCases: 1,
        errorPaths: [],
        timestamp: now + 3000,
      };

      const result = stitcher.stitch(waveB, waveC, null, null, null, null, null, null);

      expect(result.executionTimeline[0].durationMs).toBeLessThanOrEqual(1000);
      expect(result.executionTimeline[1].durationMs).toBeLessThanOrEqual(2000);
    });

    it('processes Wave F verification results', () => {
      const waveF = {
        wave: 'F' as const,
        repairAttempts: 3,
        testsPassed: 15,
        testsFailed: 2,
        verificationStatus: 'PARTIAL' as const,
        timestamp: now + 6000,
      };

      const result = stitcher.stitch(null, null, null, null, waveF, null, null, null);

      expect(result.dashboardMetrics.testCoverageFinal).toBe(15);
      expect(result.dashboardMetrics.escalationCount).toBe(0); // PARTIAL is not escalated
    });

    it('processes G.3 Resume Decision', () => {
      const g3 = {
        stage: 'G.3' as const,
        decision: {
          allowed: true,
          driftClassification: 'SOFT' as const,
          severity: 0.4,
          conditions: [],
          failedConditions: [],
          contradictions: [],
          requiredApprovals: [],
          reasoning: 'Ready to resume',
          timestamp: now + 7000,
        },
        timestamp: now + 7000,
      };

      const result = stitcher.stitch(null, null, null, null, null, null, null, g3);

      expect(result.dashboardMetrics.resumeApprovalCount).toBe(1);
    });
  });

  describe('Telemetry Stitching', () => {
    it('stitches full wave B→F flow', () => {
      const waveB = {
        wave: 'B' as const,
        scope: ['src/module'],
        expectedFiles: ['mod.ts'],
        maxFileChanges: 3,
        timestamp: now + 1000,
      };
      const waveC = {
        wave: 'C' as const,
        acceptanceCriteria: ['test1', 'test2'],
        negativeTestCases: 2,
        errorPaths: ['err1'],
        timestamp: now + 2000,
      };
      const waveD = {
        wave: 'D' as const,
        driftDetected: true,
        failureModes: ['WRONG_ABSTRACTION'],
        quarantineCount: 1,
        timestamp: now + 3000,
      };
      const waveE = {
        wave: 'E' as const,
        rulesApplied: ['rule_1'],
        healingPatternsDetected: ['pattern_1'],
        autoHealingSuccessCount: 1,
        timestamp: now + 4000,
      };
      const waveF = {
        wave: 'F' as const,
        repairAttempts: 1,
        testsPassed: 10,
        testsFailed: 0,
        verificationStatus: 'PASS' as const,
        timestamp: now + 5000,
      };

      const result = stitcher.stitch(waveB, waveC, waveD, waveE, waveF, null, null, null);

      expect(result.executionTimeline).toHaveLength(5);
      expect(result.executionTimeline[0].stage).toBe('Wave B (Planning)');
      expect(result.executionTimeline[4].stage).toBe('Wave F (Verification)');
    });

    it('correlates drift across waves', () => {
      const waveD = {
        wave: 'D' as const,
        driftDetected: true,
        failureModes: ['OPTIMISTIC_PATH'],
        quarantineCount: 2,
        timestamp: now + 3000,
      };
      const g2 = {
        stage: 'G.2' as const,
        vectors: [
          {
            sourceWave: 'E' as const,
            failureMode: 'OPTIMISTIC_PATH' as const,
            severity: 0.45,
            rootCauseWave: 'C' as const,
            correlatedEvents: [],
            recommendedPrimitives: ['add_error_handling'],
            confidence: 0.8,
            description: 'Missing error path',
            timestamp: now + 4500,
          },
        ],
        correlationPatterns: ['C→E:dependency_creep'],
        rootCauseWaves: new Set(['C']),
        timestamp: now + 4500,
      };

      const result = stitcher.stitch(null, null, waveD, null, null, null, g2, null);

      expect(result.driftProgression.length).toBeGreaterThan(0);
      expect(result.rootCauseAnalysis.length).toBeGreaterThan(0);
    });

    it('maps drift vectors to correlation map', () => {
      const g2 = {
        stage: 'G.2' as const,
        vectors: [
          {
            sourceWave: 'D' as const,
            failureMode: 'KITCHEN_SINK' as const,
            severity: 0.6,
            correlatedEvents: [],
            recommendedPrimitives: [],
            confidence: 0.8,
            description: 'test',
            timestamp: now,
          },
          {
            sourceWave: 'E' as const,
            failureMode: 'RUNAWAY_REFACTOR' as const,
            severity: 0.7,
            correlatedEvents: [],
            recommendedPrimitives: [],
            confidence: 0.75,
            description: 'test',
            timestamp: now,
          },
        ],
        correlationPatterns: [],
        rootCauseWaves: new Set(),
        timestamp: now,
      };

      const result = stitcher.stitch(null, null, null, null, null, null, g2, null);

      expect(result.correlationMap.size).toBe(2);
      expect(result.correlationMap.has('D-KITCHEN_SINK')).toBe(true);
      expect(result.correlationMap.has('E-RUNAWAY_REFACTOR')).toBe(true);
    });

    it('tracks healing effectiveness metrics', () => {
      const g1 = {
        stage: 'G.1' as const,
        primitivesApplied: ['fix1', 'fix2', 'fix3'],
        successfulPrimitives: 2,
        failedPrimitives: 1,
        timestamp: now + 4000,
      };
      const g2 = {
        stage: 'G.2' as const,
        vectors: [
          {
            sourceWave: 'D' as const,
            failureMode: 'WRONG_ABSTRACTION' as const,
            severity: 0.5,
            correlatedEvents: [],
            recommendedPrimitives: ['fix1', 'fix2'],
            confidence: 0.85,
            description: 'test',
            timestamp: now + 3000,
          },
        ],
        correlationPatterns: [],
        rootCauseWaves: new Set(),
        timestamp: now + 3000,
      };

      const result = stitcher.stitch(null, null, null, null, null, g1, g2, null);

      expect(result.healingMetrics.length).toBeGreaterThan(0);
      expect(result.dashboardMetrics.primitivesAppliedCount).toBe(3);
    });
  });

  describe('Root Cause Analysis', () => {
    it('identifies single root cause wave', () => {
      const g2 = {
        stage: 'G.2' as const,
        vectors: [
          {
            sourceWave: 'E' as const,
            failureMode: 'KITCHEN_SINK' as const,
            severity: 0.7,
            rootCauseWave: 'B' as const,
            correlatedEvents: [
              {
                wave: 'B' as const,
                failureMode: 'KITCHEN_SINK' as const,
                severity: 'HIGH' as const,
                details: {},
                timestamp: now + 1000,
              },
            ],
            recommendedPrimitives: [],
            confidence: 0.9,
            description: 'Scope creep from planning',
            timestamp: now,
          },
        ],
        correlationPatterns: [],
        rootCauseWaves: new Set(['B']),
        timestamp: now,
      };

      const result = stitcher.stitch(null, null, null, null, null, null, g2, null);

      expect(result.rootCauseAnalysis.length).toBe(1);
      expect(result.rootCauseAnalysis[0].primaryWave).toBe('B');
      expect(result.rootCauseAnalysis[0].primaryCause).toBe('KITCHEN_SINK');
    });

    it('traces propagation path through waves', () => {
      const g2 = {
        stage: 'G.2' as const,
        vectors: [
          {
            sourceWave: 'F' as const,
            failureMode: 'RUNAWAY_REFACTOR' as const,
            severity: 0.8,
            rootCauseWave: 'C' as const,
            correlatedEvents: [],
            recommendedPrimitives: [],
            confidence: 0.85,
            description: 'Refactor cascaded from criteria',
            timestamp: now,
          },
        ],
        correlationPatterns: [],
        rootCauseWaves: new Set(['C']),
        timestamp: now,
      };

      const result = stitcher.stitch(null, null, null, null, null, null, g2, null);

      expect(result.rootCauseAnalysis[0].propagationPath).toContain('C');
      expect(result.rootCauseAnalysis[0].propagationPath).toContain('F');
    });

    it('identifies contributing waves beyond root cause', () => {
      const waveB = {
        wave: 'B' as const,
        scope: ['a', 'b', 'c', 'd', 'e', 'f'], // Large scope
        expectedFiles: ['a.ts', 'b.ts', 'c.ts'],
        maxFileChanges: 10,
        timestamp: now + 1000,
      };
      const waveC = {
        wave: 'C' as const,
        acceptanceCriteria: ['test'],
        negativeTestCases: 1,
        errorPaths: [], // No error paths
        timestamp: now + 2000,
      };
      const waveD = {
        wave: 'D' as const,
        driftDetected: true,
        failureModes: ['WRONG_ABSTRACTION'],
        quarantineCount: 1,
        timestamp: now + 3000,
      };
      const g2 = {
        stage: 'G.2' as const,
        vectors: [
          {
            sourceWave: 'D' as const,
            failureMode: 'WRONG_ABSTRACTION' as const,
            severity: 0.5,
            rootCauseWave: 'B' as const,
            correlatedEvents: [],
            recommendedPrimitives: [],
            confidence: 0.8,
            description: 'test',
            timestamp: now,
          },
        ],
        correlationPatterns: [],
        rootCauseWaves: new Set(['B']),
        timestamp: now,
      };

      const result = stitcher.stitch(waveB, waveC, waveD, null, null, null, g2, null);

      expect(result.rootCauseAnalysis.length).toBeGreaterThan(0);
      const chain = result.rootCauseAnalysis[0];
      expect(chain.contributingWaves).toContain('B'); // Large scope
      expect(chain.contributingWaves).toContain('C'); // No error paths
      expect(chain.contributingWaves).toContain('D'); // Detected drift
    });

    it('counts contradictions in analysis', () => {
      const g2 = {
        stage: 'G.2' as const,
        vectors: [
          {
            sourceWave: 'D' as const,
            failureMode: 'KITCHEN_SINK' as const,
            severity: 0.6,
            rootCauseWave: 'B' as const,
            correlatedEvents: [
              {
                wave: 'B' as const,
                failureMode: 'KITCHEN_SINK' as const,
                severity: 'HIGH' as const,
                details: {},
                timestamp: now,
              },
              {
                wave: 'C' as const,
                failureMode: 'WRONG_ABSTRACTION' as const,
                severity: 'MEDIUM' as const,
                details: {},
                timestamp: now,
              },
              {
                wave: 'D' as const,
                failureMode: 'OPTIMISTIC_PATH' as const,
                severity: 'MEDIUM' as const,
                details: {},
                timestamp: now,
              },
            ],
            recommendedPrimitives: [],
            confidence: 0.7,
            description: 'Multiple modes',
            timestamp: now,
          },
        ],
        correlationPatterns: [],
        rootCauseWaves: new Set(['B']),
        timestamp: now,
      };

      const result = stitcher.stitch(null, null, null, null, null, null, g2, null);

      expect(result.rootCauseAnalysis[0].contradictions).toBe(1);
    });
  });

  describe('Dashboard Metrics', () => {
    it('computes execution time from timeline', () => {
      const waveB = {
        wave: 'B' as const,
        scope: ['src'],
        expectedFiles: ['a.ts'],
        maxFileChanges: 1,
        timestamp: now + 1000,
      };
      const waveF = {
        wave: 'F' as const,
        repairAttempts: 1,
        testsPassed: 10,
        testsFailed: 0,
        verificationStatus: 'PASS' as const,
        timestamp: now + 6000,
      };

      const result = stitcher.stitch(waveB, null, null, null, waveF, null, null, null);

      expect(result.dashboardMetrics.executionTimeSeconds).toBeGreaterThan(0);
      expect(result.dashboardMetrics.executionTimeSeconds).toBeLessThanOrEqual(10); // ~5 sec + overhead
    });

    it('calculates drift severity statistics', () => {
      const g2 = {
        stage: 'G.2' as const,
        vectors: [
          {
            sourceWave: 'D' as const,
            failureMode: 'KITCHEN_SINK' as const,
            severity: 0.8,
            correlatedEvents: [],
            recommendedPrimitives: [],
            confidence: 0.8,
            description: '',
            timestamp: now,
          },
          {
            sourceWave: 'E' as const,
            failureMode: 'WRONG_ABSTRACTION' as const,
            severity: 0.4,
            correlatedEvents: [],
            recommendedPrimitives: [],
            confidence: 0.75,
            description: '',
            timestamp: now,
          },
        ],
        correlationPatterns: [],
        rootCauseWaves: new Set(),
        timestamp: now,
      };

      const result = stitcher.stitch(null, null, null, null, null, null, g2, null);

      expect(result.dashboardMetrics.driftSeverityMax).toBe(0.8);
      expect(result.dashboardMetrics.driftSeverityAverage).toBeCloseTo(0.6, 5);
      expect(result.dashboardMetrics.totalDriftEvents).toBe(2);
    });

    it('calculates primitive success rate', () => {
      const g1 = {
        stage: 'G.1' as const,
        primitivesApplied: ['p1', 'p2', 'p3', 'p4', 'p5'],
        successfulPrimitives: 4,
        failedPrimitives: 1,
        timestamp: now,
      };

      const result = stitcher.stitch(null, null, null, null, null, g1, null, null);

      expect(result.dashboardMetrics.primitivesAppliedCount).toBe(5);
      expect(result.dashboardMetrics.primitivesSuccessRate).toBe(80);
    });

    it('counts escalation events', () => {
      const waveD = {
        wave: 'D' as const,
        driftDetected: true,
        failureModes: ['RUNAWAY_REFACTOR'],
        quarantineCount: 5,
        timestamp: now + 3000,
      };
      const g2 = {
        stage: 'G.2' as const,
        vectors: [
          {
            sourceWave: 'D' as const,
            failureMode: 'RUNAWAY_REFACTOR' as const,
            severity: 0.9, // High, should be escalated
            correlatedEvents: [],
            recommendedPrimitives: [],
            confidence: 0.85,
            description: '',
            timestamp: now,
          },
        ],
        correlationPatterns: [],
        rootCauseWaves: new Set(),
        timestamp: now,
      };

      const result = stitcher.stitch(null, null, waveD, null, null, null, g2, null);

      expect(result.dashboardMetrics.escalationCount).toBeGreaterThan(0);
    });

    it('determines Phase 28 readiness', () => {
      const g3 = {
        stage: 'G.3' as const,
        decision: {
          allowed: true,
          driftClassification: 'SOFT' as const,
          severity: 0.3,
          conditions: [],
          failedConditions: [],
          contradictions: [],
          requiredApprovals: [],
          reasoning: 'Ready',
          timestamp: now,
        },
        timestamp: now,
      };
      const g2 = {
        stage: 'G.2' as const,
        vectors: [
          {
            sourceWave: 'D' as const,
            failureMode: 'WRONG_ABSTRACTION' as const,
            severity: 0.4,
            correlatedEvents: [],
            recommendedPrimitives: [],
            confidence: 0.8,
            description: '',
            timestamp: now,
          },
        ],
        correlationPatterns: [],
        rootCauseWaves: new Set(['C']),
        timestamp: now,
      };

      const result = stitcher.stitch(null, null, null, null, null, null, g2, g3);

      expect(result.dashboardMetrics.phase28Ready).toBe(true);
    });
  });

  describe('Recommendations', () => {
    it('recommends architecture review for multiple root causes', () => {
      const g2 = {
        stage: 'G.2' as const,
        vectors: [
          {
            sourceWave: 'D' as const,
            failureMode: 'KITCHEN_SINK' as const,
            severity: 0.6,
            rootCauseWave: 'B' as const,
            correlatedEvents: [],
            recommendedPrimitives: [],
            confidence: 0.8,
            description: '',
            timestamp: now,
          },
          {
            sourceWave: 'E' as const,
            failureMode: 'RUNAWAY_REFACTOR' as const,
            severity: 0.7,
            rootCauseWave: 'C' as const,
            correlatedEvents: [],
            recommendedPrimitives: [],
            confidence: 0.75,
            description: '',
            timestamp: now,
          },
          {
            sourceWave: 'F' as const,
            failureMode: 'WRONG_ABSTRACTION' as const,
            severity: 0.5,
            rootCauseWave: 'D' as const,
            correlatedEvents: [],
            recommendedPrimitives: [],
            confidence: 0.8,
            description: '',
            timestamp: now,
          },
        ],
        correlationPatterns: [],
        rootCauseWaves: new Set(['B', 'C', 'D']),
        timestamp: now,
      };

      const result = stitcher.stitch(null, null, null, null, null, null, g2, null);

      const archRec = result.recommendations.find((r) => r.category === 'ARCHITECTURE');
      expect(archRec).toBeDefined();
      expect(archRec?.priority).toBe('HIGH');
    });

    it('recommends testing improvements for failed healing', () => {
      const g1 = {
        stage: 'G.1' as const,
        primitivesApplied: ['p1', 'p2'],
        successfulPrimitives: 0, // All failed
        failedPrimitives: 2,
        timestamp: now,
      };
      const g2 = {
        stage: 'G.2' as const,
        vectors: [
          {
            sourceWave: 'D' as const,
            failureMode: 'OPTIMISTIC_PATH' as const,
            severity: 0.5,
            correlatedEvents: [],
            recommendedPrimitives: ['p1', 'p2'],
            confidence: 0.8,
            description: '',
            timestamp: now,
          },
        ],
        correlationPatterns: [],
        rootCauseWaves: new Set(),
        timestamp: now,
      };

      const result = stitcher.stitch(null, null, null, null, null, g1, g2, null);

      const testRec = result.recommendations.find((r) => r.category === 'TESTING');
      expect(testRec).toBeDefined();
      expect(testRec?.priority).toBe('MEDIUM');
    });

    it('recommends escalation for high-severity drift', () => {
      const g2 = {
        stage: 'G.2' as const,
        vectors: [
          {
            sourceWave: 'E' as const,
            failureMode: 'RUNAWAY_REFACTOR' as const,
            severity: 0.95, // Critical
            correlatedEvents: [],
            recommendedPrimitives: [],
            confidence: 0.9,
            description: '',
            timestamp: now,
          },
        ],
        correlationPatterns: [],
        rootCauseWaves: new Set(),
        timestamp: now,
      };

      const result = stitcher.stitch(null, null, null, null, null, null, g2, null);

      const escalRec = result.recommendations.find((r) => r.category === 'ESCALATION');
      expect(escalRec).toBeDefined();
      expect(escalRec?.priority).toBe('CRITICAL');
    });
  });

  describe('Integration Scenarios', () => {
    it('e2e: complete successful wave flow B→G.4', () => {
      const timeline: Parameters<typeof stitcher.stitch> = [
        {
          wave: 'B',
          scope: ['auth', 'db'],
          expectedFiles: ['auth.ts', 'db.ts'],
          maxFileChanges: 5,
          timestamp: now,
        },
        {
          wave: 'C',
          acceptanceCriteria: ['auth_works', 'db_connected'],
          negativeTestCases: 4,
          errorPaths: ['invalid_token', 'conn_timeout', 'auth_expired', 'db_unavail'],
          timestamp: now + 1000,
        },
        {
          wave: 'D',
          driftDetected: false,
          failureModes: [],
          quarantineCount: 0,
          timestamp: now + 2000,
        },
        {
          wave: 'E',
          rulesApplied: [],
          healingPatternsDetected: [],
          autoHealingSuccessCount: 0,
          timestamp: now + 3000,
        },
        {
          wave: 'F',
          repairAttempts: 0,
          testsPassed: 15,
          testsFailed: 0,
          verificationStatus: 'PASS',
          timestamp: now + 4000,
        },
        null,
        null,
        {
          stage: 'G.3',
          decision: {
            allowed: true,
            driftClassification: 'NONE',
            severity: 0.0,
            conditions: [],
            failedConditions: [],
            contradictions: [],
            requiredApprovals: [],
            reasoning: 'No drift, ready to proceed',
            timestamp: now + 5000,
          },
          timestamp: now + 5000,
        },
      ];

      const result = stitcher.stitch(...timeline);

      expect(result.executionTimeline).toHaveLength(6); // B, C, D, E, F, G.3
      expect(result.dashboardMetrics.phase28Ready).toBe(true);
      expect(result.recommendations.length).toBeLessThanOrEqual(1); // Only low-priority optimization
    });

    it('e2e: drift detected and healed', () => {
      const g1 = {
        stage: 'G.1' as const,
        primitivesApplied: ['add_error_handling'],
        successfulPrimitives: 1,
        failedPrimitives: 0,
        timestamp: now + 3500,
      };
      const g2 = {
        stage: 'G.2' as const,
        vectors: [
          {
            sourceWave: 'D' as const,
            failureMode: 'OPTIMISTIC_PATH' as const,
            severity: 0.6,
            rootCauseWave: 'C' as const,
            correlatedEvents: [],
            recommendedPrimitives: ['add_error_handling'],
            confidence: 0.85,
            description: 'Missing error paths',
            timestamp: now + 2500,
          },
        ],
        correlationPatterns: [],
        rootCauseWaves: new Set(['C']),
        timestamp: now + 2500,
      };

      const result = stitcher.stitch(null, null, null, null, null, g1, g2, null);

      expect(result.driftProgression.length).toBeGreaterThan(0);
      expect(result.healingMetrics[0].successful).toBe(true);
      expect(result.healingMetrics[0].improvementPercent).toBeGreaterThan(0);
    });

    it('e2e: multiple contradictions detected', () => {
      const waveB = {
        wave: 'B' as const,
        scope: ['a', 'b', 'c', 'd', 'e', 'f'],
        expectedFiles: ['a.ts', 'b.ts'],
        maxFileChanges: 15,
        timestamp: now + 1000,
      };
      const waveC = {
        wave: 'C' as const,
        acceptanceCriteria: ['must support new plugins'],
        negativeTestCases: 0,
        errorPaths: [],
        timestamp: now + 2000,
      };
      const g2 = {
        stage: 'G.2' as const,
        vectors: [
          {
            sourceWave: 'F' as const,
            failureMode: 'RUNAWAY_REFACTOR' as const,
            severity: 0.85,
            rootCauseWave: 'B' as const,
            correlatedEvents: [
              { wave: 'B', failureMode: 'KITCHEN_SINK', severity: 'HIGH', details: {}, timestamp: now },
              { wave: 'C', failureMode: 'WRONG_ABSTRACTION', severity: 'MEDIUM', details: {}, timestamp: now },
              { wave: 'D', failureMode: 'OPTIMISTIC_PATH', severity: 'MEDIUM', details: {}, timestamp: now },
            ],
            recommendedPrimitives: [],
            confidence: 0.8,
            description: 'Cascading refactor',
            timestamp: now + 3000,
          },
        ],
        correlationPatterns: ['B→F:planning_ambiguity'],
        rootCauseWaves: new Set(['B']),
        timestamp: now + 3000,
      };

      const result = stitcher.stitch(waveB, waveC, null, null, null, null, g2, null);

      expect(result.dashboardMetrics.contradictionsDetected).toBeGreaterThan(0);
      expect(result.recommendations.some((r) => r.priority === 'CRITICAL')).toBe(true);
    });
  });

  describe('Output Validation', () => {
    it('returns complete UnifiedTelemetry object', () => {
      const waveB = {
        wave: 'B' as const,
        scope: ['src'],
        expectedFiles: ['a.ts'],
        maxFileChanges: 1,
        timestamp: now,
      };

      const result = stitcher.stitch(waveB, null, null, null, null, null, null, null);

      expect(result).toHaveProperty('executionId');
      expect(result).toHaveProperty('executionTimeline');
      expect(result).toHaveProperty('driftProgression');
      expect(result).toHaveProperty('healingMetrics');
      expect(result).toHaveProperty('rootCauseAnalysis');
      expect(result).toHaveProperty('dashboardMetrics');
      expect(result).toHaveProperty('correlationMap');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('timestamp');
    });

    it('generates human-readable recommendations', () => {
      const g2 = {
        stage: 'G.2' as const,
        vectors: [
          {
            sourceWave: 'D' as const,
            failureMode: 'KITCHEN_SINK' as const,
            severity: 0.8,
            rootCauseWave: 'B' as const,
            correlatedEvents: [],
            recommendedPrimitives: [],
            confidence: 0.85,
            description: '',
            timestamp: now,
          },
          {
            sourceWave: 'E' as const,
            failureMode: 'RUNAWAY_REFACTOR' as const,
            severity: 0.75,
            rootCauseWave: 'C' as const,
            correlatedEvents: [],
            recommendedPrimitives: [],
            confidence: 0.8,
            description: '',
            timestamp: now,
          },
        ],
        correlationPatterns: [],
        rootCauseWaves: new Set(['B', 'C']),
        timestamp: now,
      };

      const result = stitcher.stitch(null, null, null, null, null, null, g2, null);

      for (const rec of result.recommendations) {
        expect(rec.description).toBeTruthy();
        expect(rec.category).toMatch(/ARCHITECTURE|TESTING|PROCESS|ESCALATION/);
        expect(rec.priority).toMatch(/CRITICAL|HIGH|MEDIUM|LOW/);
        expect(rec.suggestedAction).toBeTruthy();
      }
    });
  });
});
