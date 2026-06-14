import request from 'supertest';
import { Router } from 'express';
import { createCacheRouter } from '../cache';
import { AutonomyPromptCacheAdapter } from '../../AutonomyPromptCacheAdapter';

describe('Cache Routes', () => {
  let adapter: AutonomyPromptCacheAdapter;
  let router: Router;

  beforeEach(() => {
    // Use in-memory registry for testing
    adapter = new AutonomyPromptCacheAdapter(':memory:');
    router = createCacheRouter(adapter);
  });

  describe('GET /cache/metrics', () => {
    it('should return cache statistics as JSON', async () => {
      const app = require('express')();
      app.use('/autonomy', router);

      const res = await request(app).get('/autonomy/cache/metrics');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body.data).toHaveProperty('eligible_docs');
      expect(res.body.data).toHaveProperty('total_cache_hits');
      expect(res.body.data).toHaveProperty('total_cache_misses');
    });
  });

  describe('GET /cache/metrics/prometheus', () => {
    it('should return metrics in Prometheus format', async () => {
      const app = require('express')();
      app.use('/autonomy', router);

      const res = await request(app).get('/autonomy/cache/metrics/prometheus');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.text).toContain('# HELP');
      expect(res.text).toContain('# TYPE');
      expect(res.text).toContain('prompt_cache_documents_total');
      expect(res.text).toContain('prompt_cache_hits_total');
      expect(res.text).toContain('prompt_cache_misses_total');
      expect(res.text).toContain('prompt_cache_hit_ratio');
      expect(res.text).toContain('prompt_cache_tokens_saved_total');
    });

    it('should format Prometheus metrics correctly', async () => {
      const app = require('express')();
      app.use('/autonomy', router);

      const res = await request(app).get('/autonomy/cache/metrics/prometheus');

      // Verify format: HELP, TYPE, then metric line
      const lines = res.text.split('\n').filter((l: string) => l.trim());
      expect(lines.some((l: string) => l.startsWith('# HELP'))).toBe(true);
      expect(lines.some((l: string) => l.startsWith('# TYPE'))).toBe(true);
      // At least one metric line (non-comment, non-empty)
      expect(
        lines.some((l: string) => !l.startsWith('#') && l.includes(' '))
      ).toBe(true);
    });

    it('should return zero metrics on empty cache', async () => {
      const app = require('express')();
      app.use('/autonomy', router);

      const res = await request(app).get('/autonomy/cache/metrics/prometheus');

      expect(res.status).toBe(200);
      expect(res.text).toContain('prompt_cache_documents_total 0');
      expect(res.text).toContain('prompt_cache_hits_total 0');
      expect(res.text).toContain('prompt_cache_misses_total 0');
    });

    it('should have correct Content-Type header', async () => {
      const app = require('express')();
      app.use('/autonomy', router);

      const res = await request(app).get('/autonomy/cache/metrics/prometheus');

      expect(res.headers['content-type']).toMatch(/text\/plain/);
    });
  });

  describe('GET /cache/status', () => {
    it('should return human-readable cache status', async () => {
      const app = require('express')();
      app.use('/autonomy', router);

      const res = await request(app).get('/autonomy/cache/status');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('eligible_documents');
      expect(res.body.data).toHaveProperty('cache_hit_rate');
      expect(res.body.data).toHaveProperty('total_cache_hits');
      expect(res.body.data).toHaveProperty('total_cache_misses');
      expect(res.body.data).toHaveProperty('tokens_saved');
      expect(res.body.data).toHaveProperty('estimated_weekly_savings');
    });

    it('should format hit rate as percentage string', async () => {
      const app = require('express')();
      app.use('/autonomy', router);

      const res = await request(app).get('/autonomy/cache/status');

      const hitRate = res.body.data.cache_hit_rate;
      expect(typeof hitRate).toBe('string');
      expect(hitRate).toMatch(/%$/);
    });
  });

  describe('Prometheus endpoint integration', () => {
    it('should expose both JSON and Prometheus formats', async () => {
      const app = require('express')();
      app.use('/autonomy', router);

      const jsonRes = await request(app).get('/autonomy/cache/metrics');
      const prometheusRes = await request(app).get(
        '/autonomy/cache/metrics/prometheus'
      );

      // Both endpoints should return data
      expect(jsonRes.status).toBe(200);
      expect(prometheusRes.status).toBe(200);

      // JSON should have numeric values
      expect(typeof jsonRes.body.data.total_cache_hits).toBe('number');

      // Prometheus should have text format
      expect(typeof prometheusRes.text).toBe('string');
      expect(prometheusRes.text).toContain('# HELP');
    });

    it('should reflect same data in both formats', async () => {
      const app = require('express')();
      app.use('/autonomy', router);

      const jsonRes = await request(app).get('/autonomy/cache/metrics');
      const prometheusRes = await request(app).get(
        '/autonomy/cache/metrics/prometheus'
      );

      const hits = jsonRes.body.data.total_cache_hits;
      const misses = jsonRes.body.data.total_cache_misses;

      // Prometheus text should contain the same values
      expect(prometheusRes.text).toContain(`prompt_cache_hits_total ${hits}`);
      expect(prometheusRes.text).toContain(
        `prompt_cache_misses_total ${misses}`
      );
    });
  });
});
