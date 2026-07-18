import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TimeoutHandler, TimeoutHandlerRegistry } from './timeout';

describe('TimeoutHandler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('resolves successfully if the operation completes before the timeout', async () => {
    const handler = new TimeoutHandler({ timeoutMs: 1000 });
    const mockFn = jest.fn(async () => 'ok');

    const result = await handler.execute(mockFn);
    expect(result).toBe('ok');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('rejects with timeout error if the operation exceeds the timeout limit', async () => {
    const handler = new TimeoutHandler({ timeoutMs: 1000, name: 'CustomTimeout' });
    const mockFn = jest.fn(async () => {
      // Simulate long execution
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return 'done';
    });

    const executePromise = handler.execute(mockFn);
    const assertionPromise = expect(executePromise).rejects.toThrow('CustomTimeout exceeded 1000ms');

    // Advance timer past the threshold
    await jest.advanceTimersByTimeAsync(1000);

    await assertionPromise;
  });

  it('returns configuration details', () => {
    const handler = new TimeoutHandler({ timeoutMs: 500, name: 'ConfigTest' });
    const config = handler.getConfig();
    expect(config.timeoutMs).toBe(500);
    expect(config.name).toBe('ConfigTest');
  });
});

describe('TimeoutHandlerRegistry', () => {
  it('creates and manages timeout handlers', async () => {
    const registry = new TimeoutHandlerRegistry({ timeoutMs: 2000 });
    const h1 = registry.getOrCreate('serviceA');
    const h2 = registry.getOrCreate('serviceA');
    
    expect(h1).toBe(h2);
    expect(registry.get('serviceA')).toBe(h1);

    const mockFn = jest.fn(async () => 'ok');
    const res = await registry.execute('serviceA', mockFn);
    expect(res).toBe('ok');
  });
});
