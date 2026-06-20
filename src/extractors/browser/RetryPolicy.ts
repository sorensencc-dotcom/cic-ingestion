/**
 * RetryPolicy — Deterministic retry layer for CloakBrowser navigation
 *
 * Implements bounded deterministic retries with exponential backoff.
 * Retries only on transient failures (nav, JS execution).
 * Permanent failures (WAF, auth) are not retried.
 */

import { BrowserErrorCode } from './IBrowserEngine';

export interface RetryConfig {
  maxRetries: number; // max 2
  backoffMs: number[]; // [250, 500] cumulative
  transientErrorCodes: BrowserErrorCode[];
}

export interface RetryAttempt {
  attempt: number;
  timestamp: number;
  errorCode?: BrowserErrorCode;
  errorMessage?: string;
  backoffMs?: number;
}

export class RetryPolicy {
  private config: RetryConfig;
  private attempts: Map<string, RetryAttempt[]> = new Map();

  constructor(config?: Partial<RetryConfig>) {
    this.config = {
      maxRetries: 2,
      backoffMs: [250, 500],
      transientErrorCodes: [
        BrowserErrorCode.BROWSER_TIMEOUT,
        BrowserErrorCode.BROWSER_NAV_FAIL,
        BrowserErrorCode.BROWSER_JS_FAIL,
      ],
      ...config,
    };
  }

  /**
   * Determine if error is transient (retryable)
   */
  isTransient(errorCode: BrowserErrorCode): boolean {
    return this.config.transientErrorCodes.includes(errorCode);
  }

  /**
   * Should retry based on attempt count and error code
   */
  shouldRetry(sessionId: string, errorCode: BrowserErrorCode): boolean {
    const attempts = this.attempts.get(sessionId) || [];

    // Don't retry if permanent error
    if (!this.isTransient(errorCode)) {
      return false;
    }

    // Don't retry if max retries exceeded
    if (attempts.length >= this.config.maxRetries) {
      return false;
    }

    return true;
  }

  /**
   * Get backoff duration in ms for next retry
   */
  getBackoffMs(sessionId: string): number {
    const attempts = this.attempts.get(sessionId) || [];
    const attemptIndex = attempts.length; // 0-indexed

    if (attemptIndex >= this.config.backoffMs.length) {
      return this.config.backoffMs[this.config.backoffMs.length - 1];
    }

    return this.config.backoffMs[attemptIndex];
  }

  /**
   * Record retry attempt
   */
  recordAttempt(
    sessionId: string,
    errorCode: BrowserErrorCode,
    errorMessage: string
  ): void {
    const attempts = this.attempts.get(sessionId) || [];
    const backoff = this.getBackoffMs(sessionId);

    attempts.push({
      attempt: attempts.length + 1,
      timestamp: Date.now(),
      errorCode,
      errorMessage,
      backoffMs: backoff,
    });

    this.attempts.set(sessionId, attempts);
  }

  /**
   * Get all attempts for session
   */
  getAttempts(sessionId: string): RetryAttempt[] {
    return this.attempts.get(sessionId) || [];
  }

  /**
   * Clear session attempts (cleanup)
   */
  clearAttempts(sessionId: string): void {
    this.attempts.delete(sessionId);
  }
}
