import { Job } from './producer';

export interface FailedJobRecord {
  jobId: string;
  originalJob: Job;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  failureReason: string;
  timestamp: number;
  retriesExhausted: boolean;
  lastRetryTime?: number;
}

export interface DLQResult {
  status: 'stored';
  recordId: string;
  timestamp: number;
}

export class DeadLetterQueue {
  private deadLetterQueue: FailedJobRecord[] = [];
  private maxDLQSize: number;

  constructor(maxDLQSize: number = 5000) {
    this.maxDLQSize = maxDLQSize;
  }

  /**
   * Push a failed job to the DLQ with error details
   */
  push(job: Job, error: Error, failureReason: string = 'Unknown error'): DLQResult {
    const timestamp = Date.now();

    const record: FailedJobRecord = {
      jobId: job.id || 'unknown',
      originalJob: job,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      failureReason,
      timestamp,
      retriesExhausted: (job.retries || 0) >= (job.maxRetries || 3),
      lastRetryTime: timestamp,
    };

    // Maintain max size by removing oldest records if necessary
    if (this.deadLetterQueue.length >= this.maxDLQSize) {
      this.deadLetterQueue.shift();
    }

    this.deadLetterQueue.push(record);

    return {
      status: 'stored',
      recordId: job.id || 'unknown',
      timestamp,
    };
  }

  /**
   * Retrieve a failed job record by jobId
   */
  getRecord(jobId: string): FailedJobRecord | null {
    return (
      this.deadLetterQueue.find((record) => record.jobId === jobId) || null
    );
  }

  /**
   * Get all records in DLQ
   */
  getAllRecords(): FailedJobRecord[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Get failed jobs that can be retried (retries not exhausted)
   */
  getRetryableRecords(): FailedJobRecord[] {
    return this.deadLetterQueue.filter((record) => !record.retriesExhausted);
  }

  /**
   * Recover a job from DLQ (remove and return for requeue)
   */
  recover(jobId: string): FailedJobRecord | null {
    const index = this.deadLetterQueue.findIndex(
      (record) => record.jobId === jobId
    );

    if (index === -1) {
      return null;
    }

    const [record] = this.deadLetterQueue.splice(index, 1);
    return record;
  }

  /**
   * Get current DLQ size
   */
  getSize(): number {
    return this.deadLetterQueue.length;
  }

  /**
   * Clear the DLQ
   */
  clear(): void {
    this.deadLetterQueue.length = 0;
  }

  /**
   * Get failed jobs by failure reason
   */
  getByFailureReason(reason: string): FailedJobRecord[] {
    return this.deadLetterQueue.filter(
      (record) => record.failureReason === reason
    );
  }
}
