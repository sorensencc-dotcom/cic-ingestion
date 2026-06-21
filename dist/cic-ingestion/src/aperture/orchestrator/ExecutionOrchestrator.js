/**
 * Phase 27: Aperture — Execution Orchestrator
 * Validates, executes, and receipts all adapter operations
 */
import { v4 as uuidv4 } from 'uuid';
export class ExecutionOrchestrator {
    constructor(registry, policyEngine, sandboxRuntime) {
        this.adapters = new Map();
        this.eventHandlers = new Set();
        this.registry = registry;
        this.policyEngine = policyEngine;
        this.sandboxRuntime = sandboxRuntime;
    }
    /**
     * Register adapter implementation
     */
    registerAdapter(adapter) {
        const metadata = adapter.metadata();
        this.adapters.set(metadata.id, adapter);
    }
    /**
     * Register event handler
     */
    onEvent(handler) {
        this.eventHandlers.add(handler);
    }
    /**
     * Execute single operation
     */
    async execute(adapterId, input, context) {
        const startTime = Date.now();
        const traceId = context.traceId || uuidv4();
        const receiptId = uuidv4();
        let sandboxHandle = null;
        try {
            // Step 1: Registry lookup
            const adapterDef = this.registry.lookup(adapterId);
            if (!adapterDef) {
                return this.createFailedResult(receiptId, adapterId, context.agent, 'failed', 'ADAPTER_NOT_FOUND', `Adapter ${adapterId} not found in registry`, startTime, traceId);
            }
            // Step 2: Policy authorization
            const authResult = this.policyEngine.authorize(context.agent, adapterId);
            if (!authResult.allowed) {
                this.emitEvent({
                    event_type: 'policy_denial',
                    adapter: adapterId,
                    agent: context.agent,
                    reason: authResult.reason,
                    timestamp: new Date().toISOString()
                });
                return this.createFailedResult(receiptId, adapterId, context.agent, 'denied', 'POLICY_VIOLATION', authResult.reason || 'Authorization denied', startTime, traceId, {
                    authorized: false,
                    reason: authResult.reason,
                    approval_required: false
                });
            }
            // Step 3: Check execution limits
            const callsOk = this.policyEngine.checkLimits(context.agent, 'calls');
            if (!callsOk.ok) {
                return this.createFailedResult(receiptId, adapterId, context.agent, 'denied', 'LIMIT_EXCEEDED', `Call limit exceeded: ${callsOk.current}/${callsOk.limit}`, startTime, traceId);
            }
            // Step 4: Validate input against schema
            const validationResult = this.registry.validate(adapterId, input);
            if (!validationResult.valid) {
                return this.createFailedResult(receiptId, adapterId, context.agent, 'failed', 'VALIDATION_ERROR', `Input validation failed: ${validationResult.errors?.join('; ')}`, startTime, traceId);
            }
            // Step 5: Check pre-approval requirement
            const needsApproval = this.policyEngine.preApproval(context.agent, adapterId);
            let approvalStatus;
            if (needsApproval && context.approvalGate) {
                try {
                    const approvalResult = await context.approvalGate.request(context.agent, adapterId, input);
                    if (!approvalResult.approved) {
                        approvalStatus = 'rejected';
                        return this.createFailedResult(receiptId, adapterId, context.agent, 'denied', 'APPROVAL_DENIED', approvalResult.reason || 'Operation not approved', startTime, traceId, {
                            authorized: true,
                            approval_required: true,
                            approval_status: 'rejected'
                        });
                    }
                    approvalStatus = 'approved';
                }
                catch (err) {
                    approvalStatus = 'pending';
                    // Log but don't fail on approval gate errors
                    console.warn(`Approval gate error: ${err.message}`);
                }
            }
            // Step 6: Create sandbox
            try {
                const policy = this.policyEngine.getPolicyForAgent(context.agent);
                sandboxHandle = await this.sandboxRuntime.create({
                    agent: context.agent,
                    policy: policy || {},
                    memoryQuotaMb: 256,
                    cpuQuotaPercent: 50,
                    ephemeralOnly: true
                });
            }
            catch (err) {
                return this.createFailedResult(receiptId, adapterId, context.agent, 'failed', 'SANDBOX_ERROR', `Failed to create sandbox: ${err.message}`, startTime, traceId);
            }
            // Step 7: Execute adapter with retries
            let output;
            let finalRetries = 0;
            const maxRetries = adapterDef.policy.maxRetries || 1;
            let lastError = null;
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    const adapter = this.adapters.get(adapterId);
                    if (!adapter) {
                        throw new Error(`Adapter implementation not registered: ${adapterId}`);
                    }
                    output = await Promise.race([
                        adapter.execute(input, sandboxHandle),
                        this.createTimeout(adapterDef.policy.maxExecutionMs)
                    ]);
                    finalRetries = attempt;
                    break; // Success
                }
                catch (err) {
                    lastError = err;
                    if (attempt === maxRetries) {
                        // Final failure after all retries
                        finalRetries = attempt;
                        break;
                    }
                    // Retry
                }
            }
            // If execution failed
            if (lastError && output === undefined) {
                const isTimeout = lastError.message === 'Adapter timeout';
                const status = isTimeout ? 'timeout' : 'failed';
                const errorCode = isTimeout ? 'TIMEOUT' : 'EXECUTION_FAILED';
                await sandboxHandle.cleanup();
                return this.createFailedResult(receiptId, adapterId, context.agent, status, errorCode, lastError.message, startTime, traceId, undefined, finalRetries);
            }
            // Step 8: Validate output schema
            const outputValidation = this.registry.validateOutput(adapterId, output);
            const outputSize = JSON.stringify(output).length;
            // Step 9: Increment limits
            this.policyEngine.incrementLimit(context.agent, 'calls', 1);
            this.policyEngine.incrementLimit(context.agent, 'bytes', outputSize);
            // Step 10: Cleanup sandbox
            let cleanupStatus = 'success';
            try {
                await sandboxHandle.cleanup();
            }
            catch (err) {
                cleanupStatus = 'failed';
                this.emitEvent({
                    event_type: 'sandbox_error',
                    sandbox_id: sandboxHandle?.id,
                    agent: context.agent,
                    error: err.message,
                    timestamp: new Date().toISOString()
                });
            }
            // Step 11: Create success receipt
            const latency = Date.now() - startTime;
            const adapterDef2 = this.registry.lookup(adapterId);
            const policy = this.policyEngine.getPolicyForAgent(context.agent);
            const receipt = {
                id: receiptId,
                timestamp: new Date().toISOString(),
                traceId,
                adapter: {
                    id: adapterId,
                    version: adapterDef2.implementation.version
                },
                agent: context.agent,
                policy: policy?.name || 'default',
                input: {
                    params: input,
                    size_bytes: JSON.stringify(input).length
                },
                output: {
                    result: output,
                    size_bytes: outputSize,
                    schema_valid: outputValidation.valid
                },
                status: 'success',
                latency_ms: latency,
                retries: finalRetries,
                policy_check: {
                    authorized: true,
                    approval_required: needsApproval,
                    ...(approvalStatus && { approval_status: approvalStatus })
                },
                sandbox: {
                    id: sandboxHandle.id,
                    isolation_level: 'ephemeral',
                    cleanup_status: cleanupStatus
                }
            };
            // Emit event
            this.emitEvent({
                event_type: 'adapter_execution',
                adapter: adapterId,
                agent: context.agent,
                status: 'success',
                latency_ms: latency,
                timestamp: new Date().toISOString()
            });
            return {
                receipt,
                output
            };
        }
        catch (err) {
            // Fallback error handling
            if (sandboxHandle) {
                try {
                    await sandboxHandle.cleanup();
                }
                catch { }
            }
            return this.createFailedResult(receiptId, adapterId, context.agent, 'failed', 'INTERNAL_ERROR', err.message, startTime, traceId);
        }
    }
    /**
     * Bulk execute operations (parallel)
     */
    async bulkExecute(operations) {
        const results = await Promise.all(operations.map(op => this.execute(op.adapterId, op.input, op.context)));
        return results.map(r => r.receipt);
    }
    /**
     * Bulk execute operations (sequential)
     */
    async bulkExecuteSequential(operations) {
        const receipts = [];
        for (const op of operations) {
            const result = await this.execute(op.adapterId, op.input, op.context);
            receipts.push(result.receipt);
        }
        return receipts;
    }
    /**
     * Helper: Create failed execution result
     */
    createFailedResult(receiptId, adapterId, agent, status, errorCode, errorMessage, startTime, traceId, policyCheck, retries = 0) {
        const receipt = {
            id: receiptId,
            timestamp: new Date().toISOString(),
            traceId,
            adapter: {
                id: adapterId,
                version: '1.0.0'
            },
            agent,
            policy: 'default',
            input: {
                params: {},
                size_bytes: 0
            },
            output: {
                result: null,
                size_bytes: 0,
                schema_valid: false
            },
            status,
            latency_ms: Date.now() - startTime,
            retries,
            error: {
                code: errorCode,
                message: errorMessage
            },
            policy_check: policyCheck || {
                authorized: false,
                approval_required: false
            },
            sandbox: {
                id: 'none',
                isolation_level: 'ephemeral',
                cleanup_status: 'success'
            }
        };
        return {
            receipt,
            output: null
        };
    }
    /**
     * Helper: Create timeout promise
     */
    createTimeout(ms) {
        return new Promise((_, reject) => setTimeout(() => reject(new Error('Adapter timeout')), ms));
    }
    /**
     * Helper: Emit event to handlers
     */
    emitEvent(event) {
        for (const handler of this.eventHandlers) {
            try {
                handler(event);
            }
            catch (err) {
                console.error('Event handler error:', err);
            }
        }
    }
}
//# sourceMappingURL=ExecutionOrchestrator.js.map
