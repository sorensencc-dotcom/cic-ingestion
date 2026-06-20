/**
 * RetryPolicy Unit Tests
 *
 * Tests: transient detection, retry conditions, backoff calculation, attempt recording
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RetryPolicy } from './RetryPolicy';
import { BrowserErrorCode } from './IBrowserEngine';

describe('RetryPolicy', () => {
  let policy: RetryPolicy;
  const sessionId = 'test-session-123';

  beforeEach(() => {
    policy = new RetryPolicy();
  });

  describe('transient error detection', () => {
    it('detects BROWSER_TIMEOUT as transient', () => {
      expect(policy.isTransient(BrowserErrorCode.BROWSER_TIMEOUT)).toBe(true);
    });

    it('detects BROWSER_NAV_FAIL as transient', () => {
      expect(policy.isTransient(BrowserErrorCode.BROWSER_NAV_FAIL)).toBe(true);
    });

    it('detects BROWSER_JS_FAIL as transient', () => {
      expect(policy.isTransient(BrowserErrorCode.BROWSER_JS_FAIL)).toBe(true);
    });

    it('detects BROWSER_SCREENSHOT_FAIL as permanent', () => {
      expect(policy.isTransient(BrowserErrorCode.BROWSER_SCREENSHOT_FAIL)).toBe(false);
    });

    it('detects BROWSER_CONTENT_FAIL as permanent', () => {
      expect(policy.isTransient(BrowserErrorCode.BROWSER_CONTENT_FAIL)).toBe(false);
    });
  });

  describe('retry conditions', () => {
    it('allows retry on transient error with attempts available', () => {
      expect(policy.shouldRetry(sessionId, BrowserErrorCode.BROWSER_TIMEOUT)).toBe(
        true
      );
    });

    it('denies retry on permanent error', () => {
      expect(policy.shouldRetry(sessionId, BrowserErrorCode.BROWSER_SCREENSHOT_FAIL)).toBe(
        false
      );
    });

    it('denies retry after max attempts reached', () => {
      // Record max attempts
      policy.recordAttempt(sessionId, BrowserErrorCode.BROWSER_TIMEOUT, 'timeout');
      policy.recordAttempt(sessionId, BrowserErrorCode.BROWSER_TIMEOUT, 'timeout');

      // Next retry should be denied
      expect(policy.shouldRetry(sessionId, BrowserErrorCode.BROWSER_TIMEOUT)).toBe(
        false
      );
    });

    it('allows retry on first attempt', () => {
      expect(policy.shouldRetry(sessionId, BrowserErrorCode.BROWSER_NAV_FAIL)).toBe(
        true
      );
    });

    it('allows retry on second attempt', () => {
      policy.recordAttempt(sessionId, BrowserErrorCode.BROWSER_TIMEOUT, 'timeout');
      expect(policy.shouldRetry(sessionId, BrowserErrorCode.BROWSER_NAV_FAIL)).toBe(
        true
      );
    });
  });

  describe('backoff calculation', () => {
    it('returns 250ms for first backoff', () => {
      expect(policy.getBackoffMs(sessionId)).toBe(250);
    });

    it('returns 500ms for second backoff', () => {
      policy.recordAttempt(sessionId, BrowserErrorCode.BROWSER_TIMEOUT, 'timeout');
      expect(policy.getBackoffMs(sessionId)).toBe(500);
    });

    it('returns max backoff after max retries', () => {
      policy.recordAttempt(sessionId, BrowserErrorCode.BROWSER_TIMEOUT, 'timeout');
      policy.recordAttempt(sessionId, BrowserErrorCode.BROWSER_TIMEOUT, 'timeout');
      expect(policy.getBackoffMs(sessionId)).toBe(500); // max backoff
    });
  });

  describe('attempt recording', () => {
    it('records attempt with error code and message', () => {
      policy.recordAttempt(
        sessionId,
        BrowserErrorCode.BROWSER_TIMEOUT,
        'Navigation timeout after 10s'
      );

      const attempts = policy.getAttempts(sessionId);
      expect(attempts).toHaveLength(1);
      expect(attempts[0].errorCode).toBe(BrowserErrorCode.BROWSER_TIMEOUT);
      expect(attempts[0].errorMessage).toBe('Navigation timeout after 10s');
    });

    it('includes timestamp in attempt record', () => {
      const before = Date.now();
      policy.recordAttempt(sessionId, BrowserErrorCode.BROWSER_NAV_FAIL, 'nav fail');
      const after = Date.now();

      const attempts = policy.getAttempts(sessionId);
      expect(attempts[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(attempts[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('includes backoff in attempt record', () => {
      policy.recordAttempt(sessionId, BrowserErrorCode.BROWSER_TIMEOUT, 'timeout');
      const attempts = policy.getAttempts(sessionId);
      expect(attempts[0].backoffMs).toBe(250);
    });

    it('increments attempt number', () => {
      policy.recordAttempt(sessionId, BrowserErrorCode.BROWSER_TIMEOUT, 'timeout');
      policy.recordAttempt(sessionId, BrowserErrorCode.BROWSER_NAV_FAIL, 'nav');

      const attempts = policy.getAttempts(sessionId);
      expect(attempts[0].attempt).toBe(1);
      expect(attempts[1].attempt).toBe(2);
    });
  });

  describe('session cleanup', () => {
    it('clears attempts for session', () => {
      policy.recordAttempt(sessionId, BrowserErrorCode.BROWSER_TIMEOUT, 'timeout');
      expect(policy.getAttempts(sessionId)).toHaveLength(1);

      policy.clearAttempts(sessionId);
      expect(policy.getAttempts(sessionId)).toHaveLength(0);
    });

    it('allows retry again after cleanup', () => {
      policy.recordAttempt(sessionId, BrowserErrorCode.BROWSER_TIMEOUT, 'timeout');
      policy.recordAttempt(sessionId, BrowserErrorCode.BROWSER_TIMEOUT, 'timeout');

      // Blocked before cleanup
      expect(policy.shouldRetry(sessionId, BrowserErrorCode.BROWSER_TIMEOUT)).toBe(false);

      policy.clearAttempts(sessionId);

      // Allowed after cleanup
      expect(policy.shouldRetry(sessionId, BrowserErrorCode.BROWSER_TIMEOUT)).toBe(true);
    });
  });

  describe('custom config', () => {
    it('respects custom max retries', () => {
      const customPolicy = new RetryPolicy({ maxRetries: 1 });
      const sid = 'custom-session';

      customPolicy.recordAttempt(sid, BrowserErrorCode.BROWSER_TIMEOUT, 'timeout');
      expect(customPolicy.shouldRetry(sid, BrowserErrorCode.BROWSER_TIMEOUT)).toBe(
        false
      );
    });

    it('respects custom backoff schedule', () => {
      const customPolicy = new RetryPolicy({ backoffMs: [100, 200, 400] });
      expect(customPolicy.getBackoffMs('any')).toBe(100);
    });

    it('respects custom transient error codes', () => {
      const customPolicy = new RetryPolicy({
        transientErrorCodes: [BrowserErrorCode.BROWSER_TIMEOUT],
      });

      expect(customPolicy.isTransient(BrowserErrorCode.BROWSER_TIMEOUT)).toBe(true);
      expect(customPolicy.isTransient(BrowserErrorCode.BROWSER_NAV_FAIL)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles multiple sessions independently', () => {
      const sid1 = 'session-1';
      const sid2 = 'session-2';

      policy.recordAttempt(sid1, BrowserErrorCode.BROWSER_TIMEOUT, 'timeout');
      policy.recordAttempt(sid1, BrowserErrorCode.BROWSER_TIMEOUT, 'timeout');

      // sid1 blocked
      expect(policy.shouldRetry(sid1, BrowserErrorCode.BROWSER_TIMEOUT)).toBe(false);

      // sid2 allowed
      expect(policy.shouldRetry(sid2, BrowserErrorCode.BROWSER_TIMEOUT)).toBe(true);
    });

    it('returns empty attempts for unknown session', () => {
      expect(policy.getAttempts('unknown-session')).toHaveLength(0);
    });

    it('clear on unknown session is safe', () => {
      expect(() => policy.clearAttempts('unknown')).not.toThrow();
    });
  });
});
