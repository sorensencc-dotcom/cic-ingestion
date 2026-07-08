/**
 * Wave G — Cross-Wave Drift Correlation Graph
 *
 * Correlates drift signals across Waves B–F to identify root causes
 * and recommend healing primitives.
 */

export interface WaveDriftEvent {
  wave: 'B' | 'C' | 'D' | 'E' | 'F';
  failureMode: 'KITCHEN_SINK' | 'WRONG_ABSTRACTION' | 'OPTIMISTIC_PATH' | 'RUNAWAY_REFACTOR';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details: Record<string, any>;
  timestamp: number;
}

export interface CorrelationEdge {
  sourceWave: 'B' | 'C' | 'D' | 'E' | 'F';
  targetWave: 'B' | 'C' | 'D' | 'E' | 'F';
  pattern: string;
  confidence: number; // 0.0–1.0
  description: string;
}

export interface CorrelatedDriftVector {
  sourceWave: 'B' | 'C' | 'D' | 'E' | 'F';
  failureMode: 'KITCHEN_SINK' | 'WRONG_ABSTRACTION' | 'OPTIMISTIC_PATH' | 'RUNAWAY_REFACTOR';
  severity: number; // 0.0–1.0 (computed)
  rootCauseWave?: 'B' | 'C' | 'D' | 'E' | 'F'; // Traced back to origin
  correlatedEvents: WaveDriftEvent[];
  recommendedPrimitives: string[];
  confidence: number; // 0.0–1.0
  description: string;
  timestamp: number;
}

/**
 * Correlation patterns across waves
 */
const CORRELATION_PATTERNS: Record<string, CorrelationEdge> = {
  'B→F:planning_ambiguity': {
    sourceWave: 'B',
    targetWave: 'F',
    pattern: 'planning_ambiguity_to_refactor_drift',
    confidence: 0.85,
    description: 'Ambiguous plan expectations lead to refactor drift in final validation',
  },
  'C→E:dependency_creep': {
    sourceWave: 'C',
    targetWave: 'E',
    pattern: 'dependency_creep_to_healing_loop',
    confidence: 0.80,
    description: 'Unjustified dependencies cause repair loop activation',
  },
  'D→F:debug_misdiagnosis': {
    sourceWave: 'D',
    targetWave: 'F',
    pattern: 'misdiagnosed_fix_to_drift',
    confidence: 0.75,
    description: 'Incorrect debugging leads to optimistic path or wrong abstraction',
  },
  'E→F:healing_failure': {
    sourceWave: 'E',
    targetWave: 'F',
    pattern: 'healing_ineffective_to_runaway',
    confidence: 0.70,
    description: 'Healing step failed to resolve root cause, drift escalates',
  },
  'F→B:drift_replan': {
    sourceWave: 'F',
    targetWave: 'B',
    pattern: 'drift_triggers_plan_regeneration',
    confidence: 0.65,
    description: 'Detected drift requires plan revision and restart',
  },
};

/**
 * Drift Correlation Graph Builder
 */
export class DriftCorrelationGraph {
  private events: WaveDriftEvent[] = [];

  /**
   * Record drift event from a wave
   */
  recordEvent(event: WaveDriftEvent): void {
    this.events.push(event);
  }

  /**
   * Analyze drift correlation across waves
   */
  correlate(): CorrelatedDriftVector[] {
    if (this.events.length === 0) {
      return [];
    }

    const correlations: CorrelatedDriftVector[] = [];

    // Group events by wave
    const eventsByWave = this.groupByWave(this.events);

    // For each event, find correlated events from other waves
    for (const event of this.events) {
      const correlated = this.findCorrelations(event, eventsByWave);

      if (correlated.length > 0) {
        const vector = this.buildVector(event, correlated);
        correlations.push(vector);
      }
    }

    // Deduplicate and merge vectors from same root cause
    return this.deduplicateVectors(correlations);
  }

