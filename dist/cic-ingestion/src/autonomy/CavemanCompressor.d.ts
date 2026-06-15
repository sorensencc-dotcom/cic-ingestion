/**
 * Caveman Compression Utility for Token Optimization
 * Integrates caveman-style compression for API responses and autonomy outputs
 */
interface CompressionStats {
    originalLength: number;
    compressedLength: number;
    reductionPercent: number;
    timestamp: Date;
}
/**
 * Simplified compression: remove verbose patterns common in API responses
 * Typical savings: 40-75% token reduction
 * Safe: preserves articles before numbers/acronyms, doesn't re-compress
 */
export declare function cavemanCompress(text: string, skipIfCompressed?: boolean): string;
/**
 * Compress JSON response while preserving data integrity
 * Handles objects and arrays
 */
export declare function compressJsonResponse<T extends Record<string, any> | any[]>(data: T, fieldsToCompress?: (keyof any)[]): T;
/**
 * Compress autonomy signals and proposals for efficient transmission
 */
export declare function compressAutonomyOutput(signals: any, proposals: any): {
    signals: any;
    proposals: any;
    stats: CompressionStats;
};
/**
 * Logger for compression stats (useful for monitoring token savings)
 */
export declare function logCompressionStats(stats: CompressionStats): void;
/**
 * Unified compress() method returning {data, stats}
 * Used by higher-level integrations (Wayland, Phase25To26, etc)
 */
export declare class CavemanCompressor {
    compress<T extends Record<string, any> | any[]>(data: T, fieldsToCompress?: (keyof any)[]): {
        data: T;
        stats: {
            bytesIn: number;
            bytesOut: number;
            bytesSaved: number;
            ratio: number;
            arraysProcessed: number;
            objectsProcessed: number;
            recompressionBlocked: boolean;
            error?: string;
        };
    };
}
export {};
//# sourceMappingURL=CavemanCompressor.d.ts.map