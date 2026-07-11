import { DeadLetterQueue, FailedJobRecord, DLQResult } from '../src/queue/dlq';
import { Job } from '../src/queue/producer';

describe('Dead Letter Queue', () => {
  let dlq: DeadLetterQueue;

  beforeEach(() => {
    dlq = new DeadLetterQueue();
  });

  describe('push', () => {
    test('should push failed job to DLQ with error details', () => {
      const job: Job = {
        id: 'job-123',
        type: 'extract',
        payload: { source: 'api' },
        retries: 2,
        maxRetries: 3,
      };

      const error = new Error('Connection timeout');
      const result = dlq.push(job, error, 'Network error');

      expect(result.status).toBe('stored');
      expect(result.recordId).toBe('job-123');
      expect(result.timestamp).toBeDefined();
      expect(dlq.getSize()).toBe(1);
    });

    test('should capture complete error details', () => {
      const job: Job = {
        id: 'job-456',
        type: 'transform',
        payload: { data: 'test' },
      };

      const error = new Error('Data validation failed');
      error.name = 'ValidationError';
      dlq.push(job, error, 'Schema mismatch');

      const record = dlq.getRecord('job-456');
      expect(record).not.toBeNull();
      expect(record?.error.name).toBe('ValidationError');
      expect(record?.error.message).toBe('Data validation failed');
      expect(record?.error.stack).toBeDefined();
    });

    test('should set retriesExhausted flag correctly', () => {
      const jobNotExhausted: Job = {
        id: 'job-1',
        type: 'test',
        payload: {},
        retries: 2,
        maxRetries: 5,
      };

      const jobExhausted: Job = {
        id: 'job-2',
        type: 'test',
        payload: {},
        retries: 3,
        maxRetries: 3,
      };

      const error = new Error('Test error');

      dlq.push(jobNotExhausted, error, 'Error');
      dlq.push(jobExhausted, error, 'Error');

      const record1 = dlq.getRecord('job-1');
      const record2 = dlq.getRecord('job-2');

      expect(record1?.retriesExhausted).toBe(false);
      expect(record2?.retriesExhausted).toBe(true);
    });

    test('should include timestamp for failed job record', () => {
      const job: Job = { id: 'job-999', type: 'test', payload: {} };
      const error = new Error('Test');

      const beforePush = Date.now();
      dlq.push(job, error, 'Error');
      const afterPush = Date.now();

      const record = dlq.getRecord('job-999');
      expect(record?.timestamp).toBeGreaterThanOrEqual(beforePush);
      expect(record?.timestamp).toBeLessThanOrEqual(afterPush);
    });

    test('should preserve original job data', () => {
      const job: Job = {
        id: 'job-original',
        type: 'load',
        payload: { destination: 'db', data: [1, 2, 3] },
        metadata: { priority: 'high' },
      };

      const error = new Error('DB connection failed');
      dlq.push(job, error, 'Database error');

      const record = dlq.getRecord('job-original');
      expect(record?.originalJob).toEqual(job);
      expect(record?.originalJob.payload).toEqual({
        destination: 'db',
        data: [1, 2, 3],
      });
    });

    test('should maintain max DLQ size by removing oldest records', () => {
      const dlq = new DeadLetterQueue(3);
      const error = new Error('Test');

      dlq.push({ id: 'job-1', type: 'test', payload: {} }, error, 'Error');
      dlq.push({ id: 'job-2', type: 'test', payload: {} }, error, 'Error');
      dlq.push({ id: 'job-3', type: 'test', payload: {} }, error, 'Error');

      expect(dlq.getSize()).toBe(3);

      // Adding 4th should remove the oldest
      dlq.push({ id: 'job-4', type: 'test', payload: {} }, error, 'Error');

      expect(dlq.getSize()).toBe(3);
      expect(dlq.getRecord('job-1')).toBeNull();
      expect(dlq.getRecord('job-4')).not.toBeNull();
    });

    test('should handle jobs without explicit id', () => {
      const job: Job = { type: 'test', payload: {} };
      const error = new Error('Error');

      const result = dlq.push(job, error, 'Failure');

      expect(result.recordId).toBe('unknown');
      const record = dlq.getRecord('unknown');
      expect(record).not.toBeNull();
    });
  });

  describe('getRecord', () => {
    test('should retrieve a failed job record by jobId', () => {
      const job: Job = { id: 'job-retrieve', type: 'test', payload: {} };
      const error = new Error('Test error');

      dlq.push(job, error, 'Test failure');
      const record = dlq.getRecord('job-retrieve');

      expect(record).not.toBeNull();
      expect(record?.jobId).toBe('job-retrieve');
      expect(record?.failureReason).toBe('Test failure');
    });

    test('should return null for non-existent jobId', () => {
      const record = dlq.getRecord('non-existent-job');
      expect(record).toBeNull();
    });
  });

  describe('recover', () => {
    test('should recover and remove job from DLQ', () => {
      const job: Job = { id: 'job-recover', type: 'test', payload: {} };
      const error = new Error('Error');

      dlq.push(job, error, 'Recovery test');
      expect(dlq.getSize()).toBe(1);

      const recovered = dlq.recover('job-recover');

      expect(recovered).not.toBeNull();
      expect(recovered?.jobId).toBe('job-recover');
      expect(dlq.getSize()).toBe(0);
      expect(dlq.getRecord('job-recover')).toBeNull();
    });

    test('should return null when recovering non-existent job', () => {
      const recovered = dlq.recover('non-existent');
      expect(recovered).toBeNull();
    });

    test('should return complete record on recovery', () => {
      const job: Job = {
        id: 'job-complete',
        type: 'extract',
        payload: { source: 'api' },
      };
      const error = new Error('Network timeout');

      dlq.push(job, error, 'Connection failed');
      const recovered = dlq.recover('job-complete');

      expect(recovered?.originalJob).toEqual(job);
      expect(recovered?.error.message).toBe('Network timeout');
      expect(recovered?.failureReason).toBe('Connection failed');
    });
  });

  describe('getRetryableRecords', () => {
    test('should return only records where retries are not exhausted', () => {
      const job1: Job = {
        id: 'job-1',
        type: 'test',
        payload: {},
        retries: 1,
        maxRetries: 3,
      };
      const job2: Job = {
        id: 'job-2',
        type: 'test',
        payload: {},
        retries: 3,
        maxRetries: 3,
      };
      const job3: Job = {
        id: 'job-3',
        type: 'test',
        payload: {},
        retries: 0,
        maxRetries: 2,
      };

      const error = new Error('Test');

      dlq.push(job1, error, 'Retryable');
      dlq.push(job2, error, 'Exhausted');
      dlq.push(job3, error, 'Retryable');

      const retryable = dlq.getRetryableRecords();

      expect(retryable).toHaveLength(2);
      expect(retryable.map((r) => r.jobId)).toContain('job-1');
      expect(retryable.map((r) => r.jobId)).toContain('job-3');
    });
  });

  describe('getByFailureReason', () => {
    test('should filter failed jobs by failure reason', () => {
      const job1: Job = { id: 'job-1', type: 'test', payload: {} };
      const job2: Job = { id: 'job-2', type: 'test', payload: {} };
      const job3: Job = { id: 'job-3', type: 'test', payload: {} };

      const error = new Error('Error');

      dlq.push(job1, error, 'Network timeout');
      dlq.push(job2, error, 'Database connection failed');
      dlq.push(job3, error, 'Network timeout');

      const networkTimeouts = dlq.getByFailureReason('Network timeout');

      expect(networkTimeouts).toHaveLength(2);
      expect(networkTimeouts.map((r) => r.jobId)).toEqual(['job-1', 'job-3']);
    });

    test('should return empty array for non-matching reasons', () => {
      const result = dlq.getByFailureReason('Non-existent reason');
      expect(result).toHaveLength(0);
    });
  });

  describe('queue operations', () => {
    test('getSize should return correct count', () => {
      const error = new Error('Test');

      expect(dlq.getSize()).toBe(0);

      dlq.push({ id: 'job-1', type: 'test', payload: {} }, error, 'Error');
      expect(dlq.getSize()).toBe(1);

      dlq.push({ id: 'job-2', type: 'test', payload: {} }, error, 'Error');
      expect(dlq.getSize()).toBe(2);

      dlq.recover('job-1');
      expect(dlq.getSize()).toBe(1);
    });

    test('getAllRecords should return copy of DLQ', () => {
      const error = new Error('Test');

      dlq.push({ id: 'job-1', type: 'test', payload: {} }, error, 'Error');
      dlq.push({ id: 'job-2', type: 'test', payload: {} }, error, 'Error');

      const allRecords = dlq.getAllRecords();

      expect(allRecords).toHaveLength(2);
      expect(allRecords[0].jobId).toBe('job-1');
      expect(allRecords[1].jobId).toBe('job-2');

      // Verify it's a copy
      allRecords.pop();
      expect(dlq.getSize()).toBe(2);
    });

    test('clear should empty the DLQ', () => {
      const error = new Error('Test');

      dlq.push({ id: 'job-1', type: 'test', payload: {} }, error, 'Error');
      dlq.push({ id: 'job-2', type: 'test', payload: {} }, error, 'Error');

      expect(dlq.getSize()).toBe(2);
      dlq.clear();
      expect(dlq.getSize()).toBe(0);
      expect(dlq.getAllRecords()).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    test('should handle error with undefined stack', () => {
      const job: Job = { id: 'job-stack', type: 'test', payload: {} };
      const error = new Error('Test');
      error.stack = undefined;

      dlq.push(job, error, 'No stack');
      const record = dlq.getRecord('job-stack');

      expect(record?.error.message).toBe('Test');
      expect(record?.error.stack).toBeUndefined();
    });

    test('should capture various error types', () => {
      const job: Job = { id: 'job-types', type: 'test', payload: {} };

      const typeError = new TypeError('Invalid type');
      const rangeError = new RangeError('Value out of range');

      dlq.push(job, typeError, 'Type error');
      dlq.push(job, rangeError, 'Range error');

      const records = dlq.getAllRecords();
      expect(records).toHaveLength(2);
      expect(records[0].error.name).toBe('TypeError');
      expect(records[1].error.name).toBe('RangeError');
    });
  });

  describe('metadata capture', () => {
    test('should capture lastRetryTime when job is pushed to DLQ', () => {
      const job: Job = { id: 'job-retry-time', type: 'test', payload: {} };
      const error = new Error('Error');

      const beforePush = Date.now();
      dlq.push(job, error, 'Retry test');
      const afterPush = Date.now();

      const record = dlq.getRecord('job-retry-time');

      expect(record?.lastRetryTime).toBeGreaterThanOrEqual(beforePush);
      expect(record?.lastRetryTime).toBeLessThanOrEqual(afterPush);
    });

    test('should preserve job metadata through DLQ storage', () => {
      const job: Job = {
        id: 'job-metadata',
        type: 'test',
        payload: {},
        metadata: {
          source: 'api',
          priority: 'high',
          tags: ['critical'],
        },
      };
      const error = new Error('Error');

      dlq.push(job, error, 'Metadata test');
      const record = dlq.getRecord('job-metadata');

      expect(record?.originalJob.metadata).toEqual({
        source: 'api',
        priority: 'high',
        tags: ['critical'],
      });
    });
  });
});