  /**
   * Get recommended healing primitives for a correlated vector
   */
  recommendPrimitives(vector: CorrelatedDriftVector): string[] {
    const primitives: string[] = [];

    switch (vector.failureMode) {
      case 'KITCHEN_SINK':
        primitives.push('heal.shrink_scope');
        primitives.push('heal.tighten_criteria');
        break;
      case 'WRONG_ABSTRACTION':
        primitives.push('heal.require_abstraction_step');
        break;
      case 'OPTIMISTIC_PATH':
        primitives.push('heal.inject_negative_tests');
        break;
      case 'RUNAWAY_REFACTOR':
        primitives.push('heal.enforce_surgical_diff');
        primitives.push('heal.freeze_architecture');
        break;
    }

    // If cross-wave drift detected, add dependency audit
    if (vector.sourceWave !== vector.rootCauseWave) {
      primitives.push('heal.require_dependency_justification');
    }

    return primitives;
  }

  /**
   * Build correlation matrix for visualization
   */
  buildCorrelationMatrix(): Record<string, Record<string, number>> {
    const matrix: Record<string, Record<string, number>> = {};
    const waves = ['B', 'C', 'D', 'E', 'F'];

    // Initialize matrix
    for (const w1 of waves) {
      matrix[w1] = {};
      for (const w2 of waves) {
        matrix[w1][w2] = 0;
      }
    }

    // Count correlations
    for (const [key, edge] of Object.entries(CORRELATION_PATTERNS)) {
      const matrixKey = `${edge.sourceWave}→${edge.targetWave}`;
      if (matrix[edge.sourceWave] && matrix[edge.sourceWave][edge.targetWave] !== undefined) {
        matrix[edge.sourceWave][edge.targetWave] = edge.confidence;
      }
    }

    return matrix;
  }

  /**
   * Trace drift back to root cause wave
   */
  traceRootCause(event: WaveDriftEvent): 'B' | 'C' | 'D' | 'E' | 'F' {
    let current = event.wave;

    // Walk backwards through correlation edges
    for (let i = 0; i < 5; i++) {
      // Max 5 hops to prevent infinite loops
      let found = false;

      for (const [, edge] of Object.entries(CORRELATION_PATTERNS)) {
        if (edge.targetWave === current && edge.confidence > 0.6) {
          current = edge.sourceWave;
          found = true;
          break;
        }
      }

      if (!found) break;
    }

    return current;
  }

  /**
   * Compute severity as weighted average of correlated events
   */
  computeSeverity(events: WaveDriftEvent[]): number {
    if (events.length === 0) return 0;

    const severityMap = { LOW: 0.25, MEDIUM: 0.5, HIGH: 0.75, CRITICAL: 1.0 };
    const severities = events.map((e) => severityMap[e.severity] || 0);
    const average = severities.reduce((a, b) => a + b, 0) / severities.length;

    // Escalate severity if multiple waves affected
    const waveCount = new Set(events.map((e) => e.wave)).size;
    return Math.min(average * (1 + (waveCount - 1) * 0.25), 1.0);
  }

  // Private helpers

  private groupByWave(
    events: WaveDriftEvent[]
  ): Record<'B' | 'C' | 'D' | 'E' | 'F', WaveDriftEvent[]> {
    const groups: Record<'B' | 'C' | 'D' | 'E' | 'F', WaveDriftEvent[]> = {
      B: [],
      C: [],
      D: [],
      E: [],
      F: [],
    };

    for (const event of events) {
      groups[event.wave].push(event);
    }

    return groups;
  }

  private findCorrelations(
    event: WaveDriftEvent,
    eventsByWave: Record<'B' | 'C' | 'D' | 'E' | 'F', WaveDriftEvent[]>
  ): WaveDriftEvent[] {
    const correlated: WaveDriftEvent[] = [event];

    // Look for edges from this event's wave
    for (const [, edge] of Object.entries(CORRELATION_PATTERNS)) {
      if (edge.sourceWave === event.wave) {
        // Find matching event in target wave
        const targetEvents = eventsByWave[edge.targetWave].filter(
          (e) =>
            this.failureModesRelated(e.failureMode, event.failureMode) ||
            this.detailsOverlap(e.details, event.details)
        );

        correlated.push(...targetEvents);
      }
    }

    return correlated;
  }

