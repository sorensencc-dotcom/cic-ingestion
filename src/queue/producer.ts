import { randomUUID } from 'crypto';
import { log } from '../lib/logger';

export interface Job {
  id?: string;
  type: string;
  payload: Record<string, any>;
  metadata?: Record<string, any>;
  retries?: number;
  maxRetries?: number;
}

export interface EnqueueResult {
  status: 'queued' | 'rejected';
  jobId: string;
  timestamp: number;
  message?: string;
}

export interface ProducerConfig {
  maxQueueSize?: number;
  backoffMs?: number;
}

export class Producer {
  private queue: Job[] = [];
  private maxQueueSize: number;
  private backoffMs: number;

  constructor(config: ProducerConfig = {}) {
    this.maxQueueSize = config.maxQueueSize || 1000;
    this.backoffMs = config.backoffMs || 100;
  }

  /**
   * Enqueue a job for processing
   * Returns {status: 'queued', jobId, timestamp} on success
   * Returns {status: 'rejected', ...} if queue is full
   */
  enqueue(job: Job): EnqueueResult {
    const timestamp = Date.now();

    // Check for queue overflow
    if (this.queue.length >= this.maxQueueSize) {
      log('Queue overflow: max size', this.maxQueueSize, 'reached');
      return {
        status: 'rejected',
        jobId: job.id || 'unknown',
        timestamp,
        message: `Queue overflow: max size ${this.maxQueueSize} reached`,
      };
    }

    // Generate jobId if not provided
    const jobId = job.id || randomUUID();
    const enqueuedJob: Job = {
      ...job,
      id: jobId,
      retries: job.retries || 0,
      maxRetries: job.maxRetries || 3,
    };

    this.queue.push(enqueuedJob);
    log('Job enqueued:', jobId, '| Queue size:', this.queue.length);

    return {
      status: 'queued',
      jobId,
      timestamp,
    };
  }

  /**
   * Dequeue and return the next job (FIFO)
   */
  dequeue(): Job | null {
    return this.queue.shift() || null;
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Peek at the next job without removing it
   */
  peek(): Job | null {
    return this.queue[0] || null;
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue.length = 0;
  }

  /**
   * Get all jobs in queue
   */
  getAllJobs(): Job[] {
    return [...this.queue];
  }
}
