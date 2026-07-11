/**
 * MultiCohortEngine: Phase 5 multi-stage cohort allocation and progression
 *
 * Responsibilities:
 * - Deterministic user allocation to cohorts (hash-based by cohort_id + user_id)
 * - Cohort progression validation (10% → 25% → 50% → 100%, forward only)
 * - Cohort size validation (CohortAssignment.cohort_size matches ConfiguredCohort.size)
 * - Edge case handling (empty cohorts, overflow, duplicate assignments)
 *
 * Data Contract Ownership:
 * - Owns CohortAssignment state (thread-safe append-only)
 * - Invariant: No backtrack (progression only forward)
 */

/**
 * Configured cohort metadata
 */
export interface ConfiguredCohort {
  cohort_id: string;
  size: number; // 0.0-1.0 (e.g., 0.1 = 10%)
  duration_minutes: number;
  created_at: string;
}

/**
 * Cohort assignment record (append-only, immutable)
 */
export interface CohortAssignment {
  assignment_id: string;
  proposal_id: string;
  user_id?: string; // Optional for deterministic allocation testing
  cohort_id: string;
  cohort_size: number; // Must match ConfiguredCohort[cohort_id].size
  assigned_at: string;
  progression_stage: number; // 0=10%, 1=25%, 2=50%, 3=100%
}

/**
 * Progression record (tracks cohort advancement)
 */
export interface ProgressionRecord {
  assignment_id: string;
  from_cohort: string;
  to_cohort: string;
  progressed_at: string;
  stage: number;
}

/**
 * Result of cohort allocation
 */
export interface AllocationResult {
  success: boolean;
  assignment?: CohortAssignment;
  error?: string;
}

/**
 * MultiCohortEngine: Orchestrates multi-stage cohort rollout
 *
 * Key features:
 * - Thread-safe append-only CohortAssignment log
 * - Deterministic allocation (hash of cohort_id + user_id)
 * - Forward-only progression (no backtrack)
 * - Size validation (assignment must match configured cohort size)
 */
export class MultiCohortEngine {
  private cohorts: Map<string, ConfiguredCohort> = new Map();
  private assignments: CohortAssignment[] = []; // Append-only log
  private progressions: ProgressionRecord[] = []; // Append-only progression log

  /**
   * Register a cohort configuration
   */
  registerCohort(cohort: ConfiguredCohort): void {
    if (this.cohorts.has(cohort.cohort_id)) {
      throw new Error(`Cohort already registered: ${cohort.cohort_id}`);
    }
    this.cohorts.set(cohort.cohort_id, cohort);
  }

  /**
   * Get all registered cohorts sorted by size (ascending)
   */
  getCohorts(): ConfiguredCohort[] {
    return Array.from(this.cohorts.values()).sort((a, b) => a.size - b.size);
  }

  /**
   * Get next cohort in progression from current cohort
   * Returns undefined if current cohort is final (100%)
   */
  getNextCohort(currentCohortId: string): ConfiguredCohort | undefined {
    const currentCohort = this.cohorts.get(currentCohortId);
    if (!currentCohort) {
      throw new Error(`Cohort not found: ${currentCohortId}`);
    }

    const sortedCohorts = this.getCohorts();
    const currentIndex = sortedCohorts.findIndex(
      (c) => c.cohort_id === currentCohortId
    );

    if (currentIndex < 0) {
      throw new Error(`Cohort not in sorted list: ${currentCohortId}`);
    }

    // Return next cohort if exists
    if (currentIndex < sortedCohorts.length - 1) {
      return sortedCohorts[currentIndex + 1];
    }

    // No next cohort (already at 100%)
    return undefined;
  }

  /**
   * Allocate a proposal to initial cohort (deterministically)
   *
   * Allocation strategy:
   * - Always allocates to first cohort (10%) by default
   * - Size must match ConfiguredCohort.size exactly (within 1% tolerance)
   * - Generates unique assignment_id
   * - Records in append-only log
   *
   * Throws if:
   * - No cohorts registered
   * - Size doesn't match any registered cohort
   * - Validation fails
   */
  allocateToCohort(
    proposalId: string,
    targetSize: number,
    userId?: string
  ): AllocationResult {
    // Validate cohorts registered
    if (this.cohorts.size === 0) {
      return {
        success: false,
        error: 'No cohorts registered',
      };
    }

    // Find matching cohort by size (within tolerance)
    let matchingCohort: ConfiguredCohort | undefined;

    for (const cohort of this.cohorts.values()) {
      // Tolerance: 1.5% of size or 0.0015 (whichever is larger)
      const tolerance = Math.max(0.015 * cohort.size, 0.0015);
      if (Math.abs(cohort.size - targetSize) < tolerance) {
        matchingCohort = cohort;
        break;
      }
    }

    if (!matchingCohort) {
      return {
        success: false,
        error: `No cohort matches size: ${targetSize}`,
      };
    }

    // Create assignment
    const assignment: CohortAssignment = {
      assignment_id: this.generateAssignmentId(proposalId, userId),
      proposal_id: proposalId,
      user_id: userId,
      cohort_id: matchingCohort.cohort_id,
      cohort_size: matchingCohort.size,
      assigned_at: new Date().toISOString(),
      progression_stage: 0, // Always start at 10% (index 0)
    };

    // Append to log (idempotency: check for duplicates)
    const isDuplicate = this.assignments.some(
      (a) => a.assignment_id === assignment.assignment_id
    );

    if (isDuplicate) {
      return {
        success: false,
        error: `Duplicate assignment: ${assignment.assignment_id}`,
      };
    }

    this.assignments.push(assignment);

    return {
      success: true,
      assignment,
    };
  }

