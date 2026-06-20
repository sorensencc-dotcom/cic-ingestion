/**
 * Phase 27: Aperture — Adapter Registry Tests
 */

import { AdapterRegistry, createV1Registry } from './AdapterRegistry';
import { AdapterDefinition } from '../types';

describe('AdapterRegistry', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = new AdapterRegistry();
  });

  describe('register()', () => {
    it('should register valid adapter definition', () => {
      const adapter: AdapterDefinition = {
        id: 'test.operation',
        name: 'Test Op',
        description: 'Test operation',
        category: 'shell',
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' },
        policy: {
          cost: 1,
          maxExecutionMs: 5000,
          maxRetries: 1,
          deterministic: true
        },
        accessControl: {
          requiresApproval: false
        },
        implementation: {
          module: 'test.ts',
          version: '1.0.0'
        }
      };

      registry.register(adapter);
      expect(registry.exists('test.operation')).toBe(true);
    });

    it('should reject adapter with invalid ID (no dot)', () => {
      const adapter: AdapterDefinition = {
        id: 'invalid_id',
        name: 'Test',
        description: 'Test',
        category: 'shell',
        inputSchema: {},
        outputSchema: {},
        policy: { cost: 1, maxExecutionMs: 5000, maxRetries: 1, deterministic: true },
        accessControl: {},
        implementation: { module: 'test.ts', version: '1.0.0' }
      };

      expect(() => registry.register(adapter)).toThrow();
    });

    it('should reject adapter missing name', () => {
      const adapter = {
        id: 'test.op',
        name: '',
        description: 'Test',
        category: 'shell',
        inputSchema: {},
        outputSchema: {},
        policy: { cost: 1, maxExecutionMs: 5000, maxRetries: 1, deterministic: true },
        accessControl: {},
        implementation: { module: 'test.ts', version: '1.0.0' }
      } as any;

      expect(() => registry.register(adapter)).toThrow();
    });

    it('should reject adapter missing implementation', () => {
      const adapter = {
        id: 'test.op',
        name: 'Test',
        description: 'Test',
        category: 'shell',
        inputSchema: {},
        outputSchema: {},
        policy: { cost: 1, maxExecutionMs: 5000, maxRetries: 1, deterministic: true },
        accessControl: {}
      } as any;

      expect(() => registry.register(adapter)).toThrow();
    });

    it('should allow updating existing adapter', () => {
      const adapter1: AdapterDefinition = {
        id: 'test.op',
        name: 'V1',
        description: 'Version 1',
        category: 'shell',
        inputSchema: {},
        outputSchema: {},
        policy: { cost: 1, maxExecutionMs: 5000, maxRetries: 1, deterministic: true },
        accessControl: {},
        implementation: { module: 'test.ts', version: '1.0.0' }
      };

      const adapter2 = { ...adapter1, name: 'V2', description: 'Version 2' };

      registry.register(adapter1);
      registry.register(adapter2);

      const retrieved = registry.lookup('test.op');
      expect(retrieved?.name).toBe('V2');
    });
  });

  describe('lookup()', () => {
    it('should return adapter by ID', () => {
      const adapter: AdapterDefinition = {
        id: 'http.get',
        name: 'HTTP GET',
        description: 'HTTP GET',
        category: 'http',
        inputSchema: {},
        outputSchema: {},
        policy: { cost: 3, maxExecutionMs: 30000, maxRetries: 2, deterministic: false },
        accessControl: {},
        implementation: { module: 'http/get.ts', version: '1.0.0' }
      };

      registry.register(adapter);
      const result = registry.lookup('http.get');

      expect(result).toBeDefined();
      expect(result?.name).toBe('HTTP GET');
    });

    it('should return null for non-existent adapter', () => {
      expect(registry.lookup('nonexistent.op')).toBeNull();
    });
  });

  describe('listByCategory()', () => {
    it('should list all adapters in category', () => {
      registry.register({
        id: 'file.read',
        name: 'File Read',
        description: 'Read',
        category: 'file',
        inputSchema: {},
        outputSchema: {},
        policy: { cost: 2, maxExecutionMs: 5000, maxRetries: 3, deterministic: true },
        accessControl: {},
        implementation: { module: 'file/read.ts', version: '1.0.0' }
      });

      registry.register({
        id: 'file.write',
        name: 'File Write',
        description: 'Write',
        category: 'file',
        inputSchema: {},
        outputSchema: {},
        policy: { cost: 5, maxExecutionMs: 5000, maxRetries: 1, deterministic: true },
        accessControl: {},
        implementation: { module: 'file/write.ts', version: '1.0.0' }
      });

      registry.register({
        id: 'http.get',
        name: 'HTTP GET',
        description: 'GET',
        category: 'http',
        inputSchema: {},
        outputSchema: {},
        policy: { cost: 3, maxExecutionMs: 30000, maxRetries: 2, deterministic: false },
        accessControl: {},
        implementation: { module: 'http/get.ts', version: '1.0.0' }
      });

      const fileAdapters = registry.listByCategory('file');
      expect(fileAdapters).toHaveLength(2);
      expect(fileAdapters.map(a => a.id)).toContain('file.read');
      expect(fileAdapters.map(a => a.id)).toContain('file.write');
    });

    it('should return empty array for non-existent category', () => {
      expect(registry.listByCategory('nonexistent')).toHaveLength(0);
    });
  });

  describe('validate()', () => {
    beforeEach(() => {
      registry.register({
        id: 'test.op',
        name: 'Test',
        description: 'Test',
        category: 'shell',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string' },
            timeout: { type: 'number' }
          },
          required: ['command']
        },
        outputSchema: { type: 'object' },
        policy: { cost: 1, maxExecutionMs: 5000, maxRetries: 1, deterministic: true },
        accessControl: {},
        implementation: { module: 'test.ts', version: '1.0.0' }
      });
    });

    it('should accept valid input', () => {
      const result = registry.validate('test.op', { command: 'ls' });
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject missing required field', () => {
      const result = registry.validate('test.op', { timeout: 1000 });
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('command'))).toBe(true);
    });

    it('should reject wrong type', () => {
      const result = registry.validate('test.op', { command: 123 });
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('string'))).toBe(true);
    });

    it('should reject non-existent adapter', () => {
      const result = registry.validate('nonexistent.op', {});
      expect(result.valid).toBe(false);
      expect(result.errors?.some(e => e.includes('not found'))).toBe(true);
    });
  });

  describe('validateOutput()', () => {
    beforeEach(() => {
      registry.register({
        id: 'test.op',
        name: 'Test',
        description: 'Test',
        category: 'shell',
        inputSchema: {},
        outputSchema: {
          type: 'object',
          properties: {
            stdout: { type: 'string' },
            exitCode: { type: 'number' }
          },
          required: ['stdout', 'exitCode']
        },
        policy: { cost: 1, maxExecutionMs: 5000, maxRetries: 1, deterministic: true },
        accessControl: {},
        implementation: { module: 'test.ts', version: '1.0.0' }
      });
    });

    it('should accept valid output', () => {
      const result = registry.validateOutput('test.op', { stdout: 'output', exitCode: 0 });
      expect(result.valid).toBe(true);
    });

    it('should reject invalid output', () => {
      const result = registry.validateOutput('test.op', { stdout: 'output' });
      expect(result.valid).toBe(false);
    });
  });

  describe('listAll()', () => {
    it('should return all registered adapters', () => {
      registry.register({
        id: 'a.op1',
        name: 'A',
        description: 'A',
        category: 'shell',
        inputSchema: {},
        outputSchema: {},
        policy: { cost: 1, maxExecutionMs: 5000, maxRetries: 1, deterministic: true },
        accessControl: {},
        implementation: { module: 'a.ts', version: '1.0.0' }
      });

      registry.register({
        id: 'b.op2',
        name: 'B',
        description: 'B',
        category: 'file',
        inputSchema: {},
        outputSchema: {},
        policy: { cost: 2, maxExecutionMs: 5000, maxRetries: 1, deterministic: true },
        accessControl: {},
        implementation: { module: 'b.ts', version: '1.0.0' }
      });

      const all = registry.listAll();
      expect(all).toHaveLength(2);
    });
  });

  describe('exists()', () => {
    it('should return true for registered adapter', () => {
      registry.register({
        id: 'test.op',
        name: 'Test',
        description: 'Test',
        category: 'shell',
        inputSchema: {},
        outputSchema: {},
        policy: { cost: 1, maxExecutionMs: 5000, maxRetries: 1, deterministic: true },
        accessControl: {},
        implementation: { module: 'test.ts', version: '1.0.0' }
      });

      expect(registry.exists('test.op')).toBe(true);
    });

    it('should return false for non-registered adapter', () => {
      expect(registry.exists('nonexistent.op')).toBe(false);
    });
  });

  describe('getCost()', () => {
    it('should return adapter cost', () => {
      registry.register({
        id: 'test.op',
        name: 'Test',
        description: 'Test',
        category: 'shell',
        inputSchema: {},
        outputSchema: {},
        policy: { cost: 42, maxExecutionMs: 5000, maxRetries: 1, deterministic: true },
        accessControl: {},
        implementation: { module: 'test.ts', version: '1.0.0' }
      });

      expect(registry.getCost('test.op')).toBe(42);
    });

    it('should return null for non-existent adapter', () => {
      expect(registry.getCost('nonexistent.op')).toBeNull();
    });
  });

  describe('getMaxExecutionMs()', () => {
    it('should return adapter max execution time', () => {
      registry.register({
        id: 'test.op',
        name: 'Test',
        description: 'Test',
        category: 'shell',
        inputSchema: {},
        outputSchema: {},
        policy: { cost: 1, maxExecutionMs: 12345, maxRetries: 1, deterministic: true },
        accessControl: {},
        implementation: { module: 'test.ts', version: '1.0.0' }
      });

      expect(registry.getMaxExecutionMs('test.op')).toBe(12345);
    });

    it('should return null for non-existent adapter', () => {
      expect(registry.getMaxExecutionMs('nonexistent.op')).toBeNull();
    });
  });

  describe('getByOperation()', () => {
    it('should return adapter by category and operation', () => {
      registry.register({
        id: 'http.get',
        name: 'HTTP GET',
        description: 'GET',
        category: 'http',
        inputSchema: {},
        outputSchema: {},
        policy: { cost: 3, maxExecutionMs: 30000, maxRetries: 2, deterministic: false },
        accessControl: {},
        implementation: { module: 'http/get.ts', version: '1.0.0' }
      });

      const adapter = registry.getByOperation('http', 'get');
      expect(adapter).toBeDefined();
      expect(adapter?.name).toBe('HTTP GET');
    });

    it('should return null for non-existent operation', () => {
      expect(registry.getByOperation('http', 'nonexistent')).toBeNull();
    });
  });

  describe('requiresApproval()', () => {
    it('should return true for adapters requiring approval', () => {
      registry.register({
        id: 'file.write',
        name: 'File Write',
        description: 'Write',
        category: 'file',
        inputSchema: {},
        outputSchema: {},
        policy: { cost: 5, maxExecutionMs: 5000, maxRetries: 1, deterministic: true },
        accessControl: { requiresApproval: true },
        implementation: { module: 'file/write.ts', version: '1.0.0' }
      });

      expect(registry.requiresApproval('file.write')).toBe(true);
    });

    it('should return false for adapters not requiring approval', () => {
      registry.register({
        id: 'file.read',
        name: 'File Read',
        description: 'Read',
        category: 'file',
        inputSchema: {},
        outputSchema: {},
        policy: { cost: 2, maxExecutionMs: 5000, maxRetries: 3, deterministic: true },
        accessControl: { requiresApproval: false },
        implementation: { module: 'file/read.ts', version: '1.0.0' }
      });

      expect(registry.requiresApproval('file.read')).toBe(false);
    });
  });

  describe('getAllowedAgents()', () => {
    it('should return allowed agents list', () => {
      registry.register({
        id: 'shell.exec',
        name: 'Shell Exec',
        description: 'Exec',
        category: 'shell',
        inputSchema: {},
        outputSchema: {},
        policy: { cost: 10, maxExecutionMs: 30000, maxRetries: 1, deterministic: false },
        accessControl: { allowedAgents: ['admin', 'trusted'] },
        implementation: { module: 'shell/exec.ts', version: '1.0.0' }
      });

      expect(registry.getAllowedAgents('shell.exec')).toEqual(['admin', 'trusted']);
    });

    it('should return null for unrestricted adapters', () => {
      registry.register({
        id: 'http.get',
        name: 'HTTP GET',
        description: 'GET',
        category: 'http',
        inputSchema: {},
        outputSchema: {},
        policy: { cost: 3, maxExecutionMs: 30000, maxRetries: 2, deterministic: false },
        accessControl: {},
        implementation: { module: 'http/get.ts', version: '1.0.0' }
      });

      expect(registry.getAllowedAgents('http.get')).toBeNull();
    });
  });
});

