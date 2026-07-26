import { ImageAnalysisMetrics } from '../observability';

describe('ImageAnalysisMetrics', () => {
  let metrics: ImageAnalysisMetrics;

  beforeEach(() => {
    metrics = new ImageAnalysisMetrics();
  });

  it('records successful requests and calculates latencies and usage ratios correctly', () => {
    metrics.recordSuccess(100, true);
    metrics.recordSuccess(200, false);

    const snapshot = metrics.getSnapshot();

    expect(snapshot.totalRequests).toBe(2);
    expect(snapshot.successfulRequests).toBe(2);
    expect(snapshot.errorRequests).toBe(0);
    expect(snapshot.latencies.mean).toBe(150);
    expect(snapshot.visionApiUsageRatio).toBe(0.5);
    expect(snapshot.fallbackRatio).toBe(0.5);
  });

  it('records errors by type correctly', () => {
    metrics.recordSuccess(100, true);
    metrics.recordError('TIMEOUT', 500);
    metrics.recordError('TIMEOUT', 600);
    metrics.recordError('RATE_LIMIT', 300);

    const snapshot = metrics.getSnapshot();

    expect(snapshot.totalRequests).toBe(4);
    expect(snapshot.successfulRequests).toBe(1);
    expect(snapshot.errorRequests).toBe(3);
    expect(snapshot.errorsByType).toEqual({
      TIMEOUT: 2,
      RATE_LIMIT: 1,
    });
  });

  it('calculates latency percentiles (p50, p95, p99) accurately', () => {
    // Push 100 values from 1 to 100
    for (let i = 1; i <= 100; i++) {
      metrics.recordSuccess(i, true);
    }

    const snapshot = metrics.getSnapshot();

    // Index calculation in observability.ts:
    // sorted length = 100 (sorted[0] = 1, ..., sorted[99] = 100)
    // p50: sorted[Math.floor(100 * 0.50)] = sorted[50] = 51
    // p95: sorted[Math.floor(100 * 0.95)] = sorted[95] = 96
    // p99: sorted[Math.floor(100 * 0.99)] = sorted[99] = 100
    expect(snapshot.latencies.p50).toBe(51);
    expect(snapshot.latencies.p95).toBe(96);
    expect(snapshot.latencies.p99).toBe(100);
  });

  it('evaluates SLA compliance based on thresholds', () => {
    // Compliant case
    for (let i = 0; i < 10; i++) {
      metrics.recordSuccess(100, true);
    }
    expect(metrics.isSLACompliant(500, 0.05, 0.05)).toBe(true);

    // Non-compliant case: p99 latency exceeds SLA
    metrics.recordSuccess(600, true);
    expect(metrics.isSLACompliant(500, 0.05, 0.05)).toBe(false);

    // Non-compliant case: fallback ratio exceeds maxFallbackRatio
    metrics.reset();
    metrics.recordSuccess(100, false); // fallback count 1, total 1 -> ratio 1.0
    expect(metrics.isSLACompliant(500, 0.05, 0.05)).toBe(false);

    // Non-compliant case: error rate exceeds maxErrorRate
    metrics.reset();
    metrics.recordSuccess(100, true);
    metrics.recordError('TIMEOUT', 100); // 1 error, total 2 -> error rate 0.5
    expect(metrics.isSLACompliant(500, 0.05, 0.05)).toBe(false);
  });

  it('triggers fallback alerts when fallback ratio exceeds threshold', () => {
    for (let i = 0; i < 9; i++) {
      metrics.recordSuccess(100, true);
    }
    metrics.recordSuccess(100, false); // 1 fallback out of 10 -> ratio 0.10

    const alert = metrics.checkFallbackAlert(0.05);
    expect(alert.triggered).toBe(true);
    expect(alert.message).toContain('Vision API fallback rate 10.0% exceeds threshold 5.0%');

    // Add 10 more successful vision API requests -> 1 fallback out of 20 -> ratio 0.05
    for (let i = 0; i < 10; i++) {
      metrics.recordSuccess(100, true);
    }
    const alertOk = metrics.checkFallbackAlert(0.05);
    expect(alertOk.triggered).toBe(false);
    expect(alertOk.message).toBe('');
  });

  it('resets metrics state completely', () => {
    metrics.recordSuccess(100, true);
    metrics.recordSuccess(200, false);
    metrics.recordError('TIMEOUT', 500);

    metrics.reset();

    const snapshot = metrics.getSnapshot();
    expect(snapshot.totalRequests).toBe(0);
    expect(snapshot.successfulRequests).toBe(0);
    expect(snapshot.errorRequests).toBe(0);
    expect(snapshot.latencies).toEqual({
      mean: 0,
      p50: 0,
      p95: 0,
      p99: 0,
    });
    expect(snapshot.visionApiUsageRatio).toBe(0);
    expect(snapshot.fallbackRatio).toBe(0);
    expect(snapshot.errorsByType).toEqual({});
  });
});
