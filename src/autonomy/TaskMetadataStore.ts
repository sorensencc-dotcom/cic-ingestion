/**
 * Task Metadata Store
 *
 * Holds ExecutionContext objects keyed by taskId.
 * Decouples execution context from ScheduleWakeup signature.
 * When task is scheduled, metadata is stored here; when task wakes, it looks up its context.
 */

import { ExecutionContext, ExecutionMode } from './ExecutionPolicy';

/**
 * Audit record for a tool call
 */
export interface ToolCallAudit {
  timestamp: Date;
  tool: string;
  allowed: boolean;
  reason: string; // 'preapproved', 'policy', 'interactive', 'denied', etc
  error?: string;
}

/**
 * Execution history for a task
 */
export interface TaskExecutionRecord {
  taskId: string;
  context: ExecutionContext;
  startedAt: Date;
  endedAt?: Date;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILURE' | 'PARTIAL_FAILURE';
  toolCalls: ToolCallAudit[];
  failurePoint?: string;
  error?: string;
}

/**
 * In-memory task metadata store
 */
export class TaskMetadataStore {
  private contexts = new Map<string, ExecutionContext>();
  private executions = new Map<string, TaskExecutionRecord>();

  /**
   * Store execution context for a task (called before ScheduleWakeup)
   */
  registerTask(context: ExecutionContext): void {
    this.contexts.set(context.taskId, {
      ...context,
      createdAt: context.createdAt || new Date(),
    });
  }

  /**
   * Retrieve execution context for current task
   * Called when agent wakes from scheduled execution
   */
  getContext(taskId: string): ExecutionContext | null {
    return this.contexts.get(taskId) || null;
  }

  /**
   * Get current execution context by taskId or from global if set
   */
  getCurrentContext(taskId?: string): ExecutionContext | null {
    if (taskId) {
      return this.getContext(taskId);
    }
    // Fallback: check global context if set
    return globalTaskContext || null;
  }

  /**
   * Set current execution context globally (for single task execution)
   */
  setCurrentContext(context: ExecutionContext): void {
    globalTaskContext = context;
    this.registerTask(context);
  }

  /**
   * Clear current execution context
   */
  clearCurrentContext(): void {
    globalTaskContext = null;
  }

  /**
   * Start task execution record
   */
  startExecution(context: ExecutionContext): TaskExecutionRecord {
    const record: TaskExecutionRecord = {
      taskId: context.taskId,
      context,
      startedAt: new Date(),
      status: 'RUNNING',
      toolCalls: [],
    };
    this.executions.set(context.taskId, record);
    return record;
  }

  /**
   * Record a tool call in execution history
   */
  recordToolCall(
    taskId: string,
    tool: string,
    allowed: boolean,
    reason: string,
    error?: string
  ): void {
    const record = this.executions.get(taskId);
    if (record) {
      record.toolCalls.push({
        timestamp: new Date(),
        tool,
        allowed,
        reason,
        error,
      });
    }
  }

  /**
   * Mark task execution as complete
   */
  completeExecution(
    taskId: string,
    status: 'SUCCESS' | 'FAILURE' | 'PARTIAL_FAILURE',
    error?: string,
    failurePoint?: string
  ): TaskExecutionRecord | null {
    const record = this.executions.get(taskId);
    if (record) {
      record.status = status;
      record.endedAt = new Date();
      record.error = error;
      record.failurePoint = failurePoint;
    }
    return record || null;
  }

  /**
   * Get execution history for a task
   */
  getExecution(taskId: string): TaskExecutionRecord | null {
    return this.executions.get(taskId) || null;
  }

  /**
   * Get all execution records (for audit)
   */
  getAllExecutions(): TaskExecutionRecord[] {
    return Array.from(this.executions.values());
  }

  /**
   * Clear old execution records (for memory management)
   */
  clearOldExecutions(olderThanHours: number = 24): number {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    let cleared = 0;

    for (const [taskId, record] of this.executions) {
      if (record.endedAt && record.endedAt < cutoff) {
        this.executions.delete(taskId);
        this.contexts.delete(taskId);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Export execution history as JSON for audit trail
   */
  exportAuditLog(taskId?: string): string {
    const records = taskId
      ? [this.getExecution(taskId)].filter((r) => r !== null)
      : this.getAllExecutions();

    return JSON.stringify(
      records.map((r) => ({
        taskId: r.taskId,
        mode: r.context.mode,
        startedAt: r.startedAt.toISOString(),
        endedAt: r.endedAt?.toISOString(),
        status: r.status,
        toolCalls: r.toolCalls.map((tc) => ({
          timestamp: tc.timestamp.toISOString(),
          tool: tc.tool,
          allowed: tc.allowed,
          reason: tc.reason,
          error: tc.error,
        })),
        error: r.error,
        failurePoint: r.failurePoint,
      })),
      null,
      2
    );
  }
}

/**
 * Global context for current task execution
 * Set when task starts, cleared when task ends
 */
let globalTaskContext: ExecutionContext | null = null;

/**
 * Global store instance
 */
let globalStore: TaskMetadataStore | null = null;

export function getTaskMetadataStore(): TaskMetadataStore {
  if (!globalStore) {
    globalStore = new TaskMetadataStore();
  }
  return globalStore;
}
