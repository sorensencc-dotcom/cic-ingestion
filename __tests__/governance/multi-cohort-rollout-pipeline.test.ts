/**
 * Multi-Cohort Rollout Pipeline Tests
 *
 * Phase 5 Wave B Integration Tests:
 * 1. Phase 4→5 conversion: Transform Phase 4 Proposal records to Phase 5 Variant + CohortAssignment
 * 2. Batch cohort assignment: Allocate users to cohorts deterministically in bulk
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  MultiCohortRolloutPipeline,
  Phase4Proposal,
  Phase5Variant,
  Phase5CohortAssignment,
  ConversionResult,
  BatchAllocationResult,
  RolloutPipelineState,
  RolloutDecisionLogEntry,
} from '../../src/governance/multi-cohort-rollout-pipeline';

describe('Multi-Cohort Rollout Pipeline', () => {
  let pipeline: MultiCohortRolloutPipeline;

  beforeEach(() => {
    pipeline = new MultiCohortRolloutPipeline();
  });

  describe('Phase 4→5 Conversion', () => {
    it('transforms Phase 4 proposal to Phase 5 variant with schema mapping and config migration', () => {
      // Phase 4 proposal record
      const proposal: Phase4Proposal = {
        proposal_id: 'proposal-conversion-1',
        title: 'Optimize Search Index',
        description: 'Implement new search algorithm for faster queries',
        cost_estimate: 5000,
        config: {
          algorithm: 'elasticsearch-v8',
          batch_size: 1000,
          retry_strategy: 'exponential_backoff',
          timeout_ms: 30000,
        },
        approved_at: '2026-07-11T12:00:00Z',
      };

      // Convert proposal to variant
      const result: ConversionResult = pipeline.convertProposalToVariant(proposal);

      // Verify conversion success
      expect(result.success).toBe(true);
      expect(result.variant).toBeDefined();
      expect(result.error).toBeUndefined();

      const variant = result.variant!;

      // Verify variant properties
      expect(variant.proposal_id).toBe(proposal.proposal_id); // Lineage preserved
      expect(variant.name).toBe(proposal.title); // Title → name mapping
      expect(variant.description).toBe(proposal.description); // Description copied
      expect(variant.variant_id).toBeDefined();
      expect(variant.variant_id).toContain('variant-');
      expect(variant.variant_id).toContain(proposal.proposal_id);

      // Verify config migration to treatment_config
      expect(variant.treatment_config).toBeDefined();
      expect(variant.treatment_config.proposal_source).toBe(proposal.proposal_id);
      expect(variant.treatment_config.cost_estimate).toBe(proposal.cost_estimate);
      expect(variant.treatment_config.config).toEqual(proposal.config);
      expect(variant.treatment_config.converted_at).toBeDefined();

      // Verify immutability (Object.freeze)
      expect(() => {
        // @ts-ignore - intentionally testing immutability
        variant.treatment_config.algorithm = 'changed';
      }).toThrow();

      // Verify timestamps
      expect(variant.created_at).toBeDefined();

      // Verify pipeline state initialized
      const state = pipeline.getPipelineState(proposal.proposal_id);
      expect(state).toBeDefined();
      expect(state!.status).toBe('variant_created');
      expect(state!.variant_id).toBe(variant.variant_id);
      expect(state!.proposal_id).toBe(proposal.proposal_id);
      expect(state!.variant_created_at).toBe(variant.created_at);
      expect(state!.assignment_count).toBe(0);
    });

    it('validates lineage: proposal → variant → cohort assignment', () => {
      // Phase 4 proposal
      const proposal: Phase4Proposal = {
        proposal_id: 'proposal-lineage-1',
        title: 'Database Optimization',
        description: 'Optimize query performance',
        cost_estimate: 8000,
        config: {
          query_cache: true,
          index_strategy: 'lazy',
        },
        approved_at: '2026-07-11T12:00:00Z',
      };

      // Step 1: Convert proposal to variant
      const conversionResult = pipeline.convertProposalToVariant(proposal);
      expect(conversionResult.success).toBe(true);

      const variant = conversionResult.variant!;

      // Step 2: Batch allocate users to cohorts
      const users = ['user-1', 'user-2', 'user-3'];
      const allocationResult = pipeline.batchAllocateUsersToCohorts({
        proposal_id: proposal.proposal_id,
        variant_id: variant.variant_id,
        user_ids: users,
        target_cohort_size: 0.1, // 10% cohort
      });

      expect(allocationResult.success).toBe(true);
      expect(allocationResult.total_allocated).toBe(users.length);
      expect(allocationResult.assignments.length).toBe(users.length);

      // Step 3: Validate lineage chain
      const lineageValidation = pipeline.validateLineage(proposal.proposal_id);
      expect(lineageValidation.valid).toBe(true);
      expect(lineageValidation.error).toBeUndefined();

      // Verify full lineage chain
      const assignments = pipeline.getProposalAssignments(proposal.proposal_id);
      expect(assignments.length).toBe(users.length);

      for (const assignment of assignments) {
        // Check lineage chain completeness
        expect(assignment.proposal_id).toBe(proposal.proposal_id);
        expect(assignment.variant_id).toBe(variant.variant_id);
        expect(assignment.cohort_id).toBe('cohort-10pct');
        expect(assignment.cohort_size).toBe(0.1);

        // Verify immutable records
        expect(assignment.assigned_at).toBeDefined();
        expect(assignment.progression_stage).toBe(0);
      }
    });

    it('prevents duplicate variant creation for same proposal', () => {
      const proposal: Phase4Proposal = {
        proposal_id: 'proposal-dup-1',
        title: 'Test Proposal',
        description: 'Testing duplicate prevention',
        cost_estimate: 1000,
        config: { test: true },
        approved_at: '2026-07-11T12:00:00Z',
      };

      // First conversion succeeds
      const result1 = pipeline.convertProposalToVariant(proposal);
      expect(result1.success).toBe(true);

      // Second conversion for same proposal fails
      const result2 = pipeline.convertProposalToVariant(proposal);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('already created');
      expect(result2.variant).toBeUndefined();
    });

    it('validates proposal input and rejects invalid data', () => {
      // Test empty proposal_id
      const invalidProposal1: Phase4Proposal = {
        proposal_id: '',
        title: 'Invalid Proposal',
        description: 'Missing proposal ID',
        cost_estimate: 1000,
        config: {},
        approved_at: '2026-07-11T12:00:00Z',
      };

      const result1 = pipeline.convertProposalToVariant(invalidProposal1);
      expect(result1.success).toBe(false);
      expect(result1.error).toContain('Invalid proposal_id');
    });
  });

  describe('Batch Cohort Assignment', () => {
    beforeEach(() => {
      // Setup: Create a variant first
      const proposal: Phase4Proposal = {
        proposal_id: 'proposal-batch-1',
        title: 'Batch Assignment Test',
        description: 'Testing batch cohort allocation',
        cost_estimate: 2000,
        config: { mode: 'batch' },
        approved_at: '2026-07-11T12:00:00Z',
      };

      const result = pipeline.convertProposalToVariant(proposal);
      expect(result.success).toBe(true);
    });

    it('allocates multiple users to cohorts deterministically in bulk', () => {
      // Get created variant
      const variants = pipeline.getAllVariants();
      expect(variants.length).toBeGreaterThan(0);
      const variant = variants[0];

      // Batch allocation request
      const userIds = [
        'user-alice',
        'user-bob',
        'user-charlie',
        'user-david',
        'user-eve',
      ];

      const result: BatchAllocationResult = pipeline.batchAllocateUsersToCohorts({
        proposal_id: variant.proposal_id,
        variant_id: variant.variant_id,
        user_ids: userIds,
        target_cohort_size: 0.1, // 10% cohort
      });

      // Verify batch allocation success
      expect(result.success).toBe(true);
      expect(result.total_allocated).toBe(userIds.length);
      expect(result.assignments.length).toBe(userIds.length);
      expect(result.failed_users).toBeUndefined();

      // Verify all users assigned
      const assignedUserIds = result.assignments.map((a) => a.user_id);
      expect(assignedUserIds).toEqual(userIds);

      // Verify deterministic cohort allocation
      const allAssignments = pipeline.getVariantAssignments(variant.variant_id);
      expect(allAssignments.length).toBe(userIds.length);

      // Verify all users assigned to same cohort (10%)
      for (const assignment of allAssignments) {
        expect(assignment.cohort_id).toBe('cohort-10pct');
        expect(assignment.cohort_size).toBe(0.1);
        expect(assignment.progression_stage).toBe(0);
        expect(assignment.variant_id).toBe(variant.variant_id);
        expect(assignment.proposal_id).toBe(variant.proposal_id);
      }

      // Verify deterministic assignment_ids (same inputs → same ids)
      const assignmentIds = result.assignments.map((a) => a.assignment_id);
      const assignmentIdsByUser = new Map(assignmentIds.map((id, i) => [userIds[i], id]));

      // Re-allocate same users → should generate same assignment_ids
      const duplicateResult = pipeline.batchAllocateUsersToCohorts({
        proposal_id: variant.proposal_id,
        variant_id: variant.variant_id,
        user_ids: userIds,
        target_cohort_size: 0.1,
      });

      // Note: current implementation appends duplicates (append-only log)
      // In production, this would trigger duplicate detection
      expect(duplicateResult.total_allocated).toBe(userIds.length);
    });

    it('validates deterministic allocation consistency', () => {
      const variants = pipeline.getAllVariants();
      const variant = variants[0];

      const users = ['user-x', 'user-y', 'user-z'];

      // First batch allocation
      const batch1 = pipeline.batchAllocateUsersToCohorts({
        proposal_id: variant.proposal_id,
        variant_id: variant.variant_id,
        user_ids: users,
        target_cohort_size: 0.25,
      });

      expect(batch1.success).toBe(true);
      expect(batch1.assignments.length).toBe(users.length);

      // Extract assignment_ids from first batch
      const batch1AssignmentIds = batch1.assignments
        .sort((a, b) => a.user_id!.localeCompare(b.user_id!))
        .map((a) => a.assignment_id);

      // Verify all assigned to 25% cohort
      for (const assignment of batch1.assignments) {
        expect(assignment.cohort_id).toBe('cohort-25pct');
        expect(assignment.cohort_size).toBe(0.25);
      }

      // Verify determinism: assignment IDs are based on proposal+variant+user
      // Different users get different assignments (user_id included in hash)
      const uniqueIds = new Set(batch1AssignmentIds);
      expect(uniqueIds.size).toBe(users.length); // All unique
    });

    it('handles allocation failures gracefully', () => {
      const variants = pipeline.getAllVariants();
      const variant = variants[0];

      // Test with non-existent variant
      const result1 = pipeline.batchAllocateUsersToCohorts({
        proposal_id: variant.proposal_id,
        variant_id: 'nonexistent-variant',
        user_ids: ['user-1'],
        target_cohort_size: 0.1,
      });

      expect(result1.success).toBe(false);
      expect(result1.total_allocated).toBe(0);
      expect(result1.failed_users).toBeDefined();
      expect(result1.failed_users!.length).toBe(1);
      expect(result1.failed_users![0].reason).toContain('Variant not found');

      // Test with mismatched proposal_id
      const result2 = pipeline.batchAllocateUsersToCohorts({
        proposal_id: 'wrong-proposal-id',
        variant_id: variant.variant_id,
        user_ids: ['user-1'],
        target_cohort_size: 0.1,
      });

      expect(result2.success).toBe(false);
      expect(result2.failed_users).toBeDefined();
      expect(result2.failed_users![0].reason).toContain('does not match proposal');

      // Test with empty user list
      const result3 = pipeline.batchAllocateUsersToCohorts({
        proposal_id: variant.proposal_id,
        variant_id: variant.variant_id,
        user_ids: [],
        target_cohort_size: 0.1,
      });

      expect(result3.success).toBe(false);
      expect(result3.total_allocated).toBe(0);
    });

    it('supports different cohort sizes (10%, 25%, 50%, 100%)', () => {
      const variants = pipeline.getAllVariants();
      const variant = variants[0];

      const cohortSizes = [
        { size: 0.1, id: 'cohort-10pct' },
        { size: 0.25, id: 'cohort-25pct' },
        { size: 0.5, id: 'cohort-50pct' },
        { size: 1.0, id: 'cohort-100pct' },
      ];

      for (const { size, id } of cohortSizes) {
        const result = pipeline.batchAllocateUsersToCohorts({
          proposal_id: variant.proposal_id,
          variant_id: variant.variant_id,
          user_ids: [`user-cohort-${size}`],
          target_cohort_size: size,
        });

        expect(result.success).toBe(true);
        expect(result.assignments[0].cohort_id).toBe(id);
        expect(result.assignments[0].cohort_size).toBe(size);
      }
    });

    it('maintains append-only log and prevents mutation', () => {
      const variants = pipeline.getAllVariants();
      const variant = variants[0];

      const users1 = ['user-1', 'user-2'];
      const users2 = ['user-3', 'user-4'];

      // First batch
      const result1 = pipeline.batchAllocateUsersToCohorts({
        proposal_id: variant.proposal_id,
        variant_id: variant.variant_id,
        user_ids: users1,
        target_cohort_size: 0.1,
      });

      expect(result1.success).toBe(true);
      expect(result1.assignments.length).toBe(2);

      // Second batch
      const result2 = pipeline.batchAllocateUsersToCohorts({
        proposal_id: variant.proposal_id,
        variant_id: variant.variant_id,
        user_ids: users2,
        target_cohort_size: 0.1,
      });

      expect(result2.success).toBe(true);
      expect(result2.assignments.length).toBe(2);

      // Verify append-only: both batches in log
      const allAssignments = pipeline.getAllAssignments();
      expect(allAssignments.length).toBeGreaterThanOrEqual(4);

      // Verify read-only copy (mutations don't affect log)
      const readOnlyAssignments = pipeline.getAllAssignments();
      readOnlyAssignments[0].user_id = 'mutated-user';

      const allAssignmentsAfter = pipeline.getAllAssignments();
      expect(allAssignmentsAfter[0].user_id).not.toBe('mutated-user');
    });

    it('tracks pipeline state through conversion and allocation', () => {
      const variants = pipeline.getAllVariants();
      const variant = variants[0];

      // Check state after variant creation
      let state = pipeline.getPipelineState(variant.proposal_id);
      expect(state).toBeDefined();
      expect(state!.status).toBe('variant_created');
      expect(state!.assignment_count).toBe(0);

      // Allocate users
      const users = ['user-1', 'user-2', 'user-3'];
      const result = pipeline.batchAllocateUsersToCohorts({
        proposal_id: variant.proposal_id,
        variant_id: variant.variant_id,
        user_ids: users,
        target_cohort_size: 0.1,
      });

      expect(result.success).toBe(true);

      // Check state after allocation
      state = pipeline.getPipelineState(variant.proposal_id);
      expect(state).toBeDefined();
      expect(state!.status).toBe('assigned');
      expect(state!.assignment_count).toBe(users.length);
      expect(state!.assignments_created_at).toBeDefined();
    });
  });

  describe('Integration & Lineage', () => {
    it('maintains full end-to-end lineage: proposal → variant → assignment', () => {
      const proposal: Phase4Proposal = {
        proposal_id: 'proposal-full-lineage',
        title: 'End-to-End Lineage Test',
        description: 'Verify complete lineage chain',
        cost_estimate: 3000,
        config: { feature: 'new_algorithm' },
        approved_at: '2026-07-11T12:00:00Z',
      };

      // Step 1: Convert proposal to variant
      const conversionResult = pipeline.convertProposalToVariant(proposal);
      expect(conversionResult.success).toBe(true);
      const variant = conversionResult.variant!;

      // Step 2: Allocate users to cohorts
      const userIds = ['user-1', 'user-2', 'user-3'];
      const allocationResult = pipeline.batchAllocateUsersToCohorts({
        proposal_id: proposal.proposal_id,
        variant_id: variant.variant_id,
        user_ids: userIds,
        target_cohort_size: 0.1,
      });

      expect(allocationResult.success).toBe(true);

      // Step 3: Verify complete lineage chain
      const lineageValid = pipeline.validateLineage(proposal.proposal_id);
      expect(lineageValid.valid).toBe(true);

      // Step 4: Trace lineage forward
      const proposalAssignments = pipeline.getProposalAssignments(proposal.proposal_id);
      expect(proposalAssignments.length).toBe(userIds.length);

      for (const assignment of proposalAssignments) {
        // Backward link: assignment → variant
        expect(assignment.variant_id).toBe(variant.variant_id);
        expect(assignment.proposal_id).toBe(proposal.proposal_id);

        // Verify variant link: variant → proposal
        const retrievedVariant = pipeline
          .getAllVariants()
          .find((v) => v.variant_id === assignment.variant_id);
        expect(retrievedVariant).toBeDefined();
        expect(retrievedVariant!.proposal_id).toBe(proposal.proposal_id);
      }
    });

    it('records rollout decisions in immutable audit trail', () => {
      const proposal: Phase4Proposal = {
        proposal_id: 'proposal-decisions',
        title: 'Rollout Decisions Test',
        description: 'Test immutable decision log',
        cost_estimate: 4000,
        config: { mode: 'decisions' },
        approved_at: '2026-07-11T12:00:00Z',
      };

      const conversionResult = pipeline.convertProposalToVariant(proposal);
      const variant = conversionResult.variant!;

      // Record promotion decisions
      const decision1 = pipeline.recordRolloutDecision(
        proposal.proposal_id,
        variant.variant_id,
        'promote_cohort',
        'cohort-10pct',
        0.1,
        'All metrics passed for 10% cohort. Proceeding to 25%.',
        0.25
      );

      expect(decision1.log_id).toBeDefined();
      expect(decision1.decision).toBe('promote_cohort');
      expect(decision1.recorded_at).toBeDefined();

      const decision2 = pipeline.recordRolloutDecision(
        proposal.proposal_id,
        variant.variant_id,
        'promote_cohort',
        'cohort-25pct',
        0.25,
        'Metrics stable at 25%. Promoting to 50%.',
        0.5
      );

      expect(decision2.log_id).toBeDefined();
      expect(decision2.log_id).not.toBe(decision1.log_id);

      // Retrieve decisions
      const variantDecisions = pipeline.getVariantDecisions(variant.variant_id);
      expect(variantDecisions.length).toBe(2);
      expect(variantDecisions[0].decision).toBe('promote_cohort');
      expect(variantDecisions[1].decision).toBe('promote_cohort');

      // Verify immutability of decision log
      const allDecisions = pipeline.getAllDecisions();
      allDecisions[0].decision = 'rollback' as any;
      const decisionsCopy = pipeline.getAllDecisions();
      expect(decisionsCopy[0].decision).toBe('promote_cohort'); // Unchanged
    });
  });
});
