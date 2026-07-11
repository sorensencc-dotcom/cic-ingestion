import {
  IngestionOrchestrator,
  ProcessingResult,
  IngestionOrchestrationOptions,
} from "../IngestionOrchestrator";
import { Producer, Job, EnqueueResult } from "../../queue/producer";
import { DeadLetterQueue, FailedJobRecord, DLQResult } from "../../queue/dlq";
import { IExtractor } from "../../extractors/IExtractor";

/**
 * Mock Producer that tracks enqueue calls
 */
class MockProducer extends Producer {
  enqueuedJobs: Job[] = [];

  constructor() {
    super();
  }

  enqueue(job: Job): EnqueueResult {
    this.enqueuedJobs.push(job);
    const jobId = job.id || `job-${Date.now()}`;
    return { status: "queued", jobId, timestamp: Date.now() };
  }

  reset() {
    this.enqueuedJobs = [];
    this.clear();
  }
}

/**
 * Mock DeadLetterQueue that tracks push calls
 */
class MockDeadLetterQueue extends DeadLetterQueue {
  dlqJobs: { job: Job; error: Error }[] = [];

  constructor() {
    super();
  }

  push(job: Job, err: Error, failureReason?: string): DLQResult {
    this.dlqJobs.push({ job, error: err });
    return super.push(job, err, failureReason);
  }

  reset() {
    this.dlqJobs = [];
    this.clear();
  }
}

/**
 * Mock Extractor that can be configured for various scenarios
 */
class MockExtractor extends IExtractor {
  extractCount = 0;
  shouldFail = false;
  extractDelay = 0;
  failOnAttempt?: number;

  async extract(input: any): Promise<any> {
    this.extractCount++;

    if (this.extractDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.extractDelay));
    }

    if (this.shouldFail || (this.failOnAttempt && this.extractCount === this.failOnAttempt)) {
      throw new Error("Extractor failed intentionally");
    }

    return {
      extracted: true,
      data: input.data || "extracted",
      extractedAt: new Date().toISOString(),
    };
  }

  reset() {
    this.extractCount = 0;
    this.shouldFail = false;
    this.extractDelay = 0;
    this.failOnAttempt = undefined;
  }
}

