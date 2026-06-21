/**
 * Phase A: Docker Tool Execution Integration Tests
 * Tests tool execution end-to-end in Docker container context
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { ExecutionOrchestrator } from '../orchestrator/ExecutionOrchestrator';
import { AdapterRegistry, createV1Registry } from '../registry/AdapterRegistry';
import { PolicyEngine, createDefaultPolicyEngine } from '../policy/PolicyEngine';
import { SandboxRuntime, createSandboxRuntime } from '../sandbox/SandboxRuntime';
import { FileReadAdapter, createFileReadAdapter } from '../adapters/file/FileReadAdapter';
import { FileWriteAdapter, createFileWriteAdapter } from '../adapters/file/FileWriteAdapter';
import { HttpGetAdapter, createHttpGetAdapter } from '../adapters/http/HttpGetAdapter';
import { HttpPostAdapter, createHttpPostAdapter } from '../adapters/http/HttpPostAdapter';
import { ShellExecAdapter, createShellExecAdapter } from '../adapters/shell/ShellExecAdapter';
import { ExecutionOptions, SandboxSpec } from '../types';

const createTestSandboxSpec = (agent: string): SandboxSpec => ({
  agent,
  policy: {
    name: 'test-policy',
    agent,
    version: '1.0.0',
    allow: ['file.read', 'file.write', 'shell.exec', 'http.get', 'http.post'],
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

describe('Phase A: Docker Tool Execution', () => {
  let registry: AdapterRegistry;
  let policyEngine: PolicyEngine;
  let sandboxRuntime: SandboxRuntime;
  let orchestrator: ExecutionOrchestrator;

  beforeEach(() => {
    registry = createV1Registry();
    policyEngine = createDefaultPolicyEngine();
    sandboxRuntime = createSandboxRuntime();
    orchestrator = new ExecutionOrchestrator(registry, policyEngine, sandboxRuntime);

    // Load test policy for "executor" agent
    const testPolicy = {
      name: 'test-policy',
      agent: 'executor',
      version: '1.0.0',
      allow: ['file.read', 'file.write', 'shell.exec', 'http.get', 'http.post'],
      limits: {
        max_calls: 1000,
        max_bytes: 1024 * 1024 * 100,
        max_concurrent: 10,
        max_depth: 5,
        rate_limit_qps: 100
      }
    };
    policyEngine.load(testPolicy);

    // Register adapter implementations
    orchestrator.registerAdapter(createFileReadAdapter());
    orchestrator.registerAdapter(createFileWriteAdapter());
    orchestrator.registerAdapter(createHttpGetAdapter());
    orchestrator.registerAdapter(createHttpPostAdapter());
    orchestrator.registerAdapter(createShellExecAdapter());
  });

  afterEach(async () => {
    await sandboxRuntime.cleanupAll();
  });

  describe('Single Tool Execution', () => {
    it('should execute file read tool', async () => {
      // Setup: Create file in a sandbox
      const sandbox = await sandboxRuntime.create(createTestSandboxSpec('executor'));

      const testFile = path.join(sandbox.tmpdir, 'test.txt');
      await fs.writeFile(testFile, 'test content');

      // Execute via orchestrator
      const result = await orchestrator.execute(
        'file.read',
        { path: 'test.txt' },
        { agent: 'executor', sandbox }
      );

      expect(result.receipt.status).toBe('success');
      expect(result.output.data).toBe('test content');

      await sandbox.cleanup();
    });

    it('should execute file write tool', async () => {
      const sandbox = await sandboxRuntime.create(createTestSandboxSpec('executor'));

      const result = await orchestrator.execute(
        'file.write',
        {
          path: 'output.txt',
          content: 'written data'
        },
        { agent: 'executor', sandbox }
      );

      if (result.receipt.status !== 'success') {
        console.log('Write error:', result.receipt.error);
      }

      expect(result.receipt.status).toBe('success');
      expect(result.output.size).toBeGreaterThan(0);

      // Verify file was written
      const written = await fs.readFile(
        path.join(sandbox.tmpdir, 'output.txt'),
        'utf8'
      );
      expect(written).toBe('written data');

      await sandbox.cleanup();
    });

    it('should execute shell exec tool', async () => {
      const sandbox = await sandboxRuntime.create(createTestSandboxSpec('executor'));

      const result = await orchestrator.execute(
        'shell.exec',
        { command: 'echo "hello from docker"' },
        { agent: 'executor', sandbox }
      );

      expect(result.receipt.status).toBe('success');
      expect(result.output.exitCode).toBe(0);
      expect(result.output.stdout).toContain('hello from docker');

      await sandbox.cleanup();
    });
  });

  describe('Chained Tool Execution', () => {
    it('should execute write then read in sequence', async () => {
      const sandbox = await sandboxRuntime.create(createTestSandboxSpec('executor'));

      // Write file
      const writeResult = await orchestrator.execute(
        'file.write',
        {
          path: 'chain-test.txt',
          content: 'chained data'
        },
        { agent: 'executor', sandbox }
      );

      expect(writeResult.receipt.status).toBe('success');

      // Read file back
      const readResult = await orchestrator.execute(
        'file.read',
        { path: 'chain-test.txt' },
        { agent: 'executor', sandbox }
      );

      expect(readResult.receipt.status).toBe('success');
      expect(readResult.output.data).toBe('chained data');

      await sandbox.cleanup();
    });

    it('should execute shell command then write result', async () => {
      const sandbox = await sandboxRuntime.create(createTestSandboxSpec('executor'));

      // Execute shell command
      const shellResult = await orchestrator.execute(
        'shell.exec',
        { command: 'echo "generated content"' },
        { agent: 'executor', sandbox }
      );

      expect(shellResult.receipt.status).toBe('success');

      // Write shell output to file
      const writeResult = await orchestrator.execute(
        'file.write',
        {
          path: 'shell-output.txt',
          content: shellResult.output.stdout
        },
        { agent: 'executor', sandbox }
      );

      expect(writeResult.receipt.status).toBe('success');

      // Verify
      const readResult = await orchestrator.execute(
        'file.read',
        { path: 'shell-output.txt' },
        { agent: 'executor', sandbox }
      );

      expect(readResult.output.data).toContain('generated content');

      await sandbox.cleanup();
    });
  });

  describe('Tool Execution Tracking', () => {
    it('should generate receipt for each execution', async () => {
      const sandbox = await sandboxRuntime.create(createTestSandboxSpec('executor'));

      const result = await orchestrator.execute(
        'shell.exec',
        { command: 'echo test' },
        { agent: 'executor', sandbox }
      );

      expect(result.receipt).toHaveProperty('id');
      expect(result.receipt).toHaveProperty('status');
      expect(result.receipt).toHaveProperty('timestamp');
      expect(result.receipt).toHaveProperty('latency_ms');
      expect(result.receipt).toHaveProperty('agent');

      await sandbox.cleanup();
    });

    it('should track execution latency', async () => {
      const sandbox = await sandboxRuntime.create(createTestSandboxSpec('executor'));

      const result = await orchestrator.execute(
        'shell.exec',
        { command: 'echo test' },
        { agent: 'executor', sandbox }
      );

      expect(typeof result.receipt.latency_ms).toBe('number');
      expect(result.receipt.latency_ms).toBeGreaterThanOrEqual(0);

      await sandbox.cleanup();
    });

    it('should preserve trace ID through execution', async () => {
      const sandbox = await sandboxRuntime.create(createTestSandboxSpec('executor'));

      const traceId = 'custom-trace-abc123';

      const result = await orchestrator.execute(
        'shell.exec',
        { command: 'echo test' },
        { agent: 'executor', sandbox, traceId }
      );

      expect(result.receipt.traceId).toBe(traceId);

      await sandbox.cleanup();
    });
  });

  describe('Error Handling in Docker', () => {
    it('should handle tool execution failure', async () => {
      const sandbox = await sandboxRuntime.create(createTestSandboxSpec('executor'));

      const result = await orchestrator.execute(
        'file.read',
        { path: 'nonexistent-file.txt' },
        { agent: 'executor', sandbox }
      );

      expect(result.receipt.status).toBe('failed');
      expect(result.receipt.error).toBeDefined();

      await sandbox.cleanup();
    });

    it('should handle invalid tool ID', async () => {
      const sandbox = await sandboxRuntime.create(createTestSandboxSpec('executor'));

      const result = await orchestrator.execute(
        'nonexistent.tool',
        {},
        { agent: 'executor', sandbox }
      );

      expect(result.receipt.status).toBe('failed');

      await sandbox.cleanup();
    });

    it('should handle malformed input', async () => {
      const sandbox = await sandboxRuntime.create(createTestSandboxSpec('executor'));

      const result = await orchestrator.execute(
        'file.read',
        { path: 123 }, // Invalid: path should be string
        { agent: 'executor', sandbox }
      );

      expect(result.receipt.status).toBe('failed');

      await sandbox.cleanup();
    });

    it('should capture error details', async () => {
      const sandbox = await sandboxRuntime.create(createTestSandboxSpec('executor'));

      const result = await orchestrator.execute(
        'shell.exec',
        { command: 'exit 1' },
        { agent: 'executor', sandbox }
      );

      // Shell exit code 1 should be captured
      if (result.receipt.status !== 'success') {
        expect(result.receipt.error).toBeDefined();
      }

      await sandbox.cleanup();
    });
  });

  describe('Docker Container Constraints', () => {
    it('should respect sandbox tmpdir isolation', async () => {
      const sandbox = await sandboxRuntime.create(createTestSandboxSpec('executor'));

      // Try to traverse outside sandbox (should fail)
      const result = await orchestrator.execute(
        'file.read',
        { path: '../../../etc/passwd' },
        { agent: 'executor', sandbox }
      );

      expect(result.receipt.status).toBe('failed');

      await sandbox.cleanup();
    });

    it('should isolate sandboxes from each other', async () => {
      const sandbox1 = await sandboxRuntime.create(createTestSandboxSpec('executor'));

      const sandbox2 = await sandboxRuntime.create(createTestSandboxSpec('executor'));

      // Write to sandbox1
      await orchestrator.execute(
        'file.write',
        {
          path: 'secret.txt',
          content: 'sandbox1-secret'
        },
        { agent: 'executor', sandbox: sandbox1 }
      );

      // Try to read from sandbox2 (should fail - file doesn't exist there)
      const result = await orchestrator.execute(
        'file.read',
        { path: 'secret.txt' },
        { agent: 'executor', sandbox: sandbox2 }
      );

      expect(result.receipt.status).toBe('failed');

      await sandbox1.cleanup();
      await sandbox2.cleanup();
    });
  });

  describe('Concurrent Tool Execution', () => {
    it('should execute multiple tools concurrently', async () => {
      const sandbox1 = await sandboxRuntime.create(createTestSandboxSpec('executor'));

      const sandbox2 = await sandboxRuntime.create(createTestSandboxSpec('executor'));

      const promises = [
        orchestrator.execute(
          'shell.exec',
          { command: 'echo "job1"' },
          { agent: 'executor', sandbox: sandbox1 }
        ),
        orchestrator.execute(
          'shell.exec',
          { command: 'echo "job2"' },
          { agent: 'executor', sandbox: sandbox2 }
        )
      ];

      const [result1, result2] = await Promise.all(promises);

      expect(result1.receipt.status).toBe('success');
      expect(result2.receipt.status).toBe('success');
      expect(result1.output.stdout).toContain('job1');
      expect(result2.output.stdout).toContain('job2');

      await sandbox1.cleanup();
      await sandbox2.cleanup();
    });

    it('should handle concurrent operations on same sandbox', async () => {
      const sandbox = await sandboxRuntime.create(createTestSandboxSpec('executor'));

      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          orchestrator.execute(
            'shell.exec',
            { command: `echo "job-${i}"` },
            { agent: 'executor', sandbox }
          )
        );
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.receipt.status).toBe('success');
      });

      await sandbox.cleanup();
    });
  });

  describe('Docker Volume Mounting', () => {
    it('should persist files written to sandbox', async () => {
      const sandbox = await sandboxRuntime.create(createTestSandboxSpec('executor'));

      // Write via tool
      await orchestrator.execute(
        'file.write',
        {
          path: 'persist.txt',
          content: 'persistent data'
        },
        { agent: 'executor', sandbox }
      );

      // Read directly from filesystem
      const filePath = path.join(sandbox.tmpdir, 'persist.txt');
      const content = await fs.readFile(filePath, 'utf8');

      expect(content).toBe('persistent data');

      await sandbox.cleanup();
    });

    it('should handle large file operations', async () => {
      const sandbox = await sandboxRuntime.create(createTestSandboxSpec('executor'));

      const largeData = 'x'.repeat(1024 * 1024); // 1MB

      const writeResult = await orchestrator.execute(
        'file.write',
        {
          path: 'large-file.txt',
          content: largeData
        },
        { agent: 'executor', sandbox }
      );

      expect(writeResult.receipt.status).toBe('success');

      const readResult = await orchestrator.execute(
        'file.read',
        { path: 'large-file.txt' },
        { agent: 'executor', sandbox }
      );

      expect(readResult.receipt.status).toBe('success');
      expect(readResult.output.size).toBe(largeData.length);

      await sandbox.cleanup();
    });
  });
});
