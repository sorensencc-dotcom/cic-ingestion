import { describe, it, expect, beforeEach } from '@jest/globals';
import { IngestionOrchestrator } from '../../src/orchestrator/IngestionOrchestrator';
import { Producer } from '../../src/queue/producer';
import { DeadLetterQueue } from '../../src/queue/dlq';
import { IExtractor } from '../../src/extractors/IExtractor';

class E2EExtractor extends IExtractor {
  async extract(input: any) {
    if (input.type === 'invalid') {
      throw new Error('extractor_unsupported_type');
    }
    return {
      extractedAt: Date.now(),
      normalizedData: {
        rawId: input.id,
        category: input.category || 'general',
      },
    };
  }
}

describe('Phase 2 E2E Ingestion Pipeline', () => {
  let producer: Producer;
  let dlq: DeadLetterQueue;
  let extractor: IExtractor;
  let orchestrator: IngestionOrchestrator;

  beforeEach(() => {
    producer = new Producer();
    dlq = new DeadLetterQueue();
    extractor = new E2EExtractor();
    orchestrator = new IngestionOrchestrator(producer, dlq, extractor, {
      maxRetries: 1,
      retryDelayMs: 50,
      timeout: 2000,
    });
  });

  it('runs multiple records through the pipeline and verifies outcomes', async () => {
    // 1. Submit a valid record
    const r1 = {
      id: 'doc-001',
      category: 'resilience',
      profile: 'kubernetes',
      lane: 'critical',
      orchestration_cost: 0.05,
    };

    const out1 = await orchestrator.run(r1);
    expect(out1.status).toBe('success');
    expect(out1.recordId).toBe('doc-001');
    expect(out1.data.proposal_id).toBeDefined();
    expect(out1.data.confirmed).toBe(true);

    // 2. Submit a duplicate record (idempotency check)
    const out1Duplicate = await orchestrator.run(r1);
    expect(out1Duplicate).toBe(out1);

    // 3. Submit an invalid record (no ID)
    const r2 = { category: 'unknown' };
    const out2 = await orchestrator.run(r2 as any);
    expect(out2.status).toBe('failed');
    expect(out2.stage).toBe('validate');

    // 4. Submit a record that fails extraction (DLQ check)
    const r3 = {
      id: 'doc-002',
      type: 'invalid',
    };
    const out3 = await orchestrator.run(r3);
    expect(out3.status).toBe('dlq');
    expect(out3.error).toBe('extractor_unsupported_type');

    // 5. Verify system statuses
    const status = orchestrator.status();
    expect(status.jobsQueued).toBe(1); // Only doc-001 is enqueued
    expect(status.dlqSize).toBe(1);    // Only doc-002 is in DLQ
    expect(status.status).toBe('idle');
  });
});
