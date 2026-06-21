/**
 * Phase 27: Aperture — Execution Orchestrator
 * Validates, executes, and receipts all adapter operations
 */
import { ExecutionReceipt, ExecutionResult, ExecutionContext, ExecutionRequest, Adapter } from '../types';
import { AdapterRegistry } from '../registry/AdapterRegistry';
import { PolicyEngine } from '../policy/PolicyEngine';
import { SandboxRuntime } from '../sandbox/SandboxRuntime';
export declare class ExecutionOrchestrator {
    private registry;
    private policyEngine;
    private sandboxRuntime;
    private adapters;
    private eventHandlers;
    constructor(registry: AdapterRegistry, policyEngine: PolicyEngine, sandboxRuntime: SandboxRuntime);
    /**
     * Register adapter implementation
     */
    registerAdapter(adapter: Adapter): void;
    /**
     * Register event handler
     */
    onEvent(handler: (event: any) => void): void;
    /**
     * Execute single operation
     */
    execute(adapterId: string, input: any, context: ExecutionContext): Promise<ExecutionResult>;
    /**
     * Bulk execute operations (parallel)
     */
    bulkExecute(operations: ExecutionRequest[]): Promise<ExecutionReceipt[]>;
    /**
     * Bulk execute operations (sequential)
     */
    bulkExecuteSequential(operations: ExecutionRequest[]): Promise<ExecutionReceipt[]>;
    /**
     * Helper: Create failed execution result
     */
    private createFailedResult;
    /**
     * Helper: Create timeout promise
     */
    private createTimeout;
    /**
     * Helper: Emit event to handlers
     */
    private emitEvent;
}
//# sourceMappingURL=ExecutionOrchestrator.d.ts.map