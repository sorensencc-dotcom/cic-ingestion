/**
 * Phase 27: Aperture — Browser Screenshot Adapter
 * Capture screenshot of web page
 */
import { BaseAdapter } from '../BaseAdapter';
import { SandboxHandle, ExecutionOptions } from '../../types';
export declare class BrowserScreenshotAdapter extends BaseAdapter {
    constructor();
    /**
     * Capture screenshot of web page
     * Uses shared Puppeteer engine for deterministic browser management
     */
    execute(input: any, sandbox: SandboxHandle, options?: ExecutionOptions): Promise<any>;
}
export declare function createBrowserScreenshotAdapter(): BrowserScreenshotAdapter;
//# sourceMappingURL=BrowserScreenshotAdapter.d.ts.map