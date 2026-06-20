/**
 * IBrowserEngine — Stable interface for browser-based extractors in CIC
 *
 * Enables plug-and-play browser engines (CloakBrowser, Playwright, etc.)
 * with deterministic logging, error codes, and timeout enforcement.
 */
export interface BrowserOptions {
    timeout?: number;
    headless?: boolean;
    viewport?: {
        width: number;
        height: number;
    };
    userAgent?: string;
}
export interface BrowserSession {
    id: string;
    engine: 'cloak' | 'playwright' | 'mock';
    startedAt: number;
    metadata: Record<string, any>;
}
export interface BrowserLog {
    timestamp: number;
    event: string;
    level: 'info' | 'warn' | 'error';
    sessionId: string;
    data: Record<string, any>;
}
export declare enum BrowserErrorCode {
    BROWSER_TIMEOUT = "BROWSER_TIMEOUT",
    BROWSER_NAV_FAIL = "BROWSER_NAV_FAIL",
    BROWSER_JS_FAIL = "BROWSER_JS_FAIL",
    BROWSER_SCREENSHOT_FAIL = "BROWSER_SCREENSHOT_FAIL",
    BROWSER_CONTENT_FAIL = "BROWSER_CONTENT_FAIL"
}
export interface BrowserError extends Error {
    code: BrowserErrorCode;
    sessionId?: string;
    duration?: number;
}
export interface IBrowserEngine {
    /**
     * Open a browser session and navigate to URL
     */
    open(url: string, opts?: BrowserOptions): Promise<BrowserSession>;
    /**
     * Wait for page to finish loading
     */
    waitForLoad(session: BrowserSession): Promise<void>;
    /**
     * Get rendered HTML content
     */
    getHTML(session: BrowserSession): Promise<string>;
    /**
     * Capture page screenshot as PNG buffer
     */
    getScreenshot(session: BrowserSession): Promise<Buffer>;
    /**
     * Close session and cleanup resources
     */
    close(session: BrowserSession): Promise<void>;
    /**
     * Subscribe to structured logs
     */
    onLog(callback: (log: BrowserLog) => void): void;
}
//# sourceMappingURL=IBrowserEngine.d.ts.map