import { Producer, Job, EnqueueResult } from '../producer';
import { DeadLetterQueue, FailedJobRecord, DLQResult } from '../dlq';

describe('Queue & Resilience Integration Tests', () => {
  let producer: Producer;
  let dlq: DeadLetterQueue;

  beforeEach(() => {
    producer = new Producer();
    dlq = new DeadLetterQueue();
  });

  afterEach(() => {
    producer.clear();
    dlq.clear();
  });

  describe('1. Producer -> DLQ Failure Escalation', () => {
    it('should escalate job to DLQ when retries reach maxRetries', () => {
      const job: Job = {
        id: 'job-escalate-1',
        type: 'ingest-task',
        payload: { file: 'data1.csv' },
        retries: 0,
        maxRetries: 3,
      };

      const enqueueResult = producer.enqueue(job);
      expect(enqueueResult.status).toBe('queued');
      expect(producer.getQueueSize()).toBe(1);

      // Simulate execution loop with retries
      let currentJob = producer.dequeue();
      expect(currentJob).not.toBeNull();

      const failureReason = 'Extraction timeout error';
      const executionError = new Error('Database connection failed');

      // Simulate retries up to maxRetries
      while (currentJob && (currentJob.retries || 0) < (currentJob.maxRetries || 3)) {
        currentJob.retries = (currentJob.retries || 0) + 1;
        if (currentJob.retries < (currentJob.maxRetries || 3)) {
          // Re-enqueue for retry
          producer.enqueue(currentJob);
          currentJob = producer.dequeue();
        } else {
          // Max retries reached, push to DLQ
          dlq.push(currentJob, executionError, failureReason);
        }
      }

      // Verify queue is empty after max retries reached and pushed to DLQ
      expect(producer.getQueueSize()).toBe(0);

      // Verify DLQ state
      expect(dlq.getSize()).toBe(1);
      const record = dlq.getRecord('job-escalate-1');
      expect(record).not.toBeNull();
      expect(record?.jobId).toBe('job-escalate-1');
      expect(record?.retriesExhausted).toBe(true);
      expect(record?.failureReason).toBe(failureReason);
      expect(record?.error.message).toBe('Database connection failed');
      expect(record?.originalJob.retries).toBe(3);
    });

    it('should mark retriesExhausted accurately in DLQ push', () => {
      const unexhaustedJob: Job = {
        id: 'job-unexhausted-1',
        type: 'test-type',
        payload: {},
        retries: 1,
        maxRetries: 3,
      };
      const exhaustedJob: Job = {
        id: 'job-exhausted-1',
        type: 'test-type',
        payload: {},
        retries: 3,
        maxRetries: 3,
      };

      const err = new Error('Test error');
      dlq.push(unexhaustedJob, err, 'Transient failure');
      dlq.push(exhaustedJob, err, 'Fatal failure');

      expect(dlq.getSize()).toBe(2);
      expect(dlq.getRecord('job-unexhausted-1')?.retriesExhausted).toBe(false);
      expect(dlq.getRecord('job-exhausted-1')?.retriesExhausted).toBe(true);
      expect(dlq.getRetryableRecords().length).toBe(1);
      expect(dlq.getRetryableRecords()[0].jobId).toBe('job-unexhausted-1');
    });
  });

  describe('2. DLQ Recovery & Re-drive Flow', () => {
    it('should recover job from DLQ, reset retry count, and re-enqueue into Producer', () => {
      const originalJob: Job = {
        id: 'job-redrive-1',
        type: 'sync-data',
        payload: { target: 'analytics' },
        retries: 3,
        maxRetries: 3,
      };

      const failureErr = new Error('Network timeout');
      dlq.push(originalJob, failureErr, 'Network unreachable');

      expect(dlq.getSize()).toBe(1);

      // Step 1: Recover from DLQ
      const recoveredRecord = dlq.recover('job-redrive-1');
      expect(recoveredRecord).not.toBeNull();
      expect(recoveredRecord?.jobId).toBe('job-redrive-1');
      expect(dlq.getSize()).toBe(0);
      expect(dlq.getRecord('job-redrive-1')).toBeNull();

      // Step 2: Reset retry count on recovered originalJob
      const jobToRedrive: Job = {
        ...recoveredRecord!.originalJob,
        retries: 0,
      };

      // Step 3: Re-enqueue into Producer
      const result = producer.enqueue(jobToRedrive);

      expect(result.status).toBe('queued');
      expect(result.jobId).toBe('job-redrive-1');
      expect(producer.getQueueSize()).toBe(1);

      // Verify the dequeued job state
      const reDrivenJob = producer.dequeue();
      expect(reDrivenJob).not.toBeNull();
      expect(reDrivenJob?.id).toBe('job-redrive-1');
      expect(reDrivenJob?.retries).toBe(0);
      expect(reDrivenJob?.maxRetries).toBe(3);
      expect(reDrivenJob?.payload).toEqual({ target: 'analytics' });
    });

    it('should return null when trying to recover a non-existent jobId', () => {
      const recovered = dlq.recover('non-existent-id');
      expect(recovered).toBeNull();
    });
  });

  describe('3. Producer Capacity & Overflow Rejection', () => {
    it('should reject job enqueue when queue capacity is reached (status: rejected, message containing Queue overflow)', () => {
      const smallProducer = new Producer({ maxQueueSize: 2 });

      const job1: Job = { id: 'cap-1', type: 't1', payload: {} };
      const job2: Job = { id: 'cap-2', type: 't2', payload: {} };
      const job3: Job = { id: 'cap-3', type: 't3', payload: {} };

      const res1 = smallProducer.enqueue(job1);
      const res2 = smallProducer.enqueue(job2);

      expect(res1.status).toBe('queued');
      expect(res2.status).toBe('queued');
      expect(smallProducer.getQueueSize()).toBe(2);

      // Attempt to enqueue 3rd job exceeding capacity
      const res3 = smallProducer.enqueue(job3);

      expect(res3.status).toBe('rejected');
      expect(res3.jobId).toBe('cap-3');
      expect(res3.message).toBeDefined();
      expect(res3.message).toContain('Queue overflow');
      expect(smallProducer.getQueueSize()).toBe(2);

      // Ensure queue contents are unchanged
      const jobs = smallProducer.getAllJobs();
      expect(jobs.map((j) => j.id)).toEqual(['cap-1', 'cap-2']);
    });
  });
});
