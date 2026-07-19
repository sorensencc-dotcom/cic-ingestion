/**
 * Phase 3 Load Test: Concurrent requests + SLA validation
 * Run: npm run test:load:phase3
 * Tests: 50 concurrent requests, p99 <500ms, error <5%
 */

import fetch from 'node-fetch';

const SERVICE_URL = process.env.SERVICE_URL || 'http://localhost:3000';
const CONCURRENT_REQUESTS = parseInt(process.env.LOAD_CONCURRENCY || '50', 10);
const IMAGE_SIZE = parseInt(process.env.IMAGE_SIZE || '1048576', 10); // 1MB default

interface LoadTestConfig {
  concurrency: number;
  imageSizeBytes: number;
  requestTimeoutMs: number;
  slaP99Ms: number;
  slaErrorRatePercent: number;
}

interface LoadTestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  latencies: number[];
  errors: Map<string, number>;
  p50: number;
  p95: number;
  p99: number;
  mean: number;
  errorRate: number;
  visionApiUsedCount: number;
  fallbackCount: number;
}

class Phase3LoadTest {
  private config: LoadTestConfig;

  constructor(config?: Partial<LoadTestConfig>) {
    this.config = {
      concurrency: CONCURRENT_REQUESTS,
      imageSizeBytes: IMAGE_SIZE,
      requestTimeoutMs: 5000,
      slaP99Ms: 500,
      slaErrorRatePercent: 5,
      ...config,
    };
  }

  private createTestImage(): Buffer {
    // Create a minimal PNG with specified size
    const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const padding = Buffer.alloc(Math.max(0, this.config.imageSizeBytes - header.length), 0xaa);
    return Buffer.concat([header, padding]);
  }

  async runLoadTest(): Promise<LoadTestMetrics> {
    console.log(`\n[Phase 3 Load Test] Starting...`);
    console.log(`  Concurrency: ${this.config.concurrency}`);
    console.log(`  Image size: ${this.config.imageSizeBytes} bytes`);
    console.log(`  Request timeout: ${this.config.requestTimeoutMs}ms`);
    console.log(`  SLA: p99 <${this.config.slaP99Ms}ms, error <${this.config.slaErrorRatePercent}%\n`);

    const metrics: LoadTestMetrics = {
      totalRequests: this.config.concurrency,
      successfulRequests: 0,
      failedRequests: 0,
      latencies: [],
      errors: new Map(),
      p50: 0,
      p95: 0,
      p99: 0,
      mean: 0,
      errorRate: 0,
      visionApiUsedCount: 0,
      fallbackCount: 0,
    };

    const testImage = this.createTestImage();
    const base64Image = testImage.toString('base64');
    const batchStartTime = Date.now();

    // Run concurrent requests
    const promises = Array.from({ length: this.config.concurrency }).map((_, idx) =>
      this.sendRequest(idx, base64Image, metrics)
    );

    await Promise.all(promises);

    const totalTime = Date.now() - batchStartTime;

    // Calculate metrics
    this.calculateMetrics(metrics, totalTime);

    // Print results
    this.printResults(metrics);

    return metrics;
  }

