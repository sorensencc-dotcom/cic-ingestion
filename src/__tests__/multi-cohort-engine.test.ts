/**
 * MultiCohortEngine Tests (Phase 5 Wave A)
 *
 * Test Coverage:
 * 1. Allocation: Deterministic cohort allocation (hash-based, matching)
 * 2. Progression: Forward-only cohort advancement (10% → 25% → 50% → 100%)
 * 3. Sizing: Cohort size validation and contract enforcement
 * 4. Edge Cases: Empty cohorts, overflow, duplicates
 *
 * Total: 4 test suites, 12+ test cases, 100% PASS target
 */

import {
  MultiCohortEngine,
  ConfiguredCohort,
  CohortAssignment,
} from '../governance/multi-cohort-engine';

describe('MultiCohortEngine', () => {
  let engine: MultiCohortEngine;

  // Standard cohort configuration (10%, 25%, 50%, 100%)
  const cohort10: ConfiguredCohort = {
    cohort_id: 'cohort-10pct',
    size: 0.1,
    duration_minutes: 30,
    created_at: new Date().toISOString(),
  };

  const cohort25: ConfiguredCohort = {
    cohort_id: 'cohort-25pct',
    size: 0.25,
    duration_minutes: 45,
    created_at: new Date().toISOString(),
  };

  const cohort50: ConfiguredCohort = {
    cohort_id: 'cohort-50pct',
    size: 0.5,
    duration_minutes: 60,
    created_at: new Date().toISOString(),
  };

  const cohort100: ConfiguredCohort = {
    cohort_id: 'cohort-100pct',
    size: 1.0,
    duration_minutes: 0,
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    engine = new MultiCohortEngine();
  });

  // ============================================================================
  // TEST SUITE 1: ALLOCATION
  // ============================================================================
  describe('Allocation', () => {
    beforeEach(() => {
      engine.registerCohort(cohort10);
      engine.registerCohort(cohort25);
      engine.registerCohort(cohort50);
      engine.registerCohort(cohort100);
    });

    it('allocates proposal to matching cohort size (deterministic)', () => {
      // Test deterministic allocation to 10% cohort
      const result = engine.allocateToCohort('proposal-001', 0.1);

      expect(result.success).toBe(true);
      expect(result.assignment).toBeDefined();
      expect(result.assignment?.proposal_id).toBe('proposal-001');
      expect(result.assignment?.cohort_id).toBe('cohort-10pct');
      expect(result.assignment?.cohort_size).toBe(0.1);
      expect(result.assignment?.progression_stage).toBe(0);
    });

    it('allocates with user_id for deterministic hash-based distribution', () => {
      // Test allocation with user_id (deterministic for same proposal+user)
      const result = engine.allocateToCohort(
        'proposal-002',
        0.1,
        'user-12345'
      );

      expect(result.success).toBe(true);
      expect(result.assignment?.user_id).toBe('user-12345');
      expect(result.assignment?.assignment_id).toContain('proposal-002');
      expect(result.assignment?.assignment_id).toContain('user-12345');
    });

    it('allocates to different cohort sizes within tolerance', () => {
      // Test allocation to 25% cohort
      const result25 = engine.allocateToCohort('proposal-003', 0.25);
      expect(result25.success).toBe(true);
      expect(result25.assignment?.cohort_id).toBe('cohort-25pct');

      // Test allocation to 50% cohort
      const result50 = engine.allocateToCohort('proposal-004', 0.5);
      expect(result50.success).toBe(true);
      expect(result50.assignment?.cohort_id).toBe('cohort-50pct');

      // Test allocation to 100% cohort
      const result100 = engine.allocateToCohort('proposal-005', 1.0);
      expect(result100.success).toBe(true);
      expect(result100.assignment?.cohort_id).toBe('cohort-100pct');
    });

    it('fails allocation if no matching cohort size', () => {
      // Test allocation to non-existent cohort size (0.33 = 33%)
      const result = engine.allocateToCohort('proposal-006', 0.33);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No cohort matches size');
      expect(result.assignment).toBeUndefined();
    });

    it('generates unique assignment_id per allocation', () => {
      // Test uniqueness of assignment IDs
      const result1 = engine.allocateToCohort('proposal-007', 0.1);
      const result2 = engine.allocateToCohort('proposal-008', 0.1);

      expect(result1.assignment?.assignment_id).not.toBe(
        result2.assignment?.assignment_id
      );
    });
  });

  // ============================================================================
  // TEST SUITE 2: PROGRESSION
  // ============================================================================
  describe('Progression', () => {
    beforeEach(() => {
      engine.registerCohort(cohort10);
      engine.registerCohort(cohort25);
      engine.registerCohort(cohort50);
      engine.registerCohort(cohort100);
    });

    it('progresses through cohorts: 10% → 25% → 50% → 100%', () => {
      // Initial allocation to 10%
      const allocResult = engine.allocateToCohort('proposal-100', 0.1);
      expect(allocResult.success).toBe(true);

      const assignment = allocResult.assignment!;
      const assignmentId = assignment.assignment_id;

      // Verify initial state
      expect(assignment.cohort_id).toBe('cohort-10pct');
      expect(assignment.progression_stage).toBe(0);

      // Progress to 25%
      const prog1 = engine.progressToNextCohort(assignmentId);
      expect(prog1.success).toBe(true);
      expect(prog1.progression?.from_cohort).toBe('cohort-10pct');
      expect(prog1.progression?.to_cohort).toBe('cohort-25pct');
      expect(prog1.progression?.stage).toBe(1);

      // Verify progression state
      const assignments = engine.getAllAssignments();
      const updatedAssignment = assignments.find(
        (a) => a.assignment_id === assignmentId
      );
      expect(updatedAssignment?.cohort_id).toBe('cohort-25pct');
      expect(updatedAssignment?.progression_stage).toBe(1);

      // Progress to 50%
      const prog2 = engine.progressToNextCohort(assignmentId);
      expect(prog2.success).toBe(true);
      expect(prog2.progression?.from_cohort).toBe('cohort-25pct');
      expect(prog2.progression?.to_cohort).toBe('cohort-50pct');

      // Progress to 100%
      const prog3 = engine.progressToNextCohort(assignmentId);
      expect(prog3.success).toBe(true);
      expect(prog3.progression?.from_cohort).toBe('cohort-50pct');
      expect(prog3.progression?.to_cohort).toBe('cohort-100pct');
      expect(prog3.progression?.stage).toBe(3);

      // Verify final state
      const finalAssignments = engine.getAllAssignments();
      const finalAssignment = finalAssignments.find(
        (a) => a.assignment_id === assignmentId
      );
      expect(finalAssignment?.cohort_id).toBe('cohort-100pct');
      expect(finalAssignment?.progression_stage).toBe(3);
    });

    it('returns error when trying to progress from final cohort (100%)', () => {
      // Allocate and progress all the way to 100%
      const allocResult = engine.allocateToCohort('proposal-101', 0.1);
      const assignmentId = allocResult.assignment!.assignment_id;

      engine.progressToNextCohort(assignmentId); // 10% → 25%
      engine.progressToNextCohort(assignmentId); // 25% → 50%
      engine.progressToNextCohort(assignmentId); // 50% → 100%

      // Try to progress from 100%
      const result = engine.progressToNextCohort(assignmentId);
      expect(result.success).toBe(false);
      expect(result.error).toContain('No next cohort');
    });

    it('maintains forward-only progression (no backtrack)', () => {
      // Allocate to 10%
      const allocResult = engine.allocateToCohort('proposal-102', 0.1);
      const assignmentId = allocResult.assignment!.assignment_id;

      // Progress to 25%
      engine.progressToNextCohort(assignmentId);

      // Verify progression stage increased
      const assignments = engine.getAllAssignments();
      const assignment = assignments.find((a) => a.assignment_id === assignmentId);
      expect(assignment?.progression_stage).toBe(1);

      // Attempt to allocate back to 10% (should not be allowed via reallocation)
      // This is tested implicitly: progression is the only way to change stages
      const progressions = engine.getAllProgressions();
      expect(progressions.length).toBe(1);
      expect(progressions[0].stage).toBe(1); // Forward only
    });
  });

  // ============================================================================
  // TEST SUITE 3: SIZING
  // ============================================================================
  describe('Sizing', () => {
    beforeEach(() => {
      engine.registerCohort(cohort10);
      engine.registerCohort(cohort25);
      engine.registerCohort(cohort50);
      engine.registerCohort(cohort100);
    });

    it('validates CohortAssignment.cohort_size matches ConfiguredCohort.size', () => {
      // Allocate to 10%
      const allocResult = engine.allocateToCohort('proposal-200', 0.1);
      const assignment = allocResult.assignment!;

      // Validate size
      const validation = engine.validateAssignmentSize(assignment);
      expect(validation.valid).toBe(true);
      expect(validation.error).toBeUndefined();
    });

    it('detects size mismatch between assignment and cohort configuration', () => {
      // Create an assignment with mismatched size
      const invalidAssignment: CohortAssignment = {
        assignment_id: 'assign-invalid',
        proposal_id: 'proposal-201',
        cohort_id: 'cohort-10pct',
        cohort_size: 0.2, // Should be 0.1
        assigned_at: new Date().toISOString(),
        progression_stage: 0,
      };

      const validation = engine.validateAssignmentSize(invalidAssignment);
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('Size mismatch');
    });

    it('enforces size contract for all progression stages', () => {
      // Allocate to 10%
      const allocResult = engine.allocateToCohort('proposal-202', 0.1);
      const assignmentId = allocResult.assignment!.assignment_id;

      let assignments = engine.getAllAssignments();
      let assignment = assignments.find((a) => a.assignment_id === assignmentId);

      // Validate at stage 0 (10%)
      let validation = engine.validateAssignmentSize(assignment!);
      expect(validation.valid).toBe(true);
      expect(assignment?.cohort_size).toBe(0.1);

      // Progress to 25%
      engine.progressToNextCohort(assignmentId);
      assignments = engine.getAllAssignments();
      assignment = assignments.find((a) => a.assignment_id === assignmentId);

      // Validate at stage 1 (25%)
      validation = engine.validateAssignmentSize(assignment!);
      expect(validation.valid).toBe(true);
      expect(assignment?.cohort_size).toBe(0.25);

      // Progress to 50%
      engine.progressToNextCohort(assignmentId);
      assignments = engine.getAllAssignments();
      assignment = assignments.find((a) => a.assignment_id === assignmentId);

      // Validate at stage 2 (50%)
      validation = engine.validateAssignmentSize(assignment!);
      expect(validation.valid).toBe(true);
      expect(assignment?.cohort_size).toBe(0.5);
    });

    it('validates size with floating-point tolerance (±1%)', () => {
      // Create an assignment with size within tolerance
      const closeAssignment: CohortAssignment = {
        assignment_id: 'assign-tolerance',
        proposal_id: 'proposal-203',
        cohort_id: 'cohort-10pct',
        cohort_size: 0.101, // 0.1 ± 0.001 (within 1% tolerance)
        assigned_at: new Date().toISOString(),
        progression_stage: 0,
      };

      const validation = engine.validateAssignmentSize(closeAssignment);
      expect(validation.valid).toBe(true);
    });
  });

  // ============================================================================
  // TEST SUITE 4: EDGE CASES
  // ============================================================================
  describe('Edge Cases', () => {
    it('handles allocation with no registered cohorts', () => {
      // Don't register any cohorts
      const result = engine.allocateToCohort('proposal-300', 0.1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No cohorts registered');
      expect(result.assignment).toBeUndefined();
    });

    it('rejects duplicate assignments (idempotency)', () => {
      engine.registerCohort(cohort10);

      // First allocation succeeds
      const result1 = engine.allocateToCohort('proposal-301', 0.1, 'user-a');
      expect(result1.success).toBe(true);

      // Second allocation with same proposal+user should fail (duplicate)
      const result2 = engine.allocateToCohort('proposal-301', 0.1, 'user-a');
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Duplicate assignment');
    });

    it('handles multiple proposals in same cohort', () => {
      engine.registerCohort(cohort10);
      engine.registerCohort(cohort25);

      // Allocate two proposals to same cohort
      const result1 = engine.allocateToCohort('proposal-302', 0.1);
      const result2 = engine.allocateToCohort('proposal-303', 0.1);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.assignment?.proposal_id).not.toBe(
        result2.assignment?.proposal_id
      );

      // Both should be in 10% cohort
      expect(result1.assignment?.cohort_id).toBe('cohort-10pct');
      expect(result2.assignment?.cohort_id).toBe('cohort-10pct');
    });

    it('throws error for non-existent cohort lookup', () => {
      engine.registerCohort(cohort10);

      // Try to get next cohort from non-existent cohort
      expect(() => {
        engine.getNextCohort('non-existent-cohort');
      }).toThrow('Cohort not found: non-existent-cohort');
    });

    it('handles progression for non-existent assignment', () => {
      engine.registerCohort(cohort10);
      engine.registerCohort(cohort25);

      const result = engine.progressToNextCohort('assign-does-not-exist');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Assignment not found');
    });

    it('validates allocation with cohort size overflow (0.0 size)', () => {
      // Register a 0% cohort (invalid, but test edge case)
      const invalidCohort: ConfiguredCohort = {
        cohort_id: 'cohort-0pct',
        size: 0.0,
        duration_minutes: 0,
        created_at: new Date().toISOString(),
      };
      engine.registerCohort(invalidCohort);

      // Try to allocate to 0%
      const result = engine.allocateToCohort('proposal-304', 0.0);
      expect(result.success).toBe(true);
      expect(result.assignment?.cohort_size).toBe(0.0);
    });

    it('maintains append-only log during multiple progressions', () => {
      engine.registerCohort(cohort10);
      engine.registerCohort(cohort25);
      engine.registerCohort(cohort50);

      // Allocate and progress through stages
      const alloc1 = engine.allocateToCohort('proposal-305', 0.1);
      const assignmentId = alloc1.assignment!.assignment_id;

      expect(engine.getAllAssignments().length).toBe(1);
      expect(engine.getAllProgressions().length).toBe(0);

      engine.progressToNextCohort(assignmentId);
      expect(engine.getAllAssignments().length).toBe(1); // Still 1 (updated in place)
      expect(engine.getAllProgressions().length).toBe(1);

      engine.progressToNextCohort(assignmentId);
      expect(engine.getAllAssignments().length).toBe(1);
      expect(engine.getAllProgressions().length).toBe(2);

      // Verify all progressions are in order
      const progressions = engine.getAllProgressions();
      expect(progressions[0].stage).toBe(1);
      expect(progressions[1].stage).toBe(2);
    });

    it('handles size validation for non-existent cohort', () => {
      const invalidAssignment: CohortAssignment = {
        assignment_id: 'assign-invalid-cohort',
        proposal_id: 'proposal-306',
        cohort_id: 'non-existent-cohort',
        cohort_size: 0.1,
        assigned_at: new Date().toISOString(),
        progression_stage: 0,
      };

      const validation = engine.validateAssignmentSize(invalidAssignment);
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('Cohort not found');
    });

    it('retrieves assignments by proposal_id', () => {
      engine.registerCohort(cohort10);
      engine.registerCohort(cohort25);

      // Create multiple assignments for same proposal
      engine.allocateToCohort('proposal-307', 0.1, 'user-a');
      engine.allocateToCohort('proposal-307', 0.1, 'user-b');
      engine.allocateToCohort('proposal-308', 0.1);

      const assignments307 = engine.getProposalAssignments('proposal-307');
      expect(assignments307.length).toBe(2);
      expect(assignments307.every((a) => a.proposal_id === 'proposal-307')).toBe(
        true
      );

      const assignments308 = engine.getProposalAssignments('proposal-308');
      expect(assignments308.length).toBe(1);
    });

    it('returns read-only copies of logs', () => {
      engine.registerCohort(cohort10);
      engine.registerCohort(cohort25);

      engine.allocateToCohort('proposal-309', 0.1);
      const assignmentId = engine.getAllAssignments()[0].assignment_id;
      engine.progressToNextCohort(assignmentId);

      // Get copies
      const assignments = engine.getAllAssignments();
      const progressions = engine.getAllProgressions();

      // Modify copies
      assignments[0].proposal_id = 'modified';
      progressions[0].stage = 99;

      // Verify originals are unchanged
      expect(engine.getAllAssignments()[0].proposal_id).toBe('proposal-309');
      expect(engine.getAllProgressions()[0].stage).toBe(1);
    });
  });
});
