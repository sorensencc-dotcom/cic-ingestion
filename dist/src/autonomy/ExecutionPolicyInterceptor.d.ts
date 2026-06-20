/**
 * Execution Policy Interceptor
 *
 * Wraps tool calls to enforce execution policy before harness permission checks.
 * Intercepts at agent level, decides if tool is allowed based on ExecutionMode,
 * records audit trail, and fails fast on UNATTENDED tasks.
 */
import { ExecutionContext } from './ExecutionPolicy.js';
/**
 * Result of policy check
 */
export interface PolicyCheckResult {
    allowed: boolean;
    reason: string;
    error?: string;
}
/**
 * Policy interceptor: enforces policy before tool execution
 */
export declare class ExecutionPolicyInterceptor {
    private engine;
    private store;
    /**
     * Check if tool call is allowed in current execution context
     * Called BEFORE the harness executes the tool
     */
    checkToolCall(toolName: string, taskId?: string): PolicyCheckResult;
    /**
     * Start execution for a task context
     * Call this before the task begins executing tools
     */
    startTask(context: ExecutionContext): void;
    /**
     * Complete execution for a task
     * Call this after task finishes (success or failure)
     */
    endTask(taskId: string, status: 'SUCCESS' | 'FAILURE' | 'PARTIAL_FAILURE', error?: string): void;
    /**
     * Get current execution context
     */
    getCurrentContext(taskId?: string): ExecutionContext | null;
    /**
     * Get execution history for audit
     */
    getExecutionHistory(taskId: string): import("./TaskMetadataStore.js").TaskExecutionRecord | null;
    /**
     * Export audit log
     */
    exportAuditLog(taskId?: string): string;
}
export declare function getExecutionPolicyInterceptor(): ExecutionPolicyInterceptor;
//# sourceMappingURL=ExecutionPolicyInterceptor.d.ts.map