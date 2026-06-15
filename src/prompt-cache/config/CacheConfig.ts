/**
 * Cache Configuration
 * Centralizes model, registry path, TTL, batch size, and pricing parameters
 */

export interface PricingTiers {
  inputCost: number;       // $ per 1M input tokens
  cacheReadCost: number;   // $ per 1M cache read tokens
  outputCost: number;      // $ per 1M output tokens
}

export interface CacheConfig {
  model: string;
  registryPath: string;
  ttlHours: number;
  maxBatchSize: number;
  pricingTiers: PricingTiers;
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
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
