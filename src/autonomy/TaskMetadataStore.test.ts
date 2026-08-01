import { TaskMetadataStore, getTaskMetadataStore } from './TaskMetadataStore';
import { ExecutionContext, ExecutionMode } from './ExecutionPolicy';

describe('TaskMetadataStore', () => {
  let store: TaskMetadataStore;

  const createSampleContext = (overrides: Partial<ExecutionContext> = {}): ExecutionContext => ({
    taskId: 'sample-task',
    mode: ExecutionMode.UNATTENDED,
    preapprovedTools: ['Read', 'Grep'],
    exitOnUnauthorized: true,
    ...overrides,
  });

  beforeEach(() => {
    store = new TaskMetadataStore();
  });

  describe('registerTask and getContext', () => {
    it('should register context and retrieve it by taskId', () => {
      const context = createSampleContext({ taskId: 'task-101' });

      store.registerTask(context);
      const retrieved = store.getContext('task-101');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.taskId).toBe('task-101');
      expect(retrieved?.mode).toBe(ExecutionMode.UNATTENDED);
      expect(retrieved?.preapprovedTools).toEqual(['Read', 'Grep']);
      expect(retrieved?.createdAt).toBeInstanceOf(Date);
    });

    it('should return null when getting context for unknown taskId', () => {
      expect(store.getContext('nonexistent-task')).toBeNull();
    });

    it('should support overwriting context on subsequent registerTask calls for same taskId', () => {
      const context1 = createSampleContext({ taskId: 'task-101', mode: ExecutionMode.INTERACTIVE });
      const context2 = createSampleContext({
        taskId: 'task-101',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Bash'],
      });

      store.registerTask(context1);
      store.registerTask(context2);

      const retrieved = store.getContext('task-101');
      expect(retrieved?.mode).toBe(ExecutionMode.UNATTENDED);
      expect(retrieved?.preapprovedTools).toEqual(['Bash']);
    });
  });

  describe('getCurrentContext and global context methods', () => {
    it('should return context by taskId when taskId is passed', () => {
      const context = createSampleContext({ taskId: 'task-202', mode: ExecutionMode.BATCH });
      store.registerTask(context);

      expect(store.getCurrentContext('task-202')).toEqual(store.getContext('task-202'));
    });

    it('should manage global context when set, retrieved, and cleared', () => {
      const context = createSampleContext({ taskId: 'global-task-1', mode: ExecutionMode.MAINTENANCE });

      store.setCurrentContext(context);
      expect(store.getCurrentContext()).not.toBeNull();
      expect(store.getCurrentContext()?.taskId).toBe('global-task-1');

      store.clearCurrentContext();
      expect(store.getCurrentContext()).toBeNull();
    });
  });

  describe('execution recording lifecycle', () => {
    const sampleContext = createSampleContext({ taskId: 'task-303' });

    it('should start execution and return running record', () => {
      const record = store.startExecution(sampleContext);

      expect(record.taskId).toBe('task-303');
      expect(record.status).toBe('RUNNING');
      expect(record.startedAt).toBeInstanceOf(Date);
      expect(record.toolCalls).toEqual([]);

      expect(store.getExecution('task-303')).toEqual(record);
    });

    it('should record tool calls against existing execution', () => {
      store.startExecution(sampleContext);
      store.recordToolCall('task-303', 'Write', true, 'preapproved');
      store.recordToolCall('task-303', 'Bash', false, 'denied', 'Unauthorized tool');

      const execution = store.getExecution('task-303');
      expect(execution?.toolCalls).toHaveLength(2);
      expect(execution?.toolCalls[0]).toMatchObject({
        tool: 'Write',
        allowed: true,
        reason: 'preapproved',
      });
      expect(execution?.toolCalls[1]).toMatchObject({
        tool: 'Bash',
        allowed: false,
        reason: 'denied',
        error: 'Unauthorized tool',
      });
    });

    it('should safely ignore tool calls for non-existent executions', () => {
      expect(() => {
        store.recordToolCall('ghost-task', 'Read', true, 'ok');
      }).not.toThrow();
    });

    it('should mark execution as completed with status and details', () => {
      store.startExecution(sampleContext);
      const completed = store.completeExecution('task-303', 'SUCCESS');

      expect(completed).not.toBeNull();
      expect(completed?.status).toBe('SUCCESS');
      expect(completed?.endedAt).toBeInstanceOf(Date);

      const failedCompleted = store.completeExecution('task-303', 'FAILURE', 'Timeout', 'Step 2');
      expect(failedCompleted?.status).toBe('FAILURE');
      expect(failedCompleted?.error).toBe('Timeout');
      expect(failedCompleted?.failurePoint).toBe('Step 2');
    });

    it('should return null when completing non-existent execution', () => {
      expect(store.completeExecution('ghost-task', 'SUCCESS')).toBeNull();
    });

    it('should list all executions via getAllExecutions', () => {
      const ctx1 = createSampleContext({ taskId: 't1' });
      const ctx2 = createSampleContext({ taskId: 't2' });

      store.startExecution(ctx1);
      store.startExecution(ctx2);

      const all = store.getAllExecutions();
      expect(all).toHaveLength(2);
      expect(all.map((e) => e.taskId)).toContain('t1');
      expect(all.map((e) => e.taskId)).toContain('t2');
    });
  });

  describe('clearOldExecutions', () => {
    it('should purge executions and contexts older than cutoff hours', () => {
      const ctxOld = createSampleContext({ taskId: 'old-task' });
      const ctxNew = createSampleContext({ taskId: 'new-task' });

      store.registerTask(ctxOld);
      store.registerTask(ctxNew);

      const recOld = store.startExecution(ctxOld);
      const recNew = store.startExecution(ctxNew);

      // Artificially set endedAt dates
      recOld.endedAt = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago
      recNew.endedAt = new Date(Date.now() - 1 * 60 * 60 * 1000);  // 1 hour ago

      const cleared = store.clearOldExecutions(24);

      expect(cleared).toBe(1);
      expect(store.getExecution('old-task')).toBeNull();
      expect(store.getContext('old-task')).toBeNull();
      expect(store.getExecution('new-task')).not.toBeNull();
      expect(store.getContext('new-task')).not.toBeNull();
    });
  });

  describe('exportAuditLog', () => {
    it('should export valid JSON array for all executions or a specific taskId', () => {
      const ctx = createSampleContext({ taskId: 'audit-task' });
      store.startExecution(ctx);
      store.recordToolCall('audit-task', 'Read', true, 'preapproved');
      store.completeExecution('audit-task', 'SUCCESS');

      const fullLogJson = store.exportAuditLog();
      const fullLog = JSON.parse(fullLogJson);
      expect(Array.isArray(fullLog)).toBe(true);
      expect(fullLog).toHaveLength(1);
      expect(fullLog[0].taskId).toBe('audit-task');
      expect(fullLog[0].status).toBe('SUCCESS');
      expect(fullLog[0].toolCalls).toHaveLength(1);

      const specificLogJson = store.exportAuditLog('audit-task');
      const specificLog = JSON.parse(specificLogJson);
      expect(specificLog).toHaveLength(1);

      const emptyLogJson = store.exportAuditLog('nonexistent');
      const emptyLog = JSON.parse(emptyLogJson);
      expect(emptyLog).toHaveLength(0);
    });
  });

  describe('getTaskMetadataStore singleton', () => {
    it('should return a singleton instance', () => {
      const instance1 = getTaskMetadataStore();
      const instance2 = getTaskMetadataStore();
      expect(instance1).toBe(instance2);
    });
  });
});
