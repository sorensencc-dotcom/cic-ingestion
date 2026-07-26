import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CircuitBreaker } from '../circuitBreaker';
import { RateLimiter } from '../rateLimiter';
import { RetryHandler } from '../retry';
import { HardeningOrchestrator } from '../hardeningOrchestrator';

describe('Resilience Orchestration Tests', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Combined Retry Policy inside CircuitBreaker', () => {
    it('succeeds overall when retry policy resolves transient failure before CircuitBreaker records failure', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 2, failureRateThreshold: 1.1 });
      const retry = new RetryHandler({ maxAttempts: 3, initialDelayMs: 50 });

      let attempts = 0;
      const fn = jest.fn(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('transient network glitch');
        }
        return 'success_after_retries';
      });

      const executePromise = cb.execute(() => retry.execute(fn));

      // Advance timers for retry delays (attempt 1 -> 50ms, attempt 2 -> 100ms)
      await jest.advanceTimersByTimeAsync(50);
      await jest.advanceTimersByTimeAsync(100);

      const result = await executePromise;

      expect(result).toBe('success_after_retries');
      expect(fn).toHaveBeenCalledTimes(3);
      expect(cb.getState()).toBe('CLOSED');
      expect(cb.getMetrics().successCount).toBe(1);
      expect(cb.getMetrics().failureCount).toBe(0);
    });

    it('records a single CircuitBreaker failure when all retry attempts fail', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 3, failureRateThreshold: 1.1 });
      const retry = new RetryHandler({ maxAttempts: 3, initialDelayMs: 50 });

      const fn = jest.fn(async () => {
        throw new Error('persistent service failure');
      });

      const executePromise = cb.execute(() => retry.execute(fn));
      const assertionPromise = expect(executePromise).rejects.toThrow('persistent service failure');

      await jest.advanceTimersByTimeAsync(50);
      await jest.advanceTimersByTimeAsync(100);

      await assertionPromise;

      expect(fn).toHaveBeenCalledTimes(3);
      expect(cb.getState()).toBe('CLOSED');
      expect(cb.getMetrics().failureCount).toBe(1);
    });

    it('trips CircuitBreaker to OPEN when multiple retry-wrapped operations fail beyond threshold', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 2, failureRateThreshold: 1.1 });
      const retry = new RetryHandler({ maxAttempts: 2, initialDelayMs: 10 });

      const failingFn = jest.fn(async () => {
        throw new Error('downstream offline');
      });

      // Operation 1 fails after 2 retries -> CB failure count = 1
      const op1 = cb.execute(() => retry.execute(failingFn));
      const p1 = expect(op1).rejects.toThrow('downstream offline');
      await jest.advanceTimersByTimeAsync(10);
      await p1;

      expect(cb.getState()).toBe('CLOSED');

      // Operation 2 fails after 2 retries -> CB failure count = 2 (reaches failureThreshold)
      retry.reset();
      const op2 = cb.execute(() => retry.execute(failingFn));
      const p2 = expect(op2).rejects.toThrow('downstream offline');
      await jest.advanceTimersByTimeAsync(10);
      await p2;

      expect(cb.getState()).toBe('OPEN');

      // Subsequence operations fail fast without calling fn
      retry.reset();
      await expect(cb.execute(() => retry.execute(failingFn))).rejects.toThrow('CircuitBreaker is OPEN');
    });

    it('orchestrates RateLimiter -> CircuitBreaker -> Retry pipeline in HardeningOrchestrator', async () => {
      const orchestrator = new HardeningOrchestrator({
        name: 'test-orchestrator',
        circuitBreakerFailureThreshold: 2,
        rateLimiterRequestsPerSecond: 10,
        maxRetries: 2,
      });

      let attempts = 0;
      const fn = jest.fn(async () => {
        attempts++;
        if (attempts === 1) {
          throw new Error('first attempt failed');
        }
        return 'orchestration_ok';
      });

      const executePromise = orchestrator.execute(fn);
      await jest.advanceTimersByTimeAsync(100);

      const res = await executePromise;
      expect(res).toBe('orchestration_ok');
      expect(fn).toHaveBeenCalledTimes(2);

      const metrics = orchestrator.getMetrics();
      expect(metrics.rateLimiter.allowed).toBe(1);
      expect(metrics.circuitBreaker.successCount).toBe(1);
      expect(metrics.retry.retries).toBe(1);
    });
  });

  describe('CircuitBreaker State Transitions', () => {
    it('transitions CLOSED -> OPEN on failure threshold -> HALF-OPEN after reset timeout -> CLOSED on success', async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 2,
        failureRateThreshold: 1.1,
        resetTimeoutMs: 5000,
      });

      // 1. Initially CLOSED
      expect(cb.getState()).toBe('CLOSED');

      // 2. Fail twice to trigger OPEN
      await expect(cb.execute(async () => { throw new Error('fail 1'); })).rejects.toThrow('fail 1');
      expect(cb.getState()).toBe('CLOSED');

      await expect(cb.execute(async () => { throw new Error('fail 2'); })).rejects.toThrow('fail 2');
      expect(cb.getState()).toBe('OPEN');

      // Calls while OPEN throw immediately
      await expect(cb.execute(async () => 'should not run')).rejects.toThrow('CircuitBreaker is OPEN');

      // 3. Advance time by resetTimeoutMs (5000ms) to trigger transition to HALF-OPEN
      jest.advanceTimersByTime(5000);
      expect(cb.getState()).toBe('HALF_OPEN');

      // 4. Successful call in HALF-OPEN state transitions back to CLOSED
      const res = await cb.execute(async () => 'recovered_data');
      expect(res).toBe('recovered_data');
      expect(cb.getState()).toBe('CLOSED');
    });

    it('transitions HALF-OPEN back to OPEN if execution fails in HALF-OPEN state', async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        failureRateThreshold: 1.1,
        resetTimeoutMs: 2000,
      });

      await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow('fail');
      expect(cb.getState()).toBe('OPEN');

      jest.advanceTimersByTime(2000);
      expect(cb.getState()).toBe('HALF_OPEN');

      // Failure while HALF-OPEN returns immediately to OPEN
      await expect(cb.execute(async () => { throw new Error('still failing'); })).rejects.toThrow('still failing');
      expect(cb.getState()).toBe('OPEN');
    });
  });

  describe('RateLimiter Token Removal and Replenishment', () => {
    it('removes tokens upon consumption and rejects when depleted', () => {
      const limiter = new RateLimiter({ requestsPerSecond: 10, burstSize: 3 });

      expect(limiter.getMetrics().tokensAvailable).toBe(3);

      // Consume tokens
      expect(limiter.tryConsume()).toBe(true);
      expect(limiter.getMetrics().tokensAvailable).toBe(2);

      expect(limiter.tryConsume()).toBe(true);
      expect(limiter.getMetrics().tokensAvailable).toBe(1);

      expect(limiter.tryConsume()).toBe(true);
      expect(limiter.getMetrics().tokensAvailable).toBe(0);

      // 4th consumption attempt when 0 tokens remain
      expect(limiter.tryConsume()).toBe(false);

      const metrics = limiter.getMetrics();
      expect(metrics.allowed).toBe(3);
      expect(metrics.rejected).toBe(1);
      expect(metrics.tokensAvailable).toBe(0);
    });

    it('replenishes tokens after window expiration and time advance', () => {
      // 10 requests per second = 1 token every 100ms
      const limiter = new RateLimiter({ requestsPerSecond: 10, burstSize: 5 });

      // Deplete all 5 tokens
      for (let i = 0; i < 5; i++) {
        expect(limiter.tryConsume()).toBe(true);
      }
      expect(limiter.tryConsume()).toBe(false);
      expect(limiter.getMetrics().tokensAvailable).toBe(0);

      // Advance time by 300ms -> should refill 3 tokens (300ms * 10 tokens / 1000ms = 3 tokens)
      jest.advanceTimersByTime(300);

      expect(limiter.getMetrics().tokensAvailable).toBe(3);

      // Consume the 3 replenished tokens
      expect(limiter.tryConsume()).toBe(true);
      expect(limiter.tryConsume()).toBe(true);
      expect(limiter.tryConsume()).toBe(true);
      expect(limiter.tryConsume()).toBe(false);

      // Advance time by 1000ms -> should cap at max burstSize (5 tokens)
      jest.advanceTimersByTime(1000);
      expect(limiter.getMetrics().tokensAvailable).toBe(5);
    });

    it('unblocks queued consume requests once window expires and tokens replenish', async () => {
      const limiter = new RateLimiter({ requestsPerSecond: 10, burstSize: 1 });

      expect(limiter.tryConsume()).toBe(true);
      expect(limiter.getMetrics().tokensAvailable).toBe(0);

      let unblocked = false;
      const consumeTask = limiter.consume().then(() => {
        unblocked = true;
      });

      expect(unblocked).toBe(false);

      // Advance time by 100ms (1 token refilled)
      await jest.advanceTimersByTimeAsync(100);
      await consumeTask;

      expect(unblocked).toBe(true);
      expect(limiter.getMetrics().allowed).toBe(2);
    });
  });
});
