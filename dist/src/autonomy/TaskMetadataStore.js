/**
 * Task Metadata Store
 *
 * Holds ExecutionContext objects keyed by taskId.
 * Decouples execution context from ScheduleWakeup signature.
 * When task is scheduled, metadata is stored here; when task wakes, it looks up its context.
 */
import { getExecutionPolicyEngine } from './ExecutionPolicy.js';
/**
 * In-memory task metadata store
 */
export class TaskMetadataStore {
    contexts = new Map();
    executions = new Map();
    /**
     * Store execution context for a task (called before ScheduleWakeup)
     * Merges task context with mode settings defaults from .claude/settings.json
     */
    registerTask(context) {
        const engine = getExecutionPolicyEngine();
        const mergedContext = engine.mergeContextWithSettings(context);
        this.contexts.set(context.taskId, {
            ...mergedContext,
            createdAt: mergedContext.createdAt || new Date(),
        });
    }
    /**
     * Retrieve execution context for current task
     * Called when agent wakes from scheduled execution
     */
    getContext(taskId) {
        return this.contexts.get(taskId) || null;
    }
    /**
     * Get current execution context by taskId or from global if set
     */
    getCurrentContext(taskId) {
        if (taskId) {
            return this.getContext(taskId);
        }
        // Fallback: check global context if set
        return globalTaskContext || null;
    }
    /**
     * Set current execution context globally (for single task execution)
     */
    setCurrentContext(context) {
        globalTaskContext = context;
        this.registerTask(context);
    }
    /**
     * Clear current execution context
     */
    clearCurrentContext() {
        globalTaskContext = null;
    }
    /**
     * Start task execution record
     */
    startExecution(context) {
        const record = {
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
    recordToolCall(taskId, tool, allowed, reason, error) {
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
    completeExecution(taskId, status, error, failurePoint) {
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
    getExecution(taskId) {
        return this.executions.get(taskId) || null;
    }
    /**
     * Get all execution records (for audit)
     */
    getAllExecutions() {
        return Array.from(this.executions.values());
    }
    /**
     * Clear old execution records (for memory management)
     */
    clearOldExecutions(olderThanHours = 24) {
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
    exportAuditLog(taskId) {
        const records = taskId
            ? [this.getExecution(taskId)].filter((r) => r !== null)
            : this.getAllExecutions();
        return JSON.stringify(records.map((r) => ({
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
        })), null, 2);
    }
}
/**
 * Global context for current task execution
 * Set when task starts, cleared when task ends
 */
let globalTaskContext = null;
/**
 * Global store instance
 */
let globalStore = null;
export function getTaskMetadataStore() {
    if (!globalStore) {
        globalStore = new TaskMetadataStore();
    }
    return globalStore;
}
//# sourceMappingURL=TaskMetadataStore.js.map