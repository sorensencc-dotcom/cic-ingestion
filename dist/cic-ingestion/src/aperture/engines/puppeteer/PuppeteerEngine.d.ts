/**
 * Phase 27.1: Puppeteer Engine
 * Shared browser management for BrowserNavigate + BrowserScreenshot adapters
 */
import { Browser, Page } from 'puppeteer';
export declare class PuppeteerEngine {
    private static browser;
    private static pageCount;
    private static lastMemoryCheck;
    /**
     * Get or create shared browser instance
     */
    static getBrowser(): Promise<Browser>;
    /**
     * Create new page with CIC viewport
     */
    static newPage(): Promise<Page>;
    /**
     * Close page safely
     */
    static closePage(page: Page): Promise<void>;
    /**
     * Check memory and restart browser if needed
     */
    private static checkAndRestart;
    /**
     * Graceful shutdown
     */
    static shutdown(): Promise<void>;
    /**
     * Get current browser stats
     */
    static getStats(): {
        browser: boolean;
        pageCount: number;
    };
}
//# sourceMappingURL=PuppeteerEngine.d.ts.map