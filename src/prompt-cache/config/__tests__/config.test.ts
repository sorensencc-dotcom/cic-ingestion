/**
 * Cache Config Tests
 * Unit tests for CacheConfig and ConfigLoader
 */

import { loadCacheConfig, DEFAULT_CACHE_CONFIG } from '../index';

describe('CacheConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Clear env vars before each test
    delete process.env.CIC_CACHE_MODEL;
    delete process.env.CIC_CACHE_REGISTRY_PATH;
    delete process.env.CIC_CACHE_TTL_HOURS;
    delete process.env.CIC_CACHE_MAX_BATCH_SIZE;
    delete process.env.CIC_CACHE_INPUT_COST;
    delete process.env.CIC_CACHE_READ_COST;
    delete process.env.CIC_CACHE_OUTPUT_COST;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('default config loads without env vars', () => {
    const config = loadCacheConfig();
    expect(config.model).toBe(DEFAULT_CACHE_CONFIG.model);
    expect(config.registryPath).toBe(DEFAULT_CACHE_CONFIG.registryPath);
    expect(config.ttlHours).toBe(DEFAULT_CACHE_CONFIG.ttlHours);
    expect(config.maxBatchSize).toBe(DEFAULT_CACHE_CONFIG.maxBatchSize);
    expect(config.pricingTiers).toEqual(DEFAULT_CACHE_CONFIG.pricingTiers);
  });

  test('env var overrides model', () => {
    process.env.CIC_CACHE_MODEL = 'claude-opus-4';
    const config = loadCacheConfig();
    expect(config.model).toBe('claude-opus-4');
  });

  test('env var overrides registry path', () => {
    process.env.CIC_CACHE_REGISTRY_PATH = '/custom/path/registry.json';
    const config = loadCacheConfig();
    expect(config.registryPath).toBe('/custom/path/registry.json');
  });

  test('env var overrides TTL hours', () => {
    process.env.CIC_CACHE_TTL_HOURS = '48';
    const config = loadCacheConfig();
    expect(config.ttlHours).toBe(48);
  });

  test('env var overrides batch size', () => {
    process.env.CIC_CACHE_MAX_BATCH_SIZE = '50';
    const config = loadCacheConfig();
    expect(config.maxBatchSize).toBe(50);
  });

  test('env vars override pricing tiers', () => {
    process.env.CIC_CACHE_INPUT_COST = '2.5';
    process.env.CIC_CACHE_READ_COST = '0.25';
    process.env.CIC_CACHE_OUTPUT_COST = '10.0';
    const config = loadCacheConfig();
    expect(config.pricingTiers.inputCost).toBe(2.5);
    expect(config.pricingTiers.cacheReadCost).toBe(0.25);
    expect(config.pricingTiers.outputCost).toBe(10.0);
  });

  test('invalid TTL throws error', () => {
    process.env.CIC_CACHE_TTL_HOURS = 'invalid';
    expect(() => loadCacheConfig()).toThrow('Invalid CIC_CACHE_TTL_HOURS');
  });

  test('partial env merge with defaults', () => {
    process.env.CIC_CACHE_MODEL = 'claude-haiku-3';
    process.env.CIC_CACHE_TTL_HOURS = '12';
    const config = loadCacheConfig();
    expect(config.model).toBe('claude-haiku-3');
    expect(config.ttlHours).toBe(12);
    expect(config.maxBatchSize).toBe(DEFAULT_CACHE_CONFIG.maxBatchSize);
    expect(config.registryPath).toBe(DEFAULT_CACHE_CONFIG.registryPath);
  });
});
