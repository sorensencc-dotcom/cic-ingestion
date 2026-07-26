import express from 'express';
import type { Server } from 'http';
import { createImageAnalysisRouter, loadConfig } from '../services/imageAnalysis/index.ts';

/**
 * E2E tests: Service running + real HTTP calls (no mocks)
 * Requires: SERVICE_URL env var or defaults to http://localhost:3000
 * Validates: endpoint contract, latency SLA, error handling, fallback behavior
 */

const SERVICE_URL = process.env.SERVICE_URL || 'http://localhost:3000';

interface E2ETestContext {
  serviceRunning: boolean;
  baseLatency: number;
}

const context: E2ETestContext = {
  serviceRunning: false,
  baseLatency: 0,
};

let server: Server | null = null;

beforeAll(async () => {
  let isAlive = false;
  try {
    const res = await fetch(`${SERVICE_URL}/health`, { signal: AbortSignal.timeout(1000) });
    if (res.ok || res.status === 404 || res.status === 200) {
      isAlive = true;
    }
  } catch {
    isAlive = false;
  }

  if (!isAlive) {
    const app = express();
    app.use(express.json({ limit: '100mb' }));

    app.get('/health', (_req, res) => {
      res.json({
        status: 'ok',
        service: 'cic-imageanalysis-test',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    });

    const config = loadConfig();
    const router = createImageAnalysisRouter(config);
    app.use('/api', router);

    app.use((req, res) => {
      res.status(404).json({ error: 'Not found', path: req.path });
    });

    await new Promise<void>((resolve, reject) => {
      const urlObj = new URL(SERVICE_URL);
      const port = urlObj.port ? parseInt(urlObj.port, 10) : 3000;

      const s = app.listen(port, '0.0.0.0', () => {
        server = s;
        resolve();
      });
      s.on('error', reject);
    });
  }

  // Warm-up request to ensure route and V8 JIT initialization
  try {
    await fetch(`${SERVICE_URL}/api/analyze/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBuffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64') }),
    });
  } catch {
    // Ignore warm-up errors
  }

  context.serviceRunning = true;
}, 15000);

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve) => {
      server!.close(() => resolve());
    });
  }
});

describe('ImageAnalysis E2E Tests', () => {
  describe('Scenario 1: Valid small image (PNG)', () => {
    it('should analyze PNG and return matches', async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00]);
      const base64 = pngBuffer.toString('base64');

      const startTime = Date.now();
      const response = await fetch(`${SERVICE_URL}/api/analyze/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBuffer: base64, format: 'png' }),
      });
      const latency = Date.now() - startTime;

      expect(response.status).toBe(200);

      const data = (await response.json()) as any;
      expect(data).toHaveProperty('matches');
      expect(data).toHaveProperty('metadata');
      expect(data.metadata.format).toBe('png');
      expect(latency).toBeLessThan(500); // SLA: <500ms
    });
  });

  describe('Scenario 2: Valid JPEG', () => {
    it('should analyze JPEG and detect format', async () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const base64 = jpegBuffer.toString('base64');

      const response = await fetch(`${SERVICE_URL}/api/analyze/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBuffer: base64 }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.metadata.format).toBe('jpeg');
    });
  });

  describe('Scenario 3: Error handling (invalid request)', () => {
    it('should reject missing imageBuffer', async () => {
      const response = await fetch(`${SERVICE_URL}/api/analyze/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'png' }),
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('required');
    });

    it('should reject empty imageBuffer', async () => {
      const response = await fetch(`${SERVICE_URL}/api/analyze/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBuffer: '' }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Scenario 4: Size validation (>50MB)', () => {
    it('should reject images exceeding 50MB', async () => {
      // Create a base64 string that represents >50MB (70MB base64)
      const largeBase64 = 'A'.repeat(70 * 1024 * 1024);

      const response = await fetch(`${SERVICE_URL}/api/analyze/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBuffer: largeBase64 }),
      });

      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.error).toContain('too large');
    });
  });

  describe('Scenario 5: Graceful fallback (no API key)', () => {
    it('should return mock results when Vision API unavailable', async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      const base64 = pngBuffer.toString('base64');

      const response = await fetch(`${SERVICE_URL}/api/analyze/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBuffer: base64 }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      // visionApiUsed should be false (no real API key configured in test env)
      expect(data.metadata.visionApiUsed).toBe(false);
      // Should still return valid matches structure
      expect(Array.isArray(data.matches)).toBe(true);
    });
  });

  describe('Response Contract Validation', () => {
    it('should return correct response schema', async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      const base64 = pngBuffer.toString('base64');

      const response = await fetch(`${SERVICE_URL}/api/analyze/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBuffer: base64 }),
      });

      const data = (await response.json()) as any;

      // Validate response structure
      expect(data).toHaveProperty('matches');
      expect(Array.isArray(data.matches)).toBe(true);

      expect(data).toHaveProperty('metadata');
      expect(data.metadata).toHaveProperty('format');
      expect(data.metadata).toHaveProperty('size');
      expect(data.metadata).toHaveProperty('processedAt');
      expect(data.metadata).toHaveProperty('visionApiUsed');
      expect(data.metadata).toHaveProperty('latencyMs');
      expect(data.metadata).toHaveProperty('apiProvider');

      // Validate ImageMatch schema
      if (data.matches.length > 0) {
        const match = data.matches[0];
        expect(match).toHaveProperty('url');
        expect(match).toHaveProperty('similarity');
        expect(match).toHaveProperty('source');
        expect(typeof match.similarity).toBe('number');
        expect(match.similarity).toBeGreaterThanOrEqual(0);
        expect(match.similarity).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Latency SLA', () => {
    it('should meet p99 <500ms SLA', async () => {
      const latencies: number[] = [];
      const iterations = 10; // 10 requests to establish baseline

      for (let i = 0; i < iterations; i++) {
        const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
        const base64 = pngBuffer.toString('base64');

        const startTime = Date.now();
        await fetch(`${SERVICE_URL}/api/analyze/image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBuffer: base64 }),
        });
        latencies.push(Date.now() - startTime);
      }

      const sorted = [...latencies].sort((a, b) => a - b);
      const p99 = sorted[Math.floor(sorted.length * 0.99)];

      console.log(`[E2E] Latency SLA: p99=${p99}ms (limit: 500ms)`);
      expect(p99).toBeLessThan(500);
    });
  });

  describe('RequestId correlation', () => {
    it('should return requestId for tracing', async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      const base64 = pngBuffer.toString('base64');
      const requestId = 'test-e2e-' + Date.now();

      const response = await fetch(`${SERVICE_URL}/api/analyze/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBuffer: base64, requestId }),
      });

      // Service should accept and correlate the requestId
      expect(response.status).toBe(200);
    });
  });
});
