/**
 * Phase 4: Proposal Delta Types — high-level structural changes to MAAL.
 */

/**
 * RegimeDelta: Propose new or modify routing regime.
 */
export interface RegimeDelta {
  readonly type: 'regime';
  readonly regimeId: string;
  readonly modelSelector?: string; // MAAL model selection criteria
  readonly fallbackBehavior?: string; // MAAL fallback reference
  readonly constraints?: Record<string, unknown>; // MAAL constraint bindings
}

/**
 * ConstraintDelta: Add, modify, or remove routing constraints.
 */
export interface ConstraintDelta {
  readonly type: 'constraint';
  readonly constraintId: string;
  readonly action: 'add' | 'modify' | 'remove';
  readonly constraintType: string; // e.g., "latency", "cost", "correctness"
  readonly bounds?: { min?: number; max?: number };
}

/**
 * FallbackDelta: Modify fallback graph structure.
 */
export interface FallbackDelta {
  readonly type: 'fallback';
  readonly fallbackId: string;
  readonly predecessors?: string[]; // IDs of predecessor models
  readonly successors?: string[]; // IDs of successor fallback nodes
  readonly weight?: number; // Priority weight
}

/**
 * RewardDelta: Adjust reward function weights or thresholds.
 */
export interface RewardDelta {
  readonly type: 'reward';
  readonly componentId: string; // e.g., "success", "latency", "cost"
  readonly weight?: number; // New weight (0-1, normalized)
  readonly threshold?: number; // e.g., SLA threshold
}

/**
 * SimulatorDelta: Change simulator state or behavior for offline learning.
 */
export interface SimulatorDelta {
  readonly type: 'simulator';
  readonly simulatorId: string;
  readonly modelPerformanceMatrix?: Record<string, Record<string, number>>;
  readonly stateDistribution?: Record<string, number>;
  readonly observationWindow?: number; // milliseconds
}

export type ProposalDelta = RegimeDelta | ConstraintDelta | FallbackDelta | RewardDelta | SimulatorDelta;

/**
 * Proposal: DSL payload to MAAL.
 * - Only high-level deltas (never direct mutations)
 * - Parsed & validated before governance review
 * - Canary-gated before promotion
 */
export interface Proposal {
  readonly proposalId: string;
  readonly submittedBy: string; // SPL service ID
  readonly deltas: ProposalDelta[];
  readonly rationale: string;
  readonly submittedAt: number; // timestamp
  readonly targetRegime?: string; // Optional: which regime this targets
}

/**
 * ProposalMetadata: Governance & canary tracking.
 */
export interface ProposalMetadata {
  readonly proposalId: string;
  readonly status: 'submitted' | 'validated' | 'approved' | 'rejected' | 'expired' | 'promoted' | 'rolled_back';
  readonly validationResult?: { valid: boolean; errors: string[] };
  readonly governanceDecision?: {
    approved: boolean;
    approver: string;
    decidedAt: number;
    rationale?: string;
  };
  readonly canaryTelemetry?: {
    cohortSize: number;
    avgLatency: number;
    costDelta: number;
    successRate: number;
    driftScore: number;
  };
}
