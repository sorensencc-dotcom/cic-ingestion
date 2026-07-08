/**
 * Code-Level Drift Detector
 *
 * Detects autonomous coding failures per Six New Rules:
 * - Kitchen Sink: scope creep beyond request
 * - Wrong Abstraction: duplicated logic not factored
 * - Optimistic Path: missing error handling
 * - Runaway Refactor: cascading changes beyond scope
 */

export interface DriftSignal {
  type: 'KITCHEN_SINK' | 'WRONG_ABSTRACTION' | 'OPTIMISTIC_PATH' | 'RUNAWAY_REFACTOR';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details: Record<string, any>;
  timestamp: number;
}

export interface CodeLevelInput {
  plan: PlanNode[];
  codeChanges: CodeDiff[];
  tests: TestBundle;
  dependencies: DependencyRecord[];
  logs: string[];
}

export interface PlanNode {
  id: string;
  description: string;
  expectedScope?: string[];
  step?: number;
}

export interface CodeDiff {
  file: string;
  additions: number;
  deletions: number;
  hunks: string[];
}

export interface TestBundle {
  failing: string[];
  passing: string[];
  coverage?: number;
}

export interface DependencyRecord {
  name: string;
  version: string;
  justification?: string;
}

/**
 * Detector for code-level drift
 */
export class CodeLevelDriftDetector {
  private readonly kitchenSinkThreshold = 2; // unrelated files
  private readonly duplicationThreshold = 3; // repeated blocks
  private readonly errorCoverageThreshold = 0.8; // % of error cases covered
  private readonly refactorFileLimit = 3; // max files in scope

  /**
   * Check code changes for drift signals
   */
  check(input: CodeLevelInput): DriftSignal | null {
    // Check Runaway Refactor first (highest priority — cascading changes)
    const rrDrift = this.detectRunawayRefactor(input);
    if (rrDrift) return rrDrift;

    // Check Kitchen Sink (scope drift)
    const ksDrift = this.detectKitchenSink(input);
    if (ksDrift) return ksDrift;

    // Check Wrong Abstraction (duplication)
    const waDrift = this.detectWrongAbstraction(input);
    if (waDrift) return waDrift;

    // Check Optimistic Path (error handling)
    const opDrift = this.detectOptimisticPath(input);
    if (opDrift) return opDrift;

    return null;
  }

  /**
   * Detect Kitchen Sink: scope creep beyond acceptance criteria
   */
  private detectKitchenSink(input: CodeLevelInput): DriftSignal | null {
    const filesModified = input.codeChanges.length;
    const expectedScope = input.plan
      .flatMap((p) => p.expectedScope || [])
      .filter((s) => s);

    // If plan doesn't specify scope, can't detect drift
    if (expectedScope.length === 0) {
      return null;
    }

    const unrelatedFiles = input.codeChanges.filter(
      (diff) => !expectedScope.some((scope) => diff.file.includes(scope))
    );

    // Multiple unrelated files → Kitchen Sink (CRITICAL)
    if (unrelatedFiles.length >= this.kitchenSinkThreshold) {
      return {
        type: 'KITCHEN_SINK',
        severity: 'CRITICAL',
        details: {
          filesModified,
          expectedScope,
          unrelatedFiles: unrelatedFiles.map((f) => f.file),
          reason: 'Scope expanded beyond acceptance criteria',
        },
        timestamp: Date.now(),
      };
    }

    // Single unrelated file → HIGH severity
    if (unrelatedFiles.length === 1) {
      return {
        type: 'KITCHEN_SINK',
        severity: 'HIGH',
        details: {
          filesModified,
          expectedScope,
          unrelatedFiles: unrelatedFiles.map((f) => f.file),
          reason: 'File modified outside scope',
        },
        timestamp: Date.now(),
      };
    }

    return null;
  }

  /**
   * Detect Wrong Abstraction: duplicated logic blocks
   */
  private detectWrongAbstraction(input: CodeLevelInput): DriftSignal | null {
    const hunks = input.codeChanges.flatMap((c) => c.hunks);

    // Find repeated code blocks (similarity matching)
    const duplicates = this.findDuplicateBlocks(hunks);

    if (duplicates.length >= this.duplicationThreshold) {
      return {
        type: 'WRONG_ABSTRACTION',
        severity: 'HIGH',
        details: {
          duplicateCount: duplicates.length,
          blocks: duplicates.slice(0, 3), // show first 3
          reason: 'Logic duplicated across multiple code hunks',
        },
        timestamp: Date.now(),
      };
    }

    if (duplicates.length > 0) {
      return {
        type: 'WRONG_ABSTRACTION',
        severity: 'MEDIUM',
        details: {
          duplicateCount: duplicates.length,
          blocks: duplicates,
          reason: 'Potential duplication detected',
        },
        timestamp: Date.now(),
      };
    }

    return null;
  }

