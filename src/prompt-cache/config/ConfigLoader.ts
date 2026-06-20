/**
 * Configuration Loader
 * Loads CacheConfig from environment variables with fallback to defaults
 */

import { CacheConfig, DEFAULT_CACHE_CONFIG } from './CacheConfig.js';

export function loadCacheConfig(): CacheConfig {
  const ttlHours = process.env.CIC_CACHE_TTL_HOURS
    ? parseInt(process.env.CIC_CACHE_TTL_HOURS, 10)
    : DEFAULT_CACHE_CONFIG.ttlHours;

  const maxBatchSize = process.env.CIC_CACHE_MAX_BATCH_SIZE
    ? parseInt(process.env.CIC_CACHE_MAX_BATCH_SIZE, 10)
    : DEFAULT_CACHE_CONFIG.maxBatchSize;

  const inputCost = process.env.CIC_CACHE_INPUT_COST
    ? parseFloat(process.env.CIC_CACHE_INPUT_COST)
    : DEFAULT_CACHE_CONFIG.pricingTiers.inputCost;

  const cacheReadCost = process.env.CIC_CACHE_READ_COST
    ? parseFloat(process.env.CIC_CACHE_READ_COST)
    : DEFAULT_CACHE_CONFIG.pricingTiers.cacheReadCost;

  const outputCost = process.env.CIC_CACHE_OUTPUT_COST
    ? parseFloat(process.env.CIC_CACHE_OUTPUT_COST)
    : DEFAULT_CACHE_CONFIG.pricingTiers.outputCost;

  // Validate numeric fields
  if (isNaN(ttlHours) || ttlHours <= 0) {
    throw new Error(`Invalid CIC_CACHE_TTL_HOURS: ${process.env.CIC_CACHE_TTL_HOURS}`);
  }

  if (isNaN(maxBatchSize) || maxBatchSize <= 0) {
    throw new Error(`Invalid CIC_CACHE_MAX_BATCH_SIZE: ${process.env.CIC_CACHE_MAX_BATCH_SIZE}`);
  }

  return {
    model: process.env.CIC_CACHE_MODEL || DEFAULT_CACHE_CONFIG.model,
    registryPath: process.env.CIC_CACHE_REGISTRY_PATH || DEFAULT_CACHE_CONFIG.registryPath,
    ttlHours,
    maxBatchSize,
    pricingTiers: {
      inputCost,
      cacheReadCost,
      outputCost,
    },
  };
}


