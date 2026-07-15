/**
 * MultiCohortRolloutPipeline: Phase 5 Wave B integration component
 *
 * Orchestrates Phase 4→5 transition and multi-cohort rollout:
 * 1. Convert Phase 4 proposals to Phase 5 variants + initial cohort assignments
 * 2. Batch allocate users to cohorts deterministically
 * 3. Manage pipeline state and lineage traceability
 *
 * Dependencies (Wave A):
 * - MultiCohortEngine: Cohort allocation + progression
 * - ABTestEngine: Variant registration + decision trees
 * - CustomMetricsEngine: Metrics collection + threshold evaluation
 * - CohortPromotionEngine: Promotion/rollback decisions
 *
 * Data Flow:
 * Proposal (Phase 4)
 *   → Variant (ABTestEngine: register)
 *   → CohortAssignment (MultiCohortEngine: allocate)
 *   → MetricSnapshot (CustomMetricsEngine: collect)
 *   → CohortDecision (CohortPromotionEngine: evaluate)
 *   → RolloutDecisionLog (persisted)
 */

import { randomUUID } from 'crypto';
import { Phase5SnapshotCapture } from './snapshot-capture';

/**
 * Phase 4 Proposal record (input)
 */
export interface Phase4Proposal {
  proposal_id: string;
  title: string;
  description: string;
  cost_estimate: number;
  config: Record<string, any>;
  approved_at: string;
}

/**
 * Phase 5 Variant (output from proposal conversion)
 */
export interface Phase5Variant {
  variant_id: string;
  proposal_id: string; // Lineage: links back to Phase 4
  name: string;
  description: string;
  treatment_config: Readonly<Record<string, any>>;
  created_at: string;
}

/**
 * Phase 5 CohortAssignment (output from batch allocation)
 */
export interface Phase5CohortAssignment {
  assignment_id: string;
  proposal_id: string;
  variant_id: string;
  user_id?: string;
  cohort_id: string;
  cohort_size: number;
  assigned_at: string;
  progression_stage: number;
}

/**
 * Batch allocation request
 */
export interface BatchAllocationRequest {
  proposal_id: string;
  variant_id: string;
  user_ids: string[]; // Deterministic allocation per user
  target_cohort_size: number; // e.g., 0.1 for 10%
}

/**
 * Batch allocation result
 */
export interface BatchAllocationResult {
  success: boolean;
  assignments: Phase5CohortAssignment[];
  failed_users?: Array<{ user_id: string; reason: string }>;
  total_allocated: number;
}

/**
 * Rollout pipeline state
 */
export interface RolloutPipelineState {
  proposal_id: string;
  variant_id: string;
  variant_created_at: string;
  assignments_created_at: string;
  assignment_count: number;
  status: 'pending' | 'variant_created' | 'assigned' | 'metrics_collecting' | 'completed';
}

/**
 * Rollout decision log entry (immutable)
 */
export interface RolloutDecisionLogEntry {
  log_id: string;
  proposal_id: string;
  variant_id: string;
  decision: 'promote_cohort' | 'continue_observing' | 'rollback' | 'promote_all';
  cohort_id: string;
  current_cohort_size: number;
  next_cohort_size?: number;
  reason: string;
  recorded_at: string;
}

/**
 * Conversion result from Phase 4 proposal to Phase 5 variant
 */
export interface ConversionResult {
  success: boolean;
  variant?: Phase5Variant;
  error?: string;
}

/**
 * MultiCohortRolloutPipeline: Orchestrates Phase 4→5 conversion and batch rollout
 *
 * Key responsibilities:
 * - Convert Phase 4 proposals to Phase 5 variants (schema mapping + config migration)
 * - Batch allocate users to cohorts deterministically
 * - Maintain lineage traceability (proposal → variant → assignment)
 * - Immutable audit trail of rollout decisions
 *
 * Thread safety:
 * - Append-only variant log
 * - Append-only assignment log
 * - Append-only decision log
 * - No mutable shared state
 */
export class MultiCohortRolloutPipeline {
  private variants: Map<string, Phase5Variant> = new Map(); // variant_id → Phase5Variant
  private assignments: Phase5CohortAssignment[] = []; // Append-only log
  private decisionLog: RolloutDecisionLogEntry[] = []; // Append-only log
  private pipelineState: Map<string, RolloutPipelineState> = new Map(); // proposal_id → state
  private snapshotCapture: Phase5SnapshotCapture;

