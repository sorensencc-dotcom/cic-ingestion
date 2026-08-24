import { describe, expect, it, jest } from '@jest/globals';
import { FallbackChain, FallbackChainRegistry } from './fallbackChain';

describe('FallbackChain', () => {
  it('tries providers in priority order and passes input parameter dynamically', async () => {
    const calls: string[] = [];
    const chain = new FallbackChain<string, string>({ name: 'models' });
    chain.addProvider({
      name: 'later',
      priority: 20,
      execute: async (input: string) => {
        calls.push(`later:${input}`);
        return `echo:${input}`;
      },
    });
    chain.addProvider({
      name: 'primary',
      priority: 10,
      execute: async (input: string) => {
        calls.push(`primary:${input}`);
        throw new Error('primary down');
      },
    });

    await expect(chain.execute('query-1')).resolves.toBe('echo:query-1');
    expect(calls).toEqual(['primary:query-1', 'later:query-1']);
    expect(chain.getMetrics()).toMatchObject({ totalAttempts: 2, successProvider: 'later' });
  });

  it('surfaces the terminal provider error when every fallback fails', async () => {
    const chain = new FallbackChain<void, string>({ name: 'models' });
    chain.addProvider({ name: 'primary', priority: 1, execute: async () => { throw new Error('primary down'); } });
    chain.addProvider({ name: 'fallback', priority: 2, execute: async () => { throw new Error('fallback down'); } });

    await expect(chain.execute(undefined)).rejects.toThrow('fallback down');
    expect(chain.getMetrics()).toMatchObject({ totalAttempts: 2, lastError: 'fallback down' });
  });

  it('skips an OPEN provider while another provider is eligible and retains state across requests', async () => {
    const primary = jest.fn(async (_req: string) => { throw new Error('down'); });
    const backup = jest.fn(async (req: string) => `ok:${req}`);
    const chain = new FallbackChain<string, string>({ providerFailureThreshold: 1, providerResetTimeoutMs: 1000 });
    chain.addProvider({ name: 'primary', priority: 1, execute: primary });
    chain.addProvider({ name: 'backup', priority: 2, execute: backup });

    await expect(chain.execute('req1')).resolves.toBe('ok:req1');
    await expect(chain.execute('req2')).resolves.toBe('ok:req2');

    // Primary failed once, tripped to OPEN, and was skipped on the second request
    expect(primary).toHaveBeenCalledTimes(1);
    expect(backup).toHaveBeenCalledTimes(2);
    expect(chain.getMetrics().providerStates['primary']).toBe('OPEN');
    expect(chain.getMetrics().providerStates['backup']).toBe('CLOSED');
  });

  it('recovers from HALF_OPEN to CLOSED on successful probe', async () => {
    let failPrimary = true;
    const primary = jest.fn(async () => {
      if (failPrimary) throw new Error('down');
      return 'primary-recovered';
    });
    const backup = jest.fn(async () => 'backup-response');

    const chain = new FallbackChain<void, string>({ providerFailureThreshold: 1, providerResetTimeoutMs: 50 });
    chain.addProvider({ name: 'primary', priority: 1, execute: primary });
    chain.addProvider({ name: 'backup', priority: 2, execute: backup });

    // Request 1: primary fails -> OPEN, backup succeeds
    await expect(chain.execute(undefined)).resolves.toBe('backup-response');
    expect(chain.getMetrics().providerStates['primary']).toBe('OPEN');

    // Wait for cooldown to transition to HALF_OPEN
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(chain.getMetrics().providerStates['primary']).toBe('HALF_OPEN');

    // Request 2: primary is HALF_OPEN and now succeeds -> transitions back to CLOSED
    failPrimary = false;
    await expect(chain.execute(undefined)).resolves.toBe('primary-recovered');
    expect(chain.getMetrics().providerStates['primary']).toBe('CLOSED');
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