  private async sendRequest(index: number, base64Image: string, metrics: LoadTestMetrics): Promise<void> {
    const requestStartTime = Date.now();
    let errorType = 'unknown';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

      const response = await fetch(`${SERVICE_URL}/api/analyze/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBuffer: base64Image }),
        // @ts-ignore - node-fetch AbortSignal
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const latency = Date.now() - requestStartTime;
      metrics.latencies.push(latency);

      if (!response.ok) {
        metrics.failedRequests++;
        errorType = `http_${response.status}`;
        console.log(`[Load] Request ${index + 1}/${metrics.totalRequests}: HTTP ${response.status} (${latency}ms)`);
      } else {
        const data = await response.json() as any;
        metrics.successfulRequests++;

        if (data.metadata?.visionApiUsed) {
          metrics.visionApiUsedCount++;
        } else {
          metrics.fallbackCount++;
        }

        if (index < 3 || index % Math.ceil(metrics.totalRequests / 5) === 0) {
          console.log(
            `[Load] Request ${index + 1}/${metrics.totalRequests}: OK (${latency}ms, Vision API: ${data.metadata?.visionApiUsed})`
          );
        }
      }
    } catch (error) {
      const latency = Date.now() - requestStartTime;
      metrics.latencies.push(latency);
      metrics.failedRequests++;

      const errMsg = (error as Error).message;
      if (errMsg.includes('Aborted') || errMsg.includes('timeout')) {
        errorType = 'timeout';
      } else if (errMsg.includes('ECONNREFUSED')) {
        errorType = 'connection_refused';
      } else {
        errorType = 'network_error';
      }

      console.log(`[Load] Request ${index + 1}/${metrics.totalRequests}: ${errorType} (${latency}ms)`);
    }

    // Track error types
    const count = metrics.errors.get(errorType) || 0;
    metrics.errors.set(errorType, count + 1);
  }

  private calculateMetrics(metrics: LoadTestMetrics, totalTime: number): void {
    const sorted = [...metrics.latencies].sort((a, b) => a - b);

    metrics.p50 = sorted[Math.floor(sorted.length * 0.50)];
    metrics.p95 = sorted[Math.floor(sorted.length * 0.95)];
    metrics.p99 = sorted[Math.floor(sorted.length * 0.99)];
    metrics.mean = metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length;
    metrics.errorRate = (metrics.failedRequests / metrics.totalRequests) * 100;

    console.log(`[Load] Test completed in ${totalTime}ms\n`);
  }

  private printResults(metrics: LoadTestMetrics): void {
    const passed = metrics.p99 <= this.config.slaP99Ms && metrics.errorRate <= this.config.slaErrorRatePercent;

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║           PHASE 3 LOAD TEST RESULTS                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('Request Summary:');
    console.log(`  Total:       ${metrics.totalRequests}`);
    console.log(`  Successful:  ${metrics.successfulRequests} (${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(1)}%)`);
    console.log(`  Failed:      ${metrics.failedRequests} (${metrics.errorRate.toFixed(1)}%)\n`);

    if (metrics.errors.size > 0) {
      console.log('Error Breakdown:');
      metrics.errors.forEach((count, errorType) => {
        console.log(`  ${errorType}: ${count}`);
      });
      console.log();
    }

    console.log('Vision API Usage:');
    console.log(`  Real Vision API:  ${metrics.visionApiUsedCount}`);
    console.log(`  Fallback (Mock):  ${metrics.fallbackCount}\n`);

    console.log('Latency Percentiles:');
    console.log(`  Mean:    ${metrics.mean.toFixed(1)}ms`);
    console.log(`  p50:     ${metrics.p50}ms`);
    console.log(`  p95:     ${metrics.p95}ms`);
    console.log(`  p99:     ${metrics.p99}ms (SLA: ≤${this.config.slaP99Ms}ms) ${metrics.p99 <= this.config.slaP99Ms ? '✓' : '✗'}\n`);

    console.log('SLA Validation:');
    console.log(`  p99 Latency:  ${metrics.p99}ms ≤ ${this.config.slaP99Ms}ms? ${metrics.p99 <= this.config.slaP99Ms ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`  Error Rate:   ${metrics.errorRate.toFixed(1)}% ≤ ${this.config.slaErrorRatePercent}%? ${metrics.errorRate <= this.config.slaErrorRatePercent ? '✓ PASS' : '✗ FAIL'}\n`);

    if (passed) {
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║  ✓ LOAD TEST PASSED — SLA REQUIREMENTS MET               ║');
      console.log('╚════════════════════════════════════════════════════════════╝\n');
    } else {
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║  ✗ LOAD TEST FAILED — SLA REQUIREMENTS NOT MET           ║');
      console.log('╚════════════════════════════════════════════════════════════╝\n');
    }
  }
}

// Main
(async () => {
  try {
    const test = new Phase3LoadTest();
    const metrics = await test.runLoadTest();

    const passed = metrics.p99 <= 500 && metrics.errorRate <= 5;
    process.exit(passed ? 0 : 1);
  } catch (error) {
    console.error('[Phase 3 Load Test] Unhandled error:', error);
    process.exit(1);
  }
})();
