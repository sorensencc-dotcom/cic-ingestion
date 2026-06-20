/**
 * Phase 27: Aperture — Browser Navigate Adapter
 * Navigate to URL and wait for page load
 */
import { BaseAdapter } from '../BaseAdapter';
import { ValidationUtils } from '../ValidationUtils';
import { PuppeteerEngine } from '../../engines/puppeteer/PuppeteerEngine';
export class BrowserNavigateAdapter extends BaseAdapter {
    constructor() {
        const inputSchema = {
            type: 'object',
            properties: {
                url: { type: 'string' },
                waitFor: {
                    type: 'string',
                    enum: ['load', 'domcontentloaded', 'networkidle']
                },
                timeout: { type: 'number' }
            },
            required: ['url']
        };
        const outputSchema = {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                url: { type: 'string' },
                title: { type: 'string' },
                loadTime: { type: 'number' },
                timestamp: { type: 'string' }
            }
        };
        super('browser.navigate', 'Browser Navigate', '1.0.0', inputSchema, outputSchema);
    }
    /**
     * Navigate to URL in browser context
     * Uses shared Puppeteer engine for deterministic browser management
     */
    async execute(input, sandbox, options) {
        const { url, waitFor = 'load', timeout = 30000 } = input;
        if (!url || typeof url !== 'string') {
            throw new Error('Invalid input: url must be a string');
        }
        // Validate URL against allowed domains
        const urlValidation = ValidationUtils.validateUrl(url);
        if (!urlValidation.valid) {
            throw new Error(urlValidation.error);
        }
        // Validate waitFor option
        const validWaitOptions = ['load', 'domcontentloaded', 'networkidle'];
        if (!validWaitOptions.includes(waitFor)) {
            throw new Error(`waitFor must be one of: ${validWaitOptions.join(', ')}`);
        }
        const page = await PuppeteerEngine.newPage();
        const startTime = Date.now();
        try {
            // Map waitFor to Puppeteer option
            const waitUntilMap = {
                'load': 'load',
                'domcontentloaded': 'domcontentloaded',
                'networkidle': 'networkidle2'
            };
            const response = await page.goto(url, {
                waitUntil: waitUntilMap[waitFor],
                timeout: Math.min(timeout, 15000)
            });
            const title = await page.title();
            const finalUrl = page.url();
            const loadTime = Date.now() - startTime;
            const timestamp = new Date().toISOString();
            return {
                success: true,
                url,
                finalUrl,
                status: response?.status() ?? null,
                title,
                loadTime,
                timestamp
            };
        }
        catch (err) {
            const timestamp = new Date().toISOString();
            const loadTime = Date.now() - startTime;
            return {
                success: false,
                url,
                error: err.message,
                loadTime,
                timestamp
            };
        }
        finally {
            await PuppeteerEngine.closePage(page);
        }
    }
}
export function createBrowserNavigateAdapter() {
    return new BrowserNavigateAdapter();
}
//# sourceMappingURL=BrowserNavigateAdapter.js.map