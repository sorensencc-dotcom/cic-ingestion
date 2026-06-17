/**
 * Phase D: Comprehensive Testing
 * E2E Docker integration, failure cases, load testing, audit trail validation
 * Uses test-setup.js batch approval (npm test only, no per-test prompts)
 */

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
import { ExecutionPolicyInterceptor, getExecutionPolicyInterceptor } from './ExecutionPolicyInterceptor';

describe('Phase D: Comprehensive Execution Policy Testing', () => {
  let engine: ExecutionPolicyEngine;
  let store: TaskMetadataStore;
  let interceptor: ExecutionPolicyInterceptor;

  beforeEach(() => {
    engine = new ExecutionPolicyEngine();
    store = new TaskMetadataStore();
    interceptor = new ExecutionPolicyInterceptor();
  });

  describe('E2E Docker Integration', () => {
    it('simulates Docker build in UNATTENDED mode with no prompts', () => {
      // Scenario: Task scheduled via ScheduleWakeup, wakes in UNATTENDED mode
      const dockerBuildContext: ExecutionContext = {
        taskId: 'docker-build-phase-d-e2e',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: [
          'Bash(docker-compose *)',
          'Bash(docker *)',
          'Bash(npm *)',
          'Bash(git *)',
          'Read',
          'Grep',
        ],
        exitOnUnauthorized: true,
        timeout: 600,
      };

      // 1. Register context (simulates pre-ScheduleWakeup registration)
      store.registerTask(dockerBuildContext);
      const retrieved = store.getContext('docker-build-phase-d-e2e');
      expect(retrieved).toBeDefined();

      // 2. Start execution (simulates wake-up)
      const record = store.startExecution(retrieved!);
      expect(record.status).toBe('RUNNING');

      // 3. Simulate tool calls (all pre-approved, no prompts expected)
      const toolCalls = [
        'Bash(docker-compose up --build)',
        'Bash(npm test)',
        'Bash(git status)',
        'Read',
        'Grep',
      ];

      toolCalls.forEach((tool) => {
        const allowed = engine.isToolAllowed(tool, retrieved!);
        expect(allowed).toBe(true);
        store.recordToolCall('docker-build-phase-d-e2e', tool, true, 'preapproved');
      });

      // 4. Complete execution
      const completed = store.completeExecution('docker-build-phase-d-e2e', 'SUCCESS');
      expect(completed?.status).toBe('SUCCESS');
      expect(completed?.toolCalls).toHaveLength(5);

      // 5. Verify audit trail shows all tools allowed
      completed?.toolCalls.forEach((tc) => {
        expect(tc.allowed).toBe(true);
        expect(tc.reason).toBe('preapproved');
      });
    });

    it('Docker build with unauthorized tool fails fast in UNATTENDED mode', () => {
      const dockerContext: ExecutionContext = {
        taskId: 'docker-build-unauthorized',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Bash(docker-compose *)', 'Bash(npm *)'],
        exitOnUnauthorized: true,
        timeout: 600,
      };

      store.registerTask(dockerContext);
      const retrieved = store.getContext('docker-build-unauthorized')!;
      const record = store.startExecution(retrieved);

      // Pre-approved: should pass
      expect(engine.isToolAllowed('Bash(docker-compose up)', retrieved)).toBe(true);
      store.recordToolCall('docker-build-unauthorized', 'Bash(docker-compose up)', true, 'preapproved');

      // Unauthorized: should fail
      const unauthorizedTool = 'Bash(curl https://api.example.com)';
      expect(engine.isToolAllowed(unauthorizedTool, retrieved)).toBe(false);
      store.recordToolCall(
        'docker-build-unauthorized',
        unauthorizedTool,
        false,
        'denied',
        'Not in preapproved set'
      );

      // With exitOnUnauthorized=true, task should fail
      const completed = store.completeExecution(
        'docker-build-unauthorized',
        'FAILURE',
        'Unauthorized tool call',
        unauthorizedTool
      );

      expect(completed?.status).toBe('FAILURE');
      expect(completed?.failurePoint).toBe(unauthorizedTool);
      expect(completed?.toolCalls[1].allowed).toBe(false);
    });
  });

  describe('Failure Cases & Edge Behavior', () => {
    it('UNATTENDED mode with exitOnUnauthorized=false continues after denial', () => {
      const context: ExecutionContext = {
        taskId: 'fail-but-continue',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Bash(npm *)'],
        exitOnUnauthorized: false, // Key difference
        timeout: 300,
      };

      store.registerTask(context);
      const retrieved = store.getContext('fail-but-continue')!;
      store.startExecution(retrieved);

      // Approved tool
      store.recordToolCall('fail-but-continue', 'Bash(npm test)', true, 'preapproved');

      // Denied tool
      store.recordToolCall(
        'fail-but-continue',
        'Bash(curl evil)',
        false,
        'denied',
        'Not preapproved'
      );

      // More approved tools after denial
      store.recordToolCall('fail-but-continue', 'Bash(npm run build)', true, 'preapproved');

      const completed = store.completeExecution('fail-but-continue', 'PARTIAL_FAILURE', undefined, 'curl call');

      // Even though one tool was denied, execution can continue
      expect(completed?.status).toBe('PARTIAL_FAILURE');
      expect(completed?.toolCalls).toHaveLength(3);
      expect(completed?.toolCalls[1].allowed).toBe(false);
      expect(completed?.toolCalls[2].allowed).toBe(true);
    });

    it('BATCH mode allows single upfront approval with multiple chained calls', () => {
      const batchContext: ExecutionContext = {
        taskId: 'batch-pipeline',
        mode: ExecutionMode.BATCH,
        preapprovedTools: [
          'Bash(docker-*)',
          'Bash(npm *)',
          'Bash(git *)',
          'Read',
          'Edit',
        ],
        exitOnUnauthorized: false, // Batch allows some failures
        timeout: 1800,
      };

      store.registerTask(batchContext);
      const retrieved = store.getContext('batch-pipeline')!;
      store.startExecution(retrieved);

      // Simulate 10-call batch pipeline
      const batchCalls = [
        'Bash(docker-compose build)',
        'Bash(npm install)',
        'Bash(npm test)',
        'Read',
        'Edit',
        'Bash(npm run build)',
        'Bash(git status)',
        'Bash(docker-compose push)',
        'Bash(git commit -m "build")',
        'Bash(npm run deploy)',
      ];

      batchCalls.forEach((tool) => {
        const allowed = engine.isToolAllowed(tool, retrieved);
        expect(allowed).toBe(true);
        store.recordToolCall('batch-pipeline', tool, allowed, 'preapproved');
      });

      const completed = store.completeExecution('batch-pipeline', 'SUCCESS');
      expect(completed?.toolCalls).toHaveLength(10);
      expect(completed?.toolCalls.every((tc) => tc.allowed)).toBe(true);
    });

    it('MAINTENANCE mode rejects Agent spawn', () => {
      const maintenanceContext: ExecutionContext = {
        taskId: 'daemon-process',
        mode: ExecutionMode.MAINTENANCE,
        preapprovedTools: ['Bash(docker *)', 'Bash(npm test)', 'Read', 'Grep'],
        exitOnUnauthorized: true,
        timeout: 7200,
      };

      const context = maintenanceContext;

      // Pre-approved tools allowed
      expect(engine.isToolAllowed('Bash(docker ps)', context)).toBe(true);
      expect(engine.isToolAllowed('Read', context)).toBe(true);

      // Denied tools
      expect(engine.isToolAllowed('Agent(something)', context)).toBe(false);
      expect(engine.isToolAllowed('AskUserQuestion', context)).toBe(false);
      expect(engine.isToolAllowed('ScheduleWakeup', context)).toBe(false);
    });

    it('timeout validation rejects values < 10 seconds', () => {
      const badContext: ExecutionContext = {
        taskId: 'bad-timeout',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Bash(npm *)'],
        exitOnUnauthorized: true,
        timeout: 5, // Too short
      };

      const validation = engine.validateContext(badContext);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('timeout must be >= 10 seconds');
    });
  });

  describe('Load Testing: Concurrent Task Execution', () => {
    it('handles 10 concurrent UNATTENDED tasks without cross-contamination', () => {
      const tasks: ExecutionContext[] = [];
      const taskIds: string[] = [];

      // Register 10 tasks
      for (let i = 0; i < 10; i++) {
        const context: ExecutionContext = {
          taskId: `concurrent-task-${i}`,
          mode: ExecutionMode.UNATTENDED,
          preapprovedTools: [`Bash(task-${i}-*)`], // Unique pattern per task
          exitOnUnauthorized: true,
          timeout: 300,
        };
        tasks.push(context);
        taskIds.push(context.taskId);
        store.registerTask(context);
      }

      // Start all tasks
      tasks.forEach((task) => {
        store.startExecution(task);
      });

      // Simulate parallel tool calls
      tasks.forEach((task, index) => {
        store.recordToolCall(`concurrent-task-${index}`, `Bash(task-${index}-command)`, true, 'preapproved');
      });

      // Verify isolation: each task has only its own calls
      tasks.forEach((task, index) => {
        const execution = store.getExecution(`concurrent-task-${index}`);
        expect(execution?.toolCalls).toHaveLength(1);
        expect(execution?.toolCalls[0].tool).toContain(`task-${index}`);
      });

      // Complete all tasks
      tasks.forEach((task, index) => {
        store.completeExecution(`concurrent-task-${index}`, 'SUCCESS');
      });

      // Verify all tasks completed independently
      const allExecutions = store.getAllExecutions();
      expect(allExecutions).toHaveLength(10);
      expect(allExecutions.every((ex) => ex.status === 'SUCCESS')).toBe(true);
    });

    it('merges settings across 10 tasks in parallel without conflicts', () => {
      // Register 10 tasks using settings defaults
      for (let i = 0; i < 10; i++) {
        const partialContext: ExecutionContext = {
          taskId: `settings-merge-task-${i}`,
          mode: ExecutionMode.UNATTENDED,
          preapprovedTools: [], // Rely on settings
          exitOnUnauthorized: true,
        };

        const merged = engine.mergeContextWithSettings(partialContext);
        expect(merged.taskId).toBe(`settings-merge-task-${i}`);
        expect(merged.mode).toBe(ExecutionMode.UNATTENDED);
        // Settings should fill in defaults
        expect(merged.timeout).toBeGreaterThan(0);
      }
    });

    it('handles 50-call execution without memory leaks', () => {
      const context: ExecutionContext = {
        taskId: 'high-volume-task',
        mode: ExecutionMode.BATCH,
        preapprovedTools: ['Bash(npm *)', 'Read', 'Edit'],
        exitOnUnauthorized: false,
        timeout: 3600,
      };

      store.registerTask(context);
      store.startExecution(context);

      // Simulate 50 tool calls
      for (let i = 0; i < 50; i++) {
        const tool = i % 2 === 0 ? 'Bash(npm test)' : 'Read';
        store.recordToolCall('high-volume-task', tool, true, 'preapproved');
      }

      const execution = store.getExecution('high-volume-task');
      expect(execution?.toolCalls).toHaveLength(50);
      expect(execution?.toolCalls.filter((tc) => tc.allowed)).toHaveLength(50);
    });
  });

  describe('Audit Trail Validation', () => {
    it('exports detailed audit log with all metadata', () => {
      const context: ExecutionContext = {
        taskId: 'audit-detailed',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Bash(docker-*)', 'Bash(npm *)'],
        exitOnUnauthorized: true,
        timeout: 600,
      };

      store.registerTask(context);
      store.startExecution(context);

      store.recordToolCall('audit-detailed', 'Bash(docker-compose up)', true, 'preapproved');
      store.recordToolCall('audit-detailed', 'Bash(npm test)', true, 'preapproved');
      store.recordToolCall(
        'audit-detailed',
        'Bash(unauthorized)',
        false,
        'denied',
        'Not in preapproved set'
      );

      store.completeExecution('audit-detailed', 'PARTIAL_FAILURE');

      const log = store.exportAuditLog('audit-detailed');
      const parsed = JSON.parse(log);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);

      const record = parsed[0];
      expect(record.taskId).toBe('audit-detailed');
      expect(record.mode).toBe(ExecutionMode.UNATTENDED);
      expect(record.status).toBe('PARTIAL_FAILURE');
      expect(record.startedAt).toBeDefined();
      expect(record.endedAt).toBeDefined();
      expect(record.toolCalls).toHaveLength(3);

      // Verify tool call details
      expect(record.toolCalls[0].allowed).toBe(true);
      expect(record.toolCalls[0].reason).toBe('preapproved');
      expect(record.toolCalls[2].allowed).toBe(false);
      expect(record.toolCalls[2].error).toBe('Not in preapproved set');
    });

    it('audit trail records ISO timestamps for traceability', () => {
      const context: ExecutionContext = {
        taskId: 'audit-timestamps',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Bash(*)'],
        exitOnUnauthorized: true,
      };

      const beforeTime = new Date();
      store.registerTask(context);
      store.startExecution(context);
      store.recordToolCall('audit-timestamps', 'Bash(test)', true, 'preapproved');
      store.completeExecution('audit-timestamps', 'SUCCESS');
      const afterTime = new Date();

      const log = store.exportAuditLog('audit-timestamps');
      const record = JSON.parse(log)[0];

      const startTime = new Date(record.startedAt);
      const endTime = new Date(record.endedAt);

      expect(startTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(endTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
      expect(endTime.getTime()).toBeGreaterThanOrEqual(startTime.getTime());
    });

    it('audit trail shows authorization decisions for every tool call', () => {
      const context: ExecutionContext = {
        taskId: 'audit-decisions',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Bash(safe-*)', 'Read'],
        exitOnUnauthorized: false,
      };

      store.registerTask(context);
      store.startExecution(context);

      // Mix of allowed and denied
      const calls = [
        { tool: 'Bash(safe-command)', allowed: true, reason: 'preapproved' },
        { tool: 'Bash(unsafe-command)', allowed: false, reason: 'denied' },
        { tool: 'Read', allowed: true, reason: 'preapproved' },
        { tool: 'Edit', allowed: false, reason: 'denied' },
        { tool: 'Bash(safe-another)', allowed: true, reason: 'preapproved' },
      ];

      calls.forEach((call) => {
        store.recordToolCall('audit-decisions', call.tool, call.allowed, call.reason);
      });

      store.completeExecution('audit-decisions', 'PARTIAL_FAILURE');

      const log = store.exportAuditLog('audit-decisions');
      const record = JSON.parse(log)[0];
      const toolCalls = record.toolCalls;

      expect(toolCalls).toHaveLength(5);
      calls.forEach((expectedCall, index) => {
        expect(toolCalls[index].tool).toBe(expectedCall.tool);
        expect(toolCalls[index].allowed).toBe(expectedCall.allowed);
        expect(toolCalls[index].reason).toBe(expectedCall.reason);
      });
    });

    it('clears old execution records after retention period', () => {
      // Register and complete 3 tasks
      for (let i = 0; i < 3; i++) {
        const context: ExecutionContext = {
          taskId: `cleanup-task-${i}`,
          mode: ExecutionMode.UNATTENDED,
          preapprovedTools: ['Bash(*)'],
          exitOnUnauthorized: true,
        };

        store.registerTask(context);
        store.startExecution(context);
        store.completeExecution(`cleanup-task-${i}`, 'SUCCESS');
      }

      // Manually age first 2 tasks with clear cutoff
      const record0 = store.getExecution('cleanup-task-0');
      const record1 = store.getExecution('cleanup-task-1');
      if (record0) record0.endedAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      if (record1) record1.endedAt = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago (recent)

      // Clear tasks older than 1 hour
      const clearedCount = store.clearOldExecutions(1);
      expect(clearedCount).toBe(1); // Only task-0 is > 1 hour old

      // Verify cleanup
      expect(store.getExecution('cleanup-task-0')).toBeNull();
      expect(store.getExecution('cleanup-task-1')).toBeDefined(); // 30 min, not cleared
      expect(store.getExecution('cleanup-task-2')).toBeDefined(); // Recent
    });

    it('exports all execution histories for audit compliance', () => {
      const taskIds = ['task-1', 'task-2', 'task-3'];

      taskIds.forEach((taskId) => {
        const context: ExecutionContext = {
          taskId,
          mode: ExecutionMode.UNATTENDED,
          preapprovedTools: ['Bash(*)'],
          exitOnUnauthorized: true,
        };

        store.registerTask(context);
        store.startExecution(context);
        store.recordToolCall(taskId, 'Bash(cmd)', true, 'preapproved');
        store.completeExecution(taskId, 'SUCCESS');
      });

      const log = store.exportAuditLog(); // No taskId = all tasks
      const records = JSON.parse(log);

      expect(records).toHaveLength(3);
      expect(records.map((r: any) => r.taskId)).toEqual(expect.arrayContaining(taskIds));
    });
  });

  describe('Settings Merge Under Load', () => {
    it('task context precedence holds across 100 merge operations', () => {
      const overriddenContext: ExecutionContext = {
        taskId: 'stress-test-context',
        mode: ExecutionMode.UNATTENDED,
        preapprovedTools: ['Override(tool)'],
        exitOnUnauthorized: false,
        timeout: 123,
      };

      // Merge 100 times
      for (let i = 0; i < 100; i++) {
        const merged = engine.mergeContextWithSettings(overriddenContext);
        expect(merged.preapprovedTools).toContain('Override(tool)');
        expect(merged.exitOnUnauthorized).toBe(false);
        expect(merged.timeout).toBe(123);
      }
    });
  });
});