  constructor(snapshotCapture: Phase5SnapshotCapture = new Phase5SnapshotCapture()) {
    this.snapshotCapture = snapshotCapture;
  }

  /**
   * Convert Phase 4 proposal to Phase 5 variant
   *
   * Conversion Strategy:
   * - Extract proposal metadata (title, description)
   * - Migrate config to treatment_config (immutable)
   * - Generate unique variant_id
   * - Establish lineage link (proposal_id)
   * - Freeze treatment_config to enforce immutability
   *
   * @param proposal Phase 4 proposal record
   * @returns ConversionResult with Phase5Variant or error
   *
   * Throws if:
   * - proposal_id invalid or empty
   * - Variant already created for this proposal
   */
  convertProposalToVariant(proposal: Phase4Proposal): ConversionResult {
    // Validate proposal
    if (!proposal.proposal_id || proposal.proposal_id.trim() === '') {
      return {
        success: false,
        error: 'Invalid proposal_id: must be non-empty string',
      };
    }

    // Check for duplicate variant creation
    const existingVariant = Array.from(this.variants.values()).find(
      (v) => v.proposal_id === proposal.proposal_id
    );

    if (existingVariant) {
      return {
        success: false,
        error: `Variant already created for proposal: ${proposal.proposal_id}. Variant ID: ${existingVariant.variant_id}`,
      };
    }

    // Create Phase 5 variant from Phase 4 proposal
    const variant: Phase5Variant = {
      variant_id: this.generateVariantId(proposal.proposal_id),
      proposal_id: proposal.proposal_id, // Lineage: preserve Phase 4 reference
      name: proposal.title,
      description: proposal.description,
      treatment_config: Object.freeze({
        // Migrate Phase 4 config to treatment_config
        proposal_source: proposal.proposal_id,
        cost_estimate: proposal.cost_estimate,
        config: proposal.config,
        converted_at: new Date().toISOString(),
      }),
      created_at: new Date().toISOString(),
    };

    // Store in variants map (immutable)
    this.variants.set(variant.variant_id, variant);

    // Initialize pipeline state
    this.pipelineState.set(proposal.proposal_id, {
      proposal_id: proposal.proposal_id,
      variant_id: variant.variant_id,
      variant_created_at: variant.created_at,
      assignments_created_at: '', // Will be updated after batch allocation
      assignment_count: 0,
      status: 'variant_created',
    });

    return {
      success: true,
      variant,
    };
  }

