/**
 * Execution Mode & Policy Engine
 *
 * Prevents permission prompts in unattended automation by enforcing pre-approved tool sets
 * before harness sees the tool call. Harness permission system is last line of defense only.
 */
/**
 * Execution context determines how permission checks behave
 */
export declare enum ExecutionMode {
    /** Default: current behavior, prompts user for unauthorized tools */
    INTERACTIVE = "INTERACTIVE",
    /** Scheduled/automated: skips prompts, fails fast on unauthorized tools */
    UNATTENDED = "UNATTENDED",
    /** Multi-step task: single upfront approval covers all calls in batch */
    BATCH = "BATCH",
    /** Service/daemon: pre-approved trusted pattern set */
    MAINTENANCE = "MAINTENANCE"
}
/**
 * Mode settings loaded from .claude/settings.json
 */
export interface ModeSettings {
    description?: string;
    preapprovedTools?: string[];
    exitOnUnauthorized?: boolean;
    timeout?: number;
    allowsAgentSpawn?: boolean;
    allowsUserInteraction?: boolean;
}
/**
 * Metadata for a task execution context
 */
export interface ExecutionContext {
    /** Unique task identifier */
    taskId: string;
    /** Execution mode */
    mode: ExecutionMode;
    /** Tools explicitly pre-approved for this task */
    preapprovedTools: string[];
    /** Whether to fail fast on unauthorized tools (vs waiting for prompt) */
    exitOnUnauthorized: boolean;
    /** Task timeout in seconds */
    timeout?: number;
    /** Whether to audit all tool calls */
    auditLog?: boolean;
    /** Creation timestamp */
    createdAt?: Date;
}
/**
 * Policy engine: decides if a tool call is allowed in current execution context
 */
export declare class ExecutionPolicyEngine {
    private modeSettings;
    private policies;
    constructor();
    /**
     * Get mode settings from file or defaults
     */
    getModeSettings(mode: ExecutionMode): ModeSettings;
    /**
     * Merge task context with mode settings defaults
     * Task context takes precedence over settings defaults
     */
    mergeContextWithSettings(context: ExecutionContext): ExecutionContext;
    /**
     * Check if tool is allowed in given execution context
     */
    isToolAllowed(tool: string, context: ExecutionContext): boolean;
    /**
     * Get pre-approved tools for this context (what can run without further checks)
     */
    getPreapprovedTools(context: ExecutionContext): string[];
    /**
     * Simple glob-style pattern matching
     * Supports: exact match, * wildcard, ** greedy match
     */
    private matchesPattern;
    /**
     * Validate ExecutionContext before task execution
     */
    validateContext(context: ExecutionContext): {
        valid: boolean;
        errors: string[];
    };
}
export declare function getExecutionPolicyEngine(): ExecutionPolicyEngine;
//# sourceMappingURL=ExecutionPolicy.d.ts.map