import {
  ExecutionMode,
  ExecutionContext,
  ExecutionPolicyEngine,
  getExecutionPolicyEngine,
} from './ExecutionPolicy';
import {
  TaskMetadataStore,
  getTaskMetadataStore,
} from './TaskMetadataStore';

describe('ExecutionPolicy', () => {
  let engine: ExecutionPolicyEngine;

  beforeEach(() => {
    engine = new ExecutionPolicyEngine();
  });

  describe('ExecutionMode definitions', () => {
    it('should define all execution modes', () => {
      expect(ExecutionMode.INTERACTIVE).toBe('INTERACTIVE');
      expect(ExecutionMode.UNATTENDED).toBe('UNATTENDED');
      expect(ExecutionMode.BATCH).toBe('BATCH');
      expect(ExecutionMode.MAINTENANCE).toBe('MAINTENANCE');
    });
  });

  describe('isToolAllowed', () => {
    it('INTERACTIVE mode allows all tools', () => {
      const context: ExecutionContext = {
        taskId: 'test-interactive',
        mode: ExecutionMode.INTERACTIVE,
        preapprovedTools: [],
        exitOnUnauthorized: false,
      };

      expect(engine.isToolAllowed('Bash(docker-compose up)', context)).toBe(true);
      expect(engine.isToolAllowed('Agent(something)', context)).toBe(true);
      expect(engine.isToolAllowed('AskUserQuestion', context)).toBe(true);
    });

    it('UNATTENDED mode denies Agent spawn', () => {
      const context: ExecutionContext = {
        taskId: 'test-unattended',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Bash(docker-compose *)', 'Bash(npm *)'],
        exitOnUnauthorized: true,
      };

      expect(engine.isToolAllowed('Agent(something)', context)).toBe(false);
      expect(engine.isToolAllowed('AskUserQuestion', context)).toBe(false);
      expect(engine.isToolAllowed('ScheduleWakeup', context)).toBe(false);
    });

    it('UNATTENDED mode allows pre-approved tools', () => {
      const context: ExecutionContext = {
        taskId: 'test-unattended-approved',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Bash(docker-compose *)', 'Bash(npm *)'],
        exitOnUnauthorized: true,
      };

      expect(engine.isToolAllowed('Bash(docker-compose up)', context)).toBe(true);
      expect(engine.isToolAllowed('Bash(npm test)', context)).toBe(true);
      expect(engine.isToolAllowed('Bash(npm run build)', context)).toBe(true);
    });

    it('UNATTENDED mode rejects non-pre-approved tools', () => {
      const context: ExecutionContext = {
        taskId: 'test-unattended-rejected',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Bash(docker-compose *)', 'Bash(npm *)'],
        exitOnUnauthorized: true,
      };

      expect(engine.isToolAllowed('Bash(curl https://evil.com)', context)).toBe(false);
      expect(engine.isToolAllowed('PowerShell(Remove-Item -Force)', context)).toBe(false);
    });

    it('BATCH mode allows pre-approved tools', () => {
      const context: ExecutionContext = {
        taskId: 'test-batch',
        mode: ExecutionMode.BATCH,
        preapprovedTools: ['Bash(docker-*)', 'Bash(npm *)'],
        exitOnUnauthorized: false,
      };

      expect(engine.isToolAllowed('Bash(docker-compose up)', context)).toBe(true);
      expect(engine.isToolAllowed('Bash(npm test)', context)).toBe(true);
    });

    it('MAINTENANCE mode respects its policy', () => {
      const context: ExecutionContext = {
        taskId: 'test-maintenance',
        mode: ExecutionMode.MAINTENANCE,
        preapprovedTools: ['Bash(docker *)', 'Bash(npm test)'],
        exitOnUnauthorized: true,
      };

      expect(engine.isToolAllowed('Bash(docker ps)', context)).toBe(true);
      expect(engine.isToolAllowed('Bash(npm test)', context)).toBe(true);
      expect(engine.isToolAllowed('Agent(something)', context)).toBe(false);
    });
  });

  describe('getPreapprovedTools', () => {
    it('INTERACTIVE returns empty (no pre-approval needed)', () => {
      const context: ExecutionContext = {
        taskId: 'test-interactive',
        mode: ExecutionMode.INTERACTIVE,
        preapprovedTools: ['Bash(*)'],
        exitOnUnauthorized: false,
      };

      expect(engine.getPreapprovedTools(context)).toEqual([]);
    });

    it('UNATTENDED returns context pre-approved tools', () => {
      const preapproved = ['Bash(docker-*)', 'Bash(npm *)', 'Read'];
      const context: ExecutionContext = {
        taskId: 'test-unattended',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: preapproved,
        exitOnUnauthorized: true,
      };

      expect(engine.getPreapprovedTools(context)).toEqual(preapproved);
    });
  });

  describe('validateContext', () => {
    it('accepts valid UNATTENDED context', () => {
      const context: ExecutionContext = {
        taskId: 'valid-task',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Bash(docker-*)', 'Bash(npm *)'],
        exitOnUnauthorized: true,
        timeout: 300,
      };

      const result = engine.validateContext(context);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('rejects missing taskId', () => {
      const context: ExecutionContext = {
        taskId: '',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Bash(docker-*)'],
        exitOnUnauthorized: true,
      };

      const result = engine.validateContext(context);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('taskId is required');
    });

    it('rejects invalid mode', () => {
      const context = {
        taskId: 'test',
        mode: 'INVALID_MODE' as ExecutionMode,
        preapprovedTools: ['Bash(*)'],
        exitOnUnauthorized: true,
      };

      const result = engine.validateContext(context);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('mode must be one of');
    });

    it('rejects UNATTENDED without pre-approved tools', () => {
      const context: ExecutionContext = {
        taskId: 'test',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: [],
        exitOnUnauthorized: true,
      };

      const result = engine.validateContext(context);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'mode UNATTENDED requires at least one preapprovedTool'
      );
    });

    it('rejects timeout < 10 seconds', () => {
      const context: ExecutionContext = {
        taskId: 'test',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Bash(docker-*)'],
        exitOnUnauthorized: true,
        timeout: 5,
      };

      const result = engine.validateContext(context);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('timeout must be >= 10 seconds');
    });
  });

  describe('pattern matching', () => {
    it('matches exact patterns', () => {
      const context: ExecutionContext = {
        taskId: 'test',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Bash(npm test)', 'Read', 'Grep'],
        exitOnUnauthorized: true,
      };

      expect(engine.isToolAllowed('Bash(npm test)', context)).toBe(true);
      expect(engine.isToolAllowed('Read', context)).toBe(true);
      expect(engine.isToolAllowed('Grep', context)).toBe(true);
    });

    it('matches wildcard patterns', () => {
      const context: ExecutionContext = {
        taskId: 'test',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Bash(docker *)', 'Bash(npm *)'],
        exitOnUnauthorized: true,
      };

      expect(engine.isToolAllowed('Bash(docker compose up)', context)).toBe(true);
      expect(engine.isToolAllowed('Bash(docker ps)', context)).toBe(true);
      expect(engine.isToolAllowed('Bash(npm test)', context)).toBe(true);
      expect(engine.isToolAllowed('Bash(npm run build)', context)).toBe(true);
    });
  });

  describe('global engine', () => {
    it('returns singleton instance', () => {
      const engine1 = getExecutionPolicyEngine();
      const engine2 = getExecutionPolicyEngine();
      expect(engine1).toBe(engine2);
    });
  });
});

describe('TaskMetadataStore', () => {
  let store: TaskMetadataStore;

  beforeEach(() => {
    store = new TaskMetadataStore();
  });

  describe('context management', () => {
    it('registers and retrieves execution context', () => {
      const context: ExecutionContext = {
        taskId: 'test-task',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Bash(docker-*)'],
        exitOnUnauthorized: true,
      };

      store.registerTask(context);
      const retrieved = store.getContext('test-task');

      expect(retrieved).toBeDefined();
      expect(retrieved?.taskId).toBe('test-task');
      expect(retrieved?.mode).toBe(ExecutionMode.UNATTENDED);
    });

    it('returns null for non-existent task', () => {
      expect(store.getContext('nonexistent')).toBeNull();
    });

    it('sets and gets current context globally', () => {
      const context: ExecutionContext = {
        taskId: 'current-task',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Bash(docker-*)'],
        exitOnUnauthorized: true,
      };

      store.setCurrentContext(context);
      const retrieved = store.getCurrentContext();

      expect(retrieved?.taskId).toBe('current-task');
    });

    it('clears current context', () => {
      const context: ExecutionContext = {
        taskId: 'temp-task',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Bash(docker-*)'],
        exitOnUnauthorized: true,
      };

      store.setCurrentContext(context);
      expect(store.getCurrentContext()).toBeDefined();

      store.clearCurrentContext();
      expect(store.getCurrentContext()).toBeNull();
    });
  });

  describe('execution tracking', () => {
    it('starts and completes execution', () => {
      const context: ExecutionContext = {
        taskId: 'tracked-task',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Bash(docker-*)'],
        exitOnUnauthorized: true,
      };

      const record = store.startExecution(context);
      expect(record.status).toBe('RUNNING');
      expect(record.toolCalls).toEqual([]);

      store.recordToolCall('tracked-task', 'Bash(docker-compose up)', true, 'preapproved');
      const completed = store.completeExecution('tracked-task', 'SUCCESS');

      expect(completed?.status).toBe('SUCCESS');
      expect(completed?.toolCalls).toHaveLength(1);
    });

    it('records multiple tool calls', () => {
      const context: ExecutionContext = {
        taskId: 'multi-tool-task',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Bash(docker-*)', 'Bash(npm *)'],
        exitOnUnauthorized: true,
      };

      store.startExecution(context);
      store.recordToolCall('multi-tool-task', 'Bash(docker-compose up)', true, 'preapproved');
      store.recordToolCall('multi-tool-task', 'Bash(npm test)', true, 'preapproved');
      store.recordToolCall('multi-tool-task', 'Bash(curl evil)', false, 'denied', 'Not in preapproved set');
      store.completeExecution('multi-tool-task', 'PARTIAL_FAILURE', undefined, 'curl call');

      const execution = store.getExecution('multi-tool-task');
      expect(execution?.toolCalls).toHaveLength(3);
      expect(execution?.toolCalls[0].allowed).toBe(true);
      expect(execution?.toolCalls[2].allowed).toBe(false);
    });
  });

  describe('audit log export', () => {
    it('exports execution history as JSON', () => {
      const context: ExecutionContext = {
        taskId: 'audit-task',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Bash(docker-*)'],
        exitOnUnauthorized: true,
      };

      store.startExecution(context);
      store.recordToolCall('audit-task', 'Bash(docker-compose up)', true, 'preapproved');
      store.completeExecution('audit-task', 'SUCCESS');

      const log = store.exportAuditLog('audit-task');
      const parsed = JSON.parse(log);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].taskId).toBe('audit-task');
      expect(parsed[0].status).toBe('SUCCESS');
      expect(parsed[0].toolCalls).toHaveLength(1);
    });

    it('exports all execution histories', () => {
      const context1: ExecutionContext = {
        taskId: 'task-1',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Bash(docker-*)'],
        exitOnUnauthorized: true,
      };

      const context2: ExecutionContext = {
        taskId: 'task-2',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Bash(npm *)'],
        exitOnUnauthorized: true,
      };

      store.startExecution(context1);
      store.completeExecution('task-1', 'SUCCESS');

      store.startExecution(context2);
      store.completeExecution('task-2', 'SUCCESS');

      const log = store.exportAuditLog();
      const parsed = JSON.parse(log);

      expect(parsed).toHaveLength(2);
      expect(parsed.map((p: any) => p.taskId)).toContain('task-1');
      expect(parsed.map((p: any) => p.taskId)).toContain('task-2');
    });
  });

  describe('cleanup', () => {
    it('clears old execution records', () => {
      const context: ExecutionContext = {
        taskId: 'old-task',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Bash(docker-*)'],
        exitOnUnauthorized: true,
      };

      store.startExecution(context);
      store.completeExecution('old-task', 'SUCCESS');

      // Manually set old end time (2 hours ago)
      const record = store.getExecution('old-task');
      if (record) {
        record.endedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
      }

      const cleared = store.clearOldExecutions(1); // Clear > 1 hour old
      expect(cleared).toBe(1);
      expect(store.getExecution('old-task')).toBeNull();
    });
  });

  describe('global store', () => {
    it('returns singleton instance', () => {
      const store1 = getTaskMetadataStore();
      const store2 = getTaskMetadataStore();
      expect(store1).toBe(store2);
    });
  });
});
