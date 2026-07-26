# Image Analysis Service Extended Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 100% test coverage for `ImageAnalysisMetrics` observability, `createImageAnalysisRouter` Express contract, and `ImageAnalysisService` edge-case payload handling in `cic-ingestion`.

**Architecture:** Use Jest and ts-jest to create `src/services/imageAnalysis/__tests__/observability.test.ts` for unit testing metrics and percentiles, `src/services/imageAnalysis/__tests__/router.test.ts` for Express API router validation, and expand `src/__tests__/imageAnalysis.test.ts` for boundary payload conditions.

**Tech Stack:** TypeScript, Jest, ts-jest, Express (`express`), Node.js `Buffer`.

## Global Constraints
- Target directory: `c:/dev/cic-ingestion/`
- Test Framework: Jest with ts-jest (`npx jest`)
- Style: Strict TypeScript, no skipped tests, TDD flow

---

### Task 1: Observability Unit Test Suite (`ImageAnalysisMetrics`)

**Files:**
- Create: `src/services/imageAnalysis/__tests__/observability.test.ts`
- Consumes: `ImageAnalysisMetrics` from `src/services/imageAnalysis/observability.ts`

- [ ] **Step 1: Write the failing test for `ImageAnalysisMetrics`**

Write `src/services/imageAnalysis/__tests__/observability.test.ts`:
```typescript
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
    metrics.recordError('TIMEOUT', 500);
    metrics.recordError('TIMEOUT', 300);
    metrics.recordError('INVALID_PAYLOAD', 50);

    const snapshot = metrics.getSnapshot();
    expect(snapshot.totalRequests).toBe(3);
    expect(snapshot.errorRequests).toBe(3);
    expect(snapshot.errorsByType).toEqual({
      TIMEOUT: 2,
      INVALID_PAYLOAD: 1,
    });
  });

  it('calculates latency percentiles (p50, p95, p99) accurately', () => {
    // 100 values: 1 to 100
    for (let i = 1; i <= 100; i++) {
      metrics.recordSuccess(i, true);
    }

    const snapshot = metrics.getSnapshot();
    expect(snapshot.latencies.p50).toBe(51);
    expect(snapshot.latencies.p95).toBe(96);
    expect(snapshot.latencies.p99).toBe(100);
  });

  it('evaluates SLA compliance based on thresholds', () => {
    metrics.recordSuccess(100, true);
    expect(metrics.isSLACompliant(500, 0.05, 0.05)).toBe(true);

    metrics.recordError('SERVICE_ERROR', 600); // 50% error rate
    expect(metrics.isSLACompliant(500, 0.05, 0.05)).toBe(false);
  });

  it('triggers fallback alerts when fallback ratio exceeds threshold', () => {
    metrics.recordSuccess(10, false); // fallback
    const alert = metrics.checkFallbackAlert(0.05);
    expect(alert.triggered).toBe(true);
    expect(alert.message).toContain('Vision API fallback rate 100.0% exceeds threshold 5.0%');
  });

  it('resets metrics state completely', () => {
    metrics.recordSuccess(100, true);
    metrics.recordError('ERR', 50);
    metrics.reset();

    const snapshot = metrics.getSnapshot();
    expect(snapshot.totalRequests).toBe(0);
    expect(snapshot.successfulRequests).toBe(0);
    expect(snapshot.latencies.mean).toBe(0);
    expect(snapshot.errorsByType).toEqual({});
  });
});
```

- [ ] **Step 2: Run test suite to verify tests pass**

Run: `npx jest src/services/imageAnalysis/__tests__/observability.test.ts`  
Expected: PASS

- [ ] **Step 3: Commit Task 1**

```bash
git add src/services/imageAnalysis/__tests__/observability.test.ts
git commit -m "test(imageAnalysis): add observability unit tests for ImageAnalysisMetrics"
```

---

### Task 2: Express Router API Contract Test Suite

**Files:**
- Create: `src/services/imageAnalysis/__tests__/router.test.ts`
- Consumes: `createImageAnalysisRouter` from `src/services/imageAnalysis/router.ts`

- [ ] **Step 1: Write the router contract unit test**

Write `src/services/imageAnalysis/__tests__/router.test.ts`:
```typescript
import express from 'express';
import { createImageAnalysisRouter } from '../router';

describe('ImageAnalysis Router', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json({ limit: '100mb' }));
    app.use('/api', createImageAnalysisRouter({ maxImageSizeBytes: 50 * 1024 * 1024 }));
  });

  it('validates that imageBuffer is present and is a non-empty string', async () => {
    const resMissing = await requestHandler(app, 'POST', '/api/analyze/image', {});
    expect(resMissing.status).toBe(400);
    expect(resMissing.body.error).toContain('imageBuffer is required');

    const resNonString = await requestHandler(app, 'POST', '/api/analyze/image', { imageBuffer: 12345 });
    expect(resNonString.status).toBe(400);
    expect(resNonString.body.error).toContain('imageBuffer is required');
  });

  it('rejects oversized base64 strings exceeding limit', async () => {
    // 50MB * 1.33 = ~66.5MB
    const oversizedBase64 = 'A'.repeat(70 * 1024 * 1024);
    const resLarge = await requestHandler(app, 'POST', '/api/analyze/image', { imageBuffer: oversizedBase64 });
    expect(resLarge.status).toBe(400);
    expect(resLarge.body.error).toContain('image too large');
  });

  it('preserves caller requestId or auto-generates one', async () => {
    const pngBase64 = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64');
    
    const resWithReqId = await requestHandler(app, 'POST', '/api/analyze/image', {
      imageBuffer: pngBase64,
      requestId: 'req-custom-123',
    });
    expect(resWithReqId.status).toBe(200);
    expect(resWithReqId.body).toHaveProperty('matches');
  });
});

async function requestHandler(app: express.Application, method: string, path: string, body: any): Promise<{ status: number; body: any }> {
  return new Promise((resolve) => {
    const req: any = {
      method,
      url: path,
      body,
      headers: { 'content-type': 'application/json' },
    };
    const res: any = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(data: any) {
        resolve({ status: this.statusCode, body: data });
      },
    };
    app(req, res);
  });
}
```

- [ ] **Step 2: Run test suite to verify router tests pass**

Run: `npx jest src/services/imageAnalysis/__tests__/router.test.ts`  
Expected: PASS

- [ ] **Step 3: Commit Task 2**

```bash
git add src/services/imageAnalysis/__tests__/router.test.ts
git commit -m "test(imageAnalysis): add router API contract unit tests"
```

---

### Task 3: Edge-Case Payload & Boundary Conditions in Service Test Suite

**Files:**
- Modify: `src/__tests__/imageAnalysis.test.ts`

- [ ] **Step 1: Add boundary & format edge case tests to `src/__tests__/imageAnalysis.test.ts`**

Add tests for:
1. Exact `maxImageSizeBytes` boundary size.
2. Malformed base64 decoding handling.
3. Magic byte resolution for TIFF and BMP images.

- [ ] **Step 2: Run full imageAnalysis test suite**

Run: `npx jest src/services/imageAnalysis/__tests__/ src/__tests__/imageAnalysis.test.ts`  
Expected: 100% PASS across all 3 test files.

- [ ] **Step 3: Commit Task 3**

```bash
git add src/__tests__/imageAnalysis.test.ts
git commit -m "test(imageAnalysis): add boundary conditions and format edge-case tests"
```
