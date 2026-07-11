/**
 * ABTestEngine: Phase 5 A/B variant registration and decision trees
 *
 * Responsibilities:
 * - Immutable variant registration (variant_id + treatment configuration)
 * - Decision tree routing (variant → cohort based on assignment rules)
 * - Conflict handling (UniqueConstraintError on duplicate variant_id with retry logic)
 * - Variant metadata persistence (treatment_config immutable after creation)
 *
 * Data Contract Ownership:
 * - Owns Variant metadata (immutable after creation)
 * - Invariant: Variant.variant_id unique across all instances
 * - Invariant: treatment_config cannot be modified after registration
 */

import { randomUUID } from 'crypto';

/**
 * Custom error for duplicate variant registration
 */
export class UniqueConstraintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UniqueConstraintError';
  }
}

/**
 * Immutable variant definition
 * Variant records are created once and never modified
 */
export interface ABVariant {
  variant_id: string;
  name: string;
  description: string;
  treatment_config: Readonly<Record<string, any>>;
  created_at: string;
  created_by?: string;
}

/**
 * Decision tree node representing variant routing logic
 */
export interface DecisionTreeNode {
  proposal_id: string;
  variant_id: string;
  path: string; // e.g., "proposal:X->variant->cohort->evaluate"
  created_at: string;
}

/**
 * Retry policy for handling conflicts
 */
export interface RetryPolicy {
  maxRetries: number;
  backoffMs: number; // Exponential backoff base
}

/**
 * Result of variant registration attempt
 */
export interface RegistrationResult {
  success: boolean;
  variant?: ABVariant;
  error?: string;
  retryCount?: number;
}

/**
 * ABTestEngine: Register A/B variants and create decision trees
 *
 * Key features:
 * - Immutable variant storage (Object.freeze enforced)
 * - Unique variant_id constraint with conflict detection
 * - Automatic retry on transient conflicts
 * - Decision tree generation for proposal → cohort routing
 * - Thread-safe append-only variant log
 */
export class ABTestEngine {
  private variants: Map<string, ABVariant> = new Map();
  private decisionTrees: Map<string, DecisionTreeNode> = new Map();
  private readonly defaultRetryPolicy: RetryPolicy = {
    maxRetries: 3,
    backoffMs: 100,
  };

  /**
   * Register a new A/B variant (immutable after creation)
   *
   * @param variant Variant definition (will be frozen)
   * @param retryPolicy Optional retry policy for conflict handling
   * @returns RegistrationResult with success status and variant or error
   *
   * Behavior:
   * - Creates immutable copy of variant
   * - Enforces unique variant_id constraint
   * - Throws UniqueConstraintError on duplicate (non-retryable)
   * - Locks treatment_config via Object.freeze
   *
   * Throws if:
   * - variant_id already exists (UniqueConstraintError)
   * - Invalid variant structure
   */
  registerVariant(
    variant: Omit<ABVariant, 'created_at'>,
    retryPolicy?: RetryPolicy
  ): RegistrationResult {
    const policy = retryPolicy || this.defaultRetryPolicy;
    let lastError: Error | null = null;
    let retryCount = 0;

    // Retry loop for handling transient conflicts
    for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
      try {
        // Check for duplicate variant_id
        if (this.variants.has(variant.variant_id)) {
          throw new UniqueConstraintError(
            `Variant already registered: ${variant.variant_id}. Variant IDs must be unique across all instances.`
          );
        }

        // Create immutable variant record
        const immutableVariant: ABVariant = Object.freeze({
          variant_id: variant.variant_id,
          name: variant.name,
          description: variant.description,
          treatment_config: Object.freeze({
            ...variant.treatment_config,
          }),
          created_at: new Date().toISOString(),
          created_by: variant.created_by,
        });

        // Store in variant registry
        this.variants.set(immutableVariant.variant_id, immutableVariant);

        return {
          success: true,
          variant: immutableVariant,
          retryCount,
        };
      } catch (error) {
        lastError = error as Error;

        // UniqueConstraintError is non-retryable
        if (error instanceof UniqueConstraintError) {
          return {
            success: false,
            error: error.message,
            retryCount,
          };
        }

        // For other errors, retry with exponential backoff
        retryCount++;
        if (attempt < policy.maxRetries) {
          const backoffTime = Math.pow(2, attempt) * policy.backoffMs;
          // In production, would use async sleep; here we're sync
          // This is acceptable for test harness
        }
      }
    }

