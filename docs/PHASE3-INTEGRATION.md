# Phase 3: Integration & E2E Validation

**Objective:** Validate service + client integration end-to-end, measure SLA compliance, establish baseline metrics.

**Timeline:** 1 week (after Phase 2 TRM client wiring complete)

**Blockers:** 
- Phase 2 must be complete: TRM imageAnalyzer wired into harvester flow
- cic-ingestion service running with Vision API credentials (optional for mock testing)

---

## Tasks

### 3.1 E2E Test Suite

**Files:** `src/__tests__/imageAnalysis.e2e.test.ts`

**Scenarios (5):**
1. Valid small image (PNG) — verify format detection, response schema
2. Valid JPEG — verify JPEG magic-byte detection
3. Error handling — invalid/empty imageBuffer, HTTP 400 response
4. Size validation — reject >50MB images with HTTP 400
5. Graceful fallback — return mock results if Vision API unavailable

**Setup:**
```bash
# Start service (if not already running)
npm start &

# Run E2E tests
npm test -- src/__tests__/imageAnalysis.e2e.test.ts
```

**Acceptance Criteria:**
- [ ] All 5 scenarios PASS
- [ ] Response schema matches contract (matches[], metadata with all required fields)
- [ ] Latency p99 <500ms observed in test runs
- [ ] Error handling validates HTTP status codes (400, 500, etc.)
- [ ] requestId correlation works for tracing

### 3.2 Load Testing

**Files:** `src/__tests__/imageAnalysis.phase3-load.ts`

**Configuration:**
- Concurrency: 50 requests
- Image size: 1MB (default, configurable via `IMAGE_SIZE` env var)
- Request timeout: 5000ms
- SLA: p99 <500ms, error_rate <5%

**Setup:**
```bash
# Add to package.json scripts
"test:load:phase3": "ts-node src/__tests__/imageAnalysis.phase3-load.ts"

# Run with defaults
npm run test:load:phase3

# Run with custom concurrency
LOAD_CONCURRENCY=100 npm run test:load:phase3

# Run with large image (2MB)
IMAGE_SIZE=2097152 npm run test:load:phase3
```

**Output:**
- Request summary: total, successful, failed counts + percentages
- Error breakdown: HTTP status, timeout, connection errors
- Vision API usage: real vs fallback ratio
- Latency percentiles: mean, p50, p95, p99
- SLA compliance: PASS/FAIL with reasoning

**Acceptance Criteria:**
- [ ] p99 latency ≤500ms (SLA target)
- [ ] Error rate ≤5% (SLA target)
- [ ] Vision API fallback >0% (indicates graceful degradation working)
- [ ] Test completes within reasonable time (<5min for 50 requests)
- [ ] No memory leaks or connection hangs

### 3.3 Baseline Metrics Capture

**Objective:** Establish baseline for regression detection in Phase 4+

**Procedure:**

1. **Run E2E tests (3 times)** to warm up service
   ```bash
   npm test -- src/__tests__/imageAnalysis.e2e.test.ts
   npm test -- src/__tests__/imageAnalysis.e2e.test.ts
   npm test -- src/__tests__/imageAnalysis.e2e.test.ts
   ```

2. **Run load test** (50 concurrent, 1MB images)
   ```bash
   npm run test:load:phase3
   ```

3. **Record baseline** in `PHASE3-BASELINE.json`:
   ```json
   {
     "capturedAt": "2026-07-19T...",
     "phase": 3,
     "config": {
       "concurrency": 50,
       "imageSizeBytes": 1048576,
       "requestTimeoutMs": 5000
     },
     "metrics": {
       "p50": 45,
       "p95": 180,
       "p99": 420,
       "mean": 95,
       "errorRate": 1.2,
       "visionApiUsageRatio": 0.0
     }
   }
   ```

4. **Document observations:**
   - Service warmup time needed?
   - Network latency variance?
   - Any connection/timeout patterns?
   - Memory/CPU usage stable?

### 3.4 Observability Integration

**Files:** `src/services/imageAnalysis/observability.ts`

**Metrics Collected:**
- Request latencies (store all, calculate percentiles)
- Success/error counts by type
- Vision API usage ratio (real vs fallback)
- Error types: HTTP 4xx/5xx, timeout, network errors

**Integration Points:**
1. In `ImageAnalysisService.analyze()`:
   ```typescript
   globalMetrics.recordSuccess(latencyMs, visionApiUsed);
   // or
   globalMetrics.recordError(errorType, latencyMs);
   ```

2. In Express router (optional middleware):
   ```typescript
   const snapshot = globalMetrics.getSnapshot();
   res.set('X-Metrics-P99', snapshot.latencies.p99.toString());
   ```

3. SLA monitoring (e.g., every minute):
   ```typescript
   const snapshot = globalMetrics.getSnapshot();
   if (!globalMetrics.isSLACompliant()) {
     console.warn('SLA violation detected:', snapshot);
     // Alert ops, log to monitoring system
   }
   ```

**Acceptance Criteria:**
- [ ] Metrics collector wired into service
- [ ] Snapshot captures all required fields
- [ ] SLA compliance check works (p99, error_rate, fallback_ratio)
- [ ] Fallback alert triggers when ratio >5%
- [ ] Metrics persist across batch windows (no data loss)

### 3.5 Documentation & Go-Live Checklist

**Files to create:**
- `PHASE3-BASELINE.json` — baseline metrics (post-load-test)
- `PHASE3-RUNBOOK.md` — operations guide (how to run tests, interpret results)
- `PHASE3-REGRESSION-DETECTION.md` — regression thresholds & alerting rules

**Phase 3 Completion Checklist:**
- [ ] E2E tests pass (all 5 scenarios)
- [ ] Load test passes SLA (p99 <500ms, error <5%)
- [ ] Baseline metrics captured in PHASE3-BASELINE.json
- [ ] Observability integrated into service
- [ ] Fallback alert rule configured (>5% fallback triggers page)
- [ ] Runbook documented for Phase 4 ops team
- [ ] Regression thresholds locked (p99 ≤baseline * 1.1)

---

## Environment Setup

### Service Running
```bash
cd cic-ingestion
npm start
# Service listens on CIC_INGESTION_PORT (default 3000)
```

### With Vision API Credentials (optional)
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
export VISION_API_KEY=your-api-key
npm start
```

### Test Service Running (mock mode)
```bash
# Default (no credentials needed)
npm start
# Service returns mock results for all requests
```

---

## Troubleshooting

**Load test p99 exceeds 500ms:**
- Check network latency: `ping SERVICE_URL` (one-way <100ms assumed)
- Check service CPU/memory: `top`, `ps aux`
- Reduce concurrency: `LOAD_CONCURRENCY=25 npm run test:load:phase3`
- Check if Vision API is responding: run with `VISION_API_KEY` set, compare p99

**High error rate in load test:**
- Check service logs: `tail -f service.log`
- Verify SERVICE_URL is correct: `curl -X GET http://localhost:3000/health`
- Check firewall: service must accept connections on CIC_INGESTION_PORT

**E2E tests timeout:**
- Increase REQUEST_TIMEOUT: `REQUEST_TIMEOUT=10000 npm test -- ...`
- Check if service is responding: `curl -X POST http://localhost:3000/api/analyze/image -H "Content-Type: application/json" -d '{"imageBuffer":"iVBORw0KGgo="}'`

---

## Next: Phase 4 (Feature Flag Rollout)

After Phase 3 completion:
1. Baseline metrics approved by team
2. SLA thresholds locked
3. Regression detection rules deployed
4. Phase 4: Feature flag for gradual TRM rollout (10% → 25% → 50% → 100%)
