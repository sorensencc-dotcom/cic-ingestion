/**
 * Phase 4: Canary assignment — determine cohort membership deterministically.
 */

export interface CanaryAssignment {
  readonly proposalId: string;
  readonly taskId: string; // task being routed
  readonly inCanary: boolean; // true = use candidate, false = use baseline
  readonly cohortId: string; // stable cohort identifier
  readonly timestamp: number;
}

export class CanaryAssignmentEngine {
  /**
   * Deterministically assign task to canary or baseline.
   * Uses hash(taskId + cohortId) % 100 for stable, reproducible assignment.
   */
  assign(proposalId: string, taskId: string, cohortSize: number): CanaryAssignment {
    const hash = this.hashCode(`${taskId}-${proposalId}`);
    const percentage = Math.abs(hash) % 100;
    const inCanary = percentage < cohortSize;

    return {
      proposalId,
      taskId,
      inCanary,
      cohortId: `canary-${proposalId}`,
      timestamp: Date.now(),
    };
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }
}
