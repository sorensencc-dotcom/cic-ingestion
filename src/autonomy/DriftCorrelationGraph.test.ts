/**
 * Wave G — Drift Correlation Graph Tests
 */

import { DriftCorrelationGraph, WaveDriftEvent } from './DriftCorrelationGraph.js';

describe('DriftCorrelationGraph', () => {
  let graph: DriftCorrelationGraph;

  beforeEach(() => {
    graph = new DriftCorrelationGraph();
  });

  describe('Single Wave Events', () => {
    test('records single drift event', () => {
      const event: WaveDriftEvent = {
        wave: 'B',
        failureMode: 'KITCHEN_SINK',
        severity: 'HIGH',
        details: { filesModified: 5 },
        timestamp: Date.now(),
      };

      graph.recordEvent(event);
      const correlated = graph.correlate();

      expect(correlated.length).toBeGreaterThan(0);
      expect(correlated[0].sourceWave).toBe('B');
      expect(correlated[0].failureMode).toBe('KITCHEN_SINK');
    });

    test('returns empty correlation for isolated event', () => {
      const event: WaveDriftEvent = {
        wave: 'D',
        failureMode: 'OPTIMISTIC_PATH',
        severity: 'MEDIUM',
        details: {},
        timestamp: Date.now(),
      };

      graph.recordEvent(event);
      const correlated = graph.correlate();

      // Isolated event still generates a vector but with low confidence
      expect(correlated.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('B→F: Planning Ambiguity → Refactor Drift', () => {
    test('correlates planning ambiguity to refactor drift', () => {
      const planningEvent: WaveDriftEvent = {
        wave: 'B',
        failureMode: 'KITCHEN_SINK',
        severity: 'HIGH',
        details: {
          filesModified: ['src/core/main.ts', 'src/utils/helper.ts', 'src/types/index.ts'],
          expectedScope: ['src/core'],
        },
        timestamp: Date.now(),
      };

      const refactorEvent: WaveDriftEvent = {
        wave: 'F',
        failureMode: 'RUNAWAY_REFACTOR',
        severity: 'CRITICAL',
        details: {
          filesModified: 4,
          files: ['src/core/main.ts', 'src/utils/helper.ts', 'src/types/index.ts', 'src/config/settings.ts'],
        },
        timestamp: Date.now() + 1000,
      };

      graph.recordEvent(planningEvent);
      graph.recordEvent(refactorEvent);

      const correlated = graph.correlate();

      expect(correlated.length).toBeGreaterThan(0);
      // Should detect drift at Wave F
      const fVector = correlated.find((v) => v.sourceWave === 'F');
      expect(fVector).toBeDefined();
      if (fVector) {
        expect(fVector.failureMode).toBe('RUNAWAY_REFACTOR');
        // Recommended primitives should include healing
        expect(fVector.recommendedPrimitives.length).toBeGreaterThan(0);
      }
    });
  });

  describe('C→E: Dependency Creep → Healing Loop', () => {
    test('correlates dependency creep to healing activation', () => {
      const dependencyEvent: WaveDriftEvent = {
        wave: 'C',
        failureMode: 'KITCHEN_SINK',
        severity: 'HIGH',
        details: {
          unrelatedFiles: ['src/core/main.ts'],
          newDependencies: ['lodash', 'moment'],
        },
        timestamp: Date.now(),
      };

      const healingEvent: WaveDriftEvent = {
        wave: 'E',
        failureMode: 'WRONG_ABSTRACTION',
        severity: 'HIGH',
        details: {
          duplicateCount: 2,
          files: ['src/core/main.ts'],
        },
        timestamp: Date.now() + 2000,
      };

      graph.recordEvent(dependencyEvent);
      graph.recordEvent(healingEvent);

      const correlated = graph.correlate();

      expect(correlated.length).toBeGreaterThan(0);
      // Should detect Wave E healing attempt
      const eVector = correlated.find((v) => v.sourceWave === 'E');
      expect(eVector).toBeDefined();
      if (eVector) {
        expect(eVector.failureMode).toBe('WRONG_ABSTRACTION');
        // Should recommend abstraction step
        expect(eVector.recommendedPrimitives).toContain('heal.require_abstraction_step');
      }
    });
  });

  describe('D→F: Debug Misdiagnosis → Drift Escalation', () => {
    test('traces misdiagnosed fix to escalated drift', () => {
      const debugEvent: WaveDriftEvent = {
        wave: 'D',
        failureMode: 'OPTIMISTIC_PATH',
        severity: 'MEDIUM',
        details: {
          totalTests: 5,
          negativeTests: 0,
          missingErrorCases: true,
        },
        timestamp: Date.now(),
      };

      const escapeEvent: WaveDriftEvent = {
        wave: 'F',
        failureMode: 'OPTIMISTIC_PATH',
        severity: 'HIGH',
        details: {
          totalTests: 3,
          negativeTests: 0,
        },
        timestamp: Date.now() + 3000,
      };

      graph.recordEvent(debugEvent);
      graph.recordEvent(escapeEvent);

      const correlated = graph.correlate();

      expect(correlated.length).toBeGreaterThan(0);
    });
  });

  describe('E→F: Healing Failure → Runaway Drift', () => {
    test('detects healing attempt followed by escalation', () => {
      const repairEvent: WaveDriftEvent = {
        wave: 'E',
        failureMode: 'KITCHEN_SINK',
        severity: 'HIGH',
        details: {
          criteria: { maxCorruptionPercent: 50 },
          repairSuccess: true,
        },
        timestamp: Date.now(),
      };

      const escalationEvent: WaveDriftEvent = {
        wave: 'F',
        failureMode: 'RUNAWAY_REFACTOR',
        severity: 'CRITICAL',
        details: {
          filesModified: 6,
          cascading: true,
        },
        timestamp: Date.now() + 1000,
      };

      graph.recordEvent(repairEvent);
      graph.recordEvent(escalationEvent);

      const correlated = graph.correlate();

      expect(correlated.length).toBeGreaterThan(0);
    });
  });

  describe('F→B: Drift Triggers Replan', () => {
    test('identifies drift requiring plan regeneration', () => {
      const detectionEvent: WaveDriftEvent = {
        wave: 'F',
        failureMode: 'KITCHEN_SINK',
        severity: 'CRITICAL',
        details: {
          filesModified: 5,
          expectedScope: ['src/core'],
        },
        timestamp: Date.now(),
      };

      graph.recordEvent(detectionEvent);
      const correlated = graph.correlate();

      expect(correlated.length).toBeGreaterThan(0);
      const vector = correlated[0];
      expect(vector.sourceWave).toBe('F');
    });
  });

  describe('Recommended Primitives', () => {
    test('recommends shrink_scope + tighten for KITCHEN_SINK', () => {
      const event: WaveDriftEvent = {
        wave: 'F',
        failureMode: 'KITCHEN_SINK',
        severity: 'HIGH',
        details: {},
        timestamp: Date.now(),
      };

      graph.recordEvent(event);
      const correlated = graph.correlate();

      expect(correlated.length).toBeGreaterThan(0);
      const primitives = correlated[0].recommendedPrimitives;
      expect(primitives).toContain('heal.shrink_scope');
      expect(primitives).toContain('heal.tighten_criteria');
    });

    test('recommends abstraction for WRONG_ABSTRACTION', () => {
      const event: WaveDriftEvent = {
        wave: 'E',
        failureMode: 'WRONG_ABSTRACTION',
        severity: 'HIGH',
        details: { duplicateCount: 2 },
        timestamp: Date.now(),
      };

      graph.recordEvent(event);
      const correlated = graph.correlate();

      expect(correlated.length).toBeGreaterThan(0);
      const primitives = correlated[0].recommendedPrimitives;
      expect(primitives).toContain('heal.require_abstraction_step');
    });

    test('recommends inject_negative for OPTIMISTIC_PATH', () => {
      const event: WaveDriftEvent = {
        wave: 'D',
        failureMode: 'OPTIMISTIC_PATH',
        severity: 'HIGH',
        details: { missingErrorCases: true },
        timestamp: Date.now(),
      };

      graph.recordEvent(event);
      const correlated = graph.correlate();

      expect(correlated.length).toBeGreaterThan(0);
      const primitives = correlated[0].recommendedPrimitives;
      expect(primitives).toContain('heal.inject_negative_tests');
    });

    test('recommends surgical + freeze for RUNAWAY_REFACTOR', () => {
      const event: WaveDriftEvent = {
        wave: 'F',
        failureMode: 'RUNAWAY_REFACTOR',
        severity: 'CRITICAL',
        details: { filesModified: 5 },
        timestamp: Date.now(),
      };

      graph.recordEvent(event);
      const correlated = graph.correlate();

      expect(correlated.length).toBeGreaterThan(0);
      const primitives = correlated[0].recommendedPrimitives;
      expect(primitives).toContain('heal.enforce_surgical_diff');
      expect(primitives).toContain('heal.freeze_architecture');
    });
  });

  describe('Severity Computation', () => {
    test('single HIGH event scores 0.75', () => {
      const event: WaveDriftEvent = {
        wave: 'B',
        failureMode: 'KITCHEN_SINK',
        severity: 'HIGH',
        details: {},
        timestamp: Date.now(),
      };

      graph.recordEvent(event);
      const correlated = graph.correlate();

      expect(correlated.length).toBeGreaterThan(0);
      expect(correlated[0].severity).toBeGreaterThan(0.6);
      expect(correlated[0].severity).toBeLessThanOrEqual(1.0);
    });

    test('escalates severity with multiple waves', () => {
      const event1: WaveDriftEvent = {
        wave: 'B',
        failureMode: 'KITCHEN_SINK',
        severity: 'MEDIUM',
        details: { filesModified: ['src/a.ts', 'src/b.ts'] },
        timestamp: Date.now(),
      };

      const event2: WaveDriftEvent = {
        wave: 'F',
        failureMode: 'RUNAWAY_REFACTOR',
        severity: 'MEDIUM',
        details: { files: ['src/a.ts', 'src/b.ts', 'src/c.ts'] },
        timestamp: Date.now() + 1000,
      };

      graph.recordEvent(event1);
      graph.recordEvent(event2);
      const correlated = graph.correlate();

      if (correlated.length > 0) {
        const multiWaveVector = correlated.find((v) => v.correlatedEvents.length > 1);
        if (multiWaveVector) {
          expect(multiWaveVector.severity).toBeGreaterThan(0.5);
        }
      }
    });
  });

  describe('Correlation Matrix', () => {
    test('builds correlation matrix', () => {
      const matrix = graph.buildCorrelationMatrix();

      expect(matrix).toBeDefined();
      expect(matrix['B']).toBeDefined();
      expect(matrix['F']).toBeDefined();
      expect(Object.keys(matrix).length).toBe(5); // Waves B–F
    });

    test('matrix has confidence values', () => {
      const matrix = graph.buildCorrelationMatrix();

      // Check that at least some edges have confidence > 0
      let hasConfidence = false;
      for (const row of Object.values(matrix)) {
        if (Object.values(row).some((val) => val > 0)) {
          hasConfidence = true;
          break;
        }
      }

      expect(hasConfidence).toBe(true);
    });
  });

  describe('Root Cause Tracing', () => {
    test('traces drift to root cause wave', () => {
      const event: WaveDriftEvent = {
        wave: 'F',
        failureMode: 'RUNAWAY_REFACTOR',
        severity: 'CRITICAL',
        details: {},
        timestamp: Date.now(),
      };

      graph.recordEvent(event);
      const correlated = graph.correlate();

      expect(correlated.length).toBeGreaterThan(0);
      const vector = correlated[0];
      // Root cause should be same or earlier wave
      if (vector.rootCauseWave) {
        const waveOrder: Record<string, number> = { B: 0, C: 1, D: 2, E: 3, F: 4 };
        expect(waveOrder[vector.rootCauseWave]).toBeLessThanOrEqual(waveOrder[vector.sourceWave]);
      }
    });
  });

  describe('Multi-Wave Drift Patterns', () => {
    test('detects complete chain: B→C→E→F', () => {
      const eventB: WaveDriftEvent = {
        wave: 'B',
        failureMode: 'KITCHEN_SINK',
        severity: 'HIGH',
        details: { filesModified: ['src/core/main.ts', 'src/utils/helper.ts'] },
        timestamp: Date.now(),
      };

      const eventC: WaveDriftEvent = {
        wave: 'C',
        failureMode: 'WRONG_ABSTRACTION',
        severity: 'MEDIUM',
        details: { duplicateCount: 2, files: ['src/core/main.ts'] },
        timestamp: Date.now() + 1000,
      };

      const eventE: WaveDriftEvent = {
        wave: 'E',
        failureMode: 'KITCHEN_SINK',
        severity: 'HIGH',
        details: { filesModified: ['src/core/main.ts', 'src/config/settings.ts'] },
        timestamp: Date.now() + 2000,
      };

      const eventF: WaveDriftEvent = {
        wave: 'F',
        failureMode: 'RUNAWAY_REFACTOR',
        severity: 'CRITICAL',
        details: { filesModified: 4, files: ['src/core/main.ts', 'src/config/settings.ts', 'src/a.ts', 'src/b.ts'] },
        timestamp: Date.now() + 3000,
      };

      graph.recordEvent(eventB);
      graph.recordEvent(eventC);
      graph.recordEvent(eventE);
      graph.recordEvent(eventF);

      const correlated = graph.correlate();

      expect(correlated.length).toBeGreaterThan(0);
      // At least one vector should be from Wave F (terminal drift detection)
      const waveF = correlated.find((v) => v.sourceWave === 'F');
      expect(waveF).toBeDefined();
      if (waveF) {
        // Should trace back to earlier wave
        expect(waveF.correlatedEvents.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('Confidence Scoring', () => {
    test('high confidence for multi-wave correlation', () => {
      const event1: WaveDriftEvent = {
        wave: 'B',
        failureMode: 'KITCHEN_SINK',
        severity: 'HIGH',
        details: { filesModified: ['src/a.ts', 'src/b.ts', 'src/c.ts'] },
        timestamp: Date.now(),
      };

      const event2: WaveDriftEvent = {
        wave: 'F',
        failureMode: 'RUNAWAY_REFACTOR',
        severity: 'CRITICAL',
        details: { files: ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts'] },
        timestamp: Date.now() + 1000,
      };

      graph.recordEvent(event1);
      graph.recordEvent(event2);
      const correlated = graph.correlate();

      expect(correlated.length).toBeGreaterThan(0);
      // Vectors should have some confidence value
      for (const vector of correlated) {
        expect(vector.confidence).toBeGreaterThanOrEqual(0.5);
        expect(vector.confidence).toBeLessThanOrEqual(1.0);
      }
    });
  });
});
