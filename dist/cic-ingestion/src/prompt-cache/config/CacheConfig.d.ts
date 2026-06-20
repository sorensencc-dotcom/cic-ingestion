/**
 * Cache Configuration
 * Centralizes model, registry path, TTL, batch size, and pricing parameters
 */
export interface PricingTiers {
    inputCost: number;
    cacheReadCost: number;
    outputCost: number;
}
export interface CacheConfig {
    model: string;
    registryPath: string;
    ttlHours: number;
    maxBatchSize: number;
    pricingTiers: PricingTiers;
}
export declare const DEFAULT_CACHE_CONFIG: CacheConfig;
//# sourceMappingURL=CacheConfig.d.ts.map