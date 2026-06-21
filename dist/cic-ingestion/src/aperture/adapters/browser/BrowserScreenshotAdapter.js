/**
 * Phase 27: Aperture — Browser Screenshot Adapter
 * Capture screenshot of web page
 */
import { BaseAdapter } from '../BaseAdapter.js';
import { ValidationUtils } from '../ValidationUtils.js';
import { PuppeteerEngine } from '../../engines/puppeteer/PuppeteerEngine.js';
import { ScreenshotResultSchema } from '../../../validation/schemas.js';
import { validatePng, validateScreenshotSize } from '../../../validation/guards.js';
import { makeError, makeSuccess } from '../../../validation/envelope.js';
export class BrowserScreenshotAdapter extends BaseAdapter {
    constructor() {
        const inputSchema = {
            type: 'object',
            properties: {
                url: { type: 'string' },
                width: { type: 'number' },
                height: { type: 'number' },
                timeout: { type: 'number' }
            },
            required: ['url']
        };
        const outputSchema = {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                url: { type: 'string' },
                path: { type: 'string' },
                size: { type: 'number' },
                timestamp: { type: 'string' }
            }
        };
        super('browser.screenshot', 'Browser Screenshot', '1.0.0', inputSchema, outputSchema);
    }
    /**
     * Capture screenshot of web page
     * Uses shared Puppeteer engine for deterministic browser management
     */
    async execute(input, _sandbox, _options) {
        const start = Date.now();
        const { url, width = 1280, height = 1024, timeout = 30000 } = input;
        if (!url || typeof url !== 'string') {
            return makeError('INVALID_INPUT', { url }, 'BrowserScreenshotAdapter', start);
        }
        // Validate URL against allowed domains
        const urlValidation = ValidationUtils.validateUrl(url);
        if (!urlValidation.valid) {
            return makeError('INVALID_URL', { url, error: urlValidation.error }, 'BrowserScreenshotAdapter', start);
        }
        // Validate dimensions
        if (width < 100 || width > 4096) {
            return makeError('INVALID_DIMENSIONS', { width, height }, 'BrowserScreenshotAdapter', start);
        }
        if (height < 100 || height > 4096) {
            return makeError('INVALID_DIMENSIONS', { width, height }, 'BrowserScreenshotAdapter', start);
        }
        const page = await PuppeteerEngine.newPage();
        try {
            // Navigate to URL
            await page.setViewport({ width, height });
            await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: Math.min(timeout, 15000)
            });
            // Capture screenshot
            const buffer = await page.screenshot({
                type: 'png',
                fullPage: true
            });
            const base64 = buffer.toString('base64');
            const raw = {
                base64,
                width,
                height
            };
            const parsed = ScreenshotResultSchema.safeParse(raw);
            if (!parsed.success) {
                return makeError('INVALID_SCREENSHOT_RESULT', parsed.error, 'BrowserScreenshotAdapter', start);
            }
            const data = parsed.data;
            if (!validatePng(data.base64)) {
                return makeError('INVALID_IMAGE_FORMAT', {}, 'BrowserScreenshotAdapter', start);
            }
            if (!validateScreenshotSize(data.base64)) {
                return makeError('SCREENSHOT_TOO_LARGE', {}, 'BrowserScreenshotAdapter', start);
            }
            return makeSuccess(data, 'BrowserScreenshotAdapter', start);
        }
        catch (err) {
            return makeError('SCREENSHOT_FAILED', { error: err.message }, 'BrowserScreenshotAdapter', start);
        }
        finally {
            await PuppeteerEngine.closePage(page);
        }
    }
}
export function createBrowserScreenshotAdapter() {
    return new BrowserScreenshotAdapter();
}
//# sourceMappingURL=BrowserScreenshotAdapter.js.map
