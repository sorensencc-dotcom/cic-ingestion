/**
 * SweeperFallbackRouter — Vertical-aware ingestion routing
 *
 * Routes SMB website ingestion based on vertical + JS complexity:
 * - High-JS verticals (Dental, MedSpa, Agencies) → CloakBrowser first
 * - Low-JS verticals (Restaurants, Trades) → HTML/regex → fallback to Cloak
 * - All browser failures → DLQ
 *
 * Maintains deterministic ingestion under CIC's timeout envelope.
 */
import { IBrowserEngine } from '../browser/IBrowserEngine';
export declare enum Vertical {
    DENTAL = "dental",
    MEDSPA = "medspa",
    MEDICAL = "medical",
    AGENCY = "agency",
    REAL_ESTATE = "real_estate",
    RESTAURANT = "restaurant",
    LOCAL_RETAIL = "local_retail",
    TRADES = "trades",
    UNKNOWN = "unknown"
}
export interface IngestionResult {
    url: string;
    vertical: Vertical;
    method: 'html' | 'browser' | 'dlq';
    content?: string;
    screenshot?: Buffer;
    metadata: Record<string, any>;
    duration: number;
    success: boolean;
    errorCode?: string;
    errorMessage?: string;
}
export interface DLQEntry {
    url: string;
    vertical: Vertical;
    lastAttemptedMethod: 'html' | 'browser';
    errorCode: string;
    errorMessage: string;
    timestamp: number;
    metadata: Record<string, any>;
}
export declare class SweeperFallbackRouter {
    private browserEngine;
    private dlqEntries;
    private routingMetrics;
    constructor(browserEngine?: IBrowserEngine);
    /**
     * Main ingestion entry point
     * Routes based on vertical + JS complexity
     */
    ingest(url: string, opts?: {
        vertical?: Vertical;
    }): Promise<IngestionResult>;
    /**
     * High-JS verticals: try browser first, fallback to HTML
     */
    private ingestionWithBrowserFirst;
    /**
     * Low-JS verticals: try HTML first, fallback to browser
     */
    private ingestionWithHTMLFirst;
    /**
     * Detect vertical from URL patterns
     */
    private detectVertical;
    /**
     * Classify vertical as high-JS or low-JS
     */
    private isHighJSVertical;
    /**
     * Fetch HTML via HTTP (no JavaScript execution)
     */
    private fetchHTML;
    /**
     * Route failed ingestion to Dead Letter Queue
     */
    private routeToDLQ;
    /**
     * Track routing metrics
     */
    private recordMetric;
    /**
     * Setup logging integration with CIC event bus
     */
    private setupLogging;
    /**
     * Get DLQ entries (failed ingestions)
     */
    getDLQ(): DLQEntry[];
    /**
     * Get routing metrics for observability
     */
    getMetrics(): Record<string, {
        attempts: number;
        successes: number;
    }>;
    /**
     * Clear DLQ (after processing)
     */
    clearDLQ(): void;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=SweeperFallbackRouter.d.ts.map