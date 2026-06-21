/**
 * SweeperFallbackRouter — Vertical-aware ingestion routing
 *
 * Routes SMB website ingestion based on vertical + JS complexity:
 * - High-JS verticals (Dental, MedSpa, Agencies) → CloakBrowser first
 * - Low-JS verticals (Restaurants, Trades) → HTML/regex → fallback to Cloak
 * - All browser failures → DLQ
 *
 * Maintains deterministic ingestion under CIC's timeout envelope.
 */
import { CloakBrowserAdapter } from '../browser/CloakBrowserAdapter.js';
export var Vertical;
(function (Vertical) {
    Vertical["DENTAL"] = "dental";
    Vertical["MEDSPA"] = "medspa";
    Vertical["MEDICAL"] = "medical";
    Vertical["AGENCY"] = "agency";
    Vertical["REAL_ESTATE"] = "real_estate";
    Vertical["RESTAURANT"] = "restaurant";
    Vertical["LOCAL_RETAIL"] = "local_retail";
    Vertical["TRADES"] = "trades";
    Vertical["UNKNOWN"] = "unknown";
})(Vertical || (Vertical = {}));
export class SweeperFallbackRouter {
    constructor(browserEngine) {
        this.dlqEntries = [];
        this.routingMetrics = new Map();
        this.browserEngine = browserEngine || new CloakBrowserAdapter();
        this.setupLogging();
    }
    /**
     * Main ingestion entry point
     * Routes based on vertical + JS complexity
     */
    async ingest(url, opts) {
        const startTime = Date.now();
        const vertical = opts?.vertical || this.detectVertical(url);
        const result = {
            url,
            vertical,
            method: 'html',
            metadata: { detected: opts?.vertical ? false : true },
            duration: 0,
            success: false,
        };
        this.recordMetric(vertical, 'attempt');
        try {
            // Route by vertical: high-JS verticals go to browser first
            if (this.isHighJSVertical(vertical)) {
                return await this.ingestionWithBrowserFirst(url, vertical, startTime);
            }
            else {
                return await this.ingestionWithHTMLFirst(url, vertical, startTime);
            }
        }
        catch (error) {
            const err = error;
            result.duration = Date.now() - startTime;
            result.success = false;
            result.method = 'dlq';
            result.errorMessage = err.message;
            result.errorCode = 'INGESTION_FATAL';
            // Route to DLQ
            this.routeToDLQ(url, vertical, 'browser', 'INGESTION_FATAL', err.message);
            return result;
        }
    }
    /**
     * High-JS verticals: try browser first, fallback to HTML
     */
    async ingestionWithBrowserFirst(url, vertical, startTime) {
        const result = {
            url,
            vertical,
            method: 'browser',
            metadata: { strategy: 'browser-first' },
            duration: 0,
            success: false,
        };
        try {
            // Attempt 1: CloakBrowser
            const session = await this.browserEngine.open(url, { timeout: 10000 });
            await this.browserEngine.waitForLoad(session);
            result.content = await this.browserEngine.getHTML(session);
            result.screenshot = await this.browserEngine.getScreenshot(session);
            await this.browserEngine.close(session);
            result.success = true;
            this.recordMetric(vertical, 'success');
            result.duration = Date.now() - startTime;
            return result;
        }
        catch (browserError) {
            const err = browserError;
            result.metadata.browserError = err.message;
            // Fallback: try HTML extraction
            try {
                result.method = 'html';
                result.content = await this.fetchHTML(url);
                result.success = true;
                result.metadata.fallback = true;
                this.recordMetric(vertical, 'success');
                result.duration = Date.now() - startTime;
                return result;
            }
            catch (htmlError) {
                // Both failed: route to DLQ
                const htmlErr = htmlError;
                result.success = false;
                result.method = 'dlq';
                result.errorCode = err.code || 'BROWSER_FAILED';
                result.errorMessage = `Browser: ${err.message}; HTML: ${htmlErr.message}`;
                this.routeToDLQ(url, vertical, 'browser', err.code || 'BROWSER_FAILED', err.message);
                result.duration = Date.now() - startTime;
                return result;
            }
        }
    }
    /**
     * Low-JS verticals: try HTML first, fallback to browser
     */
    async ingestionWithHTMLFirst(url, vertical, startTime) {
        const result = {
            url,
            vertical,
            method: 'html',
            metadata: { strategy: 'html-first' },
            duration: 0,
            success: false,
        };
        try {
            // Attempt 1: HTML extraction
            result.content = await this.fetchHTML(url);
            result.success = true;
            this.recordMetric(vertical, 'success');
            result.duration = Date.now() - startTime;
            return result;
        }
        catch (htmlError) {
            const err = htmlError;
            result.metadata.htmlError = err.message;
            // Fallback: try CloakBrowser
            try {
                result.method = 'browser';
                const session = await this.browserEngine.open(url, { timeout: 10000 });
                await this.browserEngine.waitForLoad(session);
                result.content = await this.browserEngine.getHTML(session);
                result.screenshot = await this.browserEngine.getScreenshot(session);
                await this.browserEngine.close(session);
                result.success = true;
                result.metadata.fallback = true;
                this.recordMetric(vertical, 'success');
                result.duration = Date.now() - startTime;
                return result;
            }
            catch (browserError) {
                // Both failed: route to DLQ
                const browserErr = browserError;
                result.success = false;
                result.method = 'dlq';
                result.errorCode = browserErr.code || 'ALL_METHODS_FAILED';
                result.errorMessage = `HTML: ${err.message}; Browser: ${browserErr.message}`;
                this.routeToDLQ(url, vertical, 'html', browserErr.code || 'ALL_METHODS_FAILED', browserErr.message);
                result.duration = Date.now() - startTime;
                return result;
            }
        }
    }
    /**
     * Detect vertical from URL patterns
     */
    detectVertical(url) {
        const lower = url.toLowerCase();
        // Dental
        if (/dent|orthodont|smile|teeth|implant|braces/i.test(lower)) {
            return Vertical.DENTAL;
        }
        // MedSpa
        if (/medspa|med\s*spa|botox|fillers|skin|aesthet/i.test(lower)) {
            return Vertical.MEDSPA;
        }
        // Medical
        if (/medical|clinic|physician|doctor|healthcare|hospital/i.test(lower)) {
            return Vertical.MEDICAL;
        }
        // Agency
        if (/agency|digital|web\s*design|creative|marketing\s*firm/i.test(lower)) {
            return Vertical.AGENCY;
        }
        // Real Estate
        if (/real\s*estate|realtor|broker|property|mls|realty/i.test(lower)) {
            return Vertical.REAL_ESTATE;
        }
        // Restaurant
        if (/restaurant|cafe|cafe|bistro|diner|food|cuisine/i.test(lower)) {
            return Vertical.RESTAURANT;
        }
        // Local Retail
        if (/retail|shop|store|boutique|clothing/i.test(lower)) {
            return Vertical.LOCAL_RETAIL;
        }
        // Trades
        if (/plumber|electrician|hvac|contractor|carpenter|painter|trades/i.test(lower)) {
            return Vertical.TRADES;
        }
        return Vertical.UNKNOWN;
    }
    /**
     * Classify vertical as high-JS or low-JS
     */
    isHighJSVertical(vertical) {
        return [
            Vertical.DENTAL,
            Vertical.MEDSPA,
            Vertical.MEDICAL,
            Vertical.AGENCY,
            Vertical.REAL_ESTATE,
        ].includes(vertical);
    }
    /**
     * Fetch HTML via HTTP (no JavaScript execution)
     */
    async fetchHTML(url) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                signal: controller.signal,
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.text();
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    /**
     * Route failed ingestion to Dead Letter Queue
     */
    routeToDLQ(url, vertical, lastMethod, errorCode, errorMessage) {
        const entry = {
            url,
            vertical,
            lastAttemptedMethod: lastMethod,
            errorCode,
            errorMessage,
            timestamp: Date.now(),
            metadata: {},
        };
        this.dlqEntries.push(entry);
        // Emit to observability
        console.log(`[DLQ] ${vertical} | ${url} | ${errorCode}`);
    }
    /**
     * Track routing metrics
     */
    recordMetric(vertical, type) {
        if (!this.routingMetrics.has(vertical)) {
            this.routingMetrics.set(vertical, { attempts: 0, successes: 0 });
        }
        const metrics = this.routingMetrics.get(vertical);
        if (type === 'attempt') {
            metrics.attempts++;
        }
        else {
            metrics.successes++;
        }
    }
    /**
     * Setup logging integration with CIC event bus
     */
    setupLogging() {
        if (this.browserEngine instanceof CloakBrowserAdapter) {
            this.browserEngine.onLog((log) => {
                // Emit to CIC event bus
                console.log(`[CIC] ${log.event} | ${log.sessionId} | ${log.level}`);
            });
        }
    }
    /**
     * Get DLQ entries (failed ingestions)
     */
    getDLQ() {
        return [...this.dlqEntries];
    }
    /**
     * Get routing metrics for observability
     */
    getMetrics() {
        const metrics = {};
        for (const [vertical, m] of this.routingMetrics.entries()) {
            metrics[vertical] = { ...m };
        }
        return metrics;
    }
    /**
     * Clear DLQ (after processing)
     */
    clearDLQ() {
        this.dlqEntries = [];
    }
    /**
     * Cleanup resources
     */
    async cleanup() {
        if (this.browserEngine instanceof CloakBrowserAdapter) {
            await this.browserEngine.cleanup();
        }
    }
}
//# sourceMappingURL=SweeperFallbackRouter.js.map
