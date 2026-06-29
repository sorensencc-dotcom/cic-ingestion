/**
 * Phase 4: Governance caps — bounds on structural changes + metric thresholds.
 */

export interface GovernanceCaps {
  readonly maxDeltaMagnitude: number; // max allowed change magnitude (0-1)
  readonly maxCohortGrowthPerEpoch: number; // canary growth cap (%)
  readonly requiredApprovers: number; // min number of approvals for structural changes
  readonly autoApproveMinorDeltas: boolean; // auto-approve non-structural changes
}

export interface MetricThresholds {
  readonly divergenceThreshold: number; // 0.15 (15%)
  readonly costDeltaThreshold: number; // 0.10 (±10%)
  readonly latencyDeltaThreshold: number; // 0.15 (±15%)
  readonly correctnessDeltaThreshold: number; // 0.02 (±2%)
  readonly driftThreshold: number; // 0.10 (simulator/live mismatch)
}

export const DEFAULT_GOVERNANCE_CAPS: GovernanceCaps = {
  maxDeltaMagnitude: 0.25, // 25% max change
  maxCohortGrowthPerEpoch: 5.0, // 5% per step
  requiredApprovers: 1, // Single approver for now (phase 3 multi-approver later)
  autoApproveMinorDeltas: true,
};

export const DEFAULT_METRIC_THRESHOLDS: MetricThresholds = {
  divergenceThreshold: 0.15,
  costDeltaThreshold: 0.10,
  latencyDeltaThreshold: 0.15,
  correctnessDeltaThreshold: 0.02,
  driftThreshold: 0.10,
};
