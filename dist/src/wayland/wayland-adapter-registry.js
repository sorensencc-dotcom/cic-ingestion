/**
 * Wayland Adapter Registry
 * Manages orchestrator adapters, lifecycle, and execution state
 */
export class WaylandAdapterRegistry {
    constructor(failureThreshold = 5) {
        this.adapters = new Map();
        this.operationLog = [];
        this.failureCount = new Map();
        this.failureThreshold = 5;
        this.failureResetIntervalMs = 60000; // 1 minute
        this.failureThreshold = failureThreshold;
    }
    registerAdapter(metadata, handler) {
        if (this.adapters.has(metadata.id)) {
            return false; // Already registered
        }
        this.adapters.set(metadata.id, {
            metadata: { ...metadata, status: 'registered' },
            handler,
        });
        this.failureCount.set(metadata.id, 0);
        return true;
    }
    unregisterAdapter(adapterId) {
        return this.adapters.delete(adapterId);
    }
    getAdapter(adapterId) {
        const entry = this.adapters.get(adapterId);
        return entry?.metadata || null;
    }
    listAdapters() {
        return Array.from(this.adapters.values()).map((entry) => entry.metadata);
    }
    async executeOperation(request) {
        const startTime = Date.now();
        const adapter = this.adapters.get(request.adapterId);
        if (!adapter) {
            return {
                success: false,
                error: `Adapter ${request.adapterId} not found`,
                executedAt: new Date().toISOString(),
            };
        }
        // Check if adapter is suspended
        if (adapter.metadata.status === 'suspended') {
            return {
                success: false,
                error: `Adapter ${request.adapterId} is suspended`,
                executedAt: new Date().toISOString(),
            };
        }
        try {
            if (!adapter.handler) {
                throw new Error(`No handler registered for ${request.adapterId}`);
            }
            // Set status to active
            adapter.metadata.status = 'active';
            adapter.metadata.lastHeartbeat = new Date().toISOString();
            const timeout = request.timeout || 30000;
            const response = await this.withTimeout(adapter.handler(request), timeout);
            this.logOperation(request.adapterId, request.operation, true, Date.now() - startTime);
            this.resetFailureCount(request.adapterId);
            return response;
        }
        catch (err) {
            const durationMs = Date.now() - startTime;
            this.logOperation(request.adapterId, request.operation, false, durationMs);
            this.incrementFailureCount(request.adapterId);
            // Suspend adapter if failure threshold exceeded
            if (this.getFailureCount(request.adapterId) >= this.failureThreshold) {
                adapter.metadata.status = 'suspended';
            }
            return {
                success: false,
                error: err instanceof Error ? err.message : String(err),
                executedAt: new Date().toISOString(),
            };
        }
    }
    setAdapterStatus(adapterId, status) {
        const adapter = this.adapters.get(adapterId);
        if (!adapter)
            return false;
        adapter.metadata.status = status;
        return true;
    }
    getFailureCount(adapterId) {
        return this.failureCount.get(adapterId) || 0;
    }
    incrementFailureCount(adapterId) {
        const current = this.failureCount.get(adapterId) || 0;
        this.failureCount.set(adapterId, current + 1);
    }
    resetFailureCount(adapterId) {
        this.failureCount.set(adapterId, 0);
    }
    logOperation(adapterId, operation, success, durationMs) {
        this.operationLog.push({
            adapterId,
            operation,
            success,
            timestamp: new Date().toISOString(),
            durationMs,
        });
        // Keep only last 1000 operations
        if (this.operationLog.length > 1000) {
            this.operationLog.shift();
        }
    }
    getOperationLog(adapterId, limit = 100) {
        let entries = this.operationLog;
        if (adapterId) {
            entries = entries.filter((e) => e.adapterId === adapterId);
        }
        return entries.slice(-limit);
    }
    getMetrics(adapterId) {
        const entries = this.operationLog.filter((e) => e.adapterId === adapterId);
        if (entries.length === 0) {
            return null;
        }
        const successCount = entries.filter((e) => e.success).length;
        const failureCount = entries.length - successCount;
        const averageDurationMs = entries.reduce((sum, e) => sum + e.durationMs, 0) / entries.length;
        return {
            totalOperations: entries.length,
            successCount,
            failureCount,
            successRate: (successCount / entries.length) * 100,
            averageDurationMs,
        };
    }
    async withTimeout(promise, ms) {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
        ]);
    }
    clear() {
        this.adapters.clear();
        this.operationLog = [];
        this.failureCount.clear();
    }
}
export function createDefaultRegistry() {
    return new WaylandAdapterRegistry(5);
}
//# sourceMappingURL=wayland-adapter-registry.js.map