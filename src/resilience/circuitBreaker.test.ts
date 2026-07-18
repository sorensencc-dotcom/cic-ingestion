import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CircuitBreaker, CircuitBreakerRegistry } from './circuitBreaker';

describe('CircuitBreaker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts in CLOSED state with empty metrics', () => {
    const cb = new CircuitBreaker();
    expect(cb.getState()).toBe('CLOSED');
    
    const metrics = cb.getMetrics();
    expect(metrics.state).toBe('CLOSED');
    expect(metrics.consecutiveFailures).toBe(0);
    expect(metrics.totalRequests).toBe(0);
    expect(metrics.successCount).toBe(0);
    expect(metrics.failureCount).toBe(0);
    expect(metrics.failureRate).toBe(0);
  });

  it('records success and increments metrics', async () => {
    const cb = new CircuitBreaker();
    const result = await cb.execute(async () => 'success_data');
    
    expect(result).toBe('success_data');
    expect(cb.getState()).toBe('CLOSED');
    
    const metrics = cb.getMetrics();
    expect(metrics.successCount).toBe(1);
    expect(metrics.totalRequests).toBe(1);
  });

  it('records failures and transitions to OPEN state when failure threshold is reached', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, failureRateThreshold: 1.1 });
    const failingFn = () => Promise.reject(new Error('fail'));

    for (let i = 0; i < 2; i++) {
      await expect(cb.execute(failingFn)).rejects.toThrow('fail');
      expect(cb.getState()).toBe('CLOSED');
    }

    // Third failure triggers OPEN
    await expect(cb.execute(failingFn)).rejects.toThrow('fail');
    expect(cb.getState()).toBe('OPEN');

    // Future executions fail fast
    await expect(cb.execute(async () => 'ok')).rejects.toThrow('CircuitBreaker is OPEN');
  });

  it('transitions to HALF_OPEN after reset timeout', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, failureRateThreshold: 1.1, resetTimeoutMs: 1000 });
    const failingFn = () => Promise.reject(new Error('fail'));

    await expect(cb.execute(failingFn)).rejects.toThrow('fail');
    await expect(cb.execute(failingFn)).rejects.toThrow('fail');
    expect(cb.getState()).toBe('OPEN');

    // Advance time
    jest.advanceTimersByTime(1000);
    expect(cb.getState()).toBe('HALF_OPEN');
  });

  it('transitions from HALF_OPEN back to CLOSED after success', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, failureRateThreshold: 1.1, resetTimeoutMs: 1000 });
    const failingFn = () => Promise.reject(new Error('fail'));

    await expect(cb.execute(failingFn)).rejects.toThrow('fail');
    await expect(cb.execute(failingFn)).rejects.toThrow('fail');
    
    jest.advanceTimersByTime(1000);
    expect(cb.getState()).toBe('HALF_OPEN');

    // Successful execution in HALF_OPEN resets to CLOSED
    const result = await cb.execute(async () => 'recovered');
    expect(result).toBe('recovered');
    expect(cb.getState()).toBe('CLOSED');
  });

  it('transitions from HALF_OPEN back to OPEN on first failure', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, failureRateThreshold: 1.1, resetTimeoutMs: 1000 });
    const failingFn = () => Promise.reject(new Error('fail'));

    await expect(cb.execute(failingFn)).rejects.toThrow('fail');
    await expect(cb.execute(failingFn)).rejects.toThrow('fail');
    
    jest.advanceTimersByTime(1000);
    expect(cb.getState()).toBe('HALF_OPEN');

    // Failure in HALF_OPEN triggers immediate OPEN
    await expect(cb.execute(failingFn)).rejects.toThrow('fail');
    expect(cb.getState()).toBe('OPEN');
  });

  it('resets correctly', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, failureRateThreshold: 1.1 });
    const failingFn = () => Promise.reject(new Error('fail'));

    await expect(cb.execute(failingFn)).rejects.toThrow('fail');
    expect(cb.getState()).toBe('OPEN');

    cb.reset();
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.getMetrics().totalRequests).toBe(0);
  });
});

describe('CircuitBreakerRegistry', () => {
  it('creates and caches circuit breakers', () => {
    const registry = new CircuitBreakerRegistry({ failureThreshold: 10 });
    const cb1 = registry.getOrCreate('serviceA');
    const cb2 = registry.getOrCreate('serviceA');
    const cb3 = registry.getOrCreate('serviceB');

    expect(cb1).toBe(cb2);
    expect(cb1).not.toBe(cb3);
    
    expect(registry.get('serviceA')).toBe(cb1);
    expect(registry.getAll().size).toBe(2);
  });

  it('aggregates metrics and resets all', () => {
    const registry = new CircuitBreakerRegistry();
    registry.getOrCreate('serviceA');
    registry.getOrCreate('serviceB');

    const allMetrics = registry.getAllMetrics();
    expect(allMetrics['serviceA']).toBeDefined();
    expect(allMetrics['serviceB']).toBeDefined();

    registry.resetAll();
    expect(registry.get('serviceA')?.getMetrics().totalRequests).toBe(0);
  });
});
