/**
 * RetryPolicy — Deterministic retry layer for CloakBrowser navigation
 *
 * Implements bounded deterministic retries with exponential backoff.
 * Retries only on transient failures (nav, JS execution).
 * Permanent failures (WAF, auth) are not retried.
 */
import { BrowserErrorCode } from './IBrowserEngine';
export interface RetryConfig {
    maxRetries: number;
    backoffMs: number[];
    transientErrorCodes: BrowserErrorCode[];
}
export interface RetryAttempt {
    attempt: number;
    timestamp: number;
    errorCode?: BrowserErrorCode;
    errorMessage?: string;
    backoffMs?: number;
}
export declare class RetryPolicy {
    private config;
    private attempts;
    constructor(config?: Partial<RetryConfig>);
    /**
     * Determine if error is transient (retryable)
     */
    isTransient(errorCode: BrowserErrorCode): boolean;
    /**
     * Should retry based on attempt count and error code
     */
    shouldRetry(sessionId: string, errorCode: BrowserErrorCode): boolean;
    /**
     * Get backoff duration in ms for next retry
     */
    getBackoffMs(sessionId: string): number;
    /**
     * Record retry attempt
     */
    recordAttempt(sessionId: string, errorCode: BrowserErrorCode, errorMessage: string): void;
    /**
     * Get all attempts for session
     */
    getAttempts(sessionId: string): RetryAttempt[];
    /**
     * Clear session attempts (cleanup)
     */
    clearAttempts(sessionId: string): void;
}
//# sourceMappingURL=RetryPolicy.d.ts.map