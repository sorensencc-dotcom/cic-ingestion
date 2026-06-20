/**
 * Execution Policy Interceptor
 *
 * Wraps tool calls to enforce execution policy before harness permission checks.
 * Intercepts at agent level, decides if tool is allowed based on ExecutionMode,
 * records audit trail, and fails fast on UNATTENDED tasks.
 */
import { ExecutionMode, getExecutionPolicyEngine, } from './ExecutionPolicy.js';
import { getTaskMetadataStore } from './TaskMetadataStore.js';
/**
 * Policy interceptor: enforces policy before tool execution
 */
export class ExecutionPolicyInterceptor {
    constructor() {
        this.engine = getExecutionPolicyEngine();
        this.store = getTaskMetadataStore();
    }
    /**
     * Check if tool call is allowed in current execution context
     * Called BEFORE the harness executes the tool
     */
    checkToolCall(toolName, taskId) {
        const context = taskId
            ? this.store.getContext(taskId)
            : this.store.getCurrentContext();
        // If no context set, allow (INTERACTIVE mode assumed)
        if (!context) {
            return {
                allowed: true,
                reason: 'no-execution-context',
            };
        }
        // Check if tool is allowed
        const allowed = this.engine.isToolAllowed(toolName, context);
        if (!allowed) {
            const reason = 'denied-by-policy';
            const error = `Tool ${toolName} not allowed in ${context.mode} mode. Pre-approved: ${context.preapprovedTools.join(', ')}`;
            // Record denied tool call
            this.store.recordToolCall(context.taskId, toolName, false, reason, error);
            // If UNATTENDED and exitOnUnauthorized, fail fast
            if (context.mode === ExecutionMode.UNATTENDED &&
                context.exitOnUnauthorized) {
                // Mark task as failed
                this.store.completeExecution(context.taskId, 'FAILURE', error, toolName);
                return {
                    allowed: false,
                    reason,
                    error,
                };
            }
            // For other modes, just record and continue (harness will prompt)
            return {
                allowed: false,
                reason,
                error,
            };
        }
        // Tool allowed
        const reason = context.mode === ExecutionMode.INTERACTIVE
            ? 'interactive-mode'
            : 'preapproved';
        this.store.recordToolCall(context.taskId, toolName, true, reason);
        return {
            allowed: true,
            reason,
        };
    }
    /**
     * Start execution for a task context
     * Call this before the task begins executing tools
     */
    startTask(context) {
        // Validate context
        const validation = this.engine.validateContext(context);
        if (!validation.valid) {
            throw new Error(`Invalid execution context: ${validation.errors.join('; ')}`);
        }
        // Register and start tracking
        this.store.setCurrentContext(context);
        this.store.startExecution(context);
    }
    /**
     * Complete execution for a task
     * Call this after task finishes (success or failure)
     */
    endTask(taskId, status, error) {
        this.store.completeExecution(taskId, status, error);
        this.store.clearCurrentContext();
    }
    /**
     * Get current execution context
     */
    getCurrentContext(taskId) {
        return this.store.getCurrentContext(taskId);
    }
    /**
     * Get execution history for audit
     */
    getExecutionHistory(taskId) {
        return this.store.getExecution(taskId);
    }
    /**
     * Export audit log
     */
    exportAuditLog(taskId) {
        return this.store.exportAuditLog(taskId);
    }
}
/**
 * Global interceptor instance
 */
let globalInterceptor = null;
export function getExecutionPolicyInterceptor() {
    if (!globalInterceptor) {
        globalInterceptor = new ExecutionPolicyInterceptor();
    }
    return globalInterceptor;
}
//# sourceMappingURL=ExecutionPolicyInterceptor.js.map