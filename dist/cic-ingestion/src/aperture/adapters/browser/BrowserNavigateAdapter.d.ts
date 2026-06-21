/**
 * Phase 27: Aperture — Browser Navigate Adapter
 * Navigate to URL and wait for page load
 */
import { BaseAdapter } from '../BaseAdapter';
import { SandboxHandle, ExecutionOptions } from '../../types';
export declare class BrowserNavigateAdapter extends BaseAdapter {
    constructor();
    /**
     * Navigate to URL in browser context
     * Uses shared Puppeteer engine for deterministic browser management
     */
    execute(input: any, _sandbox: SandboxHandle, _options?: ExecutionOptions): Promise<any>;
}
export declare function createBrowserNavigateAdapter(): BrowserNavigateAdapter;
//# sourceMappingURL=BrowserNavigateAdapter.d.ts.map