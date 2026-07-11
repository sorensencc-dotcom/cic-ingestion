/**
 * Wave E Repair — Six Rules Integration Tests
 */

import * as fs from 'fs';
import * as path from 'path';
import { RepairManifestSixRules, RepairAcceptanceCriteria } from './repairManifest.SixRules.ts';
import { recordIngestion } from './ingestionManifest.ts';

const MANIFEST_DIR = path.join(__dirname, '..', '..');
const MANIFEST_PATH = path.join(MANIFEST_DIR, 'ingestionManifest.jsonl');
const MANIFEST_BACKUP = path.join(MANIFEST_DIR, 'ingestionManifest.backup.jsonl');
const LOCK_PATH = path.join(MANIFEST_DIR, 'ingestionManifest.lock');

describe('RepairManifestSixRules', () => {
  let wrapper: RepairManifestSixRules;

  beforeEach(() => {
    wrapper = new RepairManifestSixRules();
    if (fs.existsSync(MANIFEST_PATH)) {
      fs.unlinkSync(MANIFEST_PATH);
    }
    if (fs.existsSync(MANIFEST_BACKUP)) {
      fs.unlinkSync(MANIFEST_BACKUP);
    }
    if (fs.existsSync(LOCK_PATH)) {
      fs.unlinkSync(LOCK_PATH);
    }
  });

  afterEach(() => {
    if (fs.existsSync(MANIFEST_PATH)) {
      fs.unlinkSync(MANIFEST_PATH);
    }
    if (fs.existsSync(MANIFEST_BACKUP)) {
      fs.unlinkSync(MANIFEST_BACKUP);
    }
    if (fs.existsSync(LOCK_PATH)) {
      fs.unlinkSync(LOCK_PATH);
    }
  });

  describe('Define Done', () => {
    test('rejects incomplete acceptance criteria', async () => {
      const badCriteria = {
        maxCorruptionPercent: -1, // invalid
        minSurvivalPercent: 50,
        requireBackupOnCorruption: true,
        timeoutMs: 5000,
      };

      const result = await wrapper.repairWithSixRules(badCriteria);

      expect(result.success).toBe(false);
      expect(result.instinctViolations.length).toBeGreaterThan(0);
    });

    test('accepts valid acceptance criteria', async () => {
      const criteria = wrapper.getDefaultCriteria();

      const result = await wrapper.repairWithSixRules(criteria);

      expect(result.success).toBe(true);
      expect(result.instinctViolations.length).toBe(0);
    });
  });

  describe('Criteria Validation', () => {
    test('detects high corruption rate', async () => {
      // Add 1 valid record
      recordIngestion(
        { id: 'valid-1', source: 'test.com' },
        { profile: 'api', lane: 'fast', extractors: [] },
        { passed: true, errors: [], cost: 5 },
        { extractorCost: 5, verificationCost: 0, totalCost: 5 }
      );

      // Add 3 corrupted lines
      fs.appendFileSync(MANIFEST_PATH, 'bad 1\nbad 2\nbad 3\n');

      const criteria: RepairAcceptanceCriteria = {
        maxCorruptionPercent: 20, // but we have 75%
        minSurvivalPercent: 30,
        requireBackupOnCorruption: true,
        timeoutMs: 5000,
      };

      const result = await wrapper.repairWithSixRules(criteria);

      expect(result.success).toBe(false);
      expect(result.instinctViolations.length).toBeGreaterThan(0);
      expect(result.instinctViolations[0]).toContain('Corruption exceeded threshold');
    });

    test('detects low survival rate', async () => {
      // Add 2 valid records
      recordIngestion(
        { id: 'valid-1', source: 'test.com' },
        { profile: 'api', lane: 'fast', extractors: [] },
        { passed: true, errors: [], cost: 5 },
        { extractorCost: 5, verificationCost: 0, totalCost: 5 }
      );
      recordIngestion(
        { id: 'valid-2', source: 'test.com' },
        { profile: 'api', lane: 'fast', extractors: [] },
        { passed: true, errors: [], cost: 5 },
        { extractorCost: 5, verificationCost: 0, totalCost: 5 }
      );

      // Add 8 corrupted lines
      fs.appendFileSync(MANIFEST_PATH, Array(8).fill('bad\n').join(''));

      const criteria: RepairAcceptanceCriteria = {
        maxCorruptionPercent: 90,
        minSurvivalPercent: 50, // but we only have 20%
        requireBackupOnCorruption: true,
        timeoutMs: 5000,
      };

      const result = await wrapper.repairWithSixRules(criteria);

      expect(result.success).toBe(false);
      expect(result.instinctViolations.length).toBeGreaterThan(0);
      expect(result.instinctViolations[0]).toContain('Survival fell below threshold');
    });
  });

  describe('Drift Detection', () => {
    test('detects runaway repair (too many records removed)', async () => {
      // Add 100 valid records
      for (let i = 0; i < 100; i++) {
        recordIngestion(
          { id: `valid-${i}`, source: 'test.com' },
          { profile: 'api', lane: 'fast', extractors: [] },
          { passed: true, errors: [], cost: 5 },
          { extractorCost: 5, verificationCost: 0, totalCost: 5 }
        );
      }

      // Add 60 corrupted lines (will remove 60%)
      fs.appendFileSync(MANIFEST_PATH, Array(60).fill('bad\n').join(''));

      const criteria: RepairAcceptanceCriteria = {
        maxCorruptionPercent: 60,
        minSurvivalPercent: 30,
        requireBackupOnCorruption: true,
        timeoutMs: 5000,
      };

      const result = await wrapper.repairWithSixRules(criteria);

      expect(result.driftDetected).toBe(true);
      expect(result.driftSignal?.type).toBe('RUNAWAY_REFACTOR');
      expect(result.success).toBe(false);
    });

    test('no drift for normal repair', async () => {
      // Add 50 valid records
      for (let i = 0; i < 50; i++) {
        recordIngestion(
          { id: `valid-${i}`, source: 'test.com' },
          { profile: 'api', lane: 'fast', extractors: [] },
          { passed: true, errors: [], cost: 5 },
          { extractorCost: 5, verificationCost: 0, totalCost: 5 }
        );
      }

      // Add 5 corrupted lines (10% corruption)
      fs.appendFileSync(MANIFEST_PATH, Array(5).fill('bad\n').join(''));

      const criteria: RepairAcceptanceCriteria = {
        maxCorruptionPercent: 25,
        minSurvivalPercent: 75,
        requireBackupOnCorruption: true,
        timeoutMs: 5000,
      };

      const result = await wrapper.repairWithSixRules(criteria);

      expect(result.driftDetected).toBe(false);
      expect(result.success).toBe(true);
    });
  });

  describe('Default Values', () => {
    test('getDefaultCriteria returns valid criteria', () => {
      const criteria = wrapper.getDefaultCriteria();

      expect(criteria.maxCorruptionPercent).toBeLessThanOrEqual(100);
      expect(criteria.minSurvivalPercent).toBeGreaterThanOrEqual(0);
      expect(criteria.timeoutMs).toBeGreaterThan(0);
      expect(typeof criteria.requireBackupOnCorruption).toBe('boolean');
    });

    test('getDefaultRepairPlan has expected steps', () => {
      const plan = wrapper.getDefaultRepairPlan();

      expect(plan.steps.length).toBeGreaterThan(0);
      expect(plan.steps[0]).toContain('lock');
      expect(plan.steps[plan.steps.length - 1]).toContain('Release');
      expect(plan.expectedOutcome).toBeTruthy();
      expect(plan.rollbackStrategy).toBeTruthy();
    });
  });

  describe('Integration End-to-End', () => {
    test('successful repair with Six Rules enforcement', async () => {
      // Add mix of valid and corrupted records
      recordIngestion(
        { id: 'valid-1', source: 'test.com' },
        { profile: 'api', lane: 'fast', extractors: [] },
        { passed: true, errors: [], cost: 5 },
        { extractorCost: 5, verificationCost: 0, totalCost: 5 }
      );

      fs.appendFileSync(MANIFEST_PATH, 'corrupted line\n');

      recordIngestion(
        { id: 'valid-2', source: 'test.com' },
        { profile: 'api', lane: 'fast', extractors: [] },
        { passed: true, errors: [], cost: 5 },
        { extractorCost: 5, verificationCost: 0, totalCost: 5 }
      );

      const criteria = wrapper.getDefaultCriteria();
      const result = await wrapper.repairWithSixRules(criteria);

      expect(result.success).toBe(true);
      expect(result.driftDetected).toBe(false);
      expect(result.stats.validLines).toBe(2);
      expect(result.stats.corruptedLines.length).toBe(1);
      expect(result.duration).toBeLessThan(criteria.timeoutMs);
    });
  });
});
