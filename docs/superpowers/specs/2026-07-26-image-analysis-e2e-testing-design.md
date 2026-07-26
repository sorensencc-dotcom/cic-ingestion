# Image Analysis Service E2E Testing Design (Step 2)

**Date:** 2026-07-26  
**Status:** Approved  
**Target Component:** `src/__tests__/imageAnalysis.e2e.test.ts` & `src/__tests__/test-server.ts`

---

## 1. Objectives

Re-enable and expand the skipped E2E HTTP integration test suite (`src/__tests__/imageAnalysis.e2e.test.ts`).

### Root Causes of Previous Failures:
1. **ESM Import Failure**: `import fetch from 'node-fetch'` threw `SyntaxError: Cannot use import statement outside a module` under ts-jest.
2. **Server Dependency**: E2E test suite failed if an external server on `http://localhost:3000` was not started before running `npx jest`.
3. **Payload Limit**: `test-server.ts` had a 10MB JSON body limit, causing 50MB image tests to fail with 413 Payload Too Large instead of application validation 400.

---

## 2. Design Solutions

### 2.1 Native HTTP Fetch & Server Lifecycle Management
- **HTTP Client**: Use Node's native `globalThis.fetch` (built into Node 18+) instead of third-party ESM `node-fetch`.
- **Automatic In-Process Server**:
  - `beforeAll`: Check if an HTTP service is responding at `SERVICE_URL`. If not, start an internal Express server listening on an available port (`3000` or ephemeral port).
  - `afterAll`: Gracefully close the internal HTTP server after tests complete.
- **Express Payload Limit**: Increase JSON body size limit to `100mb` in `test-server.ts` and in-process test server to allow 50MB binary (~66MB base64) testing.

---

## 3. Test Scenarios Covered

1. **PNG Format Analysis**: Send PNG magic bytes, verify 200 OK, format = `'png'`, latency < 500ms.
2. **JPEG Format Analysis**: Send JPEG magic bytes, verify 200 OK, format = `'jpeg'`.
3. **Request Parameter Validation**: Missing `imageBuffer` or empty string returns HTTP 400 with error message.
4. **Oversized Image Validation**: Payload exceeding 50MB binary limit returns HTTP 400.
5. **Fallback Behavior**: No Vision API key configured in test environment produces mock results with `visionApiUsed: false`.
6. **Schema Contract**: Validate `matches` array structure, `similarity` score range (0-100), and `metadata` properties.
7. **Latency SLA**: 10 sequential requests establish p99 < 500ms latency baseline.
8. **RequestId Correlation**: Verify custom `requestId` is correctly preserved in error and success responses.

---

## 4. Verification Plan

### Automated Command
- Command: `npx jest src/__tests__/imageAnalysis.e2e.test.ts`
- Target: 100% PASS rate (all scenarios passing without external dependencies).
