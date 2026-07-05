/**
 * CloakBrowserAdapter — IBrowserEngine implementation for CloakBrowser
 *
 * Wraps CloakBrowser with deterministic logging, error codes, and timeout enforcement.
 * Integrates with CIC event bus for observability.
 */
import { v4 as uuidv4 } from 'uuid';
import { BrowserErrorCode, } from './IBrowserEngine';
import { RetryPolicy } from './RetryPolicy';
export class CloakBrowserAdapter {
    browser = null;
    pages = new Map();
    logCallbacks = [];
    sessionMetadata = new Map();
    retryPolicy;
    constructor() {
        // CloakBrowser initialization deferred to first use
        this.retryPolicy = new RetryPolicy({ maxRetries: 2, backoffMs: [250, 500] });
    }
    async open(url, opts) {
        const sessionId = uuidv4();
        const timeout = opts?.timeout ?? 10000;
        const session = {
            id: sessionId,
            engine: 'cloak',
            startedAt: Date.now(),
            metadata: {
                url,
                headless: opts?.headless ?? true,
                timeout,
            },
        };
        this.sessionMetadata.set(sessionId, session);
        this.emit('browser.open.start', sessionId, { url, timeout });
        // Lazy-load CloakBrowser on first use
        if (!this.browser) {
            this.browser = await this.initializeBrowser();
        }
        let lastError = null;
        while (true) {
            try {
                const page = await this.browser.newPage();
                this.pages.set(sessionId, page);
                // Navigate with timeout enforcement
                const navPromise = page.goto(url, { timeout });
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(this.createBrowserError(BrowserErrorCode.BROWSER_TIMEOUT, `Navigation timeout after ${timeout}ms`, sessionId, timeout)), timeout));
                await Promise.race([navPromise, timeoutPromise]);
                this.emit('browser.open.success', sessionId, {
                    url,
                    duration: Date.now() - session.startedAt,
                });
                this.retryPolicy.clearAttempts(sessionId);
                return session;
            }
            catch (error) {
                const err = error;
                const code = err.code ||
                    (err.message.includes('timeout') || err.message.includes('Timeout')
                        ? BrowserErrorCode.BROWSER_TIMEOUT
                        : BrowserErrorCode.BROWSER_NAV_FAIL);
                lastError = this.createBrowserError(code, err.message, sessionId, Date.now() - session.startedAt);
                // Check if should retry
                if (this.retryPolicy.shouldRetry(sessionId, code)) {
                    const backoff = this.retryPolicy.getBackoffMs(sessionId);
                    this.retryPolicy.recordAttempt(sessionId, code, err.message);
                    this.emit('browser.open.retry', sessionId, {
                        code,
                        message: err.message,
                        backoffMs: backoff,
                        attempts: this.retryPolicy.getAttempts(sessionId).length,
                    });
                    // Wait before retry
                    await new Promise((resolve) => setTimeout(resolve, backoff));
                    continue;
                }
                this.emit('browser.open.error', sessionId, {
                    code,
                    message: err.message,
                    duration: Date.now() - session.startedAt,
                    attempts: this.retryPolicy.getAttempts(sessionId).length,
                });
                this.retryPolicy.clearAttempts(sessionId);
                throw lastError;
            }
        }
    }
    async waitForLoad(session) {
        const page = this.pages.get(session.id);
        if (!page) {
            throw this.createBrowserError(BrowserErrorCode.BROWSER_NAV_FAIL, `Session ${session.id} not found`, session.id);
        }
        this.emit('browser.waitForLoad.start', session.id, {});
        try {
            // CloakBrowser handles DOM hydration internally
            // This is a no-op but included for interface compliance
            this.emit('browser.waitForLoad.success', session.id, {});
        }
        catch (error) {
            const err = error;
            this.emit('browser.waitForLoad.error', session.id, {
                message: err.message,
            });
            throw this.createBrowserError(BrowserErrorCode.BROWSER_JS_FAIL, err.message, session.id);
        }
    }
    async getHTML(session) {
        const page = this.pages.get(session.id);
        if (!page) {
            throw this.createBrowserError(BrowserErrorCode.BROWSER_CONTENT_FAIL, `Session ${session.id} not found`, session.id);
        }
        this.emit('browser.getHTML.start', session.id, {});
        try {
            const html = await page.content();
            this.emit('browser.getHTML.success', session.id, {
                contentLength: html.length,
            });
            return html;
        }
        catch (error) {
            const err = error;
            this.emit('browser.getHTML.error', session.id, {
                message: err.message,
            });
            throw this.createBrowserError(BrowserErrorCode.BROWSER_CONTENT_FAIL, err.message, session.id);
        }
    }
    async getScreenshot(session) {
        const page = this.pages.get(session.id);
        if (!page) {
            throw this.createBrowserError(BrowserErrorCode.BROWSER_SCREENSHOT_FAIL, `Session ${session.id} not found`, session.id);
        }
        this.emit('browser.getScreenshot.start', session.id, {});
        try {
            const buffer = await page.screenshot({ type: 'png' });
            this.emit('browser.getScreenshot.success', session.id, {
                bufferSize: buffer.length,
            });
            return buffer;
        }
        catch (error) {
            const err = error;
            this.emit('browser.getScreenshot.error', session.id, {
                message: err.message,
            });
            throw this.createBrowserError(BrowserErrorCode.BROWSER_SCREENSHOT_FAIL, err.message, session.id);
        }
    }
    async close(session) {
        const page = this.pages.get(session.id);
        if (!page) {
            return; // Already closed
        }
        this.emit('browser.close.start', session.id, {});
        try {
            await page.close();
            this.pages.delete(session.id);
            this.sessionMetadata.delete(session.id);
            this.emit('browser.close.success', session.id, {
                duration: Date.now() - session.startedAt,
            });
        }
        catch (error) {
            const err = error;
            this.emit('browser.close.error', session.id, {
                message: err.message,
            });
        }
    }
    onLog(callback) {
        this.logCallbacks.push(callback);
    }
    emit(event, sessionId, data) {
        const log = {
            timestamp: Date.now(),
            event,
            level: event.includes('error') ? 'error' : 'info',
            sessionId,
            data,
        };
        // Emit to all subscribed callbacks
        for (const callback of this.logCallbacks) {
            try {
                callback(log);
            }
            catch (error) {
                console.error('Log callback error:', error);
            }
        }
    }
    createBrowserError(code, message, sessionId, duration) {
        const error = new Error(message);
        error.code = code;
        error.sessionId = sessionId;
        error.duration = duration;
        return error;
    }
    async initializeBrowser() {
        // In production, dynamically import CloakBrowser here
        // For now, return a mock that can be replaced
        try {
            const cloakBrowser = await import('cloakbrowser');
            return (await cloakBrowser.launch({ headless: true }));
        }
        catch (error) {
            throw new Error('CloakBrowser not installed. Run: npm install cloakbrowser');
        }
    }
    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.pages.clear();
            this.sessionMetadata.clear();
        }
    }
}
//# sourceMappingURL=CloakBrowserAdapter.js.map