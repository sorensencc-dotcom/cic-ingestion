import { Producer } from "../queue/producer";
import { DeadLetterQueue } from "../queue/dlq";
import { IExtractor } from "../extractors/IExtractor";
import { log } from "../lib/logger";
import { metricsCollector } from "../lib/metrics";
import { ProposalCreation, AuditRecord } from "../governance/proposal-creation";

export interface PipelineStage {
  name: string;
  validate: (record: any) => Promise<boolean>;
  process: (record: any) => Promise<any>;
}

export interface ProcessingResult {
  recordId: string;
  status: "success" | "failed" | "dlq";
  stage: string;
  data?: any;
  error?: string;
  timestamp: number;
}

export interface IngestionOrchestrationOptions {
  timeout?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

export interface OrchestratorStatus {
  agentName: string;
  status: 'ready' | 'processing' | 'idle';
  jobsQueued: number;
  dlqSize: number;
  lastProcessed: number | null;
}

/**
 * IngestionOrchestrator: 4-stage pipeline (validate → extract → store → confirm)
 * Routes records through producer queue, handles errors to DLQ, ensures idempotency.
 */
export class IngestionOrchestrator {
  private producer: Producer;
  private dlq: DeadLetterQueue;
  private extractor: IExtractor;
  private opts: IngestionOrchestrationOptions;
  private activePromises: Set<Promise<any>>;
  private processedRecords: Map<string, ProcessingResult>;
  private lastProcessedTime: number | null = null;
  private proposalCreation: ProposalCreation;

  constructor(
    producer: Producer,
    dlq: DeadLetterQueue,
    extractor: IExtractor,
    opts: IngestionOrchestrationOptions = {}
  ) {
    this.producer = producer;
    this.dlq = dlq;
    this.extractor = extractor;
    this.proposalCreation = new ProposalCreation();
    this.opts = {
      timeout: opts.timeout ?? 30000,
      maxRetries: opts.maxRetries ?? 3,
      retryDelayMs: opts.retryDelayMs ?? 1000,
    };
    this.activePromises = new Set();
    this.processedRecords = new Map();
  }

  /**
   * Main entry point: orchestrates record through full pipeline.
   * Returns immediately, tracking promise internally.
   */
  async run(record: any): Promise<ProcessingResult> {
    if (!record || !record.id) {
      const error = "Record must have an id field";
      log("error: run() invalid record", error);
      return {
        recordId: record?.id ?? "unknown",
        status: "failed" as const,
        stage: "validate",
        error,
        timestamp: Date.now(),
      };
    }

    // Check idempotency: skip if already processed
    if (this.processedRecords.has(record.id)) {
      log(`info: run() record ${record.id} already processed`);
      return this.processedRecords.get(record.id)!;
    }

    const promise: Promise<ProcessingResult> = this._orchestratePipeline(record).catch((err): ProcessingResult => {
      log("error: run() unhandled error", err.message);
      return {
        recordId: record.id,
        status: "failed" as const,
        stage: "unknown",
        error: err.message,
        timestamp: Date.now(),
      };
    });

    this.activePromises.add(promise);
    promise.finally(() => this.activePromises.delete(promise));

    return promise;
  }

  /**
   * Main orchestration pipeline: validate → extract → store → confirm
   */
  private async _orchestratePipeline(record: any): Promise<ProcessingResult> {
    const recordId = record.id;
    log(`info: _orchestratePipeline() starting for ${recordId}`);

    try {
      // Stage 1: Validate
      const validated = await this.processStage(record, "validate", async (r) => {
        const isValid = await this._validateRecord(r);
        if (!isValid) throw new Error("Validation failed");
        return r;
      });

      // Stage 2: Extract
      const extracted = await this.processStage(validated, "extract", async (r) => {
        return await this._extractRecord(r);
      });

      // Stage 3: Store (enqueue to producer)
      const stored = await this.processStage(extracted, "store", async (r) => {
        return await this._storeRecord(r);
      });

      // Stage 4: Confirm
      const confirmed = await this.processStage(stored, "confirm", async (r) => {
        return await this._confirmRecord(r);
      });

      // Stage 5: Create proposal for governance pipeline (Phase 4 integration point)
      // Extract audit record metadata and create proposal for governance review
      const auditRecord: AuditRecord = {
        profile: record.profile || 'filesystem',
        lane: record.lane || 'fast',
        orchestration_cost: record.orchestration_cost || 0,
        entry_id: recordId,
        created_at: new Date().toISOString(),
      };

      const proposal = this.proposalCreation.fromAuditRecord(auditRecord);
      log(`info: _orchestratePipeline() created proposal ${proposal.proposal_id} for entry ${recordId}`);

      const result: ProcessingResult = {
        recordId,
        status: "success",
        stage: "confirm",
        data: {
          ...confirmed,
          proposal_id: proposal.proposal_id,
          source_entry_id: proposal.source_entry_id,
        },
        timestamp: Date.now(),
      };

      this.processedRecords.set(recordId, result);
      metricsCollector.recordJobProcessed();
      this.lastProcessedTime = Date.now();
      log(`info: _orchestratePipeline() success for ${recordId}`);
      return result;
    } catch (err) {
      return await this.handleError(record, err as Error);
    }
  }

