import {
  ExecutionMode,
  ExecutionContext,
} from './ExecutionPolicy';
import {
  ExecutionPolicyInterceptor,
  getExecutionPolicyInterceptor,
} from './ExecutionPolicyInterceptor';

describe('ExecutionPolicyInterceptor', () => {
  let interceptor: ExecutionPolicyInterceptor;

  beforeEach(() => {
    interceptor = new ExecutionPolicyInterceptor();
  });

  describe('checkToolCall', () => {
    it('allows tools when no execution context set', () => {
      const result = interceptor.checkToolCall('Bash(docker-compose up)');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('no-execution-context');
    });

    it('allows pre-approved tools in UNATTENDED mode', () => {
      const context: ExecutionContext = {
        taskId: 'task-1',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Bash(docker-*)'],
        exitOnUnauthorized: true,
      };

      interceptor.startTask(context);
      const result = interceptor.checkToolCall('Bash(docker-compose up)', 'task-1');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('preapproved');
    });

    it('denies unauthorized tools in UNATTENDED mode with exitOnUnauthorized', () => {
      const context: ExecutionContext = {
        taskId: 'task-2',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Bash(docker-*)'],
        exitOnUnauthorized: true,
      };

      interceptor.startTask(context);
      const result = interceptor.checkToolCall('Bash(curl evil.com)', 'task-2');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('denied-by-policy');
      expect(result.error).toBeDefined();
    });

    it('marks task as failed when unauthorized tool called in UNATTENDED mode', () => {
      const context: ExecutionContext = {
        taskId: 'task-3',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Bash(npm *)'],
        exitOnUnauthorized: true,
      };

      interceptor.startTask(context);
      interceptor.checkToolCall('Bash(dangerous-command)', 'task-3');

      const execution = interceptor.getExecutionHistory('task-3');
      expect(execution?.status).toBe('FAILURE');
      expect(execution?.failurePoint).toBe('Bash(dangerous-command)');
    });

    it('records allowed tool calls in audit trail', () => {
      const context: ExecutionContext = {
        taskId: 'task-4',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Bash(docker-*)', 'Bash(npm *)'],
        exitOnUnauthorized: false,
      };

      interceptor.startTask(context);
      interceptor.checkToolCall('Bash(docker-compose up)', 'task-4');
      interceptor.checkToolCall('Bash(npm test)', 'task-4');

      const execution = interceptor.getExecutionHistory('task-4');
      expect(execution?.toolCalls).toHaveLength(2);
      expect(execution?.toolCalls[0].allowed).toBe(true);
      expect(execution?.toolCalls[1].allowed).toBe(true);
    });

    it('records denied tool calls in audit trail', () => {
      const context: ExecutionContext = {
        taskId: 'task-5',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Bash(npm *)'],
        exitOnUnauthorized: false,
      };

      interceptor.startTask(context);
      interceptor.checkToolCall('Bash(npm test)', 'task-5');
      interceptor.checkToolCall('Bash(curl http://...)', 'task-5');

      const execution = interceptor.getExecutionHistory('task-5');
      expect(execution?.toolCalls).toHaveLength(2);
      expect(execution?.toolCalls[0].allowed).toBe(true);
      expect(execution?.toolCalls[1].allowed).toBe(false);
    });
  });

  describe('task lifecycle', () => {
    it('starts and ends task execution', () => {
      const context: ExecutionContext = {
        taskId: 'lifecycle-task',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Bash(docker-*)'],
        exitOnUnauthorized: true,
      };

      interceptor.startTask(context);
      expect(interceptor.getCurrentContext()).toBeDefined();
      expect(interceptor.getCurrentContext()?.taskId).toBe('lifecycle-task');

      interceptor.checkToolCall('Bash(docker-compose up)', 'lifecycle-task');
      interceptor.endTask('lifecycle-task', 'SUCCESS');

      expect(interceptor.getCurrentContext()).toBeNull();
      const execution = interceptor.getExecutionHistory('lifecycle-task');
      expect(execution?.status).toBe('SUCCESS');
    });

    it('rejects invalid context', () => {
      const invalidContext: ExecutionContext = {
        taskId: '',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: [],
        exitOnUnauthorized: true,
      };

      expect(() => interceptor.startTask(invalidContext)).toThrow();
    });
  });

  describe('audit log export', () => {
    it('exports task execution as JSON', () => {
      const context: ExecutionContext = {
        taskId: 'audit-task',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Bash(docker-*)'],
        exitOnUnauthorized: true,
      };

      interceptor.startTask(context);
      interceptor.checkToolCall('Bash(docker-compose up)', 'audit-task');
      interceptor.endTask('audit-task', 'SUCCESS');

      const log = interceptor.exportAuditLog('audit-task');
      const parsed = JSON.parse(log);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].taskId).toBe('audit-task');
      expect(parsed[0].mode).toBe(ExecutionMode.UNATTENDED);
      expect(parsed[0].status).toBe('SUCCESS');
      expect(parsed[0].toolCalls).toHaveLength(1);
    });
  });

  describe('global interceptor', () => {
    it('returns singleton instance', () => {
      const inter1 = getExecutionPolicyInterceptor();
      const inter2 = getExecutionPolicyInterceptor();
      expect(inter1).toBe(inter2);
    });
  });

  describe('INTERACTIVE mode behavior', () => {
    it('allows all tools in INTERACTIVE mode', () => {
      const context: ExecutionContext = {
        taskId: 'interactive-task',
        mode: ExecutionMode.INTERACTIVE,
        preapprovedTools: [],
        exitOnUnauthorized: false,
      };

      interceptor.startTask(context);
      const result1 = interceptor.checkToolCall('Bash(docker-compose up)', 'interactive-task');
      const result2 = interceptor.checkToolCall('Agent(something)', 'interactive-task');
      const result3 = interceptor.checkToolCall('AskUserQuestion', 'interactive-task');

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
      expect(result3.allowed).toBe(true);
    });
  });

  describe('BATCH mode behavior', () => {
    it('allows pre-approved tools in BATCH mode', () => {
      const context: ExecutionContext = {
        taskId: 'batch-task',
        mode: ExecutionMode.BATCH,
        preapprovedTools: ['Bash(docker-*)', 'Bash(npm *)'],
        exitOnUnauthorized: false,
      };

      interceptor.startTask(context);
      const result1 = interceptor.checkToolCall('Bash(docker-compose up)', 'batch-task');
      const result2 = interceptor.checkToolCall('Bash(npm test)', 'batch-task');

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });

    it('denies Agent spawn in BATCH mode', () => {
      const context: ExecutionContext = {
        taskId: 'batch-task-2',
        mode: ExecutionMode.BATCH,
        preapprovedTools: ['Bash(docker-*)'],
        exitOnUnauthorized: false,
      };

      interceptor.startTask(context);
      const result = interceptor.checkToolCall('Agent(subagent)', 'batch-task-2');

      expect(result.allowed).toBe(false);
    });
  });
});
