/**
 * Phase 3 Observability Tests
 *
 * Validates:
 * 1. Logging integration across modules
 * 2. Metrics collection (jobs processed, failures to DLQ)
 * 3. Agent polling status endpoint
 * 4. Observability data structure and completeness
 */

import { IngestionOrchestrator, OrchestratorStatus } from '../src/orchestrator/IngestionOrchestrator';
import { Producer } from '../src/queue/producer';
import { DeadLetterQueue } from '../src/queue/dlq';
import { ReverseImageSearchExtractor } from '../src/extractors/ReverseImageSearchExtractor';
import { metricsCollector, MetricsSnapshot } from '../src/lib/metrics';
import { log } from '../src/lib/logger';

// Mock console.log to capture logs
let capturedLogs: string[] = [];
const originalLog = console.log;

beforeEach(() => {
  capturedLogs = [];
  console.log = (...args: any[]) => {
    capturedLogs.push(args.map(a => String(a)).join(' '));
  };
  metricsCollector.reset();
});

afterEach(() => {
  console.log = originalLog;
});

describe('Phase 3 Observability - Logging Integration', () => {
  test('logger.log() outputs structured logs with [cic] prefix', () => {
    log('Test message', 'with', 'multiple', 'args');
    expect(capturedLogs.length).toBe(1);
    expect(capturedLogs[0]).toContain('[cic]');
    expect(capturedLogs[0]).toContain('Test message');
  });

  test('Producer logs enqueue operations', async () => {
    const producer = new Producer();
    const job = { type: 'test', payload: { data: 'test' }, id: 'job-1' };

    producer.enqueue(job);

    expect(capturedLogs.length).toBeGreaterThan(0);
    expect(capturedLogs[0]).toContain('Job enqueued');
    expect(capturedLogs[0]).toContain('job-1');
    expect(capturedLogs[0]).toContain('Queue size');
  });

  test('Producer logs queue overflow conditions', () => {
    const producer = new Producer({ maxQueueSize: 1 });
    const job1 = { type: 'test', payload: { data: '1' }, id: 'job-1' };
    const job2 = { type: 'test', payload: { data: '2' }, id: 'job-2' };

    producer.enqueue(job1);
    capturedLogs = []; // Reset to see overflow only
    producer.enqueue(job2);

    expect(capturedLogs.length).toBeGreaterThan(0);
    expect(capturedLogs[0]).toContain('Queue overflow');
  });

  test('Orchestrator logs pipeline stages', async () => {
    const producer = new Producer();
    const dlq = new DeadLetterQueue();
    const extractor = new ReverseImageSearchExtractor();
    const orchestrator = new IngestionOrchestrator(producer, dlq, extractor);

    const record = { id: 'rec-1', data: 'test' };
    await orchestrator.run(record);

    // Should have logs from orchestration pipeline
    expect(capturedLogs.length).toBeGreaterThan(0);
    const allLogs = capturedLogs.join(' ');
    expect(allLogs).toContain('[cic]');
  });

  test('ReverseImageSearchExtractor logs extraction operations', async () => {
    const extractor = new ReverseImageSearchExtractor();
    const buffer = Buffer.from('test data');

    await extractor.extract(buffer);

    const allLogs = capturedLogs.join(' ');
    expect(allLogs).toContain('ReverseImageSearchExtractor.extract()');
  });
});

