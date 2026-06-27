/**
 * Tests for WaylandAdapterRegistry
 */

import {
  WaylandAdapterRegistry,
  AdapterMetadata,
  AdapterRequest,
  AdapterResponse,
  createDefaultRegistry,
} from '../wayland-adapter-registry';

describe.skip('WaylandAdapterRegistry', () => {
  let registry: WaylandAdapterRegistry;

  beforeEach(() => {
    registry = new WaylandAdapterRegistry(5);
  });

  describe('registerAdapter', () => {
    it('registers a new adapter', () => {
      const metadata: AdapterMetadata = {
        id: 'adapter-1',
        name: 'Test Adapter',
        version: '1.0.0',
        capabilities: ['read', 'write'],
        status: 'registered',
        registeredAt: new Date().toISOString(),
      };

      const result = registry.registerAdapter(metadata);
      expect(result).toBe(true);
    });

    it('prevents duplicate registration', () => {
      const metadata: AdapterMetadata = {
        id: 'adapter-1',
        name: 'Test Adapter',
        version: '1.0.0',
        capabilities: ['read'],
        status: 'registered',
        registeredAt: new Date().toISOString(),
      };

      registry.registerAdapter(metadata);
      const result = registry.registerAdapter(metadata);
      expect(result).toBe(false);
    });

    it('registers adapter with handler', async () => {
      const metadata: AdapterMetadata = {
        id: 'adapter-2',
        name: 'Handler Adapter',
        version: '1.0.0',
        capabilities: ['execute'],
        status: 'registered',
        registeredAt: new Date().toISOString(),
      };

      const handler = async (req: AdapterRequest): Promise<AdapterResponse> => ({
        success: true,
        data: { result: 'ok' },
        executedAt: new Date().toISOString(),
      });

      const result = registry.registerAdapter(metadata, handler);
      expect(result).toBe(true);
    });
  });

  describe('unregisterAdapter', () => {
    it('unregisters an adapter', () => {
      const metadata: AdapterMetadata = {
        id: 'adapter-3',
        name: 'Temp Adapter',
        version: '1.0.0',
        capabilities: [],
        status: 'registered',
        registeredAt: new Date().toISOString(),
      };

      registry.registerAdapter(metadata);
      const result = registry.unregisterAdapter('adapter-3');
      expect(result).toBe(true);
    });

    it('returns false for non-existent adapter', () => {
      const result = registry.unregisterAdapter('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getAdapter', () => {
    it('retrieves adapter metadata', () => {
      const metadata: AdapterMetadata = {
        id: 'adapter-4',
        name: 'Get Test',
        version: '1.0.0',
        capabilities: ['read'],
        status: 'registered',
        registeredAt: new Date().toISOString(),
      };

      registry.registerAdapter(metadata);
      const retrieved = registry.getAdapter('adapter-4');

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('adapter-4');
      expect(retrieved?.name).toBe('Get Test');
    });

    it('returns null for non-existent adapter', () => {
      const result = registry.getAdapter('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('listAdapters', () => {
    it('lists all registered adapters', () => {
      const meta1: AdapterMetadata = {
        id: 'adapter-5',
        name: 'Adapter 5',
        version: '1.0.0',
        capabilities: [],
        status: 'registered',
        registeredAt: new Date().toISOString(),
      };

      const meta2: AdapterMetadata = {
        id: 'adapter-6',
        name: 'Adapter 6',
        version: '1.0.0',
        capabilities: [],
        status: 'registered',
        registeredAt: new Date().toISOString(),
      };

      registry.registerAdapter(meta1);
      registry.registerAdapter(meta2);

      const adapters = registry.listAdapters();
      expect(adapters.length).toBe(2);
      expect(adapters.map((a: AdapterMetadata) => a.id)).toContain('adapter-5');
      expect(adapters.map((a: AdapterMetadata) => a.id)).toContain('adapter-6');
    });

    it('returns empty array when no adapters registered', () => {
      const adapters = registry.listAdapters();
      expect(adapters).toEqual([]);
    });
  });

  describe('executeOperation', () => {
    it('executes operation on registered adapter', async () => {
      const metadata: AdapterMetadata = {
        id: 'adapter-7',
        name: 'Exec Test',
        version: '1.0.0',
        capabilities: ['execute'],
        status: 'registered',
        registeredAt: new Date().toISOString(),
      };

      const handler = async (): Promise<AdapterResponse> => ({
        success: true,
        data: { result: 'executed' },
        executedAt: new Date().toISOString(),
      });

      registry.registerAdapter(metadata, handler);

      const request: AdapterRequest = {
        adapterId: 'adapter-7',
        operation: 'test_op',
        params: {},
      };

      const response = await registry.executeOperation(request);
      expect(response.success).toBe(true);
      expect(response.data).toEqual({ result: 'executed' });
    });

    it('returns error for non-existent adapter', async () => {
      const request: AdapterRequest = {
        adapterId: 'non-existent',
        operation: 'test_op',
        params: {},
      };

      const response = await registry.executeOperation(request);
      expect(response.success).toBe(false);
      expect(response.error).toContain('not found');
    });

    it('returns error for suspended adapter', async () => {
      const metadata: AdapterMetadata = {
        id: 'adapter-8',
        name: 'Suspend Test',
        version: '1.0.0',
        capabilities: [],
        status: 'suspended',
        registeredAt: new Date().toISOString(),
      };

      registry.registerAdapter(metadata);

      const request: AdapterRequest = {
        adapterId: 'adapter-8',
        operation: 'test_op',
        params: {},
      };

      const response = await registry.executeOperation(request);
      expect(response.success).toBe(false);
      expect(response.error).toContain('suspended');
    });

    it('respects operation timeout', async () => {
      const metadata: AdapterMetadata = {
        id: 'adapter-9',
        name: 'Timeout Test',
        version: '1.0.0',
        capabilities: [],
        status: 'registered',
        registeredAt: new Date().toISOString(),
      };

      const slowHandler = async (): Promise<AdapterResponse> => {
        return new Promise((resolve) => {
          setTimeout(
            () => resolve({ success: true, data: {}, executedAt: new Date().toISOString() }),
            5000
          );
        });
      };

      registry.registerAdapter(metadata, slowHandler);

      const request: AdapterRequest = {
        adapterId: 'adapter-9',
        operation: 'slow_op',
        params: {},
        timeout: 100,
      };

      const response = await registry.executeOperation(request);
      expect(response.success).toBe(false);
      expect(response.error).toContain('Timeout');
    }, 10000);

    it('increments failure count on error', async () => {
      const metadata: AdapterMetadata = {
        id: 'adapter-10',
        name: 'Failure Test',
        version: '1.0.0',
        capabilities: [],
        status: 'registered',
        registeredAt: new Date().toISOString(),
      };

      const failingHandler = async (): Promise<AdapterResponse> => {
        throw new Error('Handler error');
      };

      registry.registerAdapter(metadata, failingHandler);

      const request: AdapterRequest = {
        adapterId: 'adapter-10',
        operation: 'fail_op',
        params: {},
      };

      await registry.executeOperation(request);
      expect(registry.getFailureCount('adapter-10')).toBe(1);

      await registry.executeOperation(request);
      expect(registry.getFailureCount('adapter-10')).toBe(2);
    });

    it('suspends adapter after failure threshold', async () => {
      const metadata: AdapterMetadata = {
        id: 'adapter-11',
        name: 'Suspend After Failures',
        version: '1.0.0',
        capabilities: [],
        status: 'registered',
        registeredAt: new Date().toISOString(),
      };

      const failingHandler = async (): Promise<AdapterResponse> => {
        throw new Error('Always fails');
      };

      registry.registerAdapter(metadata, failingHandler);

      const request: AdapterRequest = {
        adapterId: 'adapter-11',
        operation: 'fail_op',
        params: {},
      };

      // Execute 5 times to exceed threshold
      for (let i = 0; i < 5; i++) {
        await registry.executeOperation(request);
      }

      const adapter = registry.getAdapter('adapter-11');
      expect(adapter?.status).toBe('suspended');
    });

    it('resets failure count on success', async () => {
      const metadata: AdapterMetadata = {
        id: 'adapter-12',
        name: 'Reset Failures',
        version: '1.0.0',
        capabilities: [],
        status: 'registered',
        registeredAt: new Date().toISOString(),
      };

      let callCount = 0;
      const handler = async (): Promise<AdapterResponse> => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Not yet');
        }
        return { success: true, data: {}, executedAt: new Date().toISOString() };
      };

      registry.registerAdapter(metadata, handler);

      const request: AdapterRequest = {
        adapterId: 'adapter-12',
        operation: 'recovery_op',
        params: {},
      };

      await registry.executeOperation(request); // Fail
      await registry.executeOperation(request); // Fail
      expect(registry.getFailureCount('adapter-12')).toBe(2);

      await registry.executeOperation(request); // Success
      expect(registry.getFailureCount('adapter-12')).toBe(0);
    });
  });

  describe('setAdapterStatus', () => {
    it('changes adapter status', () => {
      const metadata: AdapterMetadata = {
        id: 'adapter-13',
        name: 'Status Test',
        version: '1.0.0',
        capabilities: [],
        status: 'registered',
        registeredAt: new Date().toISOString(),
      };

      registry.registerAdapter(metadata);
      const result = registry.setAdapterStatus('adapter-13', 'active');
      expect(result).toBe(true);

      const updated = registry.getAdapter('adapter-13');
      expect(updated?.status).toBe('active');
    });

    it('returns false for non-existent adapter', () => {
      const result = registry.setAdapterStatus('non-existent', 'active');
      expect(result).toBe(false);
    });
  });

  describe('getOperationLog', () => {
    it('logs operations', async () => {
      const metadata: AdapterMetadata = {
        id: 'adapter-14',
        name: 'Log Test',
        version: '1.0.0',
        capabilities: [],
        status: 'registered',
        registeredAt: new Date().toISOString(),
      };

      const handler = async (): Promise<AdapterResponse> => ({
        success: true,
        data: {},
        executedAt: new Date().toISOString(),
      });

      registry.registerAdapter(metadata, handler);

      const request: AdapterRequest = {
        adapterId: 'adapter-14',
        operation: 'log_op',
        params: {},
      };

      await registry.executeOperation(request);

      const log = registry.getOperationLog('adapter-14');
      expect(log.length).toBe(1);
      expect(log[0].success).toBe(true);
      expect(log[0].operation).toBe('log_op');
    });

    it('limits log entries', async () => {
      const metadata: AdapterMetadata = {
        id: 'adapter-15',
        name: 'Limit Log',
        version: '1.0.0',
        capabilities: [],
        status: 'registered',
        registeredAt: new Date().toISOString(),
      };

      const handler = async (): Promise<AdapterResponse> => ({
        success: true,
        data: {},
        executedAt: new Date().toISOString(),
      });

      registry.registerAdapter(metadata, handler);

      const request: AdapterRequest = {
        adapterId: 'adapter-15',
        operation: 'op',
        params: {},
      };

      for (let i = 0; i < 150; i++) {
        await registry.executeOperation(request);
      }

      const log = registry.getOperationLog('adapter-15');
      expect(log.length).toBeLessThanOrEqual(100);
    });
  });

  describe('getMetrics', () => {
    it('calculates adapter metrics', async () => {
      const metadata: AdapterMetadata = {
        id: 'adapter-16',
        name: 'Metrics Test',
        version: '1.0.0',
        capabilities: [],
        status: 'registered',
        registeredAt: new Date().toISOString(),
      };

      let successCount = 0;
      const handler = async (): Promise<AdapterResponse> => {
        successCount++;
        return {
          success: successCount > 1,
          data: {},
          executedAt: new Date().toISOString(),
        };
      };

      registry.registerAdapter(metadata, handler);

      const request: AdapterRequest = {
        adapterId: 'adapter-16',
        operation: 'metric_op',
        params: {},
      };

      await registry.executeOperation(request);
      await registry.executeOperation(request);
      await registry.executeOperation(request);

      const metrics = registry.getMetrics('adapter-16');
      expect(metrics).toBeDefined();
      expect(metrics?.totalOperations).toBe(3);
      expect(metrics?.successRate).toBeCloseTo(66.67, 1);
    });

    it('returns null for adapter with no operations', () => {
      const metadata: AdapterMetadata = {
        id: 'adapter-17',
        name: 'No Ops',
        version: '1.0.0',
        capabilities: [],
        status: 'registered',
        registeredAt: new Date().toISOString(),
      };

      registry.registerAdapter(metadata);

      const metrics = registry.getMetrics('adapter-17');
      expect(metrics).toBeNull();
    });
  });

  describe('clear', () => {
    it('clears all registry data', async () => {
      const metadata: AdapterMetadata = {
        id: 'adapter-18',
        name: 'Clear Test',
        version: '1.0.0',
        capabilities: [],
        status: 'registered',
        registeredAt: new Date().toISOString(),
      };

      registry.registerAdapter(metadata);

      registry.clear();

      const adapters = registry.listAdapters();
      expect(adapters).toEqual([]);
    });
  });

  describe('factory function', () => {
    it('creates default registry', () => {
      const defaultRegistry = createDefaultRegistry();
      expect(defaultRegistry).toBeDefined();
    });
  });
});
