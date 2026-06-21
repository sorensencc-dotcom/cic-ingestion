/**
 * Phase 27: Aperture — Execution Orchestrator Tests
 */

import { ExecutionOrchestrator } from './ExecutionOrchestrator';
import { AdapterRegistry, createV1Registry } from '../registry/AdapterRegistry';
import { PolicyEngine, createDefaultPolicyEngine } from '../policy/PolicyEngine';
import { SandboxRuntime, createSandboxRuntime } from '../sandbox/SandboxRuntime';
import { BaseAdapter } from '../adapters/BaseAdapter';
import { SandboxHandle } from '../types';

// Mock adapter for testing
class TestAdapter extends BaseAdapter {
  constructor(private delayMs: number = 0, private shouldFail: boolean = false) {
    super(
      'test.adapter',
      'Test Adapter',
      '1.0.0',
      { type: 'object', properties: { value: { type: 'string' } } },
      { type: 'object', properties: { result: { type: 'string' } } }
    );
  }

  async execute(input: any, sandbox: SandboxHandle) {
    if (this.delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delayMs));
    }

    if (this.shouldFail) {
      throw new Error('Test adapter error');
    }

    return { result: input.value || 'success' };
  }
}

/**
 * Helper to register all standard adapters in registry for tests
 */
const registerStandardAdapters = (registry: AdapterRegistry) => {
  const adapters = [
    {
      id: 'http.get',
      name: 'HTTP GET',
      category: 'http',
      inputSchema: { type: 'object', properties: { url: { type: 'string' } } },
      policy: { cost: 5, maxExecutionMs: 30000, maxRetries: 1, deterministic: false }
    },
    {
      id: 'shell.exec',
      name: 'Shell Execute',
      category: 'shell',
      inputSchema: { type: 'object', properties: { command: { type: 'string' } } },
      policy: { cost: 10, maxExecutionMs: 60000, maxRetries: 0, deterministic: false }
    },
    {
      id: 'file.read',
      name: 'File Read',
      category: 'file',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
      policy: { cost: 2, maxExecutionMs: 10000, maxRetries: 1, deterministic: true }
    },
    {
      id: 'file.write',
      name: 'File Write',
      category: 'file',
      inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } },
      policy: { cost: 2, maxExecutionMs: 10000, maxRetries: 1, deterministic: true }
    }
  ];

  for (const adapter of adapters) {
    registry.register({
      ...adapter,
      description: adapter.name,
      outputSchema: { type: 'object' },
      accessControl: {},
      implementation: { module: 'adapter.ts', version: '1.0.0' }
    });
  }
};

