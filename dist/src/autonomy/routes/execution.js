/**
 * Execution Policy Router
 *
 * Endpoints for registering task execution contexts and auditing execution.
 * Used to set up pre-approved tool sets before ScheduleWakeup fires.
 */
import express from 'express';
import { ExecutionMode, getExecutionPolicyEngine, } from '../ExecutionPolicy.js';
import { getTaskMetadataStore, } from '../TaskMetadataStore.js';
import { getExecutionPolicyInterceptor, } from '../ExecutionPolicyInterceptor.js';
export function createExecutionRouter() {
    const router = express.Router();
    const store = getTaskMetadataStore();
    const engine = getExecutionPolicyEngine();
    const interceptor = getExecutionPolicyInterceptor();
    /**
     * POST /autonomy/execution/register
     * Register execution context for a task before scheduling
     *
     * Usage:
     * ```
     * POST /autonomy/execution/register
     * {
     *   "taskId": "build-phase-2-5",
     *   "mode": "UNATTENDED",
     *   "preapprovedTools": ["Bash(docker-compose *)", "Bash(npm *)", "Read", "Grep"],
     *   "exitOnUnauthorized": true,
     *   "timeout": 600
     * }
     * ```
     *
     * Then call ScheduleWakeup(taskId) in agent code.
     * When task wakes, it will:
     * 1. Look up context by taskId
     * 2. Set execution mode to UNATTENDED
     * 3. All tool calls check policy BEFORE harness permission checks
     * 4. Pre-approved tools execute without prompts
     * 5. Unauthorized tools fail fast (no hanging prompts)
     */
    router.post('/execution/register', (req, res) => {
        try {
            const context = req.body;
            // Validate context
            const validation = engine.validateContext(context);
            if (!validation.valid) {
                return res.status(400).json({
                    error: 'Invalid execution context',
                    details: validation.errors,
                });
            }
            // Register context
            store.registerTask(context);
            return res.json({
                registered: true,
                taskId: context.taskId,
                mode: context.mode,
                preapprovedTools: context.preapprovedTools,
                message: `Task ${context.taskId} registered. Use ScheduleWakeup(taskId) to schedule execution.`,
            });
        }
        catch (error) {
            return res.status(500).json({
                error: 'Failed to register execution context',
                message: error.message,
            });
        }
    });
    /**
     * GET /autonomy/execution/status/:taskId
     * Get current execution status for a task
     */
    router.get('/execution/status/:taskId', (req, res) => {
        try {
            const { taskId } = req.params;
            const execution = store.getExecution(taskId);
            if (!execution) {
                return res.status(404).json({
                    error: 'Task not found',
                    taskId,
                });
            }
            return res.json({
                taskId: execution.taskId,
                mode: execution.context.mode,
                status: execution.status,
                startedAt: execution.startedAt.toISOString(),
                endedAt: execution.endedAt?.toISOString(),
                toolCallCount: execution.toolCalls.length,
                allowedToolCount: execution.toolCalls.filter((t) => t.allowed).length,
                deniedToolCount: execution.toolCalls.filter((t) => !t.allowed).length,
                error: execution.error,
                failurePoint: execution.failurePoint,
            });
        }
        catch (error) {
            return res.status(500).json({
                error: 'Failed to get execution status',
                message: error.message,
            });
        }
    });
    /**
     * GET /autonomy/execution/audit/:taskId
     * Get detailed audit trail for a task
     * Shows every tool call, whether it was allowed, and why
     */
    router.get('/execution/audit/:taskId', (req, res) => {
        try {
            const { taskId } = req.params;
            const execution = store.getExecution(taskId);
            if (!execution) {
                return res.status(404).json({
                    error: 'Task not found',
                    taskId,
                });
            }
            res.set('Content-Type', 'application/json');
            return res.send(store.exportAuditLog(taskId));
        }
        catch (error) {
            return res.status(500).json({
                error: 'Failed to get audit log',
                message: error.message,
            });
        }
    });
    /**
     * POST /autonomy/execution/check
     * Check if a tool call would be allowed (for pre-flight validation)
     *
     * Usage:
     * ```
     * POST /autonomy/execution/check
     * {
     *   "taskId": "build-phase-2-5",
     *   "tool": "Bash(docker-compose up)"
     * }
     * ```
     *
     * Response:
     * ```
     * {
     *   "allowed": true,
     *   "reason": "preapproved",
     *   "taskId": "build-phase-2-5",
     *   "mode": "UNATTENDED",
     *   "tool": "Bash(docker-compose up)"
     * }
     * ```
     */
    router.post('/execution/check', (req, res) => {
        try {
            const { taskId, tool } = req.body;
            if (!taskId || !tool) {
                return res.status(400).json({
                    error: 'Missing required fields: taskId, tool',
                });
            }
            const context = store.getContext(taskId);
            if (!context) {
                return res.status(404).json({
                    error: 'Task context not found',
                    taskId,
                });
            }
            const allowed = engine.isToolAllowed(tool, context);
            return res.json({
                allowed,
                taskId,
                mode: context.mode,
                tool,
                reason: allowed ? 'preapproved' : 'denied-by-policy',
                preapprovedTools: context.preapprovedTools,
            });
        }
        catch (error) {
            return res.status(500).json({
                error: 'Failed to check tool',
                message: error.message,
            });
        }
    });
    /**
     * GET /autonomy/execution/modes
     * List available execution modes and their policies
     */
    router.get('/execution/modes', (_req, res) => {
        return res.json({
            modes: [
                {
                    mode: ExecutionMode.INTERACTIVE,
                    description: 'Default: user at keyboard, prompts enabled',
                    allowsAgentSpawn: true,
                    allowsUserInteraction: true,
                    requiresPreapproval: false,
                    useCase: 'Manual debugging, interactive exploration',
                },
                {
                    mode: ExecutionMode.UNATTENDED,
                    description: 'Scheduled task: no prompts, fails fast on unauthorized tools',
                    allowsAgentSpawn: false,
                    allowsUserInteraction: false,
                    requiresPreapproval: true,
                    useCase: 'Overnight builds, CI/CD pipelines, automation',
                },
                {
                    mode: ExecutionMode.BATCH,
                    description: 'Multi-step task: single approval covers all calls',
                    allowsAgentSpawn: false,
                    allowsUserInteraction: false,
                    requiresPreapproval: false,
                    useCase: 'Chained operations, sequential automation',
                },
                {
                    mode: ExecutionMode.MAINTENANCE,
                    description: 'Service/daemon: pre-approved trusted pattern set',
                    allowsAgentSpawn: false,
                    allowsUserInteraction: false,
                    requiresPreapproval: true,
                    useCase: 'Long-running services, background workers',
                },
            ],
        });
    });
    return router;
}
//# sourceMappingURL=execution.js.map