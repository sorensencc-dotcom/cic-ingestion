# Queue & Resilience Extended Testing Implementation Plan (Step 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create end-to-end integration tests between `Producer` and `DeadLetterQueue` (`src/queue/__tests__/queue-resilience.integration.test.ts`) and create resilience stack orchestration tests (`src/resilience/__tests__/resilience-orchestration.test.ts`) in `cic-ingestion`.

**Architecture:** Use Jest and ts-jest to verify Producer-to-DLQ job failure escalation, job re-drive workflows, queue overflow backpressure, and combined Retry + CircuitBreaker + RateLimiter state machine rules.

**Tech Stack:** TypeScript, Jest, ts-jest, Node.js `crypto`.

## Global Constraints
- Target directory: `c:/dev/cic-ingestion/`
- Test Framework: Jest with ts-jest (`npx jest`)
- Style: Strict TypeScript, TDD flow

---

### Task 1: Queue Integration & Re-drive Test Suite

**Files:**
- Create: `src/queue/__tests__/queue-resilience.integration.test.ts`
- Consumes: `Producer` from `src/queue/producer.ts` & `DeadLetterQueue` from `src/queue/dlq.ts`

- [ ] **Step 1: Write integration tests for Producer + DLQ**

Write `src/queue/__tests__/queue-resilience.integration.test.ts`:
```typescript
import { Producer, Job } from '../producer';
import { DeadLetterQueue } from '../dlq';

describe('Producer + DLQ Integration Suite', () => {
  let producer: Producer;
  let dlq: DeadLetterQueue;

  beforeEach(() => {
    producer = new Producer({ maxQueueSize: 5 });
    dlq = new DeadLetterQueue(100);
  });

  it('escalates job to DLQ when max retries are reached', () => {
    const job: Job = {
      id: 'job-escalate-1',
      type: 'ingest-document',
      payload: { documentId: 'doc-456' },
      retries: 2,
      maxRetries: 3,
    };

    producer.enqueue(job);
    const dequeued = producer.dequeue();
    expect(dequeued).not.toBeNull();

    // Simulate failed processing
    dequeued!.retries = (dequeued!.retries || 0) + 1;
    const error = new Error('Upstream timeout');
    const dlqResult = dlq.push(dequeued!, error, 'TIMEOUT');

    expect(dlqResult.status).toBe('stored');
    const dlqRecord = dlq.getRecord('job-escalate-1');
    expect(dlqRecord?.retriesExhausted).toBe(true);
    expect(dlqRecord?.failureReason).toBe('TIMEOUT');
  });

  it('re-drives failed job from DLQ back into Producer queue', () => {
    const job: Job = {
      id: 'job-redrive-1',
      type: 'process-pdf',
      payload: { url: 'https://example.com/file.pdf' },
      retries: 1,
      maxRetries: 3,
    };

    const error = new Error('Transient DB glitch');
    dlq.push(job, error, 'DB_TRANSIENT');

    // Re-drive flow
    const retryable = dlq.getRetryableRecords();
    expect(retryable).toHaveLength(1);

    const recovered = dlq.recover('job-redrive-1');
    expect(recovered).not.toBeNull();

    // Re-enqueue into Producer
    const reEnqueuedJob: Job = {
      ...recovered!.originalJob,
      retries: 0, // Reset retry count for new attempt
    };

    const enqueueResult = producer.enqueue(reEnqueuedJob);
    expect(enqueueResult.status).toBe('queued');
    expect(producer.getQueueSize()).toBe(1);
    expect(dlq.getSize()).toBe(0);
  });

  it('rejects enqueuing when Producer maxQueueSize is reached and handles backpressure', () => {
    for (let i = 1; i <= 5; i++) {
      const res = producer.enqueue({ id: `job-${i}`, type: 'work', payload: {} });
      expect(res.status).toBe('queued');
    }

    const overflowRes = producer.enqueue({ id: 'job-overflow', type: 'work', payload: {} });
    expect(overflowRes.status).toBe('rejected');
    expect(overflowRes.message).toContain('Queue overflow');
    expect(producer.getQueueSize()).toBe(5);
  });
});
```

- [ ] **Step 2: Run test suite to verify**

Run: `npx jest src/queue/__tests__/queue-resilience.integration.test.ts`  
Expected: PASS

- [ ] **Step 3: Commit Task 1**

```bash
git add src/queue/__tests__/queue-resilience.integration.test.ts
git commit -m "test(queue): add Producer and DLQ end-to-end integration test suite"
```

---

### Task 2: Resilience Stack Orchestration Test Suite

**Files:**
- Create: `src/resilience/__tests__/resilience-orchestration.test.ts`
- Consumes: `retry` from `src/resilience/retry.ts`, `CircuitBreaker` from `src/resilience/circuitBreaker.ts`, `RateLimiter` from `src/resilience/rateLimiter.ts`

- [ ] **Step 1: Write resilience stack orchestration tests**

Write `src/resilience/__tests__/resilience-orchestration.test.ts`:
```typescript
import { retry } from '../retry';
import { CircuitBreaker } from '../circuitBreaker';
import { RateLimiter } from '../rateLimiter';

describe('Resilience Stack Orchestration', () => {
  it('combines retry with circuit breaker on intermittent failures', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeout: 1000 });
    let attempts = 0;

    const fragileOperation = async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Temporary glitch');
      }
      return 'SUCCESS';
    };

    const result = await cb.execute(() => retry(fragileOperation, { retries: 3, minTimeout: 10 }));
    expect(result).toBe('SUCCESS');
    expect(attempts).toBe(3);
    expect(cb.getState()).toBe('CLOSED');
  });

  it('opens circuit breaker when failure threshold is exceeded', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeout: 1000 });

    const failingOp = async () => {
      throw new Error('Hard failure');
    };

    await expect(cb.execute(failingOp)).rejects.toThrow('Hard failure');
    await expect(cb.execute(failingOp)).rejects.toThrow('Hard failure');

    expect(cb.getState()).toBe('OPEN');
    await expect(cb.execute(failingOp)).rejects.toThrow(/circuit breaker is open/i);
  });

  it('enforces rate limiter tokens and replenishes after interval', async () => {
    const limiter = new RateLimiter({ tokensPerInterval: 2, interval: 100 });

    expect(limiter.tryRemoveTokens(1)).toBe(true);
    expect(limiter.tryRemoveTokens(1)).toBe(true);
    expect(limiter.tryRemoveTokens(1)).toBe(false); // Depleted

    await new Promise((r) => setTimeout(r, 120));
    expect(limiter.tryRemoveTokens(1)).toBe(true); // Replenished
  });
});
```

- [ ] **Step 2: Run test suite to verify**

Run: `npx jest src/resilience/__tests__/resilience-orchestration.test.ts`  
Expected: PASS

- [ ] **Step 3: Commit Task 2**

```bash
git add src/resilience/__tests__/resilience-orchestration.test.ts
git commit -m "test(resilience): add resilience orchestration tests for retry, circuitBreaker, and rateLimiter"
```