  /**
   * Detect Optimistic Path: missing error handling or negative tests
   */
  private detectOptimisticPath(input: CodeLevelInput): DriftSignal | null {
    // Check for negative test cases
    const negativeTests = input.tests.failing.filter(
      (t) =>
        t.includes('error') ||
        t.includes('invalid') ||
        t.includes('malformed') ||
        t.includes('null') ||
        t.includes('timeout')
    );

    const totalTests = input.tests.failing.length + input.tests.passing.length;

    // Flag if: tests exist but ZERO negative tests (optimistic only)
    if (totalTests > 0 && negativeTests.length === 0 && input.codeChanges.length > 0) {
      return {
        type: 'OPTIMISTIC_PATH',
        severity: 'HIGH',
        details: {
          totalTests,
          negativeTests: negativeTests.length,
          missingErrorCases: true,
          reason: 'Tests exist but zero cover error cases',
        },
        timestamp: Date.now(),
      };
    }

    return null;
  }

  /**
   * Detect Runaway Refactor: cascading changes beyond scope
   */
  private detectRunawayRefactor(input: CodeLevelInput): DriftSignal | null {
    const filesModified = input.codeChanges.length;

    // File limit exceeded → Runaway Refactor
    if (filesModified > this.refactorFileLimit) {
      return {
        type: 'RUNAWAY_REFACTOR',
        severity: 'CRITICAL',
        details: {
          filesModified,
          limit: this.refactorFileLimit,
          files: input.codeChanges.map((c) => c.file),
          reason: 'Cascading refactor: too many files modified',
        },
        timestamp: Date.now(),
      };
    }

    // Check for refactor-related log patterns
    const refactorPatterns = input.logs.filter((log) =>
      /clean\s+up|modernize|refactor|rename|restructure/i.test(log)
    );

    if (refactorPatterns.length > 0 && filesModified > 2) {
      return {
        type: 'RUNAWAY_REFACTOR',
        severity: 'MEDIUM',
        details: {
          filesModified,
          refactorLogs: refactorPatterns.slice(0, 2),
          reason: 'Refactor-related activity across multiple files',
        },
        timestamp: Date.now(),
      };
    }

    return null;
  }

  /**
   * Find duplicate code blocks (simple string similarity)
   */
  private findDuplicateBlocks(hunks: string[]): string[] {
    const blockMap = new Map<string, number>();
    const duplicates: string[] = [];

    for (const hunk of hunks) {
      // Extract multi-line blocks (heuristic: lines with same indent pattern)
      const lines = hunk.split('\n').filter((l) => l.trim());
      const block = lines.slice(0, 5).join('\n'); // first 5 lines

      if (block.length > 20) {
        // skip short blocks
        const count = (blockMap.get(block) || 0) + 1;
        blockMap.set(block, count);

        if (count > 1 && !duplicates.includes(block)) {
          duplicates.push(block);
        }
      }
    }

    return duplicates;
  }

  /**
   * Check batch of code changes
   */
  checkBatch(inputs: CodeLevelInput[]): DriftSignal[] {
    return inputs
      .map((i) => this.check(i))
      .filter((s): s is DriftSignal => s !== null);
  }

  /**
   * Compute drift score (0.0 = clean, 1.0 = critical drift)
   */
  computeScore(input: CodeLevelInput): number {
    const ks = this.detectKitchenSink(input);
    const wa = this.detectWrongAbstraction(input);
    const op = this.detectOptimisticPath(input);
    const rr = this.detectRunawayRefactor(input);

    // Hard drift = 1.0
    if (ks?.severity === 'CRITICAL' || rr?.severity === 'CRITICAL') {
      return 1.0;
    }

    // Weighted sum
    let score = 0;
    if (ks) score += 0.25 * (ks.severity === 'HIGH' ? 0.75 : 0.5);
    if (wa) score += 0.25 * (wa.severity === 'HIGH' ? 0.75 : 0.5);
    if (op) score += 0.25 * (op.severity === 'HIGH' ? 0.75 : 0.5);
    if (rr) score += 0.25 * (rr.severity === 'HIGH' ? 0.75 : 0.5);

    return Math.min(score, 1.0);
  }
}
