# Image Analysis Service: Extended Unit & Integration Testing Design

**Date:** 2026-07-26  
**Status:** Approved (Approach C - Hybrid Comprehensive Suite)  
**Target Component:** `src/services/imageAnalysis/` & `src/__tests__/imageAnalysis.test.ts`

---

## 1. Overview & Objectives

Expand test coverage for the `imageAnalysis` service component within `cic-ingestion`. The service handles image magic-byte format detection, size validation, Google Vision API integration with fallback capabilities, metrics tracking, and Express HTTP routing.

This design covers:
1. **`src/services/imageAnalysis/__tests__/observability.test.ts`**: Comprehensive unit tests for metrics tracking (`ImageAnalysisMetrics`), percentile math (p50/p95/p99), SLA compliance checks, reset behaviors, and alert triggers.
2. **`src/services/imageAnalysis/__tests__/router.test.ts`**: Unit tests for the Express router contract (`createImageAnalysisRouter`), request parameter validation, base64 payload size checks, auto-generated vs caller-supplied `requestId` handling, and HTTP status codes (200, 400, 500).
3. **`src/__tests__/imageAnalysis.test.ts`**: Edge-case payload testing (malformed base64, exact `maxImageSizeBytes` boundaries), magic byte format resolution, and `config.ts` default loader tests.

---

## 2. Component Design & New Test Cases

### 2.1 Observability Test Suite (`src/services/imageAnalysis/__tests__/observability.test.ts`)
- **`recordSuccess` & `recordError`**: Verify internal counters increment correctly and error maps log exact error categories.
- **Latency Percentiles**: Test mean, p50, p95, and p99 calculations across empty array, single item, and non-trivial latency distributions.
- **SLA Compliance (`isSLACompliant`)**:
  - Test passing SLA when p99 ≤ 500ms, fallback ratio ≤ 5%, and error rate ≤ 5%.
  - Test failing SLA when any individual threshold is breached (latency, fallback, or error rate).
- **Alert Triggering (`checkFallbackAlert`)**:
  - Test `triggered: false` when fallback ratio is below threshold.
  - Test `triggered: true` with formatted message when fallback ratio exceeds threshold.
- **Reset**: Verify `reset()` clears latencies, counters, error maps, and usage ratios.

### 2.2 Express Router Test Suite (`src/services/imageAnalysis/__tests__/router.test.ts`)
- **Request Validation**:
  - Return HTTP 400 when `imageBuffer` is omitted, `null`, non-string, or empty string `""`.
  - Return HTTP 400 when base64 string exceeds 50 MB equivalent (~66 MB base64).
- **Request Correlation**:
  - Auto-generate a valid timestamp-random `requestId` when caller omits it.
  - Preserve explicit `requestId` passed in the request body.
- **Error Response Handling**:
  - Test HTTP 500 with `{ error: 'Internal server error', requestId }` when underlying service throws an unexpected exception.

### 2.3 Service Edge Cases (`src/__tests__/imageAnalysis.test.ts`)
- **Base64 Boundary Checks**:
  - Image buffer exactly equal to `maxImageSizeBytes` (succeeds).
  - Image buffer equal to `maxImageSizeBytes + 1` (fails with size error).
- **Format Edge Cases**:
  - Verify format detection for GIF (`47 49 46 38`), WebP (`52 49 46 46 ... 57 45 42 50`).
  - Verify fallback to request format or `'unknown'`.
- **Config Loader**:
  - Test `loadConfig()` defaults vs environment variables.

---

## 3. Verification Plan

### Automated Tests
- Command: `npx jest src/services/imageAnalysis/__tests__/ src/__tests__/imageAnalysis.test.ts`
- Expected Result: 100% PASS rate for all tests.