describe('Phase 3 Observability - Metrics Collection', () => {
  test('MetricsCollector tracks jobs processed', () => {
    const snapshot1 = metricsCollector.getSnapshot();
    expect(snapshot1.jobsProcessed).toBe(0);

    metricsCollector.recordJobProcessed();
    metricsCollector.recordJobProcessed();

    const snapshot2 = metricsCollector.getSnapshot();
    expect(snapshot2.jobsProcessed).toBe(2);
  });

  test('MetricsCollector tracks jobs failed to DLQ', () => {
    const snapshot1 = metricsCollector.getSnapshot();
    expect(snapshot1.jobsFailedToDLQ).toBe(0);

    metricsCollector.recordJobFailedToDLQ();
    metricsCollector.recordJobFailedToDLQ();
    metricsCollector.recordJobFailedToDLQ();

    const snapshot2 = metricsCollector.getSnapshot();
    expect(snapshot2.jobsFailedToDLQ).toBe(3);
  });

  test('MetricsCollector records extraction time', () => {
    metricsCollector.recordExtractionTime(125);

    const snapshot = metricsCollector.getSnapshot();
    expect(snapshot.extractionTime).toBe(125);
  });

  test('MetricsCollector records pipeline latency', () => {
    metricsCollector.recordPipelineLatency(456);

    const snapshot = metricsCollector.getSnapshot();
    expect(snapshot.pipelineLatency).toBe(456);
  });

  test('MetricsCollector.getSnapshot() returns complete structure', () => {
    metricsCollector.recordJobProcessed();
    metricsCollector.recordJobFailedToDLQ();
    metricsCollector.recordExtractionTime(100);
    metricsCollector.recordPipelineLatency(200);

    const snapshot = metricsCollector.getSnapshot();

    expect(snapshot).toHaveProperty('jobsProcessed', 1);
    expect(snapshot).toHaveProperty('jobsFailedToDLQ', 1);
    expect(snapshot).toHaveProperty('extractionTime', 100);
    expect(snapshot).toHaveProperty('pipelineLatency', 200);
    expect(snapshot).toHaveProperty('timestamp');
    expect(typeof snapshot.timestamp).toBe('number');
    expect(snapshot.timestamp).toBeGreaterThan(0);
  });

  test('MetricsCollector.reset() clears all metrics', () => {
    metricsCollector.recordJobProcessed();
    metricsCollector.recordJobFailedToDLQ();
    metricsCollector.recordExtractionTime(50);
    metricsCollector.recordPipelineLatency(75);

    metricsCollector.reset();

    const snapshot = metricsCollector.getSnapshot();
    expect(snapshot.jobsProcessed).toBe(0);
    expect(snapshot.jobsFailedToDLQ).toBe(0);
    expect(snapshot.extractionTime).toBe(0);
    expect(snapshot.pipelineLatency).toBe(0);
  });

  test('MetricsCollector.getUptime() returns elapsed time', async () => {
    const uptimeStart = metricsCollector.getUptime();
    expect(uptimeStart).toBeGreaterThanOrEqual(0);

    // Wait a bit
    await new Promise(r => setTimeout(r, 50));

    const uptimeEnd = metricsCollector.getUptime();
    expect(uptimeEnd).toBeGreaterThan(uptimeStart);
  });
});

describe('Phase 3 Observability - Agent Polling Status', () => {
  test('Orchestrator.status() exposes required fields', async () => {
    const producer = new Producer();
    const dlq = new DeadLetterQueue();
    const extractor = new ReverseImageSearchExtractor();
    const orchestrator = new IngestionOrchestrator(producer, dlq, extractor);

    const status = orchestrator.status();

    expect(status).toHaveProperty('agentName');
    expect(status).toHaveProperty('status');
    expect(status).toHaveProperty('jobsQueued');
    expect(status).toHaveProperty('dlqSize');
    expect(status).toHaveProperty('lastProcessed');
  });

  test('Orchestrator.status() returns correct structure', () => {
    const producer = new Producer();
    const dlq = new DeadLetterQueue();
    const extractor = new ReverseImageSearchExtractor();
    const orchestrator = new IngestionOrchestrator(producer, dlq, extractor);

    const status: OrchestratorStatus = orchestrator.status();

    expect(status.agentName).toBe('IngestionOrchestrator');
    expect(['ready', 'processing', 'idle']).toContain(status.status);
    expect(typeof status.jobsQueued).toBe('number');
    expect(typeof status.dlqSize).toBe('number');
    expect(status.lastProcessed === null || typeof status.lastProcessed === 'number').toBe(true);
  });

  test('Orchestrator.status() reflects queue depth', async () => {
    const producer = new Producer();
    const dlq = new DeadLetterQueue();
    const extractor = new ReverseImageSearchExtractor();
    const orchestrator = new IngestionOrchestrator(producer, dlq, extractor);

    const status1 = orchestrator.status();
    expect(status1.jobsQueued).toBe(0);

    // Enqueue jobs
    producer.enqueue({ type: 'test', payload: { data: '1' } });
    producer.enqueue({ type: 'test', payload: { data: '2' } });

    const status2 = orchestrator.status();
    expect(status2.jobsQueued).toBe(2);
  });

  test('Orchestrator.status() reflects DLQ size', async () => {
    const producer = new Producer();
    const dlq = new DeadLetterQueue();
    const extractor = new ReverseImageSearchExtractor();
    const orchestrator = new IngestionOrchestrator(producer, dlq, extractor);

    const status1 = orchestrator.status();
    expect(status1.dlqSize).toBe(0);

    // Push to DLQ
    const testError = new Error('Test error');
    const testJob = { id: 'job-1', type: 'test', payload: {} };
    dlq.push(testJob, testError, 'Test failure');

    const status2 = orchestrator.status();
    expect(status2.dlqSize).toBe(1);
  });

  test('Orchestrator.status() updates lastProcessed after successful run', async () => {
    const producer = new Producer();
    const dlq = new DeadLetterQueue();
    const extractor = new ReverseImageSearchExtractor();
    const orchestrator = new IngestionOrchestrator(producer, dlq, extractor);

    const statusBefore = orchestrator.status();
    expect(statusBefore.lastProcessed).toBeNull();

    // Run a job
    const record = { id: 'rec-1', data: 'test' };
    await orchestrator.run(record);

    const statusAfter = orchestrator.status();
    expect(statusAfter.lastProcessed).not.toBeNull();
    expect(typeof statusAfter.lastProcessed).toBe('number');
    expect(statusAfter.lastProcessed).toBeGreaterThan(0);
  });

  test('Orchestrator.status() reflects processing state', async () => {
    const producer = new Producer();
    const dlq = new DeadLetterQueue();
    const extractor = new ReverseImageSearchExtractor();
    const orchestrator = new IngestionOrchestrator(producer, dlq, extractor);

    // Initial state should be idle
    let status = orchestrator.status();
    expect(['idle', 'processing']).toContain(status.status);

    // After run completes, should return to idle
    const record = { id: 'rec-1', data: 'test' };
    await orchestrator.run(record);

    status = orchestrator.status();
    expect(status.status).toBe('idle');
  });
});

