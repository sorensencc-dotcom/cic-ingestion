import { describe, expect, it, jest } from '@jest/globals';
import { HardeningOrchestrator, HardeningRegistry } from './hardeningOrchestrator';

describe('HardeningOrchestrator', () => {
  it('propagates configured limits to every composed handler', () => {
    const orchestrator = new HardeningOrchestrator({
      name: 'payments', circuitBreakerFailureThreshold: 2,
      rateLimiterRequestsPerSecond: 7, timeoutMs: 1234, maxRetries: 4,
    });
    expect(orchestrator.getMetrics()).toMatchObject({
      name: 'payments', timeout: expect.objectContaining({ timeoutMs: 1234 }),
      retry: expect.objectContaining({ name: 'payments-retry' }),
    });
    expect(orchestrator.getMetrics().rateLimiter.requestsPerSecond).toBe(7);
  });

  it('runs fallback only after the primary hardening pipeline fails', async () => {
    const primary = jest.fn(async () => { throw new Error('primary failed'); });
    const fallback = jest.fn(async <T>() => 'fallback value' as T);
    const orchestrator = new HardeningOrchestrator({ name: 'search', maxRetries: 1 });
    orchestrator.addFallbackProvider('backup', fallback as any, 1);

    await expect(orchestrator.execute(primary)).resolves.toBe('fallback value');
    expect(primary).toHaveBeenCalledTimes(1);
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('does not run the primary function after circuit breaker opens', async () => {
    const primary = jest.fn(async () => { throw new Error('down'); });
    const orchestrator = new HardeningOrchestrator({ name: 'api', circuitBreakerFailureThreshold: 1, maxRetries: 1 });

    await expect(orchestrator.execute(primary)).rejects.toThrow('down');
    await expect(orchestrator.execute(primary)).rejects.toThrow('api-cb is OPEN');
    expect(primary).toHaveBeenCalledTimes(1);
  });
});

describe('HardeningRegistry', () => {
  it('returns the same orchestrator for a provider name', () => {
    const registry = new HardeningRegistry();
    const first = registry.getOrCreate({ name: 'api' });
    expect(registry.getOrCreate({ name: 'api', maxRetries: 99 })).toBe(first);
    expect(registry.getAllMetrics().api.name).toBe('api');
  });
});
