/**
 * CavemanStats Schema v1.0
 * Standard compression telemetry across CIC architecture
 */
export interface CavemanStatsV1 {
    schema_version: '1.0';
    bytes_in: number;
    bytes_out: number;
    bytes_saved: number;
    ratio: number;
    arrays_processed: number;
    objects_processed: number;
    recompression_blocked: boolean;
    compression_error?: string;
    pipeline_stage: string;
    tool_id?: string;
    phase_id?: number;
    agent_id?: string;
    timestamp: number;
    hash?: string;
}
export declare function createCavemanStats(bytesIn: number, bytesOut: number, context?: {
    arrays_processed?: number;
    objects_processed?: number;
    recompression_blocked?: boolean;
    pipeline_stage?: string;
    tool_id?: string;
    phase_id?: number;
    agent_id?: string;
    hash?: string;
    compression_error?: string;
}): CavemanStatsV1;
export declare function logCavemanStats(label: string, stats: CavemanStatsV1): void;
export declare function validateCavemanStats(stats: CavemanStatsV1): boolean;
//# sourceMappingURL=CavemanStats.d.ts.map