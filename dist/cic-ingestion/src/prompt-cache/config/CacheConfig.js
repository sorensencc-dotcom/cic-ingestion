/**
 * Cache Configuration
 * Centralizes model, registry path, TTL, batch size, and pricing parameters
 */
export const DEFAULT_CACHE_CONFIG = {
    model: 'claude-3-5-sonnet-20241022',
    registryPath: '~/.cic/cache-registry.json',
    ttlHours: 24,
    maxBatchSize: 100,
    pricingTiers: {
        inputCost: 3.0,
        cacheReadCost: 0.3,
        outputCost: 15.0,
    },
};
//# sourceMappingURL=CacheConfig.js.map