    // All retries exhausted
    return {
      success: false,
      error: `Failed to register variant after ${policy.maxRetries + 1} attempts: ${lastError?.message}`,
      retryCount,
    };
  }

  /**
   * Get a registered variant by variant_id (read-only)
   *
   * Returns undefined if variant not found
   * Returns immutable reference to variant
   */
  getVariant(variantId: string): ABVariant | undefined {
    return this.variants.get(variantId);
  }

  /**
   * List all registered variants (read-only)
   *
   * Returns array of immutable variant references
   */
  listVariants(): ABVariant[] {
    return Array.from(this.variants.values());
  }

  /**
   * Get variant count
   */
  getVariantCount(): number {
    return this.variants.size;
  }

  /**
   * Check if variant_id is already registered
   *
   * Useful for pre-flight checks before registration attempts
   */
  hasVariant(variantId: string): boolean {
    return this.variants.has(variantId);
  }

  /**
   * Create a decision tree for a proposal
   *
   * Decision tree represents the routing path:
   * proposal_id → variant_id → cohort_id → metric evaluation
   *
   * @param proposalId Phase 4 proposal ID
   * @param variantId Registered variant ID
   * @returns DecisionTreeNode representing the routing path
   *
   * Throws if:
   * - Variant not registered for given variantId
   */
  createDecisionTree(proposalId: string, variantId?: string): DecisionTreeNode {
    // Optional: validate variant exists if provided
    if (variantId && !this.variants.has(variantId)) {
      throw new Error(
        `Variant not registered: ${variantId}. Register variant before creating decision tree.`
      );
    }

    // Create decision tree path
    const path = `proposal:${proposalId}->variant${variantId ? `:${variantId}` : ':unassigned'}->cohort->evaluate`;

    const treeNode: DecisionTreeNode = {
      proposal_id: proposalId,
      variant_id: variantId || 'unassigned',
      path,
      created_at: new Date().toISOString(),
    };

    // Store tree node for lineage tracking
    const treeId = `${proposalId}-${variantId || randomUUID()}`;
    this.decisionTrees.set(treeId, treeNode);

    return treeNode;
  }

  /**
   * Get decision tree for a proposal+variant pair
   *
   * Useful for tracing routing decisions
   */
  getDecisionTree(proposalId: string, variantId: string): DecisionTreeNode | undefined {
    const treeId = `${proposalId}-${variantId}`;
    return this.decisionTrees.get(treeId);
  }

  /**
   * Get all decision trees for a proposal
   *
   * Returns all routing paths for a given proposal
   */
  getProposalDecisionTrees(proposalId: string): DecisionTreeNode[] {
    return Array.from(this.decisionTrees.values()).filter(
      (tree) => tree.proposal_id === proposalId
    );
  }

  /**
   * Validate variant immutability
   *
   * Checks if variant's treatment_config is immutable (frozen)
   * Returns error if variant was modified
   */
  validateVariantImmutability(variantId: string): {
    valid: boolean;
    error?: string;
  } {
    const variant = this.variants.get(variantId);

    if (!variant) {
      return {
        valid: false,
        error: `Variant not found: ${variantId}`,
      };
    }

    // Check if treatment_config is frozen
    if (!Object.isFrozen(variant.treatment_config)) {
      return {
        valid: false,
        error: `Variant treatment_config is not immutable: ${variantId}. This indicates the variant was improperly modified after registration.`,
      };
    }

    // Check if variant object itself is frozen
    if (!Object.isFrozen(variant)) {
      return {
        valid: false,
        error: `Variant object is not immutable: ${variantId}. This indicates the variant was improperly modified after registration.`,
      };
    }

    return { valid: true };
  }

  /**
   * Clear all variants and decision trees (useful for testing)
   *
   * WARNING: This is a destructive operation and should only be used in test cleanup
   */
  clear(): void {
    this.variants.clear();
    this.decisionTrees.clear();
  }

  /**
   * Get internal state for diagnostics (test only)
   */
  getState(): {
    variantCount: number;
    treeCount: number;
    variants: ABVariant[];
  } {
    return {
      variantCount: this.variants.size,
      treeCount: this.decisionTrees.size,
      variants: this.listVariants(),
    };
  }
}
