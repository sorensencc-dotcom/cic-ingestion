/**
 * Phase 27: Aperture — Browser Screenshot Adapter
 * Capture screenshot of web page
 */
import { BaseAdapter } from '../BaseAdapter';
import { ValidationUtils } from '../ValidationUtils';
import { PuppeteerEngine } from '../../engines/puppeteer/PuppeteerEngine';
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
    async execute(input, sandbox, options) {
        const { url, width = 1280, height = 1024, timeout = 30000 } = input;
        if (!url || typeof url !== 'string') {
            throw new Error('Invalid input: url must be a string');
        }
        // Validate URL against allowed domains
        const urlValidation = ValidationUtils.validateUrl(url);
        if (!urlValidation.valid) {
            throw new Error(urlValidation.error);
        }
        // Validate dimensions
        if (width < 100 || width > 4096) {
            throw new Error('Width must be between 100 and 4096');
        }
        if (height < 100 || height > 4096) {
            throw new Error('Height must be between 100 and 4096');
        }
        const page = await PuppeteerEngine.newPage();
        const startTime = Date.now();
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
            // Validate screenshot size
            const sizeValidation = ValidationUtils.validateBodySize(buffer.toString('base64'), 5 * 1024 * 1024);
            if (!sizeValidation.valid) {
                return {
                    success: false,
                    url,
                    error: sizeValidation.error,
                    timestamp: new Date().toISOString()
                };
            }
            const timestamp = new Date().toISOString();
            const loadTime = Date.now() - startTime;
            return {
                success: true,
                url,
                screenshotBase64: buffer.toString('base64'),
                size: buffer.length,
                width,
                height,
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
export function createBrowserScreenshotAdapter() {
    return new BrowserScreenshotAdapter();
}
//# sourceMappingURL=BrowserScreenshotAdapter.js.map