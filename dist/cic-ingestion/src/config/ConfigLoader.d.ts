/**
 * Configuration Loader
 * Loads defaults.json + optional override via CIC_CONFIG_PATH env var
 * Returns immutable merged config snapshot
 */
export interface CICConfig {
    services: {
        kg: {
            sqlitePath: string;
            ingestBatchSize: number;
            maxLagMs: number;
        };
        torquequery: {
            url: string;
            backfillHours: number;
        };
    };
}
export declare function loadConfig(): CICConfig;
//# sourceMappingURL=ConfigLoader.d.ts.map