/**
 * Wayland Adapter Registry
 * Manages orchestrator adapters, lifecycle, and execution state
 */
export interface AdapterMetadata {
    id: string;
    name: string;
    version: string;
    capabilities: string[];
    status: 'registered' | 'active' | 'suspended' | 'failed';
    registeredAt: string;
    lastHeartbeat?: string;
}
export interface AdapterRequest {
    adapterId: string;
    operation: string;
    params: Record<string, unknown>;
    timeout?: number;
}
export interface AdapterResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    executedAt: string;
}
export declare class WaylandAdapterRegistry {
    private adapters;
    private operationLog;
    private failureCount;
    private failureThreshold;
    private failureResetIntervalMs;
    constructor(failureThreshold?: number);
    registerAdapter(metadata: AdapterMetadata, handler?: (req: AdapterRequest) => Promise<AdapterResponse>): boolean;
    unregisterAdapter(adapterId: string): boolean;
    getAdapter(adapterId: string): AdapterMetadata | null;
    listAdapters(): AdapterMetadata[];
    executeOperation(request: AdapterRequest): Promise<AdapterResponse>;
    setAdapterStatus(adapterId: string, status: AdapterMetadata['status']): boolean;
    getFailureCount(adapterId: string): number;
    private incrementFailureCount;
    private resetFailureCount;
    private logOperation;
    getOperationLog(adapterId?: string, limit?: number): typeof this.operationLog;
    getMetrics(adapterId: string): {
        totalOperations: number;
        successCount: number;
        failureCount: number;
        successRate: number;
        averageDurationMs: number;
    } | null;
    private withTimeout;
    clear(): void;
}
export declare function createDefaultRegistry(): WaylandAdapterRegistry;
//# sourceMappingURL=wayland-adapter-registry.d.ts.map