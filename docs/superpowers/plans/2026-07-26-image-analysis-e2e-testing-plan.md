# Image Analysis E2E Testing Implementation Plan (Step 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-enable and pass all E2E HTTP integration tests in `src/__tests__/imageAnalysis.e2e.test.ts` with automated test server lifecycle management.

**Architecture:** Replace ESM `node-fetch` with Node's native `globalThis.fetch`. Add `beforeAll`/`afterAll` Express server lifecycle management to `src/__tests__/imageAnalysis.e2e.test.ts` so tests can run standalone without requiring a manual server startup. Update `test-server.ts` JSON limit to 100MB.

**Tech Stack:** TypeScript, Jest, ts-jest, Express, Native Node `fetch`.

## Global Constraints
- Target directory: `c:/dev/cic-ingestion/`
- Test Framework: Jest with ts-jest (`npx jest`)
- Style: Strict TypeScript, standalone E2E execution, TDD flow

---

### Task 1: Update Test Server Payload Limit

**Files:**
- Modify: `src/__tests__/test-server.ts:14`

- [ ] **Step 1: Increase JSON body limit in `test-server.ts`**

Change `express.json({ limit: '10mb' })` to `express.json({ limit: '100mb' })`.

- [ ] **Step 2: Commit Task 1**

```bash
git add src/__tests__/test-server.ts
git commit -m "fix(test-server): increase JSON payload limit to 100mb for E2E testing"
```

---

### Task 2: Refactor E2E Test Suite for Standalone HTTP Execution

**Files:**
- Modify: `src/__tests__/imageAnalysis.e2e.test.ts`

- [ ] **Step 1: Update `src/__tests__/imageAnalysis.e2e.test.ts`**

1. Remove `import fetch from 'node-fetch'`.
2. Use native `globalThis.fetch`.
3. Add `beforeAll` server startup (if `SERVICE_URL` is unreachable, spin up test server on port 3000 or free port) and `afterAll` teardown.
4. Ensure all 8 test scenarios pass cleanly.

- [ ] **Step 2: Run E2E test suite to verify**

Run: `npx jest src/__tests__/imageAnalysis.e2e.test.ts`  
Expected: PASS (all tests passing)

- [ ] **Step 3: Commit Task 2**

```bash
git add src/__tests__/imageAnalysis.e2e.test.ts
git commit -m "test(imageAnalysis): re-enable E2E HTTP integration suite with standalone server lifecycle"
```
