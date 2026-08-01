import { describe, expect, it, jest } from '@jest/globals';
import { FallbackChain, FallbackChainRegistry } from './fallbackChain';

describe('FallbackChain', () => {
  it('tries providers in priority order and stops after first success', async () => {
    const calls: string[] = [];
    const chain = new FallbackChain({ name: 'models' });
    chain.addProvider({ name: 'later', priority: 20, execute: async <T>() => { calls.push('later'); return 'later' as T; } });
    chain.addProvider({ name: 'primary', priority: 10, execute: async <T>() => { calls.push('primary'); throw new Error('primary down'); } });

    await expect(chain.execute<string>()).resolves.toBe('later');
    expect(calls).toEqual(['primary', 'later']);
    expect(chain.getMetrics()).toMatchObject({ totalAttempts: 2, successProvider: 'later' });
  });

  it('surfaces the terminal provider error when every fallback fails', async () => {
    const chain = new FallbackChain({ name: 'models' });
    chain.addProvider({ name: 'primary', priority: 1, execute: async () => { throw new Error('primary down'); } });
    chain.addProvider({ name: 'fallback', priority: 2, execute: async () => { throw new Error('fallback down'); } });

    await expect(chain.execute()).rejects.toThrow('fallback down');
    expect(chain.getMetrics()).toMatchObject({ totalAttempts: 2, lastError: 'fallback down' });
  });

  it('skips an OPEN provider while another provider is eligible', async () => {
    const primary = jest.fn(async () => { throw new Error('down'); });
    const backup = jest.fn(async () => 'ok');
    const chain = new FallbackChain({ providerFailureThreshold: 1, providerResetTimeoutMs: 1000 });
    chain.addProvider({ name: 'primary', priority: 1, execute: primary });
    chain.addProvider({ name: 'backup', priority: 2, execute: backup as any });

    await expect(chain.execute()).resolves.toBe('ok');
    await expect(chain.execute()).resolves.toBe('ok');
    expect(primary).toHaveBeenCalledTimes(1);
    expect(backup).toHaveBeenCalledTimes(2);
  });
});

describe('FallbackChainRegistry', () => {
  it('reuses chains and preserves configuration', () => {
    const registry = new FallbackChainRegistry();
    const first = registry.getOrCreate('api', { providerFailureThreshold: 7 });
    expect(registry.getOrCreate('api')).toBe(first);
    expect(registry.getMetrics('api')?.name).toBe('api');
  });
});
