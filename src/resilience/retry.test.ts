import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { RetryHandler, RetryHandlerRegistry } from './retry';

describe('RetryHandler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('executes successfully on the first try', async () => {
    const handler = new RetryHandler({ maxAttempts: 3 });
    const mockFn = jest.fn(async () => 'ok');

    const result = await handler.execute(mockFn);
    expect(result).toBe('ok');
    expect(mockFn).toHaveBeenCalledTimes(1);

    const metrics = handler.getMetrics();
    expect(metrics.totalAttempts).toBe(1);
    expect(metrics.successes).toBe(1);
    expect(metrics.retries).toBe(0);
    expect(metrics.failures).toBe(0);
  });

  it('retries on failure and eventually succeeds', async () => {
    const handler = new RetryHandler({ maxAttempts: 3, initialDelayMs: 100 });
    let attempts = 0;
    const mockFn = jest.fn(async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('temporary error');
      }
      return 'recovered';
    });

    const executePromise = handler.execute(mockFn);

    // First attempt fails. Timer scheduled for 100ms
    await jest.advanceTimersByTimeAsync(100);
    // Second attempt fails. Timer scheduled for 200ms (100 * 2)
    await jest.advanceTimersByTimeAsync(200);

    const result = await executePromise;
    expect(result).toBe('recovered');
    expect(mockFn).toHaveBeenCalledTimes(3);

    const metrics = handler.getMetrics();
    expect(metrics.totalAttempts).toBe(3);
    expect(metrics.retries).toBe(2);
    expect(metrics.successes).toBe(1);
    expect(metrics.failures).toBe(0);
  });

  it('fails completely after exceeding max attempts', async () => {
    const handler = new RetryHandler({ maxAttempts: 3, initialDelayMs: 100 });
    const mockFn = jest.fn(async () => {
      throw new Error('permanent error');
    });

    const executePromise = handler.execute(mockFn);
    const assertionPromise = expect(executePromise).rejects.toThrow('permanent error');

    // Fail 1 -> wait 100ms
    await jest.advanceTimersByTimeAsync(100);
    // Fail 2 -> wait 200ms
    await jest.advanceTimersByTimeAsync(200);

    await assertionPromise;
    expect(mockFn).toHaveBeenCalledTimes(3);

    const metrics = handler.getMetrics();
    expect(metrics.totalAttempts).toBe(3);
    expect(metrics.retries).toBe(2);
    expect(metrics.successes).toBe(0);
    expect(metrics.failures).toBe(1);
    expect(metrics.lastError).toBe('permanent error');
  });

  it('caps backoff delay at maxDelayMs', async () => {
    const handler = new RetryHandler({
      maxAttempts: 4,
      initialDelayMs: 100,
      backoffMultiplier: 10,
      maxDelayMs: 500,
    });
    const mockFn = jest.fn(async () => {
      throw new Error('fail');
    });

    // Delays would be:
    // Attempt 1 fails -> delay 100ms
    // Attempt 2 fails -> delay 1000ms (capped at 500ms)
    // Attempt 3 fails -> delay 10000ms (capped at 500ms)
    const executePromise = handler.execute(mockFn);
    const assertionPromise = expect(executePromise).rejects.toThrow('fail');

    await jest.advanceTimersByTimeAsync(100);
    await jest.advanceTimersByTimeAsync(500); // capped at 500ms
    await jest.advanceTimersByTimeAsync(500); // capped at 500ms

    await assertionPromise;
    expect(mockFn).toHaveBeenCalledTimes(4);
  });

  it('resets correctly', async () => {
    const handler = new RetryHandler({ maxAttempts: 1 });
    await expect(handler.execute(async () => { throw new Error('e'); })).rejects.toThrow('e');

    handler.reset();
    expect(handler.getMetrics().totalAttempts).toBe(0);
    expect(handler.getMetrics().failures).toBe(0);
  });
});

describe('RetryHandlerRegistry', () => {
  it('creates and manages retry handlers', async () => {
    const registry = new RetryHandlerRegistry({ maxAttempts: 2 });
    const h1 = registry.getOrCreate('serviceA');
    const h2 = registry.getOrCreate('serviceA');
    
    expect(h1).toBe(h2);
    expect(registry.get('serviceA')).toBe(h1);

    const mockFn = jest.fn(async () => 'ok');
    const res = await registry.execute('serviceA', mockFn);
    expect(res).toBe('ok');
    expect(registry.getMetrics('serviceA')?.successes).toBe(1);
  });
});
