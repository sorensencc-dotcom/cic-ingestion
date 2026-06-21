/**
 * Phase 27: Aperture — Browser Navigate Adapter
 * Navigate to URL and wait for page load
 */
import { BaseAdapter } from '../BaseAdapter.js';
import { ValidationUtils } from '../ValidationUtils.js';
import { PuppeteerEngine } from '../../engines/puppeteer/PuppeteerEngine.js';
import { NavigateResultSchema } from '../../../validation/schemas.js';
import { validateFinalUrl } from '../../../validation/guards.js';
import { makeError, makeSuccess } from '../../../validation/envelope.js';
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
    async execute(input, _sandbox, _options) {
        const start = Date.now();
        const { url, waitFor = 'load', timeout = 30000 } = input;
        if (!url || typeof url !== 'string') {
            return makeError('INVALID_INPUT', { url }, 'BrowserNavigateAdapter', start);
        }
        // Validate URL against allowed domains
        const urlValidation = ValidationUtils.validateUrl(url);
        if (!urlValidation.valid) {
            return makeError('INVALID_URL', { url, error: urlValidation.error }, 'BrowserNavigateAdapter', start);
        }
        // Validate waitFor option
        const validWaitOptions = ['load', 'domcontentloaded', 'networkidle'];
        if (!validWaitOptions.includes(waitFor)) {
            return makeError('INVALID_WAIT_OPTION', { waitFor }, 'BrowserNavigateAdapter', start);
        }
        const page = await PuppeteerEngine.newPage();
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
            const finalUrl = page.url();
            const raw = {
                url: finalUrl,
                status: response?.status() ?? null,
                redirected: finalUrl !== url
            };
            const parsed = NavigateResultSchema.safeParse(raw);
            if (!parsed.success) {
                return makeError('INVALID_NAVIGATION_RESULT', parsed.error, 'BrowserNavigateAdapter', start);
            }
            const data = parsed.data;
            if (!validateFinalUrl(data.url)) {
                return makeError('INVALID_FINAL_URL', { url: data.url }, 'BrowserNavigateAdapter', start);
            }
            return makeSuccess(data, 'BrowserNavigateAdapter', start);
        }
        catch (err) {
            return makeError('NAVIGATION_FAILED', { error: err.message }, 'BrowserNavigateAdapter', start);
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