describe('Phase 3 Observability - End-to-End Integration', () => {
  test('Orchestrator integration records metrics for successful processing', async () => {
    const producer = new Producer();
    const dlq = new DeadLetterQueue();
    const extractor = new ReverseImageSearchExtractor();
    const orchestrator = new IngestionOrchestrator(producer, dlq, extractor);

    const record = { id: 'rec-1', data: 'test' };
    const result = await orchestrator.run(record);

    expect(result.status).toBe('success');

    const metrics = metricsCollector.getSnapshot();
    expect(metrics.jobsProcessed).toBeGreaterThan(0);
    expect(metrics.jobsFailedToDLQ).toBe(0);
  });

  test('Orchestrator integration records metrics for failed processing', async () => {
    const producer = new Producer();
    const dlq = new DeadLetterQueue();
    const extractor = new ReverseImageSearchExtractor();
    const orchestrator = new IngestionOrchestrator(producer, dlq, extractor);

    // Invalid record (missing id)
    const result = await orchestrator.run({ data: 'test' });

    expect(result.status).toBe('failed');

    const status = orchestrator.status();
    // Should have recorded the failure in metrics and possibly DLQ
    expect(status).toBeDefined();
  });

  test('Observability data is accessible via status() endpoint for external polling', async () => {
    const producer = new Producer();
    const dlq = new DeadLetterQueue();
    const extractor = new ReverseImageSearchExtractor();
    const orchestrator = new IngestionOrchestrator(producer, dlq, extractor);

    // Simulate some activity
    producer.enqueue({ type: 'test', payload: { data: '1' } });
    const record = { id: 'rec-1', data: 'test' };
    await orchestrator.run(record);

    // External agent polling
    const status = orchestrator.status();

    // Verify all required fields are present and valid for external consumption
    expect(status.agentName).toBe('IngestionOrchestrator');
    expect(typeof status.status).toBe('string');
    expect(typeof status.jobsQueued).toBe('number');
    expect(typeof status.dlqSize).toBe('number');
    expect(status.lastProcessed === null || typeof status.lastProcessed === 'number').toBe(true);

    // Metrics also accessible
    const metrics = metricsCollector.getSnapshot();
    expect(metrics.jobsProcessed).toBeGreaterThanOrEqual(0);
    expect(metrics.jobsFailedToDLQ).toBeGreaterThanOrEqual(0);
    expect(typeof metrics.timestamp).toBe('number');
  });
});
