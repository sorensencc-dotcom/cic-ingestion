import {
  CodeLevelDriftDetector,
  CodeLevelInput,
} from './CodeLevelDriftDetector.ts';

describe('CodeLevelDriftDetector', () => {
  let detector: CodeLevelDriftDetector;

  beforeEach(() => {
    detector = new CodeLevelDriftDetector();
  });

  describe('detectRunawayRefactor', () => {
    it('flags CRITICAL RUNAWAY_REFACTOR when file limit (>3 files) is exceeded', () => {
      const input: CodeLevelInput = {
        plan: [{ id: 'p1', description: 'Refactor scope', expectedScope: ['src/core'] }],
        codeChanges: [
          { file: 'src/core/a.ts', additions: 10, deletions: 5, hunks: [] },
          { file: 'src/core/b.ts', additions: 10, deletions: 5, hunks: [] },
          { file: 'src/core/c.ts', additions: 10, deletions: 5, hunks: [] },
          { file: 'src/core/d.ts', additions: 10, deletions: 5, hunks: [] },
        ],
        tests: { failing: [], passing: ['test1'] },
        dependencies: [],
        logs: [],
      };

      const signal = detector.check(input);

      expect(signal).not.toBeNull();
      expect(signal?.type).toBe('RUNAWAY_REFACTOR');
      expect(signal?.severity).toBe('CRITICAL');
      expect(signal?.details.filesModified).toBe(4);
    });

    it('flags MEDIUM RUNAWAY_REFACTOR when refactor log patterns present with >2 files modified', () => {
      const input: CodeLevelInput = {
        plan: [],
        codeChanges: [
          { file: 'src/core/a.ts', additions: 5, deletions: 2, hunks: [] },
          { file: 'src/core/b.ts', additions: 5, deletions: 2, hunks: [] },
          { file: 'src/core/c.ts', additions: 5, deletions: 2, hunks: [] },
        ],
        tests: { failing: [], passing: [] },
        dependencies: [],
        logs: ['Attempting to restructure helper module', 'Refactor clean up'],
      };

      const signal = detector.check(input);

      expect(signal).not.toBeNull();
      expect(signal?.type).toBe('RUNAWAY_REFACTOR');
      expect(signal?.severity).toBe('MEDIUM');
    });
  });

  describe('detectKitchenSink', () => {
    it('flags CRITICAL KITCHEN_SINK when >=2 files modified outside expected scope', () => {
      const input: CodeLevelInput = {
        plan: [{ id: 'p1', description: 'Modify core', expectedScope: ['src/core/main.ts'] }],
        codeChanges: [
          { file: 'src/core/main.ts', additions: 5, deletions: 1, hunks: [] },
          { file: 'src/unrelated/foo.ts', additions: 20, deletions: 0, hunks: [] },
          { file: 'src/other/bar.ts', additions: 30, deletions: 0, hunks: [] },
        ],
        tests: { failing: [], passing: [] },
        dependencies: [],
        logs: [],
      };

      const signal = detector.check(input);

      expect(signal).not.toBeNull();
      expect(signal?.type).toBe('KITCHEN_SINK');
      expect(signal?.severity).toBe('CRITICAL');
      expect(signal?.details.unrelatedFiles).toEqual(['src/unrelated/foo.ts', 'src/other/bar.ts']);
    });

    it('flags HIGH KITCHEN_SINK when single file modified outside expected scope', () => {
      const input: CodeLevelInput = {
        plan: [{ id: 'p1', description: 'Modify core', expectedScope: ['src/core/main.ts'] }],
        codeChanges: [
          { file: 'src/core/main.ts', additions: 5, deletions: 1, hunks: [] },
          { file: 'src/unrelated/foo.ts', additions: 20, deletions: 0, hunks: [] },
        ],
        tests: { failing: [], passing: [] },
        dependencies: [],
        logs: [],
      };

      const signal = detector.check(input);

      expect(signal).not.toBeNull();
      expect(signal?.type).toBe('KITCHEN_SINK');
      expect(signal?.severity).toBe('HIGH');
    });
  });

  describe('detectWrongAbstraction', () => {
    it('flags HIGH WRONG_ABSTRACTION when >=3 duplicated code blocks detected', () => {
      const dup1 = '  const result1 = validateData1(input);\n  if (!result1.ok) throw new Error("Invalid 1");\n  saveToStore(result1);\n  logEvent("save 1");\n  return result1;';
      const dup2 = '  const result2 = validateData2(input);\n  if (!result2.ok) throw new Error("Invalid 2");\n  saveToStore(result2);\n  logEvent("save 2");\n  return result2;';
      const dup3 = '  const result3 = validateData3(input);\n  if (!result3.ok) throw new Error("Invalid 3");\n  saveToStore(result3);\n  logEvent("save 3");\n  return result3;';
      const input: CodeLevelInput = {
        plan: [{ id: 'p1', description: 'Scope', expectedScope: ['src/core'] }],
        codeChanges: [
          {
            file: 'src/core/service.ts',
            additions: 50,
            deletions: 0,
            hunks: [dup1, dup1, dup2, dup2, dup3, dup3],
          },
        ],
        tests: { failing: [], passing: [] },
        dependencies: [],
        logs: [],
      };

      const signal = detector.check(input);

      expect(signal).not.toBeNull();
      expect(signal?.type).toBe('WRONG_ABSTRACTION');
      expect(signal?.severity).toBe('HIGH');
    });
  });

  describe('detectOptimisticPath', () => {
    it('flags HIGH OPTIMISTIC_PATH when tests exist but zero negative/error tests present', () => {
      const input: CodeLevelInput = {
        plan: [{ id: 'p1', description: 'Scope', expectedScope: ['src/core'] }],
        codeChanges: [{ file: 'src/core/main.ts', additions: 10, deletions: 0, hunks: [] }],
        tests: {
          failing: ['testPositiveCalculation'],
          passing: ['testHappyPathFlow'],
        },
        dependencies: [],
        logs: [],
      };

      const signal = detector.check(input);

      expect(signal).not.toBeNull();
      expect(signal?.type).toBe('OPTIMISTIC_PATH');
      expect(signal?.severity).toBe('HIGH');
    });

    it('returns null when negative tests are present', () => {
      const input: CodeLevelInput = {
        plan: [{ id: 'p1', description: 'Scope', expectedScope: ['src/core'] }],
        codeChanges: [{ file: 'src/core/main.ts', additions: 10, deletions: 0, hunks: [] }],
        tests: {
          failing: ['test_invalid_payload_error'],
          passing: ['testHappyPathFlow'],
        },
        dependencies: [],
        logs: [],
      };

      const signal = detector.check(input);

      expect(signal).toBeNull();
    });
  });

  describe('checkBatch and computeScore', () => {
    it('processes batch of inputs and computes scores', () => {
      const input1: CodeLevelInput = {
        plan: [{ id: 'p1', description: 'Scope', expectedScope: ['src/core'] }],
        codeChanges: [{ file: 'src/core/main.ts', additions: 5, deletions: 0, hunks: [] }],
        tests: { failing: ['test_error'], passing: ['test_ok'] },
        dependencies: [],
        logs: [],
      };

      const input2: CodeLevelInput = {
        plan: [{ id: 'p2', description: 'Scope', expectedScope: ['src/core'] }],
        codeChanges: [
          { file: 'src/core/a.ts', additions: 1, deletions: 0, hunks: [] },
          { file: 'src/core/b.ts', additions: 1, deletions: 0, hunks: [] },
          { file: 'src/core/c.ts', additions: 1, deletions: 0, hunks: [] },
          { file: 'src/core/d.ts', additions: 1, deletions: 0, hunks: [] },
        ],
        tests: { failing: [], passing: [] },
        dependencies: [],
        logs: [],
      };

      const signals = detector.checkBatch([input1, input2]);
      expect(signals).toHaveLength(1);
      expect(signals[0].type).toBe('RUNAWAY_REFACTOR');

      const scoreClean = detector.computeScore(input1);
      expect(scoreClean).toBe(0);

      const scoreCritical = detector.computeScore(input2);
      expect(scoreCritical).toBe(1.0);
    });
  });
});
