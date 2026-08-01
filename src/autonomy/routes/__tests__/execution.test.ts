import express, { Express } from 'express';
import { Server } from 'http';
import { createExecutionRouter } from '../execution';
import { getTaskMetadataStore } from '../../TaskMetadataStore';
import { ExecutionMode, ExecutionContext } from '../../ExecutionPolicy';

describe('Execution Router', () => {
  let app: Express;
  let server: Server;
  let baseUrl: string;

  const createValidContext = (overrides: Partial<ExecutionContext> = {}): ExecutionContext => ({
    taskId: 'sample-task',
    mode: ExecutionMode.UNATTENDED,
    preapprovedTools: ['Read', 'Grep'],
    exitOnUnauthorized: true,
    ...overrides,
  });

  beforeAll((done) => {
    app = express();
    app.use(express.json());
    app.use('/autonomy', createExecutionRouter());

    server = app.listen(0, '127.0.0.1', () => {
      const address = server.address() as { port: number };
      baseUrl = `http://127.0.0.1:${address.port}/autonomy`;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    const store = getTaskMetadataStore();
    store.clearOldExecutions(0);
  });

  describe('POST /autonomy/execution/register', () => {
    it('should return 400 when invalid execution context is provided', async () => {
      const response = await fetch(`${baseUrl}/execution/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: '' }), // Invalid taskId
      });

      expect(response.status).toBe(400);
      const body = (await response.json()) as any;
      expect(body.error).toBe('Invalid execution context');
      expect(body.details).toBeDefined();
    });

    it('should return 200 and register task when valid context is provided', async () => {
      const payload = createValidContext({ taskId: 'reg-task-1' });

      const response = await fetch(`${baseUrl}/execution/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as any;
      expect(body.registered).toBe(true);
      expect(body.taskId).toBe('reg-task-1');
      expect(body.mode).toBe(ExecutionMode.UNATTENDED);
      expect(body.preapprovedTools).toEqual(['Read', 'Grep']);

      const store = getTaskMetadataStore();
      expect(store.getContext('reg-task-1')).not.toBeNull();
    });
  });

  describe('GET /autonomy/execution/status/:taskId', () => {
    it('should return 404 for unknown taskId', async () => {
      const response = await fetch(`${baseUrl}/execution/status/unknown-task`);
      expect(response.status).toBe(404);
      const body = (await response.json()) as any;
      expect(body.error).toBe('Task not found');
    });

    it('should return 200 with status details when execution exists', async () => {
      const store = getTaskMetadataStore();
      const ctx = createValidContext({ taskId: 'status-task-1', mode: ExecutionMode.INTERACTIVE });
      store.startExecution(ctx);
      store.recordToolCall('status-task-1', 'Read', true, 'preapproved');
      store.recordToolCall('status-task-1', 'Bash', false, 'denied');

      const response = await fetch(`${baseUrl}/execution/status/status-task-1`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as any;
      expect(body.taskId).toBe('status-task-1');
      expect(body.status).toBe('RUNNING');
      expect(body.toolCallCount).toBe(2);
      expect(body.allowedToolCount).toBe(1);
      expect(body.deniedToolCount).toBe(1);
    });
  });

  describe('GET /autonomy/execution/audit/:taskId', () => {
    it('should return 404 when audit trail for task is not found', async () => {
      const response = await fetch(`${baseUrl}/execution/audit/ghost-task`);
      expect(response.status).toBe(404);
    });

    it('should return 200 and audit trail JSON when task exists', async () => {
      const store = getTaskMetadataStore();
      const ctx = createValidContext({ taskId: 'audit-task-1' });
      store.startExecution(ctx);
      store.recordToolCall('audit-task-1', 'Write', true, 'preapproved');
      store.completeExecution('audit-task-1', 'SUCCESS');

      const response = await fetch(`${baseUrl}/execution/audit/audit-task-1`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as any;
      expect(Array.isArray(body)).toBe(true);
      expect(body[0].taskId).toBe('audit-task-1');
      expect(body[0].toolCalls[0].tool).toBe('Write');
    });
  });

  describe('POST /autonomy/execution/check', () => {
    it('should return 400 when missing required fields', async () => {
      const response = await fetch(`${baseUrl}/execution/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: 't1' }), // Missing tool
      });

      expect(response.status).toBe(400);
      const body = (await response.json()) as any;
      expect(body.error).toBe('Missing required fields: taskId, tool');
    });

    it('should return 404 when task context is not found', async () => {
      const response = await fetch(`${baseUrl}/execution/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: 'missing-ctx', tool: 'Read' }),
      });

      expect(response.status).toBe(404);
      const body = (await response.json()) as any;
      expect(body.error).toBe('Task context not found');
    });

    it('should return 200 with allowed status when tool is preapproved', async () => {
      const store = getTaskMetadataStore();
      store.registerTask(createValidContext({
        taskId: 'check-task-1',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Read', 'Grep'],
      }));

      const response = await fetch(`${baseUrl}/execution/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: 'check-task-1', tool: 'Read' }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as any;
      expect(body.allowed).toBe(true);
      expect(body.reason).toBe('preapproved');
    });
  });

  describe('GET /autonomy/execution/modes', () => {
    it('should return list of available execution modes', async () => {
      const response = await fetch(`${baseUrl}/execution/modes`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as any;
      expect(Array.isArray(body.modes)).toBe(true);
      expect(body.modes.length).toBeGreaterThanOrEqual(4);
    });
  });
});