  /**
   * Process a single stage: validate input, execute, timeout protection, retry logic.
   */
  async processStage(
    record: any,
    stageName: string,
    processor: (record: any) => Promise<any>
  ): Promise<any> {
    let lastErr: Error | null = null;

    for (let attempt = 0; attempt <= this.opts.maxRetries!; attempt++) {
      try {
        log(`info: processStage() ${stageName} attempt ${attempt + 1} for ${record.id}`);

        const result = await Promise.race([
          processor(record),
          this._timeoutPromise(this.opts.timeout!),
        ]);

        log(`info: processStage() ${stageName} success for ${record.id}`);
        return result;
      } catch (err) {
        lastErr = err as Error;

        if (attempt < this.opts.maxRetries!) {
          log(
            `warn: processStage() ${stageName} attempt ${attempt + 1} failed, retrying...`
          );
          await this._delay(this.opts.retryDelayMs! * Math.pow(2, attempt));
        } else {
          log(
            `error: processStage() ${stageName} failed after ${this.opts.maxRetries! + 1} attempts`
          );
          throw err;
        }
      }
    }

    throw lastErr || new Error(`Stage ${stageName} failed`);
  }

  /**
   * Handle errors: route to DLQ, return failed result.
   */
  async handleError(record: any, error: Error): Promise<ProcessingResult> {
    const recordId = record?.id ?? "unknown";
    log(`error: handleError() routing to DLQ for ${recordId}`, error.message);

    metricsCollector.recordJobFailedToDLQ();

    try {
      const dlqResult = this.dlq.push(record, error, error.message);
      log(`info: handleError() job ${recordId} stored in DLQ with recordId ${dlqResult.recordId}`);

      const result: ProcessingResult = {
        recordId,
        status: "dlq",
        stage: "error-handler",
        error: error.message,
        data: { dlqResult },
        timestamp: Date.now(),
      };

      this.processedRecords.set(recordId, result);
      return result;
    } catch (dlqErr) {
      log("error: handleError() DLQ push failed", (dlqErr as Error).message);

      const result: ProcessingResult = {
        recordId,
        status: "failed",
        stage: "error-handler",
        error: `Original error: ${error.message}; DLQ push failed: ${(dlqErr as Error).message}`,
        timestamp: Date.now(),
      };

      this.processedRecords.set(recordId, result);
      return result;
    }
  }

  /**
   * Wait for all active promises to complete. Timeout if exceeds limit.
   */
  async waitForCompletion(timeoutMs: number = 60000): Promise<void> {
    if (this.activePromises.size === 0) return;

    log(`info: waitForCompletion() waiting for ${this.activePromises.size} promises`);

    try {
      await Promise.race([
        Promise.all(Array.from(this.activePromises)),
        this._timeoutPromise(timeoutMs),
      ]);
      log("info: waitForCompletion() all promises settled");
    } catch (err) {
      log("warn: waitForCompletion() timeout exceeded", (err as Error).message);
      throw err;
    }
  }

  // === Private stage implementations ===

  private async _validateRecord(record: any): Promise<boolean> {
    if (!record.id || typeof record.id !== "string") return false;
    return true;
  }

  private async _extractRecord(record: any): Promise<any> {
    const extracted = await this.extractor.extract(record);
    return { ...record, extracted };
  }

  private async _storeRecord(record: any): Promise<any> {
    const queueResult = await this.producer.enqueue(record);
    return { ...record, queued: queueResult };
  }

  private async _confirmRecord(record: any): Promise<any> {
    // Mark as confirmed
    return { ...record, confirmed: true, confirmedAt: new Date().toISOString() };
  }

  // === Utility methods ===

  private _timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    );
  }

  private _delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get processing history (for testing/debugging).
   */
  getProcessingHistory(): Map<string, ProcessingResult> {
    return new Map(this.processedRecords);
  }

  /**
   * Clear processing history (useful for test isolation).
   */
  clearProcessingHistory(): void {
    this.processedRecords.clear();
  }

  /**
   * Expose orchestrator status for external agent polling.
   * Returns: {agentName, status, jobsQueued, dlqSize, lastProcessed}
   */
  status(): OrchestratorStatus {
    return {
      agentName: 'IngestionOrchestrator',
      status: this.activePromises.size > 0 ? 'processing' : 'idle',
      jobsQueued: this.producer.getQueueSize(),
      dlqSize: this.dlq.getSize(),
      lastProcessed: this.lastProcessedTime,
    };
  }
}
