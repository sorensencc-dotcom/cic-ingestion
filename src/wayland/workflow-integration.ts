// filename: workflow-integration.ts
// Wayland Workflow Integration Example
// Shows how to invoke workflows via Wayland adapters

import { createDefaultRegistry } from './wayland-adapter-registry';
import { createDefaultSecurityPolicy } from './wayland-security-policy';
import {
  WorkflowRunner,
  WorkflowContext,
  dailyIngestReasoningWorkflow,
} from './workflow';

// Example: Run daily ingest reasoning workflow
export async function runDailyIngestReasoning(
  logger: any
): Promise<Map<string, any>> {
  const registry = createDefaultRegistry();
  const securityPolicy = createDefaultSecurityPolicy();
  const runner = new WorkflowRunner();

  const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const ctx: WorkflowContext = {
    workflowId: dailyIngestReasoningWorkflow.id,
    sessionId,
    stepResults: new Map(),
    startTime: Date.now(),
    logger,
    registry,
    securityPolicy,
  };

  logger.info('workflow-integration.start', {
    workflowId: dailyIngestReasoningWorkflow.id,
    sessionId,
  });

  try {
    const results = await runner.run(dailyIngestReasoningWorkflow, ctx);

    logger.info('workflow-integration.success', {
      workflowId: dailyIngestReasoningWorkflow.id,
      sessionId,
      stepCount: dailyIngestReasoningWorkflow.steps.length,
      durationMs: Date.now() - ctx.startTime,
    });

    return results;
  } catch (err: any) {
    logger.error('workflow-integration.error', {
      workflowId: dailyIngestReasoningWorkflow.id,
      sessionId,
      error: err.message,
    });
    throw err;
  }
}

// Example: Direct HTTP call to Orchestrator (for testing)
export async function callOrchestratorDirect(
  action: string,
  metadata?: Record<string, any>
): Promise<any> {
  const payload = {
    action,
    timestamp: new Date().toISOString(),
    metadata: metadata || {},
  };

  let response: globalThis.Response;
  try {
    response = await fetch('http://localhost:7001/reason', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    throw new Error(`Orchestrator unreachable: ${err.message}`);
  }

  if (!response.ok) {
    throw new Error(`Orchestrator error: ${response.status} ${response.statusText}`);
  }

  try {
    return await response.json();
  } catch (parseErr: any) {
    throw new Error(`Invalid JSON from Orchestrator: ${parseErr.message}`);
  }
}

// Example: Async workflow trigger (fire-and-forget)
// NOTE: Promise resolves when queued (sync), not when workflow finishes (async).
// Uses setImmediate (in-memory queue). Not persistent—job lost on process exit.
// For production, use persistent queue (Bull, RabbitMQ, etc.)
export function triggerWorkflowAsync(
  logger: any,
  workflowId: string = 'daily-ingest-reasoning'
): Promise<string> {
  return new Promise((resolve) => {
    // Queue workflow for background execution
    setImmediate(async () => {
      try {
        await runDailyIngestReasoning(logger);
        logger.info('async-workflow.complete', { workflowId });
      } catch (err: any) {
        logger.error('async-workflow.error', { workflowId, error: err.message });
      }
    });
    // Resolve immediately (workflow runs in background)
    resolve(`Workflow ${workflowId} queued`);
  });
}