  private failureModesRelated(mode1: string, mode2: string): boolean {
    // Kitchen Sink can lead to Runaway Refactor
    if (
      (mode1 === 'KITCHEN_SINK' && mode2 === 'RUNAWAY_REFACTOR') ||
      (mode1 === 'RUNAWAY_REFACTOR' && mode2 === 'KITCHEN_SINK')
    ) {
      return true;
    }

    // Optimistic Path can lead to Wrong Abstraction (skipped error paths)
    if (
      (mode1 === 'OPTIMISTIC_PATH' && mode2 === 'WRONG_ABSTRACTION') ||
      (mode1 === 'WRONG_ABSTRACTION' && mode2 === 'OPTIMISTIC_PATH')
    ) {
      return true;
    }

    return false;
  }

  private detailsOverlap(details1: Record<string, any>, details2: Record<string, any>): boolean {
    // Check if both mention same files/modules
    const files1 = new Set([
      ...(details1.filesModified || []),
      ...(details1.unrelatedFiles || []),
      ...((details1.files || []) as string[]),
    ]);

    const files2 = new Set([
      ...(details2.filesModified || []),
      ...(details2.unrelatedFiles || []),
      ...((details2.files || []) as string[]),
    ]);

    if (files1.size > 0 && files2.size > 0) {
      const intersection = [...files1].filter((f) => files2.has(f));
      return intersection.length > 0;
    }

    return false;
  }

  private buildVector(
    primaryEvent: WaveDriftEvent,
    correlatedEvents: WaveDriftEvent[]
  ): CorrelatedDriftVector {
    const rootCause = this.traceRootCause(primaryEvent);
    const severity = this.computeSeverity(correlatedEvents);
    const waveConfidence = correlatedEvents.length > 1 ? 0.8 : 0.6;

    return {
      sourceWave: primaryEvent.wave,
      failureMode: primaryEvent.failureMode,
      severity,
      rootCauseWave: rootCause !== primaryEvent.wave ? rootCause : undefined,
      correlatedEvents,
      recommendedPrimitives: this.recommendPrimitives({
        sourceWave: primaryEvent.wave,
        failureMode: primaryEvent.failureMode,
        severity,
        rootCauseWave: rootCause !== primaryEvent.wave ? rootCause : undefined,
        correlatedEvents,
        recommendedPrimitives: [],
        confidence: 0,
        description: '',
        timestamp: Date.now(),
      }),
      confidence: waveConfidence,
      description: this.buildDescription(primaryEvent, correlatedEvents, rootCause),
      timestamp: primaryEvent.timestamp,
    };
  }

  private buildDescription(
    primary: WaveDriftEvent,
    correlated: WaveDriftEvent[],
    rootCause: string
  ): string {
    const waveCount = new Set(correlated.map((e) => e.wave)).size;

    if (waveCount > 1) {
      const waves = [...new Set(correlated.map((e) => e.wave))].join(',');
      return `Multi-wave drift: ${primary.failureMode} detected in Wave ${primary.wave}, originating from Wave ${rootCause}. Affected waves: ${waves}`;
    }

    return `Drift in Wave ${primary.wave}: ${primary.failureMode} (severity: ${primary.severity})`;
  }

  private deduplicateVectors(vectors: CorrelatedDriftVector[]): CorrelatedDriftVector[] {
    const seen = new Set<string>();
    const deduplicated: CorrelatedDriftVector[] = [];

    for (const vector of vectors) {
      const key = `${vector.rootCauseWave || vector.sourceWave}:${vector.failureMode}`;

      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(vector);
      }
    }

    return deduplicated;
  }
}
