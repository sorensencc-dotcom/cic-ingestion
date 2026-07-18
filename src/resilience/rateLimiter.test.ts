import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { RateLimiter, RateLimiterRegistry } from './rateLimiter';

describe('RateLimiter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts with full token capacity', () => {
    const limiter = new RateLimiter({ requestsPerSecond: 10, burstSize: 20 });
    const metrics = limiter.getMetrics();
    expect(metrics.tokensAvailable).toBe(20);
    expect(metrics.allowed).toBe(0);
    expect(metrics.rejected).toBe(0);
  });

  it('consumes tokens and rejects when depleted', () => {
    const limiter = new RateLimiter({ requestsPerSecond: 10, burstSize: 3 });

    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(false); // Depleted!

    const metrics = limiter.getMetrics();
    expect(metrics.tokensAvailable).toBe(0);
    expect(metrics.allowed).toBe(3);
    expect(metrics.rejected).toBe(1);
    expect(metrics.rejection_rate).toBe(0.25);
  });

  it('refills tokens over time', () => {
    const limiter = new RateLimiter({ requestsPerSecond: 10, burstSize: 5 });

    // Consume all
    for (let i = 0; i < 5; i++) {
      expect(limiter.tryConsume()).toBe(true);
    }
    expect(limiter.tryConsume()).toBe(false);

    // Advance time by 500ms -> should refill 5 tokens (10 rps / 1000 * 500 = 5 tokens)
    jest.advanceTimersByTime(500);

    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(false); // Depleted again
  });

  it('blocks async consume until tokens are available', async () => {
    const limiter = new RateLimiter({ requestsPerSecond: 10, burstSize: 1 });

    // Consume the only token
    expect(limiter.tryConsume()).toBe(true);

    // Async consume should block. We start it:
    let consumed = false;
    const consumePromise = limiter.consume().then(() => {
      consumed = true;
    });

    // Verify it is still blocking
    expect(consumed).toBe(false);

    // Run timers forward to refill the token (10 rps -> 1 token per 100ms)
    await jest.advanceTimersByTimeAsync(100);
    await consumePromise;

    expect(consumed).toBe(true);
  });

  it('resets correctly', () => {
    const limiter = new RateLimiter({ requestsPerSecond: 10, burstSize: 5 });
    expect(limiter.tryConsume()).toBe(true);
    
    limiter.reset();
    expect(limiter.getMetrics().tokensAvailable).toBe(5);
    expect(limiter.getMetrics().allowed).toBe(0);
  });
});

describe('RateLimiterRegistry', () => {
  it('creates and caches rate limiters', () => {
    const registry = new RateLimiterRegistry({ requestsPerSecond: 5 });
    const r1 = registry.getOrCreate('endpointA');
    const r2 = registry.getOrCreate('endpointA');
    const r3 = registry.getOrCreate('endpointB');

    expect(r1).toBe(r2);
    expect(r1).not.toBe(r3);
    expect(registry.get('endpointA')).toBe(r1);
  });

  it('can consume and track metrics from registry', async () => {
    const registry = new RateLimiterRegistry({ requestsPerSecond: 10, burstSize: 2 });

    expect(await registry.tryConsume('endpointA')).toBe(true);
    expect(await registry.tryConsume('endpointA')).toBe(true);
    expect(await registry.tryConsume('endpointA')).toBe(false);

    const allMetrics = registry.getAllMetrics();
    expect(allMetrics['endpointA']).toBeDefined();
    expect(allMetrics['endpointA'].allowed).toBe(2);

    registry.resetAll();
    expect(registry.getMetrics('endpointA')?.allowed).toBe(0);
  });
});