describe('createV1Registry()', () => {
  it('should create registry with all v1 adapters', () => {
    const registry = createV1Registry();

    expect(registry.exists('shell.exec')).toBe(true);
    expect(registry.exists('file.read')).toBe(true);
    expect(registry.exists('file.write')).toBe(true);
    expect(registry.exists('http.get')).toBe(true);
    expect(registry.exists('model.generate')).toBe(true);
  });

  it('should have correct adapter metadata', () => {
    const registry = createV1Registry();
    const httpGet = registry.lookup('http.get');

    expect(httpGet?.name).toBe('HTTP GET');
    expect(httpGet?.category).toBe('http');
    expect(httpGet?.policy.cost).toBe(3);
  });

  it('should list all shell adapters', () => {
    const registry = createV1Registry();
    const shell = registry.listByCategory('shell');

    expect(shell.length).toBeGreaterThan(0);
    expect(shell.some(a => a.id === 'shell.exec')).toBe(true);
  });

  it('should have deterministic contracts', () => {
    const registry = createV1Registry();

    // file.read is deterministic
    expect(registry.lookup('file.read')?.policy.deterministic).toBe(true);

    // http.get is not deterministic (varies by server state)
    expect(registry.lookup('http.get')?.policy.deterministic).toBe(false);
  });
});
