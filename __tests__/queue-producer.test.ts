import { Producer, Job, EnqueueResult } from '../src/queue/producer';

describe('Queue Producer', () => {
  let producer: Producer;

  beforeEach(() => {
    producer = new Producer();
  });

  describe('enqueue', () => {
    test('should enqueue a job successfully', () => {
      const job: Job = {
        type: 'extract',
        payload: { source: 'test' },
      };

      const result = producer.enqueue(job);

      expect(result.status).toBe('queued');
      expect(result.jobId).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(typeof result.timestamp).toBe('number');
    });

    test('should generate jobId if not provided', () => {
      const job: Job = {
        type: 'transform',
        payload: { data: 'test' },
      };

      const result1 = producer.enqueue(job);
      const result2 = producer.enqueue(job);

      expect(result1.jobId).not.toBe(result2.jobId);
    });

    test('should preserve provided jobId', () => {
      const job: Job = {
        id: 'custom-job-123',
        type: 'load',
        payload: { destination: 'db' },
      };

      const result = producer.enqueue(job);

      expect(result.jobId).toBe('custom-job-123');
    });

    test('should enqueue multiple jobs in FIFO order', () => {
      const jobs: Job[] = [
        { type: 'job1', payload: {} },
        { type: 'job2', payload: {} },
        { type: 'job3', payload: {} },
      ];

      jobs.forEach((job) => producer.enqueue(job));

      expect(producer.getQueueSize()).toBe(3);
      expect(producer.peek()?.type).toBe('job1');
    });

    test('should reject job when queue is full', () => {
      const producer = new Producer({ maxQueueSize: 2 });
      const job: Job = { type: 'test', payload: {} };

      producer.enqueue(job);
      producer.enqueue(job);
      const result = producer.enqueue(job);

      expect(result.status).toBe('rejected');
      expect(result.message).toContain('Queue overflow');
    });

    test('should include metadata in queued job', () => {
      const job: Job = {
        type: 'extract',
        payload: { source: 'api' },
        metadata: { priority: 'high', tags: ['urgent'] },
      };

      producer.enqueue(job);
      const queuedJob = producer.peek();

      expect(queuedJob?.metadata).toEqual({ priority: 'high', tags: ['urgent'] });
    });

    test('should set default retry count and maxRetries', () => {
      const job: Job = {
        type: 'test',
        payload: {},
      };

      producer.enqueue(job);
      const queuedJob = producer.peek();

      expect(queuedJob?.retries).toBe(0);
      expect(queuedJob?.maxRetries).toBe(3);
    });

    test('should preserve provided maxRetries', () => {
      const job: Job = {
        type: 'test',
        payload: {},
        maxRetries: 5,
      };

      producer.enqueue(job);
      const queuedJob = producer.peek();

      expect(queuedJob?.maxRetries).toBe(5);
    });
  });

  describe('dequeue', () => {
    test('should dequeue jobs in FIFO order', () => {
      const jobs: Job[] = [
        { type: 'job1', payload: {} },
        { type: 'job2', payload: {} },
        { type: 'job3', payload: {} },
      ];

      jobs.forEach((job) => producer.enqueue(job));

      expect(producer.dequeue()?.type).toBe('job1');
      expect(producer.dequeue()?.type).toBe('job2');
      expect(producer.dequeue()?.type).toBe('job3');
      expect(producer.dequeue()).toBeNull();
    });

    test('should return null when queue is empty', () => {
      expect(producer.dequeue()).toBeNull();
    });
  });

  describe('queue operations', () => {
    test('getQueueSize should return correct count', () => {
      expect(producer.getQueueSize()).toBe(0);

      producer.enqueue({ type: 'test', payload: {} });
      expect(producer.getQueueSize()).toBe(1);

      producer.enqueue({ type: 'test', payload: {} });
      expect(producer.getQueueSize()).toBe(2);

      producer.dequeue();
      expect(producer.getQueueSize()).toBe(1);
    });

    test('peek should not remove job from queue', () => {
      const job: Job = { type: 'test', payload: {} };
      producer.enqueue(job);

      const peeked1 = producer.peek();
      const peeked2 = producer.peek();

      expect(peeked1).toEqual(peeked2);
      expect(producer.getQueueSize()).toBe(1);
    });

    test('clear should empty the queue', () => {
      producer.enqueue({ type: 'test', payload: {} });
      producer.enqueue({ type: 'test', payload: {} });

      expect(producer.getQueueSize()).toBe(2);
      producer.clear();
      expect(producer.getQueueSize()).toBe(0);
      expect(producer.dequeue()).toBeNull();
    });

    test('getAllJobs should return copy of queue', () => {
      const job1: Job = { type: 'job1', payload: {} };
      const job2: Job = { type: 'job2', payload: {} };

      producer.enqueue(job1);
      producer.enqueue(job2);

      const allJobs = producer.getAllJobs();
      expect(allJobs).toHaveLength(2);
      expect(allJobs[0].type).toBe('job1');
      expect(allJobs[1].type).toBe('job2');

      // Verify it's a copy, not the original
      allJobs.pop();
      expect(producer.getQueueSize()).toBe(2);
    });
  });

  describe('backpressure handling', () => {
    test('should respect backoffMs configuration', () => {
      const producer = new Producer({ backoffMs: 500 });
      const result = producer.enqueue({ type: 'test', payload: {} });
      expect(result.status).toBe('queued');
    });

    test('should handle rapid sequential enqueues without data loss', () => {
      const producer = new Producer({ maxQueueSize: 100 });

      for (let i = 0; i < 50; i++) {
        const result = producer.enqueue({
          type: `job-${i}`,
          payload: { index: i },
        });
        expect(result.status).toBe('queued');
      }

      expect(producer.getQueueSize()).toBe(50);
    });

    test('should handle maxQueueSize edge case', () => {
      const producer = new Producer({ maxQueueSize: 3 });

      const result1 = producer.enqueue({ type: 'job1', payload: {} });
      const result2 = producer.enqueue({ type: 'job2', payload: {} });
      const result3 = producer.enqueue({ type: 'job3', payload: {} });
      const result4 = producer.enqueue({ type: 'job4', payload: {} });

      expect(result1.status).toBe('queued');
      expect(result2.status).toBe('queued');
      expect(result3.status).toBe('queued');
      expect(result4.status).toBe('rejected');
      expect(producer.getQueueSize()).toBe(3);
    });
  });

  describe('timestamp accuracy', () => {
    test('should include timestamp for queued results', () => {
      const beforeEnqueue = Date.now();
      const result = producer.enqueue({ type: 'test', payload: {} });
      const afterEnqueue = Date.now();

      expect(result.timestamp).toBeGreaterThanOrEqual(beforeEnqueue);
      expect(result.timestamp).toBeLessThanOrEqual(afterEnqueue);
    });

    test('should include timestamp for rejected results', () => {
      const producer = new Producer({ maxQueueSize: 1 });
      producer.enqueue({ type: 'job1', payload: {} });

      const beforeReject = Date.now();
      const result = producer.enqueue({ type: 'job2', payload: {} });
      const afterReject = Date.now();

      expect(result.timestamp).toBeGreaterThanOrEqual(beforeReject);
      expect(result.timestamp).toBeLessThanOrEqual(afterReject);
    });
  });
});
