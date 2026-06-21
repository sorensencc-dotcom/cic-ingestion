/**
 * Phase A: Docker Sandbox Integration Tests
 * Tests sandbox isolation, cleanup, and concurrent execution
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { SandboxRuntime, createSandboxRuntime } from '../sandbox/SandboxRuntime';
import { SandboxHandle, SandboxSpec } from '../types';

const createTestSandboxSpec = (agent: string): SandboxSpec => ({
  agent,
  policy: {
    name: 'test-policy',
    agent,
    version: '1.0.0',
    allow: ['*'],
    limits: {
      max_calls: 1000,
      max_bytes: 1024 * 1024 * 100,
      max_concurrent: 10,
      max_depth: 5,
      rate_limit_qps: 100
    }
  },
  memoryQuotaMb: 512,
  cpuQuotaPercent: 50,
  ephemeralOnly: true
});

describe('Phase A: Docker Sandbox Integration', () => {
  let sandboxRuntime: SandboxRuntime;

  beforeEach(() => {
    sandboxRuntime = createSandboxRuntime();
  });

  afterEach(async () => {
    await sandboxRuntime.cleanupAll();
  });

  describe('Sandbox Creation & Isolation', () => {
    it('should create isolated sandbox', async () => {
      const sandbox = await sandboxRuntime.create(createTestSandboxSpec('test-agent'));

      expect(sandbox.id).toBeDefined();
      expect(sandbox.agent).toBe('test-agent');
      expect(sandbox.tmpdir).toBeDefined();
      expect(sandbox.createdAt).toBeDefined();

      // Verify tmpdir is unique
      const stat = await fs.stat(sandbox.tmpdir);
      expect(stat.isDirectory()).toBe(true);
    });

    it('should create unique sandbox directories', async () => {
      const sandbox1 = await sandboxRuntime.create(createTestSandboxSpec('agent1'));

      const sandbox2 = await sandboxRuntime.create(createTestSandboxSpec('agent2'));

      expect(sandbox1.tmpdir).not.toBe(sandbox2.tmpdir);
      expect(sandbox1.id).not.toBe(sandbox2.id);
    });

    it('should isolate sandbox environment', async () => {
      const sandbox = await sandboxRuntime.create(createTestSandboxSpec('test-agent'));

      const originalTmpdir = process.env.TMPDIR;

      await sandboxRuntime.execute(sandbox, async () => {
        expect(process.env.TMPDIR).toBe(sandbox.tmpdir);
      });

      // After execution, environment restored
      expect(process.env.TMPDIR).toBe(originalTmpdir);
    });

    it('should preserve agent metadata', async () => {
      const sandbox = await sandboxRuntime.create(createTestSandboxSpec('harvester'));

      const retrieved = sandboxRuntime.get(sandbox.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.agent).toBe('harvester');
    });
  });

  describe('Sandbox Cleanup', () => {
    it('should clean up sandbox directory on cleanup', async () => {
      const sandbox = await sandboxRuntime.create(createTestSandboxSpec('test-agent'));

      const tmpdir = sandbox.tmpdir;
      expect(await fs.pathExists(tmpdir)).toBe(true);

      await sandbox.cleanup();

      // Directory should be removed
      expect(await fs.pathExists(tmpdir)).toBe(false);
    });

    it('should handle cleanup of non-existent directory', async () => {
      const sandbox = await sandboxRuntime.create(createTestSandboxSpec('test-agent'));

      // Remove directory manually
      await fs.rm(sandbox.tmpdir, { recursive: true, force: true });

      // Cleanup should not fail
      await expect(sandbox.cleanup()).resolves.not.toThrow();
    });

    it('should cleanup all sandboxes', async () => {
      const sandboxes = [];
      for (let i = 0; i < 5; i++) {
        const sb = await sandboxRuntime.create(createTestSandboxSpec(`agent-${i}`));
        sandboxes.push(sb);
      }

      const tmpdirs = sandboxes.map(s => s.tmpdir);

      // Verify all exist
      for (const tmpdir of tmpdirs) {
        expect(await fs.pathExists(tmpdir)).toBe(true);
      }

      await sandboxRuntime.cleanupAll();

      // Verify all cleaned
      for (const tmpdir of tmpdirs) {
        expect(await fs.pathExists(tmpdir)).toBe(false);
      }
    });

    it('should remove sandbox from registry on cleanup', async () => {
      const sandbox = await sandboxRuntime.create(createTestSandboxSpec('test-agent'));

      const id = sandbox.id;
      expect(sandboxRuntime.get(id)).toBeDefined();

      await sandbox.cleanup();

      expect(sandboxRuntime.get(id)).toBeNull();
    });
  });

  describe('Sandbox Execution', () => {
    it('should execute function in sandbox context', async () => {
      const sandbox = await sandboxRuntime.create(createTestSandboxSpec('test-agent'));

      let executedTmpdir: string | undefined;

      await sandboxRuntime.execute(sandbox, async () => {
        executedTmpdir = process.env.TMPDIR;
        return true;
      });

      expect(executedTmpdir).toBe(sandbox.tmpdir);
    });

    it('should restore environment after execution', async () => {
      const sandbox = await sandboxRuntime.create(createTestSandboxSpec('test-agent'));

      const originalTmpdir = process.env.TMPDIR;

      await sandboxRuntime.execute(sandbox, async () => {
        // Inside sandbox
        expect(process.env.TMPDIR).toBe(sandbox.tmpdir);
      });

      // After sandbox
      expect(process.env.TMPDIR).toBe(originalTmpdir);
    });

    it('should handle execution errors without breaking cleanup', async () => {
      const sandbox = await sandboxRuntime.create(createTestSandboxSpec('test-agent'));

      await expect(
        sandboxRuntime.execute(sandbox, async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');

      // Environment should still be restored
      expect(process.env.TMPDIR).not.toBe(sandbox.tmpdir);
    });

    it('should return execution result', async () => {
      const sandbox = await sandboxRuntime.create(createTestSandboxSpec('test-agent'));

      const result = await sandboxRuntime.execute(sandbox, async () => {
        return { data: 'test-result' };
      });

      expect(result).toEqual({ data: 'test-result' });
    });

    it('should fail to execute on non-existent sandbox', async () => {
      const fakeSandbox: SandboxHandle = {
        id: 'fake-id',
        agent: 'fake',
        createdAt: new Date().toISOString(),
        tmpdir: '/fake/path',
        cleanup: async () => { }
      };

      await expect(
        sandboxRuntime.execute(fakeSandbox, async () => {
          return null;
        })
      ).rejects.toThrow(/not found/);
    });
  });

  describe('Concurrent Sandbox Operations', () => {
    it('should handle concurrent sandbox creation', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          sandboxRuntime.create(createTestSandboxSpec(`agent-${i}`))
        );
      }

      const sandboxes = await Promise.all(promises);

      expect(sandboxes).toHaveLength(10);

      // All should be unique
      const ids = sandboxes.map(s => s.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(10);
    });

    it('should handle concurrent executions', async () => {
      const sandboxes: SandboxHandle[] = [];
      for (let i = 0; i < 5; i++) {
        sandboxes.push(
          await sandboxRuntime.create(createTestSandboxSpec(`agent-${i}`))
        );
      }

      const results = await Promise.all(
        sandboxes.map((sandbox, idx) =>
          sandboxRuntime.execute(sandbox, async () => {
            return { index: idx, tmpdir: process.env.TMPDIR };
          })
        )
      );

      expect(results).toHaveLength(5);
      results.forEach((result, idx) => {
        expect(result.index).toBe(idx);
        expect(result.tmpdir).toBe(sandboxes[idx].tmpdir);
      });
    });

    it('should track active sandboxes', async () => {
      const sandbox1 = await sandboxRuntime.create(createTestSandboxSpec('agent-1'));

      const active1 = sandboxRuntime.listActive();
      expect(active1).toHaveLength(1);

      const sandbox2 = await sandboxRuntime.create(createTestSandboxSpec('agent-2'));

      const active2 = sandboxRuntime.listActive();
      expect(active2).toHaveLength(2);

      await sandbox1.cleanup();

      const active3 = sandboxRuntime.listActive();
      expect(active3).toHaveLength(1);
      expect(active3[0].id).toBe(sandbox2.id);
    });
  });

  describe('Sandbox File Isolation', () => {
    it('should isolate files between sandboxes', async () => {
      const sandbox1 = await sandboxRuntime.create(createTestSandboxSpec('agent-1'));

      const sandbox2 = await sandboxRuntime.create(createTestSandboxSpec('agent-2'));

      // Create file in sandbox1
      const file1 = path.join(sandbox1.tmpdir, 'test.txt');
      await fs.writeFile(file1, 'sandbox1-data');

      // File should not exist in sandbox2
      const file2 = path.join(sandbox2.tmpdir, 'test.txt');
      expect(await fs.pathExists(file2)).toBe(false);

      // File should exist in sandbox1
      expect(await fs.pathExists(file1)).toBe(true);
    });

    it('should preserve file contents in sandbox', async () => {
      const sandbox = await sandboxRuntime.create(createTestSandboxSpec('test-agent'));

      const testFile = path.join(sandbox.tmpdir, 'data.txt');
      const testData = 'important data';

      await sandboxRuntime.execute(sandbox, async () => {
        await fs.writeFile(testFile, testData);
      });

      // Data should persist after execution
      const read = await fs.readFile(testFile, 'utf8');
      expect(read).toBe(testData);
    });

    it('should cleanup sandbox files on removal', async () => {
      const sandbox = await sandboxRuntime.create(createTestSandboxSpec('test-agent'));

      const testFile = path.join(sandbox.tmpdir, 'sensitive.txt');
      await fs.writeFile(testFile, 'sensitive-data');

      await sandbox.cleanup();

      // File should be gone
      expect(await fs.pathExists(testFile)).toBe(false);
    });
  });

  describe('Sandbox Metadata', () => {
    it('should preserve sandbox agent metadata', async () => {
      const agents = ['harvester', 'validator', 'executor'];

      for (const agent of agents) {
        const sandbox = await sandboxRuntime.create(createTestSandboxSpec(agent));

        expect(sandbox.agent).toBe(agent);
        await sandbox.cleanup();
      }
    });

    it('should set creation timestamp', async () => {
      const before = new Date();

      const sandbox = await sandboxRuntime.create(createTestSandboxSpec('test-agent'));

      const after = new Date();

      const createdTime = new Date(sandbox.createdAt);
      expect(createdTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(createdTime.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should have unique sandbox IDs', async () => {
      const sandboxes = [];
      const ids = new Set<string>();

      for (let i = 0; i < 20; i++) {
        const sb = await sandboxRuntime.create(createTestSandboxSpec('test'));
        sandboxes.push(sb);
        ids.add(sb.id);
      }

      // All IDs should be unique
      expect(ids.size).toBe(20);

      await sandboxRuntime.cleanupAll();
    });
  });
});