describe("IngestionOrchestrator - Pipeline Tests", () => {
  let orchestrator: IngestionOrchestrator;
  let producer: MockProducer;
  let dlq: MockDeadLetterQueue;
  let extractor: MockExtractor;

  beforeEach(() => {
    producer = new MockProducer();
    dlq = new MockDeadLetterQueue();
    extractor = new MockExtractor();
    orchestrator = new IngestionOrchestrator(producer, dlq, extractor, {
      timeout: 10000,
      maxRetries: 2,
      retryDelayMs: 50,
    });
  });

  afterEach(async () => {
    try {
      await orchestrator.waitForCompletion(5000);
    } catch (e) {
      // Timeout acceptable
    }
  });

  describe("T1: Full Pipeline Success Flow", () => {
    it("should orchestrate record through validate → extract → store → confirm", async () => {
      const record = { id: "test-1", data: "input-data" };

      const result = await orchestrator.run(record);
      await orchestrator.waitForCompletion(5000);

      expect(result.status).toBe("success");
      expect(result.recordId).toBe("test-1");
      expect(result.stage).toBe("confirm");
      expect(result.data).toBeDefined();
      expect(result.error).toBeUndefined();
      expect(result.timestamp).toBeGreaterThan(0);

      expect(producer.enqueuedJobs.length).toBe(1);
      expect(producer.enqueuedJobs[0].id).toBe("test-1");
      expect(dlq.dlqJobs.length).toBe(0);
      expect(extractor.extractCount).toBe(1);
    });

    it("should confirm record with timestamp and queued markers", async () => {
      const record = { id: "test-2", data: "confirm-test" };

      const result = await orchestrator.run(record);
      await orchestrator.waitForCompletion(5000);

      expect(result.data.confirmed).toBe(true);
      expect(result.data.confirmedAt).toBeDefined();
      expect(result.data.queued).toBeDefined();
      expect(result.data.queued.status).toBe("queued");
      expect(result.data.extracted).toBeDefined();
      expect(result.data.extracted.extracted).toBe(true);
    });
  });

  describe("T2: Error → DLQ Routing", () => {
    it("should route extraction errors to DLQ", async () => {
      extractor.shouldFail = true;
      const record = { id: "dlq-test-1", data: "will-fail" };

      const result = await orchestrator.run(record);
      await orchestrator.waitForCompletion(5000);

      expect(result.status).toBe("dlq");
      expect(result.stage).toBe("error-handler");
      expect(result.error).toContain("Extractor failed");
      expect(result.recordId).toBe("dlq-test-1");

      expect(dlq.dlqJobs.length).toBe(1);
      expect(dlq.dlqJobs[0].job.id).toBe("dlq-test-1");
      expect(dlq.dlqJobs[0].error.message).toContain("Extractor failed");
      expect(producer.enqueuedJobs.length).toBe(0);
    });

    it("should handle invalid records (missing id)", async () => {
      const record = { data: "no-id" };

      const result = await orchestrator.run(record);

      expect(result.status).toBe("failed");
      expect(result.stage).toBe("validate");
      expect(result.error).toContain("Record must have an id field");
      expect(result.recordId).toBe("unknown");

      expect(producer.enqueuedJobs.length).toBe(0);
      expect(dlq.dlqJobs.length).toBe(0);
    });

    it("should handle null/undefined records gracefully", async () => {
      const result = await orchestrator.run(null);

      expect(result.status).toBe("failed");
      expect(result.stage).toBe("validate");
      expect(result.error).toContain("Record must have an id field");
    });
  });

  describe("T3: Stage Progression & Order", () => {
    it("should process stages in correct order", async () => {
      const stageOrder: string[] = [];
      const originalExtract = extractor.extract.bind(extractor);

      extractor.extract = async (input: any) => {
        stageOrder.push("extract");
        return await originalExtract(input);
      };

      const record = { id: "stage-order-1" };

      const result = await orchestrator.run(record);
      await orchestrator.waitForCompletion(5000);

      expect(result.stage).toBe("confirm");
      expect(stageOrder).toContain("extract");
    });

    it("should not proceed past validation if record is invalid", async () => {
      const record = { id: "", data: "empty-id" };

      const result = await orchestrator.run(record);

      expect(extractor.extractCount).toBe(0);
      expect(producer.enqueuedJobs.length).toBe(0);
    });

    it("should stop pipeline on extraction failure and route to DLQ", async () => {
      extractor.shouldFail = true;
      const record = { id: "stop-pipeline-1" };

      const result = await orchestrator.run(record);
      await orchestrator.waitForCompletion(5000);

      expect(result.status).toBe("dlq");
      expect(result.data.confirmed).toBeUndefined();
      expect(dlq.dlqJobs.length).toBe(1);
    });
  });

  describe("T4: Concurrent Record Processing", () => {
    it("should handle multiple records concurrently without blocking", async () => {
      const records = [
        { id: "concurrent-1", data: "data-1" },
        { id: "concurrent-2", data: "data-2" },
        { id: "concurrent-3", data: "data-3" },
      ];

      const startTime = Date.now();
      const promises = records.map((r) => orchestrator.run(r));
      const results = await Promise.all(promises);
      const elapsed = Date.now() - startTime;

      results.forEach((result) => {
        expect(result.status).toBe("success");
      });

      expect(producer.enqueuedJobs.length).toBe(3);
      expect(extractor.extractCount).toBe(3);
      expect(elapsed).toBeLessThan(5000);
    });

    it("should handle mix of successful and failed records concurrently", async () => {
      // Create extractors that fail only for specific IDs
      const originalExtract = extractor.extract.bind(extractor);
      extractor.extract = async (input: any) => {
        if (input.id === "mixed-2") {
          throw new Error("Intentional failure for mixed-2");
        }
        return await originalExtract(input);
      };

      const records = [
        { id: "mixed-1", data: "succeed" },
        { id: "mixed-2", data: "fail" },
        { id: "mixed-3", data: "succeed" },
      ];

      const promises = records.map((r) => orchestrator.run(r));
      const results = await Promise.all(promises);
      await orchestrator.waitForCompletion(5000);

      const successful = results.filter((r) => r.status === "success");
      const failed = results.filter((r) => r.status === "dlq");

      expect(successful.length).toBe(2);
      expect(failed.length).toBe(1);
      expect(failed[0].recordId).toBe("mixed-2");
    });

    it("should maintain independent processing across concurrent executions", async () => {
      const records = Array.from({ length: 10 }, (_, i) => ({
        id: `concurrent-${i}`,
        data: `data-${i}`,
      }));

      const results = await Promise.all(records.map((r) => orchestrator.run(r)));

      results.forEach((result, idx) => {
        expect(result.recordId).toBe(`concurrent-${idx}`);
        expect(result.status).toBe("success");
      });
    });
  });

  describe("T5: Idempotency & Retry Logic", () => {
    it("should process same record only once (idempotency)", async () => {
      const record = { id: "idempotent-1", data: "test" };

      const result1 = await orchestrator.run(record);
      await orchestrator.waitForCompletion(5000);

      const enqueuedBefore = producer.enqueuedJobs.length;
      const extractedBefore = extractor.extractCount;

      const result2 = await orchestrator.run(record);

      expect(result2).toEqual(result1);
      expect(producer.enqueuedJobs.length).toBe(enqueuedBefore);
      expect(extractor.extractCount).toBe(extractedBefore);
    });

    it("should retry on transient failures and succeed on retry", async () => {
      let attemptCount = 0;
      const originalExtract = extractor.extract.bind(extractor);
      extractor.extract = async (input: any) => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error("Transient failure");
        }
        return await originalExtract(input);
      };

      const record = { id: "retry-1", data: "transient-test" };

      const result = await orchestrator.run(record);
      await orchestrator.waitForCompletion(5000);

      expect(result.status).toBe("success");
      expect(attemptCount).toBeGreaterThan(1);
      expect(attemptCount).toBeLessThanOrEqual(3);
    });

    it("should respect maxRetries limit and DLQ after exhausting retries", async () => {
      extractor.shouldFail = true;
      const opts: IngestionOrchestrationOptions = {
        timeout: 10000,
        maxRetries: 1,
        retryDelayMs: 10,
      };
      const strictOrchestrator = new IngestionOrchestrator(
        producer,
        dlq,
        extractor,
        opts
      );

      const record = { id: "retry-limit-1" };

      const result = await strictOrchestrator.run(record);
      await strictOrchestrator.waitForCompletion(5000);

      expect(result.status).toBe("dlq");
      expect(extractor.extractCount).toBe(2);
    });
  });

  describe("T6: Timeout & Error Propagation", () => {
    it("should timeout if processing exceeds timeout limit", async () => {
      extractor.extractDelay = 15000;
      const tightOrchestrator = new IngestionOrchestrator(producer, dlq, extractor, {
        timeout: 100,
        maxRetries: 0,
        retryDelayMs: 10,
      });

      const record = { id: "timeout-1" };

      const result = await tightOrchestrator.run(record);
      await tightOrchestrator.waitForCompletion(5000);

      expect(result.status).toBe("dlq");
      expect(result.error).toContain("Timeout");
    });

    it("should propagate extraction errors with context", async () => {
      extractor.extract = async () => {
        throw new Error("Custom extraction error: database unavailable");
      };

      const record = { id: "error-context-1" };

      const result = await orchestrator.run(record);
      await orchestrator.waitForCompletion(5000);

      expect(result.status).toBe("dlq");
      expect(result.error).toContain("database unavailable");
      expect(dlq.dlqJobs[0].error.message).toContain("database unavailable");
    });
  });

  describe("T7: Processing History & State Management", () => {
    it("should track processing history for successful records", async () => {
      const records = [
        { id: "history-1", data: "test1" },
        { id: "history-2", data: "test2" },
      ];

      await Promise.all(records.map((r) => orchestrator.run(r)));
      await orchestrator.waitForCompletion(5000);

      const history = orchestrator.getProcessingHistory();

      expect(history.size).toBe(2);
      expect(history.has("history-1")).toBe(true);
      expect(history.has("history-2")).toBe(true);
      expect(history.get("history-1")?.status).toBe("success");
    });

    it("should include failed records in history", async () => {
      extractor.shouldFail = true;

      const record = { id: "history-fail-1" };
      await orchestrator.run(record);
      await orchestrator.waitForCompletion(5000);

      const history = orchestrator.getProcessingHistory();

      expect(history.has("history-fail-1")).toBe(true);
      expect(history.get("history-fail-1")?.status).toBe("dlq");
    });

    it("should clear processing history on demand", async () => {
      const record = { id: "clear-1" };
      await orchestrator.run(record);

      let history = orchestrator.getProcessingHistory();
      expect(history.size).toBe(1);

      orchestrator.clearProcessingHistory();

      history = orchestrator.getProcessingHistory();
      expect(history.size).toBe(0);

      await orchestrator.run(record);
      await orchestrator.waitForCompletion(5000);

      history = orchestrator.getProcessingHistory();
      expect(history.size).toBe(1);
    });
  });

  describe("T8: Memory & Promise Cleanup", () => {
    it("should clean up promises after completion", async () => {
      const records = Array.from({ length: 100 }, (_, i) => ({
        id: `cleanup-${i}`,
        data: `data-${i}`,
      }));

      const results = await Promise.all(records.map((r) => orchestrator.run(r)));
      await orchestrator.waitForCompletion(10000);

      results.forEach((r) => {
        expect(r.status).toBe("success");
      });

      expect(producer.enqueuedJobs.length).toBe(100);
    });

    it("should not hang on rapid successive calls", async () => {
      const rapid = Array.from({ length: 50 }, (_, i) => ({
        id: `rapid-${i}`,
      }));

      const promises = rapid.map((r) => orchestrator.run(r));

      const startWait = Date.now();
      const results = await Promise.all(promises);
      await orchestrator.waitForCompletion(5000);
      const elapsed = Date.now() - startWait;

      expect(results.every((r) => r.status === "success")).toBe(true);
      expect(elapsed).toBeLessThan(10000);
    });
  });
});
