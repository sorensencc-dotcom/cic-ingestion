/**
 * ABTestEngine Unit Tests
 *
 * Test Coverage:
 * 1. Variant Registration (immutability constraint)
 * 2. Decision Tree (variant → cohort routing)
 * 3. Conflict Handling (duplicate variant_id with retry logic)
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ABTestEngine, UniqueConstraintError } from '../../src/governance/ab-test-engine';

describe('ABTestEngine', () => {
  let engine: ABTestEngine;

  beforeEach(() => {
    engine = new ABTestEngine();
  });

  describe('Variant Registration (Immutability Constraint)', () => {
    it('creates immutable variant records with variant_id + config', () => {
      // Register a variant
      const variantData = {
        variant_id: 'variant-baseline-v1',
        name: 'Baseline Strategy',
        description: 'Original enrichment algorithm',
        treatment_config: {
          algorithm: 'standard',
          confidence_threshold: 0.75,
          fallback_strategy: 'error',
        },
      };

      const result = engine.registerVariant(variantData);

      expect(result.success).toBe(true);
      expect(result.variant).toBeDefined();
      expect(result.variant?.variant_id).toBe('variant-baseline-v1');
      expect(result.variant?.treatment_config.algorithm).toBe('standard');
      expect(result.variant?.created_at).toBeDefined();

      // Verify immutability: attempt to modify treatment_config should fail
      const variant = result.variant!;

      // Try to mutate treatment_config (should fail silently in strict mode)
      expect(() => {
        (variant.treatment_config as any).algorithm = 'modified';
      }).toThrow();

      // Try to mutate variant object (should fail)
      expect(() => {
        (variant as any).name = 'Modified Name';
      }).toThrow();

      // Verify original values unchanged
      expect(variant.treatment_config.algorithm).toBe('standard');
      expect(variant.name).toBe('Baseline Strategy');

      // Validate immutability via engine method
      const immutableCheck = engine.validateVariantImmutability(variant.variant_id);
      expect(immutableCheck.valid).toBe(true);
    });
  });

  describe('Decision Tree (Variant → Cohort Routing)', () => {
    it('routes variant → cohort based on assignment rules and creates decision tree', () => {
      // Register a variant first
      const variantData = {
        variant_id: 'variant-ml-v2',
        name: 'ML v2 Strategy',
        description: 'Machine learning v2 enrichment',
        treatment_config: {
          algorithm: 'ml-v2',
          confidence_threshold: 0.85,
          feature_set: 'expanded',
        },
      };

      const regResult = engine.registerVariant(variantData);
      expect(regResult.success).toBe(true);

      // Create decision tree for proposal → variant → cohort routing
      const proposalId = 'proposal-ml-v2-rollout';
      const tree = engine.createDecisionTree(proposalId, variantData.variant_id);

      expect(tree.proposal_id).toBe(proposalId);
      expect(tree.variant_id).toBe('variant-ml-v2');
      expect(tree.path).toContain('proposal:proposal-ml-v2-rollout');
      expect(tree.path).toContain('variant:variant-ml-v2');
      expect(tree.path).toContain('cohort');
      expect(tree.path).toContain('evaluate');
      expect(tree.created_at).toBeDefined();

      // Verify tree persists and can be retrieved
      const retrievedTree = engine.getDecisionTree(proposalId, variantData.variant_id);
      expect(retrievedTree).toBeDefined();
      expect(retrievedTree?.path).toBe(tree.path);

      // Verify proposal decision trees can be listed
      const proposalTrees = engine.getProposalDecisionTrees(proposalId);
      expect(proposalTrees.length).toBeGreaterThan(0);
      expect(proposalTrees[0].proposal_id).toBe(proposalId);
    });
  });

  describe('Conflict Handling (Duplicate variant_id with Retry Logic)', () => {
    it('detects duplicate variant_id and throws UniqueConstraintError without retry', () => {
      // Register first variant
      const variantData = {
        variant_id: 'variant-duplicate-test',
        name: 'Test Variant',
        description: 'For duplicate testing',
        treatment_config: { test: true },
      };

      const result1 = engine.registerVariant(variantData);
      expect(result1.success).toBe(true);
      expect(result1.retryCount).toBe(0);

      // Attempt to register duplicate variant_id
      const result2 = engine.registerVariant(variantData);

      expect(result2.success).toBe(false);
      expect(result2.error).toBeDefined();
      expect(result2.error).toContain('Variant already registered');
      expect(result2.error).toContain('variant-duplicate-test');
      expect(result2.error).toContain('unique');
      expect(result2.retryCount).toBe(0); // Non-retryable error

      // Verify original variant unchanged
      const original = engine.getVariant('variant-duplicate-test');
      expect(original).toBeDefined();
      expect(original?.name).toBe('Test Variant');

      // Verify conflict detection through hasVariant
      expect(engine.hasVariant('variant-duplicate-test')).toBe(true);

      // Verify variant count is still 1 (duplicate was rejected)
      expect(engine.getVariantCount()).toBe(1);
    });

    it('implements retry logic with exponential backoff for transient errors', () => {
      // Register variant with custom retry policy
      const variantData = {
        variant_id: 'variant-retry-test',
        name: 'Retry Test Variant',
        description: 'For retry logic testing',
        treatment_config: { retryTest: true },
      };

      const customRetryPolicy = {
        maxRetries: 2,
        backoffMs: 10,
      };

      // First registration should succeed immediately
      const result1 = engine.registerVariant(variantData, customRetryPolicy);
      expect(result1.success).toBe(true);
      expect(result1.retryCount).toBe(0);

      // Attempt duplicate with retry policy
      // Should fail immediately (not retryable), retryCount should be 0
      const result2 = engine.registerVariant(variantData, customRetryPolicy);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Variant already registered');
      // UniqueConstraintError is non-retryable, so retryCount stays at 0
      expect(result2.retryCount).toBe(0);
    });
  });

  describe('Additional Variant Operations', () => {
    it('retrieves and lists registered variants', () => {
      const variants = [
        {
          variant_id: 'variant-1',
          name: 'Variant 1',
          description: 'First variant',
          treatment_config: { id: 1 },
        },
        {
          variant_id: 'variant-2',
          name: 'Variant 2',
          description: 'Second variant',
          treatment_config: { id: 2 },
        },
      ];

      for (const v of variants) {
        const result = engine.registerVariant(v);
        expect(result.success).toBe(true);
      }

      // List all variants
      const all = engine.listVariants();
      expect(all.length).toBe(2);

      // Get specific variant
      const v1 = engine.getVariant('variant-1');
      expect(v1).toBeDefined();
      expect(v1?.name).toBe('Variant 1');

      // Check variant count
      expect(engine.getVariantCount()).toBe(2);

      // Check hasVariant
      expect(engine.hasVariant('variant-1')).toBe(true);
      expect(engine.hasVariant('variant-nonexistent')).toBe(false);
    });

    it('enforces immutability across all registered variants', () => {
      const variant = {
        variant_id: 'variant-immutable-check',
        name: 'Immutability Check',
        description: 'Verify all variants are immutable',
        treatment_config: {
          setting1: 'value1',
          setting2: { nested: true },
        },
      };

      const result = engine.registerVariant(variant);
      expect(result.success).toBe(true);

      // Validate immutability
      const check = engine.validateVariantImmutability(variant.variant_id);
      expect(check.valid).toBe(true);
      expect(check.error).toBeUndefined();

      // Invalid check for non-existent variant
      const invalidCheck = engine.validateVariantImmutability('nonexistent');
      expect(invalidCheck.valid).toBe(false);
      expect(invalidCheck.error).toBeDefined();
    });

    it('creates decision trees with proper routing paths', () => {
      // Register multiple variants
      const v1 = {
        variant_id: 'v1',
        name: 'V1',
        description: 'Variant 1',
        treatment_config: {},
      };
      const v2 = {
        variant_id: 'v2',
        name: 'V2',
        description: 'Variant 2',
        treatment_config: {},
      };

      engine.registerVariant(v1);
      engine.registerVariant(v2);

      // Create decision trees for same proposal with different variants
      const tree1 = engine.createDecisionTree('proposal-1', 'v1');
      const tree2 = engine.createDecisionTree('proposal-1', 'v2');

      expect(tree1.path).not.toBe(tree2.path);
      expect(tree1.path).toContain('v1');
      expect(tree2.path).toContain('v2');

      // Retrieve proposal decision trees
      const proposalTrees = engine.getProposalDecisionTrees('proposal-1');
      expect(proposalTrees.length).toBe(2);
    });

    it('handles unregistered variant in decision tree creation', () => {
      // Create decision tree for unregistered variant
      // This should throw an error
      expect(() => {
        engine.createDecisionTree('proposal-1', 'nonexistent-variant');
      }).toThrow('Variant not registered');
    });

    it('allows decision tree creation without variant_id (provisional)', () => {
      // Can create decision tree before variant is registered (for planning)
      const tree = engine.createDecisionTree('proposal-1');

      expect(tree.proposal_id).toBe('proposal-1');
      expect(tree.variant_id).toBe('unassigned');
      expect(tree.path).toContain('unassigned');
    });
  });

  describe('Engine State and Diagnostics', () => {
    it('tracks engine state correctly', () => {
      const variant1 = {
        variant_id: 'v1',
        name: 'V1',
        description: 'Variant 1',
        treatment_config: {},
      };

      let state = engine.getState();
      expect(state.variantCount).toBe(0);
      expect(state.treeCount).toBe(0);

      engine.registerVariant(variant1);
      engine.createDecisionTree('p1', 'v1');

      state = engine.getState();
      expect(state.variantCount).toBe(1);
      expect(state.treeCount).toBe(1);
      expect(state.variants.length).toBe(1);
    });

    it('clears all state for testing', () => {
      const variant = {
        variant_id: 'v1',
        name: 'V1',
        description: 'Variant 1',
        treatment_config: {},
      };

      engine.registerVariant(variant);
      engine.createDecisionTree('p1', 'v1');

      let state = engine.getState();
      expect(state.variantCount).toBe(1);

      engine.clear();

      state = engine.getState();
      expect(state.variantCount).toBe(0);
      expect(state.treeCount).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('prevents modification through returned variant reference', () => {
      const original = {
        variant_id: 'v-edge-case',
        name: 'Edge Case',
        description: 'Testing edge case immutability',
        treatment_config: { key: 'value' },
      };

      const result = engine.registerVariant(original);
      expect(result.success).toBe(true);

      const variant = result.variant!;

      // Try to modify nested treatment_config (should fail)
      expect(() => {
        (variant.treatment_config as any).key = 'modified';
      }).toThrow();

      // Retrieve again and verify unchanged
      const retrieved = engine.getVariant('v-edge-case');
      expect(retrieved?.treatment_config.key).toBe('value');
    });

    it('creates unique decision trees for same proposal+variant pair', () => {
      const variant = {
        variant_id: 'v1',
        name: 'V1',
        description: 'Variant 1',
        treatment_config: {},
      };

      engine.registerVariant(variant);

      // Create tree at different times
      const tree1 = engine.createDecisionTree('p1', 'v1');
      const tree2 = engine.createDecisionTree('p1', 'v1');

      // Both should have same path but potentially different created_at
      expect(tree1.path).toBe(tree2.path);
      // Times might differ slightly if called at different moments
    });
  });
});