  /**
   * Batch allocate users to cohorts deterministically
   *
   * Allocation Strategy:
   * - Deterministic: hash(cohort_id + user_id) → assignment_id
   * - Each user assigned to single cohort (no duplicates)
   * - Records immutable assignment records
   * - Validates all assignments before batch commit
   *
   * @param request Batch allocation request (proposal, variant, users, target cohort)
   * @returns BatchAllocationResult with assignments or failures
   *
   * Validation:
   * - Proposal exists in pipeline state
   * - Variant exists and matches proposal
   * - All users validated before assignment
   */
  batchAllocateUsersToCohorts(
    request: BatchAllocationRequest
  ): BatchAllocationResult {
    const results: Phase5CohortAssignment[] = [];
    const failures: Array<{ user_id: string; reason: string }> = [];

    // Validate request
    if (!request.proposal_id || !request.variant_id || !request.user_ids || request.user_ids.length === 0) {
      return {
        success: false,
        assignments: [],
        failed_users: [
          {
            user_id: '',
            reason: 'Invalid batch allocation request: missing required fields',
          },
        ],
        total_allocated: 0,
      };
    }

    // Validate variant exists and matches proposal
    const variant = this.variants.get(request.variant_id);
    if (!variant) {
      return {
        success: false,
        assignments: [],
        failed_users: request.user_ids.map((uid) => ({
          user_id: uid,
          reason: `Variant not found: ${request.variant_id}`,
        })),
        total_allocated: 0,
      };
    }

    if (variant.proposal_id !== request.proposal_id) {
      return {
        success: false,
        assignments: [],
        failed_users: request.user_ids.map((uid) => ({
          user_id: uid,
          reason: `Variant does not match proposal: variant proposal_id=${variant.proposal_id}, request proposal_id=${request.proposal_id}`,
        })),
        total_allocated: 0,
      };
    }

    // Allocate each user deterministically
    const allocationTime = new Date().toISOString();
    for (const userId of request.user_ids) {
      try {
        // Validate user_id
        if (!userId || userId.trim() === '') {
          failures.push({
            user_id: userId,
            reason: 'Invalid user_id: must be non-empty string',
          });
          continue;
        }

        // Create deterministic assignment
        const assignment: Phase5CohortAssignment = {
          assignment_id: this.generateAssignmentId(
            request.proposal_id,
            request.variant_id,
            userId
          ),
          proposal_id: request.proposal_id,
          variant_id: request.variant_id,
          user_id: userId,
          cohort_id: this.generateCohortId(request.target_cohort_size),
          cohort_size: request.target_cohort_size,
          assigned_at: allocationTime,
          progression_stage: 0, // Always start at initial cohort (0)
        };

        results.push(assignment);
      } catch (error) {
        failures.push({
          user_id: userId,
          reason: `Allocation error: ${(error as Error).message}`,
        });
      }
    }

    // Append all successful assignments to log (atomic batch)
    if (results.length > 0) {
      this.assignments.push(...results);

      // Update pipeline state
      const state = this.pipelineState.get(request.proposal_id);
      if (state) {
        state.assignments_created_at = allocationTime;
        state.assignment_count += results.length;
        state.status = 'assigned';
      }
    }

    return {
      success: failures.length === 0,
      assignments: results,
      failed_users: failures.length > 0 ? failures : undefined,
      total_allocated: results.length,
    };
  }

  /**
   * Record a rollout decision to immutable audit trail
   *
   * @param proposal_id Proposal identifier
   * @param variant_id Variant identifier
   * @param decision Promotion decision (promote_cohort, continue_observing, rollback, promote_all)
   * @param cohort_id Current cohort identifier
   * @param current_cohort_size Current cohort size (0.0-1.0)
   * @param reason Decision rationale
   * @param next_cohort_size Next cohort size (if applicable)
   * @param feature_flag_state Feature flag state to snapshot before deployment (promote decisions only)
   * @returns RolloutDecisionLogEntry (immutable)
   *
   * For 'promote_cohort' / 'promote_all' decisions, captures a Phase 5 pre-deployment
   * snapshot (config + feature flags) before the decision is recorded and Phase 6
   * deployment begins. Throws if the snapshot fails to persist, blocking Phase 6.
   */
  recordRolloutDecision(
    proposal_id: string,
    variant_id: string,
    decision: 'promote_cohort' | 'continue_observing' | 'rollback' | 'promote_all',
    cohort_id: string,
    current_cohort_size: number,
    reason: string,
    next_cohort_size?: number,
    feature_flag_state: Record<string, boolean> = {}
  ): RolloutDecisionLogEntry {
    if (decision === 'promote_cohort' || decision === 'promote_all') {
      const variant = this.variants.get(variant_id);
      const configState = (variant?.treatment_config.config as Record<string, any>) ?? {};

      this.snapshotCapture.capturePreDeploymentSnapshot(
        proposal_id,
        variant_id,
        configState,
        feature_flag_state
      );

      // Snapshot missing after capture: block Phase 6 deployment
      if (!this.snapshotCapture.hasSnapshot(proposal_id, variant_id)) {
        throw new Error(
          `Phase 5 snapshot capture failed for proposal=${proposal_id}, variant=${variant_id}. Phase 6 deployment blocked.`
        );
      }
    }

    const entry: RolloutDecisionLogEntry = {
      log_id: randomUUID(),
      proposal_id,
      variant_id,
      decision,
      cohort_id,
      current_cohort_size,
      next_cohort_size,
      reason,
      recorded_at: new Date().toISOString(),
    };

    // Append to immutable log
    this.decisionLog.push(entry);

    return entry;
  }

  /**
   * Get pipeline state for a proposal
   */
  getPipelineState(proposalId: string): RolloutPipelineState | undefined {
    return this.pipelineState.get(proposalId);
  }