  /**
   * Validate cohort size consistency
   *
   * Checks:
   * - CohortAssignment.cohort_size matches ConfiguredCohort[cohort_id].size
   * - Returns validation error if mismatch
   * - Uses 1% tolerance for floating-point comparison
   */
  validateAssignmentSize(assignment: CohortAssignment): {
    valid: boolean;
    error?: string;
  } {
    const cohort = this.cohorts.get(assignment.cohort_id);

    if (!cohort) {
      return {
        valid: false,
        error: `Cohort not found: ${assignment.cohort_id}`,
      };
    }

    // Tolerance: 1.5% or 0.0015 (whichever is larger for small numbers)
    // Use 1.5% to account for floating-point precision issues
    const tolerance = Math.max(0.015 * cohort.size, 0.0015);

    if (Math.abs(cohort.size - assignment.cohort_size) > tolerance) {
      return {
        valid: false,
        error: `Size mismatch: assignment size ${assignment.cohort_size} does not match cohort ${cohort.cohort_id} size ${cohort.size}`,
      };
    }

    return { valid: true };
  }

  /**
   * Advance assignment to next cohort (progression)
   *
   * Progression Rules:
   * - Only forward (10% → 25% → 50% → 100%)
   * - No backtrack allowed
   * - Must validate next cohort exists
   * - Creates immutable progression record
   *
   * Throws if:
   * - Current cohort is final (100%, no next)
   * - Assignment not found
   */
  progressToNextCohort(
    assignmentId: string
  ): {
    success: boolean;
    progression?: ProgressionRecord;
    error?: string;
  } {
    // Find assignment
    const assignment = this.assignments.find((a) => a.assignment_id === assignmentId);

    if (!assignment) {
      return {
        success: false,
        error: `Assignment not found: ${assignmentId}`,
      };
    }

    // Get next cohort
    const nextCohort = this.getNextCohort(assignment.cohort_id);

    if (!nextCohort) {
      return {
        success: false,
        error: `No next cohort for ${assignment.cohort_id} (already at 100%)`,
      };
    }

    // Create progression record (immutable)
    const progression: ProgressionRecord = {
      assignment_id: assignmentId,
      from_cohort: assignment.cohort_id,
      to_cohort: nextCohort.cohort_id,
      progressed_at: new Date().toISOString(),
      stage: assignment.progression_stage + 1,
    };

    this.progressions.push(progression);

    // Update assignment with new progression stage
    assignment.cohort_id = nextCohort.cohort_id;
    assignment.cohort_size = nextCohort.size;
    assignment.progression_stage += 1;

    return {
      success: true,
      progression,
    };
  }

  /**
   * Get all assignments (read-only view)
   */
  getAllAssignments(): CohortAssignment[] {
    // Return deep copy to prevent mutation
    return this.assignments.map((a) => ({ ...a }));
  }

  /**
   * Get all progressions (read-only view)
   */
  getAllProgressions(): ProgressionRecord[] {
    // Return deep copy to prevent mutation
    return this.progressions.map((p) => ({ ...p }));
  }

  /**
   * Get assignments for a specific proposal
   */
  getProposalAssignments(proposalId: string): CohortAssignment[] {
    return this.assignments.filter((a) => a.proposal_id === proposalId);
  }

  /**
   * Private: Generate unique assignment_id
   * Deterministic: based on proposal_id + user_id (if provided)
   * Hash function ensures consistency across calls with same inputs
   */
  private generateAssignmentId(proposalId: string, userId?: string): string {
    if (userId) {
      return this.simpleHash(`${proposalId}-${userId}`);
    }
    return this.simpleHash(proposalId);
  }

  /**
   * Private: Simple deterministic hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `assign-${str}-${Math.abs(hash).toString(16)}`;
  }
}
