# Queue & Resilience Extended Testing Design (Step 3)

**Date:** 2026-07-26  
**Status:** Approved  
**Target Components:** `src/queue/` & `src/resilience/`

---

## 1. Overview & Objectives

Expand integration and unit testing for the queue management (`Producer`, `DeadLetterQueue`) and resilience mechanisms (`retry`, `circuitBreaker`, `rateLimiter`, `timeout`) in `cic-ingestion`.

Objectives:
1. **Producer + DLQ Integration Suite (`src/queue/__tests__/queue-resilience.integration.test.ts`)**:
   - End-to-end Producer to DLQ failure escalation flow when job retries are exhausted (`retries >= maxRetries`).
   - Job recovery and requeue workflow: `dlq.recover(jobId)` -> reset retries -> `producer.enqueue(job)` -> successful execution.
   - Queue capacity overflow and backpressure handling when queue reaches `maxQueueSize`.
   - Batch job processing & filtering by failure reasons.

2. **Resilience Stack Hardening Suite (`src/resilience/__tests__/resilience-orchestration.test.ts`)**:
   - Integrated retry policies + circuit breaker state transitions under cascading failures.
   - Circuit breaker transition rules: `CLOSED` -> `OPEN` on error threshold -> `HALF-OPEN` after reset timeout -> `CLOSED` on success probe.
   - Rate limiter burst control and window resets.
   - Timeout cancellation and cleanup of dangling handles.

---

## 2. Component Design & New Test Cases

### 2.1 Queue Integration (`src/queue/__tests__/queue-resilience.integration.test.ts`)
- **Job Failure Escalation**: Enqueue jobs -> simulate failed execution loop -> verify job transitions to DLQ with `retriesExhausted: true` and full stack trace.
- **DLQ Job Re-drive**: Extract retryable records from DLQ (`getRetryableRecords`), re-enqueue into `Producer`, process job to completion, verify removal from DLQ.
- **Queue Overflow & Rejection**: Fill queue to `maxQueueSize` (e.g. 5 jobs), attempt 6th enqueue, verify `status: 'rejected'` with `Queue overflow` message.

### 2.2 Resilience Orchestration (`src/resilience/__tests__/resilience-orchestration.test.ts`)
- **Cascading Retry + Circuit Breaker**: Wrap failing Async function in `retry` inside `CircuitBreaker`. Verify retries execute first, then failure count opens the circuit breaker.
- **Circuit Breaker Probe Recovery**: Verify `HALF-OPEN` state permits single test call; success closes circuit breaker, failure re-opens circuit breaker immediately.
- **Rate Limiter Concurrency & Window Reset**: Verify tokens consume correctly and replenish after time window elapses.

---

## 3. Verification Plan

### Automated Tests
- Command: `npx jest src/queue/__tests__/ src/resilience/__tests__/ __tests__/queue-*.test.ts`
- Expected Result: 100% PASS rate.