  /**
   * Get all assignments for a proposal
   */
  getProposalAssignments(proposalId: string): Phase5CohortAssignment[] {
    return this.assignments.filter((a) => a.proposal_id === proposalId);
  }

  /**
   * Get all assignments for a variant
   */
  getVariantAssignments(variantId: string): Phase5CohortAssignment[] {
    return this.assignments.filter((a) => a.variant_id === variantId);
  }

  /**
   * Get rollout decisions for a variant
   */
  getVariantDecisions(variantId: string): RolloutDecisionLogEntry[] {
    return this.decisionLog.filter((d) => d.variant_id === variantId);
  }

  /**
   * Get all variants (read-only)
   */
  getAllVariants(): Phase5Variant[] {
    return Array.from(this.variants.values());
  }

  /**
   * Get all assignments (read-only)
   */
  getAllAssignments(): Phase5CohortAssignment[] {
    // Return copy to prevent external mutation
    return this.assignments.map((a) => ({ ...a }));
  }

  /**
   * Get all decisions (read-only)
   */
  getAllDecisions(): RolloutDecisionLogEntry[] {
    // Return copy to prevent external mutation
    return this.decisionLog.map((d) => ({ ...d }));
  }

  /**
   * Validate lineage: proposal → variant → assignment
   *
   * Returns error if chain is broken
   */
  validateLineage(proposalId: string): {
    valid: boolean;
    error?: string;
  } {
    // Find variant for proposal
    const variant = Array.from(this.variants.values()).find(
      (v) => v.proposal_id === proposalId
    );

    if (!variant) {
      return {
        valid: false,
        error: `No variant created for proposal: ${proposalId}`,
      };
    }

    // Find assignments for variant
    const assignments = this.assignments.filter(
      (a) => a.variant_id === variant.variant_id && a.proposal_id === proposalId
    );

    if (assignments.length === 0) {
      return {
        valid: false,
        error: `No cohort assignments for variant: ${variant.variant_id}`,
      };
    }

    return { valid: true };
  }

  /**
   * Private: Generate unique variant_id
   * Deterministic based on proposal_id
   */
  private generateVariantId(proposalId: string): string {
    const hash = this.simpleHash(proposalId);
    return `variant-${proposalId}-${hash.substring(0, 8)}`;
  }

  /**
   * Private: Generate unique assignment_id
   * Deterministic based on proposal_id + variant_id + user_id
   */
  private generateAssignmentId(
    proposalId: string,
    variantId: string,
    userId: string
  ): string {
    const combined = `${proposalId}:${variantId}:${userId}`;
    const hash = this.simpleHash(combined);
    return `assign-${hash.substring(0, 12)}`;
  }

  /**
   * Private: Generate cohort_id from target cohort size
   * Maps size (0.1, 0.25, 0.5, 1.0) to standard cohort IDs
   */
  private generateCohortId(size: number): string {
    const sizeMap: Record<number, string> = {
      0.1: 'cohort-10pct',
      0.25: 'cohort-25pct',
      0.5: 'cohort-50pct',
      1.0: 'cohort-100pct',
    };

    // Find matching size (within tolerance)
    for (const [sizeKey, cohortId] of Object.entries(sizeMap)) {
      const key = parseFloat(sizeKey);
      if (Math.abs(key - size) < 0.01) {
        return cohortId;
      }
    }

    // Fallback: generate ID from size
    return `cohort-${Math.round(size * 100)}pct`;
  }

  /**
   * Private: Simple deterministic hash function
   * Uses multiple iterations and mixing to ensure different inputs produce different outputs
   */
  private simpleHash(str: string): string {
    let hash = 5381; // DJB2 hash algorithm starting value
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) + hash) ^ char; // DJB2 mixing with XOR
    }

    // Additional mixing to improve distribution
    let mixed = hash;
    mixed = mixed >>> 0; // Convert to unsigned 32-bit
    mixed = ((mixed ^ (mixed >>> 15)) * 0x27d4eb2d) >>> 0;
    mixed = ((mixed ^ (mixed >>> 15)) * 0x27d4eb2d) >>> 0;
    mixed = (mixed ^ (mixed >>> 15)) >>> 0;

    return Math.abs(mixed).toString(16).padStart(16, '0');
  }
}
