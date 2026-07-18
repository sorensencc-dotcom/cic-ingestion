import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { IngestionOrchestrator } from '../../src/orchestrator/IngestionOrchestrator';
import { Producer } from '../../src/queue/producer';
import { DeadLetterQueue } from '../../src/queue/dlq';
import { IExtractor } from '../../src/extractors/IExtractor';

class MockExtractor extends IExtractor {
  async extract(input: any) {
    if (input.failExtract) {
      throw new Error('extraction failed');
    }
    return { extracted: true, data: input };
  }
}

describe('IngestionOrchestrator Unit Tests', () => {
  let producer: Producer;
  let dlq: DeadLetterQueue;
  let extractor: IExtractor;

  beforeEach(() => {
    jest.useFakeTimers();
    producer = new Producer();
    dlq = new DeadLetterQueue();
    extractor = new MockExtractor();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('successfully processes record with full pipeline', async () => {
    const o = new IngestionOrchestrator(producer, dlq, extractor);
    const out = await o.run({ id: '1', profile: 'filesystem', lane: 'fast', orchestration_cost: 0.01 });

    expect(out.status).toBe('success');
    expect(out.recordId).toBe('1');
    expect(out.data.proposal_id).toBeDefined();
  });

  it('rejects record immediately if missing id', async () => {
    const o = new IngestionOrchestrator(producer, dlq, extractor);
    const out = await o.run({ no_id: true } as any);

    expect(out.status).toBe('failed');
    expect(out.stage).toBe('validate');
    expect(out.error).toBe('Record must have an id field');
  });

  it('respects idempotency and skips already processed record', async () => {
    const o = new IngestionOrchestrator(producer, dlq, extractor);
    const firstResult = await o.run({ id: '1' });
    const secondResult = await o.run({ id: '1' });

    expect(firstResult).toBe(secondResult);
  });

  it('routes to DLQ when extractor fails', async () => {
    const o = new IngestionOrchestrator(producer, dlq, extractor, { maxRetries: 0 });
    const out = await o.run({ id: '2', failExtract: true });

    expect(out.status).toBe('dlq');
    expect(out.error).toBe('extraction failed');
    expect(dlq.getSize()).toBe(1);
  });

  it('falls back to failed state if DLQ push itself fails', async () => {
    const brokenDlq = new DeadLetterQueue();
    jest.spyOn(brokenDlq, 'push').mockImplementation(() => {
      throw new Error('DLQ disk full');
    });

    const o = new IngestionOrchestrator(producer, brokenDlq, extractor, { maxRetries: 0 });
    const out = await o.run({ id: '3', failExtract: true });

    expect(out.status).toBe('failed');
    expect(out.error).toContain('DLQ push failed: DLQ disk full');
  });

  it('retries on temporary stage failures', async () => {
    let callCount = 0;
    const flakeExtractor = new (class extends IExtractor {
      async extract(input: any) {
        callCount++;
        if (callCount < 2) {
          throw new Error('temp fail');
        }
        return { extracted: true };
      }
    })();

    const o = new IngestionOrchestrator(producer, dlq, flakeExtractor, {
      maxRetries: 2,
      retryDelayMs: 100,
    });

    const runPromise = o.run({ id: '4' });

    // Advance timer past first retry delay (100ms)
    await jest.advanceTimersByTimeAsync(100);

    const out = await runPromise;
    expect(out.status).toBe('success');
    expect(callCount).toBe(2); // Retried once and succeeded
  });

  it('fails stage immediately on timeout', async () => {
    const slowExtractor = new (class extends IExtractor {
      async extract(input: any) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return { extracted: true };
      }
    })();

    const o = new IngestionOrchestrator(producer, dlq, slowExtractor, {
      timeout: 1000,
      maxRetries: 0,
    });

    const runPromise = o.run({ id: '5' });

    // Force timeout to trigger
    await jest.advanceTimersByTimeAsync(1000);

    const out = await runPromise;
    expect(out.status).toBe('dlq');
    expect(out.error).toBe('Timeout after 1000ms');
  });
});
