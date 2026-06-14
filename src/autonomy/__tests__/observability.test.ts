/**
 * Observability Manager Tests (Phase 4)
 * Logger injection, metrics collection, Prometheus export
 */

import { Request, Response } from 'express';
import { ObservabilityManager } from '../ObservabilityManager';

describe('ObservabilityManager', () => {
  let observability: ObservabilityManager;

  beforeEach(() => {
    observability = ObservabilityManager.getInstance();
    observability.resetMetrics();
  });

  describe('Logger Interface', () => {
    it('provides injected logger', () => {
      const logger = observability.getLogger();
      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.debug).toBeDefined();
    });

    it('logs info messages', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const logger = observability.getLogger();

      logger.info('test', 'Info message', { data: 'test' });
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('logs error messages with stack trace', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const logger = observability.getLogger();
      const error = new Error('Test error');

      logger.error('test', 'Error occurred', error);
      expect(consoleSpy).toHaveBeenCalled();

      const call = consoleSpy.mock.calls[0][0];
      expect(call).toContain('"level":"error"');

      consoleSpy.mockRestore();
    });
  });

  describe('Request Metrics Collection', () => {
    it('records HTTP request metrics', () => {
      const mockReq = { method: 'GET', path: '/autonomy/signals' } as Request;
      const mockRes = { statusCode: 200 } as Response;

      observability.recordRequest(mockReq, mockRes, 150);
      const snapshot = observability.getMetricsJSON();

      expect(snapshot.requests_total).toBe(1);
      expect(snapshot.requests_by_status['200']).toBe(1);
    });

    it('tracks multiple requests with different statuses', () => {
      observability.recordRequest({ method: 'GET', path: '/autonomy/signals' } as Request, { statusCode: 200 } as Response, 100);
      observability.recordRequest({ method: 'POST', path: '/autonomy/proposals' } as Request, { statusCode: 201 } as Response, 200);
      observability.recordRequest({ method: 'GET', path: '/autonomy/signals' } as Request, { statusCode: 404 } as Response, 50);

      const snapshot = observability.getMetricsJSON();

      expect(snapshot.requests_total).toBe(3);
      expect(snapshot.requests_by_status['200']).toBe(1);
      expect(snapshot.requests_by_status['201']).toBe(1);
      expect(snapshot.requests_by_status['404']).toBe(1);
    });

    it('tracks endpoint request counts', () => {
      observability.recordRequest({ method: 'GET', path: '/autonomy/signals' } as Request, { statusCode: 200 } as Response, 100);
      observability.recordRequest({ method: 'GET', path: '/autonomy/signals' } as Request, { statusCode: 200 } as Response, 150);
      observability.recordRequest({ method: 'POST', path: '/autonomy/proposals' } as Request, { statusCode: 201 } as Response, 200);

      const snapshot = observability.getMetricsJSON();

      expect(snapshot.requests_by_endpoint['GET /autonomy/signals']).toBe(2);
      expect(snapshot.requests_by_endpoint['POST /autonomy/proposals']).toBe(1);
    });

    it('calculates latency percentiles', () => {
      // Add requests with increasing latencies
      for (let i = 1; i <= 100; i++) {
        observability.recordRequest({ method: 'GET', path: '/autonomy/signals' } as Request, { statusCode: 200 } as Response, i * 10);
      }

      const snapshot = observability.getMetricsJSON();

      expect(snapshot.latency_p50).toBeGreaterThan(0);
      expect(snapshot.latency_p95).toBeGreaterThan(snapshot.latency_p50);
      expect(snapshot.latency_p99).toBeGreaterThan(snapshot.latency_p95);
    });
  });

  describe('Caveman Compression Stats', () => {
    it('records compression statistics', () => {
      observability.recordCavemanStats({
        bytesIn: 1000,
        bytesOut: 600,
        ratio: 0.6,
      });

      const snapshot = observability.getMetricsJSON();

      expect(snapshot.caveman_stats_total.bytes_in).toBe(1000);
      expect(snapshot.caveman_stats_total.bytes_out).toBe(600);
      expect(snapshot.caveman_stats_total.bytes_saved).toBe(400);
    });

    it('accumulates compression stats across multiple calls', () => {
      observability.recordCavemanStats({ bytesIn: 1000, bytesOut: 600 });
      observability.recordCavemanStats({ bytesIn: 500, bytesOut: 300 });
      observability.recordCavemanStats({ bytesIn: 2000, bytesOut: 1000 });

      const snapshot = observability.getMetricsJSON();

      expect(snapshot.caveman_stats_total.bytes_in).toBe(3500);
      expect(snapshot.caveman_stats_total.bytes_out).toBe(1900);
      expect(snapshot.caveman_stats_total.bytes_saved).toBe(1600);
    });

    it('calculates compression ratio percentage', () => {
      observability.recordCavemanStats({ bytesIn: 1000, bytesOut: 600 });

      const snapshot = observability.getMetricsJSON();

      // (1000 - 600) / 1000 = 40%
      expect(snapshot.caveman_compression_ratio).toBe(40);
    });

    it('handles zero bytes gracefully', () => {
      observability.recordCavemanStats({ bytesIn: 0, bytesOut: 0 });

      const snapshot = observability.getMetricsJSON();

      expect(snapshot.caveman_compression_ratio).toBe(0);
    });
  });

  describe('Active Signal and Proposal Tracking', () => {
    it('updates active signal count', () => {
      observability.setActiveSignals(42);
      const snapshot = observability.getMetricsJSON();

      expect(snapshot.active_signals).toBe(42);
    });

    it('updates active proposal count', () => {
      observability.setActiveProposals(15);
      const snapshot = observability.getMetricsJSON();

      expect(snapshot.active_proposals).toBe(15);
    });

    it('tracks both signals and proposals independently', () => {
      observability.setActiveSignals(50);
      observability.setActiveProposals(25);

      const snapshot = observability.getMetricsJSON();

      expect(snapshot.active_signals).toBe(50);
      expect(snapshot.active_proposals).toBe(25);
    });
  });

  describe('Metrics Snapshot', () => {
    it('returns complete metrics snapshot', () => {
      observability.recordRequest({ method: 'GET', path: '/autonomy/signals' } as Request, { statusCode: 200 } as Response, 100);
      observability.recordCavemanStats({ bytesIn: 1000, bytesOut: 600 });
      observability.setActiveSignals(10);
      observability.setActiveProposals(5);

      const snapshot = observability.getMetricsJSON();

      expect(snapshot).toHaveProperty('requests_total');
      expect(snapshot).toHaveProperty('requests_by_status');
      expect(snapshot).toHaveProperty('requests_by_endpoint');
      expect(snapshot).toHaveProperty('latency_p50');
      expect(snapshot).toHaveProperty('latency_p95');
      expect(snapshot).toHaveProperty('latency_p99');
      expect(snapshot).toHaveProperty('caveman_stats_total');
      expect(snapshot).toHaveProperty('caveman_compression_ratio');
      expect(snapshot).toHaveProperty('active_signals');
      expect(snapshot).toHaveProperty('active_proposals');
    });
  });

  describe('Prometheus Metrics Export', () => {
    it('exports metrics in Prometheus format', () => {
      observability.recordRequest({ method: 'GET', path: '/autonomy/signals' } as Request, { statusCode: 200 } as Response, 100);
      observability.recordCavemanStats({ bytesIn: 1000, bytesOut: 600 });
      observability.setActiveSignals(10);

      const prometheusOutput = observability.getMetricsPrometheus();

      expect(prometheusOutput).toContain('# HELP autonomy_requests_total');
      expect(prometheusOutput).toContain('autonomy_requests_total 1');
      expect(prometheusOutput).toContain('# HELP autonomy_caveman_bytes_in');
      expect(prometheusOutput).toContain('autonomy_caveman_bytes_in 1000');
      expect(prometheusOutput).toContain('autonomy_active_signals 10');
    });

    it('formats Prometheus metrics correctly', () => {
      observability.recordRequest({ method: 'GET', path: '/autonomy/signals' } as Request, { statusCode: 200 } as Response, 100);

      const prometheusOutput = observability.getMetricsPrometheus();

      // Check for correct Prometheus format
      expect(prometheusOutput).toMatch(/^# HELP/m);
      expect(prometheusOutput).toMatch(/^# TYPE/m);
      expect(prometheusOutput).toMatch(/^autonomy_/m);
    });

    it('includes all metric types in Prometheus output', () => {
      observability.recordRequest({ method: 'GET', path: '/autonomy/signals' } as Request, { statusCode: 200 } as Response, 100);
      observability.recordRequest({ method: 'POST', path: '/autonomy/proposals' } as Request, { statusCode: 201 } as Response, 150);
      observability.recordCavemanStats({ bytesIn: 1000, bytesOut: 600 });
      observability.setActiveSignals(10);
      observability.setActiveProposals(5);

      const prometheusOutput = observability.getMetricsPrometheus();

      expect(prometheusOutput).toContain('autonomy_requests_total');
      expect(prometheusOutput).toContain('autonomy_requests_by_status');
      expect(prometheusOutput).toContain('autonomy_requests_by_endpoint');
      expect(prometheusOutput).toContain('autonomy_latency_p50_ms');
      expect(prometheusOutput).toContain('autonomy_latency_p95_ms');
      expect(prometheusOutput).toContain('autonomy_latency_p99_ms');
      expect(prometheusOutput).toContain('autonomy_caveman_bytes_in');
      expect(prometheusOutput).toContain('autonomy_caveman_bytes_out');
      expect(prometheusOutput).toContain('autonomy_caveman_bytes_saved');
      expect(prometheusOutput).toContain('autonomy_caveman_compression_ratio');
      expect(prometheusOutput).toContain('autonomy_active_signals');
      expect(prometheusOutput).toContain('autonomy_active_proposals');
    });
  });

  describe('Metrics Reset', () => {
    it('resets all metrics', () => {
      observability.recordRequest({ method: 'GET', path: '/autonomy/signals' } as Request, { statusCode: 200 } as Response, 100);
      observability.recordCavemanStats({ bytesIn: 1000, bytesOut: 600 });
      observability.setActiveSignals(10);

      const snapshotBefore = observability.getMetricsJSON();
      expect(snapshotBefore.requests_total).toBe(1);

      observability.resetMetrics();

      const snapshotAfter = observability.getMetricsJSON();

      expect(snapshotAfter.requests_total).toBe(0);
      expect(snapshotAfter.caveman_stats_total.bytes_in).toBe(0);
      expect(snapshotAfter.active_signals).toBe(0);
    });
  });

  describe('Singleton Pattern', () => {
    it('returns same instance across calls', () => {
      const instance1 = ObservabilityManager.getInstance();
      const instance2 = ObservabilityManager.getInstance();

      expect(instance1).toBe(instance2);
    });
  });
});
