/**
 * Phase 27: Aperture — Browser Screenshot Adapter
 * Capture screenshot of web page
 */

import { BaseAdapter } from '../BaseAdapter';
import { SandboxHandle, ExecutionOptions } from '../../types';
import { JSONSchema7 } from 'json-schema';
import { ValidationUtils } from '../ValidationUtils';

export class BrowserScreenshotAdapter extends BaseAdapter {
  constructor() {
    const inputSchema: JSONSchema7 = {
      type: 'object',
      properties: {
        url: { type: 'string' },
        width: { type: 'number' },
        height: { type: 'number' },
        timeout: { type: 'number' }
      },
      required: ['url']
    };

    const outputSchema: JSONSchema7 = {
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
   * Note: Requires puppeteer/playwright (stub for Phase 27)
   */
  async execute(
    input: any,
    sandbox: SandboxHandle,
    options?: ExecutionOptions
  ): Promise<any> {
    const { url, width = 1920, height = 1080, timeout = 30000 } = input;

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

    try {
      // TODO: Integrate with Puppeteer/Playwright for actual screenshot capture
      // For Phase 27 skeleton, return stub response
      const timestamp = new Date().toISOString();
      const screenshotPath = `screenshot-${Date.now()}.png`;

      return {
        success: true,
        url,
        path: screenshotPath,
        size: 0, // Stub
        timestamp
      };
    } catch (err: any) {
      throw new Error(`Failed to capture screenshot: ${err.message}`);
    }
  }
}

export function createBrowserScreenshotAdapter(): BrowserScreenshotAdapter {
  return new BrowserScreenshotAdapter();
}
