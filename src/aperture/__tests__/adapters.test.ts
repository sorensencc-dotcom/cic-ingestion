/**
 * Phase A: Tool Execution Unit Tests
 * Tests each adapter's execute() method independently
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { FileReadAdapter, createFileReadAdapter } from '../adapters/file/FileReadAdapter';
import { FileWriteAdapter, createFileWriteAdapter } from '../adapters/file/FileWriteAdapter';
import { HttpGetAdapter, createHttpGetAdapter } from '../adapters/http/HttpGetAdapter';
import { HttpPostAdapter, createHttpPostAdapter } from '../adapters/http/HttpPostAdapter';
import { ShellExecAdapter, createShellExecAdapter } from '../adapters/shell/ShellExecAdapter';
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

describe('Phase A: Tool Execution - Adapters', () => {
  let sandboxRuntime: SandboxRuntime;
  let sandbox: SandboxHandle;

  beforeEach(async () => {
    sandboxRuntime = createSandboxRuntime();
    sandbox = await sandboxRuntime.create(createTestSandboxSpec('test-agent'));
  });

  afterEach(async () => {
    await sandboxRuntime.cleanupAll();
  });

  describe('FileReadAdapter', () => {
    let adapter: FileReadAdapter;

    beforeEach(() => {
      adapter = createFileReadAdapter();
    });

    it('should read file from sandbox', async () => {
      // Create test file in sandbox
      const testFile = path.join(sandbox.tmpdir, 'test.txt');
      await fs.writeFile(testFile, 'hello world', 'utf8');

      const result = await adapter.execute(
        { path: 'test.txt', encoding: 'utf8' },
        sandbox
      );

      expect(result.data).toBe('hello world');
      expect(result.size).toBe(11);
      expect(result.mtime).toBeDefined();
    });

    it('should respect encoding parameter', async () => {
      const testFile = path.join(sandbox.tmpdir, 'binary.bin');
      const buffer = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
      await fs.writeFile(testFile, buffer);

      const result = await adapter.execute(
        { path: 'binary.bin', encoding: 'binary' },
        sandbox
      );

      expect(result.size).toBe(5);
    });

    it('should reject path traversal attempts', async () => {
      await expect(
        adapter.execute(
          { path: '../../../etc/passwd' },
          sandbox
        )
      ).rejects.toThrow(/path traversal|outside/i);
    });

    it('should reject missing path parameter', async () => {
      await expect(
        adapter.execute({}, sandbox)
      ).rejects.toThrow(/path must be a string/i);
    });

    it('should handle file not found', async () => {
      await expect(
        adapter.execute(
          { path: 'nonexistent.txt' },
          sandbox
        )
      ).rejects.toThrow(/Failed to read file/);
    });

    it('should include file metadata in response', async () => {
      const testFile = path.join(sandbox.tmpdir, 'metadata.txt');
      await fs.writeFile(testFile, 'test content');

      const result = await adapter.execute(
        { path: 'metadata.txt' },
        sandbox
      );

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('size');
      expect(result).toHaveProperty('mtime');
    });
  });

  describe('FileWriteAdapter', () => {
    let adapter: FileWriteAdapter;

    beforeEach(() => {
      adapter = createFileWriteAdapter();
    });

    it('should write file to sandbox', async () => {
      const result = await adapter.execute(
        {
          path: 'output.txt',
          content: 'test content',
          encoding: 'utf8'
        },
        sandbox
      );

      expect(result.path).toBe('output.txt');
      expect(result.size).toBe(12);

      // Verify file was actually written
      const written = await fs.readFile(
        path.join(sandbox.tmpdir, 'output.txt'),
        'utf8'
      );
      expect(written).toBe('test content');
    });

    it('should create parent directories if needed', async () => {
      const result = await adapter.execute(
        {
          path: 'subdir/nested/file.txt',
          content: 'nested content'
        },
        sandbox
      );

      expect(result.path).toBe('subdir/nested/file.txt');

      const written = await fs.readFile(
        path.join(sandbox.tmpdir, 'subdir/nested/file.txt'),
        'utf8'
      );
      expect(written).toBe('nested content');
    });

    it('should reject path traversal in write', async () => {
      await expect(
        adapter.execute(
          {
            path: '../../../etc/passwd',
            content: 'malicious'
          },
          sandbox
        )
      ).rejects.toThrow(/path traversal|outside/i);
    });

    it('should handle large file writes', async () => {
      const largeData = 'x'.repeat(1024 * 100); // 100KB

      const result = await adapter.execute(
        {
          path: 'large.txt',
          content: largeData
        },
        sandbox
      );

      expect(result.size).toBe(largeData.length);
    });

    it('should fail if missing required path parameter', async () => {
      await expect(
        adapter.execute(
          { content: 'content' },
          sandbox
        )
      ).rejects.toThrow(/path must be a string/i);
    });

    it('should fail if missing required data parameter', async () => {
      await expect(
        adapter.execute(
          { path: 'file.txt' },
          sandbox
        )
      ).rejects.toThrow(/content must be a string/i);
    });
  });

  describe('HttpGetAdapter', () => {
    let adapter: HttpGetAdapter;

    beforeEach(() => {
      adapter = createHttpGetAdapter();
    });

    it('should reject domains not in allowlist', async () => {
      await expect(
        adapter.execute(
          {
            url: 'https://httpbin.org/json',
            timeout: 5000
          },
          sandbox
        )
      ).rejects.toThrow(/not in allowlist|domain/i);
    });

    it('should reject invalid URL', async () => {
      await expect(
        adapter.execute(
          {
            url: 'not-a-valid-url',
            timeout: 5000
          },
          sandbox
        )
      ).rejects.toThrow(/invalid|url/i);
    });

    it('should fail without required URL parameter', async () => {
      await expect(
        adapter.execute(
          { timeout: 5000 },
          sandbox
        )
      ).rejects.toThrow(/url must be a string/i);
    });
  });

  describe('HttpPostAdapter', () => {
    let adapter: HttpPostAdapter;

    beforeEach(() => {
      adapter = createHttpPostAdapter();
    });

    it('should reject domains not in allowlist', async () => {
      await expect(
        adapter.execute(
          {
            url: 'https://httpbin.org/post',
            body: JSON.stringify({ test: 'data' }),
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000
          },
          sandbox
        )
      ).rejects.toThrow(/not in allowlist|domain/i);
    });

    it('should fail without required URL', async () => {
      await expect(
        adapter.execute(
          {
            body: 'test',
            timeout: 5000
          },
          sandbox
        )
      ).rejects.toThrow(/url must be a string/i);
    });

    it('should fail without required body', async () => {
      await expect(
        adapter.execute(
          {
            url: 'https://httpbin.org/post',
            timeout: 5000
          },
          sandbox
        )
      ).rejects.toThrow(/body is required/i);
    });
  });

  describe('ShellExecAdapter', () => {
    let adapter: ShellExecAdapter;

    beforeEach(() => {
      adapter = createShellExecAdapter();
    });

    it('should execute shell command', async () => {
      const result = await adapter.execute(
        {
          command: 'echo hello',
          timeout: 5000
        },
        sandbox
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('hello');
    });

    it('should capture stdout and stderr', async () => {
      const result = await adapter.execute(
        {
          command: 'echo "out" && echo "err" >&2',
          timeout: 5000
        },
        sandbox
      );

      expect(result.stdout).toContain('out');
    });

    it('should capture non-zero exit codes', async () => {
      const result = await adapter.execute(
        {
          command: 'exit 42',
          timeout: 5000
        },
        sandbox
      );

      expect(result.exitCode).toBe(42);
    });

    it('should support simple shell commands', async () => {
      const result = await adapter.execute(
        {
          command: 'echo success',
          timeout: 5000
        },
        sandbox
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('success');
    });

    it('should reject missing command parameter', async () => {
      await expect(
        adapter.execute(
          { timeout: 5000 },
          sandbox
        )
      ).rejects.toThrow(/command must be a string/i);
    });
  });
});
