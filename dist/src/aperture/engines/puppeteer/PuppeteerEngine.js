/**
 * Phase 27.1: Puppeteer Engine
 * Shared browser management for BrowserNavigate + BrowserScreenshot adapters
 */
import puppeteer from 'puppeteer';
export class PuppeteerEngine {
    static browser = null;
    static pageCount = 0;
    static lastMemoryCheck = Date.now();
    /**
     * Get or create shared browser instance
     */
    static async getBrowser() {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
        }
        // Check memory periodically
        const now = Date.now();
        if (now - this.lastMemoryCheck > 30000) {
            this.lastMemoryCheck = now;
            await this.checkAndRestart();
        }
        return this.browser;
    }
    /**
     * Create new page with CIC viewport
     */
    static async newPage() {
        const browser = await this.getBrowser();
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 1024 });
        this.pageCount++;
        return page;
    }
    /**
     * Close page safely
     */
    static async closePage(page) {
        try {
            await page.close();
            this.pageCount = Math.max(0, this.pageCount - 1);
        }
        catch (_) {
            // Ignore errors on close
        }
    }
    /**
     * Check memory and restart browser if needed
     */
    static async checkAndRestart() {
        if (!this.browser)
            return;
        try {
            const pages = await this.browser.pages();
            const version = await this.browser.version();
            // Restart if too many pages or memory exceeded (heuristic)
            if (pages.length > 50 || this.pageCount > 50) {
                await this.shutdown();
            }
        }
        catch (_) {
            // If browser is broken, restart
            await this.shutdown();
        }
    }
    /**
     * Graceful shutdown
     */
    static async shutdown() {
        if (this.browser) {
            try {
                await this.browser.close();
            }
            catch (_) { }
            this.browser = null;
            this.pageCount = 0;
        }
    }
    /**
     * Get current browser stats
     */
    static getStats() {
        return {
            browser: this.browser !== null,
            pageCount: this.pageCount
        };
    }
}
//# sourceMappingURL=PuppeteerEngine.js.map