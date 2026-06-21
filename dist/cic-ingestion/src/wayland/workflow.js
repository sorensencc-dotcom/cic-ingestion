// filename: workflow.ts
// Wayland Workflow Definitions
// Task orchestration with Orchestrator integration
export class WorkflowRunner {
    async run(workflow, ctx) {
        ctx.logger.info('workflow.start', {
            workflowId: workflow.id,
            steps: workflow.steps.length,
            sessionId: ctx.sessionId,
        });
        for (const step of workflow.steps) {
            // Skip if condition not met
            if (step.condition && !step.condition(ctx)) {
                ctx.logger.info('workflow.step.skipped', {
                    workflowId: workflow.id,
                    stepId: step.id,
                    sessionId: ctx.sessionId,
                });
                continue;
            }
            const maxRetries = step.retries || 1;
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    ctx.logger.info('workflow.step.start', {
                        workflowId: workflow.id,
                        stepId: step.id,
                        attempt: attempt + 1,
                        sessionId: ctx.sessionId,
                    });
                    const adapter = ctx.registry.get(step.adapter);
                    if (!adapter) {
                        throw new Error(`Adapter not found: ${step.adapter}`);
                    }
                    if (typeof adapter.execute !== 'function') {
                        throw new Error(`Adapter ${step.adapter} missing execute method`);
                    }
                    const result = await adapter.execute(step.payload, ctx);
                    ctx.stepResults.set(step.id, result);
                    ctx.logger.info('workflow.step.success', {
                        workflowId: workflow.id,
                        stepId: step.id,
                        sessionId: ctx.sessionId,
                    });
                    break;
                }
                catch (err) {
                    ctx.logger.warn('workflow.step.retry', {
                        workflowId: workflow.id,
                        stepId: step.id,
                        attempt: attempt + 1,
                        maxRetries,
                        error: err.message,
                        sessionId: ctx.sessionId,
                    });
                    if (attempt === maxRetries - 1) {
                        throw err;
                    }
                    // Exponential backoff capped at 10s
                    const delayMs = Math.min(Math.pow(2, attempt) * 1000, 10000);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }
        }
        const duration = Date.now() - ctx.startTime;
        ctx.logger.info('workflow.complete', {
            workflowId: workflow.id,
            durationMs: duration,
            sessionId: ctx.sessionId,
        });
        return ctx.stepResults;
    }
}
// Daily Ingest Reasoning Workflow
export const dailyIngestReasoningWorkflow = {
    id: 'daily-ingest-reasoning',
    name: 'Daily Ingest Reasoning',
    description: 'Daily ingestion + Orchestrator reasoning loop',
    schedule: '0 0 * * *', // Daily at midnight
    steps: [
        {
            id: 'call-orchestrator',
            adapter: 'http',
            payload: {
                method: 'POST',
                url: 'http://localhost:7001/reason',
                headers: {
                    'content-type': 'application/json',
                },
                body: {
                    action: 'ingest-reasoning',
                    timestamp: new Date().toISOString(),
                    metadata: {
                        source: 'wayland-workflow',
                        workflowId: 'daily-ingest-reasoning',
                    },
                },
                timeoutMs: 30000,
            },
            retries: 3,
            timeoutMs: 30000,
        },
    ],
};
// Workflow registry
const workflows = new Map();
export function registerWorkflow(workflow) {
    workflows.set(workflow.id, workflow);
}
export function getWorkflow(id) {
    return workflows.get(id);
}
export function listWorkflows() {
    return Array.from(workflows.values());
}
// Register default workflows
registerWorkflow(dailyIngestReasoningWorkflow);
//# sourceMappingURL=workflow.js.map
