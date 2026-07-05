/**
 * RetryPolicy — Deterministic retry layer for CloakBrowser navigation
 *
 * Implements bounded deterministic retries with exponential backoff.
 * Retries only on transient failures (nav, JS execution).
 * Permanent failures (WAF, auth) are not retried.
 */
import { BrowserErrorCode } from './IBrowserEngine';
export class RetryPolicy {
    config;
    attempts = new Map();
    constructor(config) {
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
    isTransient(errorCode) {
        return this.config.transientErrorCodes.includes(errorCode);
    }
    /**
     * Should retry based on attempt count and error code
     */
    shouldRetry(sessionId, errorCode) {
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
    getBackoffMs(sessionId) {
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
    recordAttempt(sessionId, errorCode, errorMessage) {
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
    getAttempts(sessionId) {
        return this.attempts.get(sessionId) || [];
    }
    /**
     * Clear session attempts (cleanup)
     */
    clearAttempts(sessionId) {
        this.attempts.delete(sessionId);
    }
}
//# sourceMappingURL=RetryPolicy.js.map