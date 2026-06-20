/**
 * CloakBrowserAdapter — IBrowserEngine implementation for CloakBrowser
 *
 * Wraps CloakBrowser with deterministic logging, error codes, and timeout enforcement.
 * Integrates with CIC event bus for observability.
 */
import { IBrowserEngine, BrowserSession, BrowserOptions, BrowserLog } from './IBrowserEngine';
export declare class CloakBrowserAdapter implements IBrowserEngine {
    private browser;
    private pages;
    private logCallbacks;
    private sessionMetadata;
    private retryPolicy;
    constructor();
    open(url: string, opts?: BrowserOptions): Promise<BrowserSession>;
    waitForLoad(session: BrowserSession): Promise<void>;
    getHTML(session: BrowserSession): Promise<string>;
    getScreenshot(session: BrowserSession): Promise<Buffer>;
    close(session: BrowserSession): Promise<void>;
    onLog(callback: (log: BrowserLog) => void): void;
    private emit;
    private createBrowserError;
    private initializeBrowser;
    cleanup(): Promise<void>;
}
//# sourceMappingURL=CloakBrowserAdapter.d.ts.map