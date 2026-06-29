/**
 * Phase 4: Canary execution errors.
 */

export interface CanaryError {
  readonly code: string;
  readonly message: string;
  readonly proposalId?: string;
  readonly details?: Record<string, unknown>;
}

export const CANARY_ERRORS = {
  COHORT_ASSIGNMENT_FAILED: 'CANARY_COHORT_ASSIGNMENT_FAILED',
  TELEMETRY_COLLECTION_FAILED: 'CANARY_TELEMETRY_COLLECTION_FAILED',
  GROWTH_DECISION_FAILED: 'CANARY_GROWTH_DECISION_FAILED',
  HARD_VIOLATION_DETECTED: 'CANARY_HARD_VIOLATION_DETECTED',
  ROLLBACK_FAILED: 'CANARY_ROLLBACK_FAILED',
} as const;
