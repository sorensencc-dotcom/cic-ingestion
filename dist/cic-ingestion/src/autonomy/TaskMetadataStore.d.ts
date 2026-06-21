/**
 * Task Metadata Store
 *
 * Holds ExecutionContext objects keyed by taskId.
 * Decouples execution context from ScheduleWakeup signature.
 * When task is scheduled, metadata is stored here; when task wakes, it looks up its context.
 */
import { ExecutionContext } from './ExecutionPolicy.js';
/**
 * Audit record for a tool call
 */
export interface ToolCallAudit {
    timestamp: Date;
    tool: string;
    allowed: boolean;
    reason: string;
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
export declare class TaskMetadataStore {
    private contexts;
    private executions;
    /**
     * Store execution context for a task (called before ScheduleWakeup)
     * Merges task context with mode settings defaults from .claude/settings.json
     */
    registerTask(context: ExecutionContext): void;
    /**
     * Retrieve execution context for current task
     * Called when agent wakes from scheduled execution
     */
    getContext(taskId: string): ExecutionContext | null;
    /**
     * Get current execution context by taskId or from global if set
     */
    getCurrentContext(taskId?: string): ExecutionContext | null;
    /**
     * Set current execution context globally (for single task execution)
     */
    setCurrentContext(context: ExecutionContext): void;
    /**
     * Clear current execution context
     */
    clearCurrentContext(): void;
    /**
     * Start task execution record
     */
    startExecution(context: ExecutionContext): TaskExecutionRecord;
    /**
     * Record a tool call in execution history
     */
    recordToolCall(taskId: string, tool: string, allowed: boolean, reason: string, error?: string): void;
    /**
     * Mark task execution as complete
     */
    completeExecution(taskId: string, status: 'SUCCESS' | 'FAILURE' | 'PARTIAL_FAILURE', error?: string, failurePoint?: string): TaskExecutionRecord | null;
    /**
     * Get execution history for a task
     */
    getExecution(taskId: string): TaskExecutionRecord | null;
    /**
     * Get all execution records (for audit)
     */
    getAllExecutions(): TaskExecutionRecord[];
    /**
     * Clear old execution records (for memory management)
     */
    clearOldExecutions(olderThanHours?: number): number;
    /**
     * Export execution history as JSON for audit trail
     */
    exportAuditLog(taskId?: string): string;
}
export declare function getTaskMetadataStore(): TaskMetadataStore;
//# sourceMappingURL=TaskMetadataStore.d.ts.map