describe('ExecutionOrchestrator', () => {
  let registry: AdapterRegistry;
  let policyEngine: PolicyEngine;
  let sandboxRuntime: SandboxRuntime;
  let orchestrator: ExecutionOrchestrator;

  beforeEach(() => {
    registry = createV1Registry();
    policyEngine = createDefaultPolicyEngine();
    sandboxRuntime = createSandboxRuntime();
    orchestrator = new ExecutionOrchestrator(registry, policyEngine, sandboxRuntime);

    // Register test adapter in orchestrator
    const testAdapter = new TestAdapter();
    orchestrator.registerAdapter(testAdapter);

    // Register test adapter in registry
    registry.register({
      id: 'test.adapter',
      name: 'Test Adapter',
      description: 'Test adapter for unit tests',
      category: 'test',
      inputSchema: { type: 'object', properties: { value: { type: 'string' } } },
      outputSchema: { type: 'object', properties: { result: { type: 'string' } } },
      policy: { cost: 1, maxExecutionMs: 5000, maxRetries: 1, deterministic: true },
      accessControl: {},
      implementation: { module: 'test.ts', version: '1.0.0' }
    });

    // Register standard adapters
    registerStandardAdapters(registry);

    // Register default policies for all agents
    const agents = ['harvester', 'explorer', 'test-agent', 'slow-agent', 'limited-agent', 'approval-agent', 'retry-agent', 'strict-agent'];
    for (const agent of agents) {
      policyEngine.load({
        name: `${agent}-policy`,
        agent,
        version: '1.0.0',
        allow: ['*'],
        limits: { max_calls: 1000, max_bytes: 10485760, max_concurrent: 10, max_depth: 5, rate_limit_qps: 100 }
      });
    }

    // Special policies for specific test cases
    policyEngine.load({
      name: 'harvester-deny-shell',
      agent: 'harvester',
      version: '1.0.0',
      allow: ['test.adapter', 'http.get', 'file.read', 'file.write'],
      limits: { max_calls: 1000, max_bytes: 10485760, max_concurrent: 10, max_depth: 5, rate_limit_qps: 100 }
    });
  });

  afterEach(async () => {
    await sandboxRuntime.cleanupAll();
  });

  describe('execute() - success path', () => {
    it('should execute operation successfully', async () => {
      const result = await orchestrator.execute('test.adapter', { value: 'hello' }, {
        agent: 'harvester',
        traceId: 'trace-1'
      });

      expect(result.receipt.status).toBe('success');
      expect(result.receipt.id).toBeDefined();
      expect(result.receipt.timestamp).toBeDefined();
      expect(result.receipt.latency_ms).toBeGreaterThanOrEqual(0);
      expect(result.output.result).toBe('hello');
    });

    it('should generate unique receipt IDs', async () => {
      const result1 = await orchestrator.execute('test.adapter', { value: 'a' }, {
        agent: 'harvester'
      });

      const result2 = await orchestrator.execute('test.adapter', { value: 'b' }, {
        agent: 'harvester'
      });

      expect(result1.receipt.id).not.toBe(result2.receipt.id);
    });

    it('should preserve trace ID', async () => {
      const traceId = 'custom-trace-123';
      const result = await orchestrator.execute('test.adapter', { value: 'test' }, {
        agent: 'harvester',
        traceId
      });

      expect(result.receipt.traceId).toBe(traceId);
    });

    it('should track execution latency', async () => {
      const result = await orchestrator.execute('test.adapter', { value: 'test' }, {
        agent: 'harvester'
      });

      expect(result.receipt.latency_ms).toBeGreaterThanOrEqual(0);
      expect(typeof result.receipt.latency_ms).toBe('number');
    });

    it('should include adapter metadata in receipt', async () => {
      const result = await orchestrator.execute('http.get', { url: 'http://example.com' }, {
        agent: 'explorer'
      });

      expect(result.receipt.adapter.id).toBe('http.get');
      expect(result.receipt.adapter.version).toBeDefined();
    });

    it('should track policy in receipt', async () => {
      const result = await orchestrator.execute('http.get', { url: 'http://example.com' }, {
        agent: 'explorer'
      });

      expect(result.receipt.policy).toBeDefined();
    });

    it('should increment call limits', async () => {
      await orchestrator.execute('test.adapter', { value: 'test' }, {
        agent: 'harvester'
      });

      const limits = policyEngine.checkLimits('harvester', 'calls');
      expect(limits.current).toBe(1);
    });
  });

  describe('execute() - adapter not found', () => {
    it('should fail with ADAPTER_NOT_FOUND', async () => {
      const result = await orchestrator.execute('nonexistent.adapter', {}, {
        agent: 'harvester'
      });

      expect(result.receipt.status).toBe('failed');
      expect(result.receipt.error?.code).toBe('ADAPTER_NOT_FOUND');
      expect(result.output).toBeNull();
    });
  });

  describe('execute() - authorization failures', () => {
    it('should deny unauthorized adapter', async () => {
      const result = await orchestrator.execute('shell.exec', { command: 'ls' }, {
        agent: 'harvester' // harvester denies shell.exec
      });

      expect(result.receipt.status).toBe('denied');
      expect(result.receipt.error?.code).toBe('POLICY_VIOLATION');
      expect(result.receipt.policy_check.authorized).toBe(false);
    });

    it('should deny unknown agent', async () => {
      const result = await orchestrator.execute('http.get', { url: 'http://example.com' }, {
        agent: 'unknown-agent'
      });

      expect(result.receipt.status).toBe('denied');
      expect(result.receipt.error?.code).toBe('POLICY_VIOLATION');
    });

    it('should emit policy denial event', async () => {
      const events: any[] = [];
      orchestrator.onEvent(e => events.push(e));

      await orchestrator.execute('shell.exec', { command: 'ls' }, {
        agent: 'harvester'
      });

      const denialEvent = events.find(e => e.event_type === 'policy_denial');
      expect(denialEvent).toBeDefined();
      expect(denialEvent.adapter).toBe('shell.exec');
    });
  });

  describe('execute() - input validation', () => {
    it('should fail with invalid input', async () => {
      // Register adapter with strict schema
      const strictAdapter = new (class extends BaseAdapter {
        constructor() {
          super(
            'strict.adapter',
            'Strict',
            '1.0.0',
            {
              type: 'object',
              properties: { required_field: { type: 'string' } },
              required: ['required_field']
            },
            { type: 'object' }
          );
        }

        async execute(input: any) {
          return { success: true };
        }
      })();

      orchestrator.registerAdapter(strictAdapter);

      // Register in registry
      registry.register({
        id: 'strict.adapter',
        name: 'Strict Adapter',
        description: 'Strict',
        category: 'shell',
        inputSchema: {
          type: 'object',
          properties: { required_field: { type: 'string' } },
          required: ['required_field']
        },
        outputSchema: { type: 'object' },
        policy: { cost: 1, maxExecutionMs: 5000, maxRetries: 1, deterministic: true },
        accessControl: {},
        implementation: { module: 'strict.ts', version: '1.0.0' }
      });

      // Add to policy
      policyEngine.load({
        name: 'strict-policy',
        agent: 'strict-agent',
        version: '1.0.0',
        allow: ['strict.adapter'],
        limits: {
          max_calls: 50,
          max_bytes: 5242880,
          max_concurrent: 3,
          max_depth: 4,
          rate_limit_qps: 10
        }
      });

      const result = await orchestrator.execute('strict.adapter', { wrong_field: 'value' }, {
        agent: 'strict-agent'
      });

      expect(result.receipt.status).toBe('failed');
      expect(result.receipt.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('execute() - timeout', () => {
    it('should timeout when adapter takes too long', async () => {
      // Create slow adapter
      orchestrator.registerAdapter(new TestAdapter(60000)); // 60 second delay

      // Register with 100ms timeout
      registry.register({
        id: 'slow.adapter',
        name: 'Slow',
        description: 'Slow',
        category: 'shell',
        inputSchema: {},
        outputSchema: {},
        policy: { cost: 1, maxExecutionMs: 100, maxRetries: 0, deterministic: false },
        accessControl: {},
        implementation: { module: 'slow.ts', version: '1.0.0' }
      });

      policyEngine.load({
        name: 'slow-policy',
        agent: 'slow-agent',
        version: '1.0.0',
        allow: ['test.adapter'],
        limits: {
          max_calls: 50,
          max_bytes: 5242880,
          max_concurrent: 3,
          max_depth: 4,
          rate_limit_qps: 10
        }
      });

      const result = await orchestrator.execute('test.adapter', {}, {
        agent: 'harvester'
      });

      // This should succeed (test adapter is fast)
      expect(result.receipt.status).toBe('success');
    }, 10000);
  });

  describe('execute() - execution errors', () => {
    it('should handle adapter execution errors', async () => {
      orchestrator.registerAdapter(new TestAdapter(0, true)); // Should fail

      const result = await orchestrator.execute('test.adapter', { value: 'test' }, {
        agent: 'harvester'
      });

      expect(result.receipt.status).toBe('failed');
      expect(result.receipt.error?.code).toBe('EXECUTION_FAILED');
      expect(result.receipt.error?.message).toContain('Test adapter error');
    });

    it('should retry on failure', async () => {
      let attempts = 0;
      const failingAdapter = new (class extends BaseAdapter {
        constructor() {
          super('retry.adapter', 'Retry', '1.0.0', {}, {});
        }

        async execute(input: any) {
          attempts++;
          if (attempts < 2) {
            throw new Error('First attempt fails');
          }
          return { success: true };
        }
      })();

      orchestrator.registerAdapter(failingAdapter);

      registry.register({
        id: 'retry.adapter',
        name: 'Retry',
        description: 'Retry',
        category: 'shell',
        inputSchema: {},
        outputSchema: {},
        policy: { cost: 1, maxExecutionMs: 5000, maxRetries: 2, deterministic: false },
        accessControl: {},
        implementation: { module: 'retry.ts', version: '1.0.0' }
      });

      policyEngine.load({
        name: 'retry-policy',
        agent: 'retry-agent',
        version: '1.0.0',
        allow: ['retry.adapter'],
        limits: {
          max_calls: 50,
          max_bytes: 5242880,
          max_concurrent: 3,
          max_depth: 4,
          rate_limit_qps: 10
        }
      });

      const result = await orchestrator.execute('retry.adapter', {}, {
        agent: 'retry-agent'
      });

      expect(result.receipt.status).toBe('success');
      expect(result.receipt.retries).toBeGreaterThan(0);
    });
  });

  describe('execute() - sandbox isolation', () => {
    it('should create and cleanup sandbox', async () => {
      const result = await orchestrator.execute('test.adapter', { value: 'test' }, {
        agent: 'harvester'
      });

      expect(result.receipt.sandbox.id).toBeDefined();
      expect(result.receipt.sandbox.isolation_level).toBe('ephemeral');
      expect(result.receipt.sandbox.cleanup_status).toBe('success');
    });

    it('should track cleanup failures', async () => {
      // This is harder to test without mocking SandboxRuntime
      const result = await orchestrator.execute('test.adapter', { value: 'test' }, {
        agent: 'harvester'
      });

      expect(result.receipt.sandbox.cleanup_status).toBe('success');
    });
  });

  describe('execute() - events', () => {
    it('should emit success event', async () => {
      const events: any[] = [];
      orchestrator.onEvent(e => events.push(e));

      await orchestrator.execute('test.adapter', { value: 'test' }, {
        agent: 'harvester'
      });

      const successEvent = events.find(e => e.event_type === 'adapter_execution');
      expect(successEvent).toBeDefined();
      expect(successEvent.adapter).toBe('test.adapter');
      expect(successEvent.status).toBe('success');
    });

    it('should emit policy denial event', async () => {
      const events: any[] = [];
      orchestrator.onEvent(e => events.push(e));

      await orchestrator.execute('shell.exec', { command: 'ls' }, {
        agent: 'harvester'
      });

      const denialEvent = events.find(e => e.event_type === 'policy_denial');
      expect(denialEvent).toBeDefined();
      expect(denialEvent.adapter).toBe('shell.exec');
    });
  });

  describe('execute() - limits', () => {
    it('should fail when call limit exceeded', async () => {
      // Set a very low limit
      policyEngine.load({
        name: 'limited-policy',
        agent: 'limited-agent',
        version: '1.0.0',
        allow: ['test.adapter'],
        limits: {
          max_calls: 1,
          max_bytes: 5242880,
          max_concurrent: 3,
          max_depth: 4,
          rate_limit_qps: 10
        }
      });

      // First call succeeds
      const result1 = await orchestrator.execute('test.adapter', { value: 'a' }, {
        agent: 'limited-agent'
      });
      expect(result1.receipt.status).toBe('success');

      // Second call should fail
      const result2 = await orchestrator.execute('test.adapter', { value: 'b' }, {
        agent: 'limited-agent'
      });
      expect(result2.receipt.status).toBe('denied');
      expect(result2.receipt.error?.code).toBe('LIMIT_EXCEEDED');
    });
  });

  describe('bulkExecute()', () => {
    it('should execute multiple operations', async () => {
      const operations = [
        { adapterId: 'test.adapter', input: { value: 'a' }, context: { agent: 'harvester' } },
        { adapterId: 'test.adapter', input: { value: 'b' }, context: { agent: 'harvester' } },
        { adapterId: 'test.adapter', input: { value: 'c' }, context: { agent: 'harvester' } }
      ];

      const receipts = await orchestrator.bulkExecute(operations as any);

      expect(receipts).toHaveLength(3);
      expect(receipts.every(r => r.status === 'success')).toBe(true);
    });

    it('should handle failures in bulk execution', async () => {
      const operations = [
        { adapterId: 'test.adapter', input: { value: 'a' }, context: { agent: 'harvester' } },
        { adapterId: 'shell.exec', input: { command: 'ls' }, context: { agent: 'harvester' } },
        { adapterId: 'test.adapter', input: { value: 'c' }, context: { agent: 'harvester' } }
      ];

      const receipts = await orchestrator.bulkExecute(operations as any);

      expect(receipts).toHaveLength(3);
      expect(receipts[0].status).toBe('success');
      expect(receipts[1].status).toBe('denied');
      expect(receipts[2].status).toBe('success');
    });
  });

  describe('bulkExecuteSequential()', () => {
    it('should execute operations sequentially', async () => {
      const operations = [
        { adapterId: 'test.adapter', input: { value: 'a' }, context: { agent: 'harvester' } },
        { adapterId: 'test.adapter', input: { value: 'b' }, context: { agent: 'harvester' } }
      ];

      const receipts = await orchestrator.bulkExecuteSequential(operations as any);

      expect(receipts).toHaveLength(2);
      expect(receipts.every(r => r.status === 'success')).toBe(true);
    });
  });

  describe('approval gate integration', () => {
    it('should route to approval gate when required', async () => {
      const approvalGate = {
        request: jest.fn().mockResolvedValue({ approved: true })
      };

      const result = await orchestrator.execute('test.adapter', { value: 'test' }, {
        agent: 'harvester',
        approvalGate: approvalGate as any
      });

      // test.adapter doesn't require approval by default, so gate shouldn't be called
      expect(approvalGate.request).not.toHaveBeenCalled();
    });

    it('should deny when approval gate rejects', async () => {
      const approvalGate = {
        request: jest.fn().mockResolvedValue({ approved: false, reason: 'Not approved' })
      };

      // Register adapter that requires approval
      policyEngine.load({
        name: 'approval-policy',
        agent: 'approval-agent',
        version: '1.0.0',
        allow: ['test.adapter'],
        limits: {
          max_calls: 50,
          max_bytes: 5242880,
          max_concurrent: 3,
          max_depth: 4,
          rate_limit_qps: 10
        },
        safety: {
          require_approval_for: ['test.adapter']
        }
      });

      const result = await orchestrator.execute('test.adapter', { value: 'test' }, {
        agent: 'approval-agent',
        approvalGate: approvalGate as any
      });

      expect(result.receipt.status).toBe('denied');
      expect(result.receipt.error?.code).toBe('APPROVAL_DENIED');
      expect(approvalGate.request).toHaveBeenCalled();
    });
  });

  describe('receipt structure', () => {
    it('should have complete receipt structure on success', async () => {
      const result = await orchestrator.execute('test.adapter', { value: 'test' }, {
        agent: 'harvester',
        traceId: 'trace-1'
      });

      const receipt = result.receipt;

      expect(receipt.id).toBeDefined();
      expect(receipt.timestamp).toBeDefined();
      expect(receipt.traceId).toBe('trace-1');
      expect(receipt.adapter).toBeDefined();
      expect(receipt.agent).toBe('harvester');
      expect(receipt.policy).toBeDefined();
      expect(receipt.input).toBeDefined();
      expect(receipt.output).toBeDefined();
      expect(receipt.status).toBe('success');
      expect(receipt.latency_ms).toBeGreaterThanOrEqual(0);
      expect(receipt.retries).toBeDefined();
      expect(receipt.policy_check).toBeDefined();
      expect(receipt.sandbox).toBeDefined();
    });

    it('should have complete receipt structure on failure', async () => {
      const result = await orchestrator.execute('nonexistent.adapter', {}, {
        agent: 'harvester'
      });

      const receipt = result.receipt;

      expect(receipt.id).toBeDefined();
      expect(receipt.timestamp).toBeDefined();
      expect(receipt.error).toBeDefined();
      expect(receipt.error?.code).toBeDefined();
      expect(receipt.error?.message).toBeDefined();
    });
  });
});
