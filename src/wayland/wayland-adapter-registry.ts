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

export class WaylandAdapterRegistry {
  private adapters: Map<
    string,
    {
      metadata: AdapterMetadata;
      handler?: (req: AdapterRequest) => Promise<AdapterResponse>;
    }
  > = new Map();

  private operationLog: Array<{
    adapterId: string;
    operation: string;
    success: boolean;
    timestamp: string;
    durationMs: number;
  }> = [];

  private failureCount: Map<string, number> = new Map();
  private failureThreshold: number = 5;
  private failureResetIntervalMs: number = 60000; // 1 minute

  constructor(failureThreshold: number = 5) {
    this.failureThreshold = failureThreshold;
  }

  registerAdapter(
    metadata: AdapterMetadata,
    handler?: (req: AdapterRequest) => Promise<AdapterResponse>
  ): boolean {
    if (this.adapters.has(metadata.id)) {
      return false; // Already registered
    }

    this.adapters.set(metadata.id, {
      metadata: { ...metadata },
      handler,
    });

    this.failureCount.set(metadata.id, 0);
    return true;
  }

  unregisterAdapter(adapterId: string): boolean {
    return this.adapters.delete(adapterId);
  }

  getAdapter(adapterId: string): AdapterMetadata | null {
    const entry = this.adapters.get(adapterId);
    return entry?.metadata || null;
  }

  listAdapters(): AdapterMetadata[] {
    return Array.from(this.adapters.values()).map((entry) => entry.metadata);
  }

  async executeOperation(request: AdapterRequest): Promise<AdapterResponse> {
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

      this.logOperation(request.adapterId, request.operation, response.success, Date.now() - startTime);

      if (response.success) {
        this.resetFailureCount(request.adapterId);
      } else {
        this.incrementFailureCount(request.adapterId);
        if (this.getFailureCount(request.adapterId) >= this.failureThreshold) {
          adapter.metadata.status = 'suspended';
        }
      }

      return response;
    } catch (err) {
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

  setAdapterStatus(adapterId: string, status: AdapterMetadata['status']): boolean {
    const adapter = this.adapters.get(adapterId);
    if (!adapter) return false;

    adapter.metadata.status = status;
    return true;
  }

  getFailureCount(adapterId: string): number {
    return this.failureCount.get(adapterId) || 0;
  }

  private incrementFailureCount(adapterId: string): void {
    const current = this.failureCount.get(adapterId) || 0;
    this.failureCount.set(adapterId, current + 1);
  }

  private resetFailureCount(adapterId: string): void {
    this.failureCount.set(adapterId, 0);
  }

  private logOperation(
    adapterId: string,
    operation: string,
    success: boolean,
    durationMs: number
  ): void {
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

  getOperationLog(adapterId?: string, limit: number = 100): typeof this.operationLog {
    let entries = this.operationLog;
    if (adapterId) {
      entries = entries.filter((e) => e.adapterId === adapterId);
    }
    return entries.slice(-limit);
  }

  getMetrics(adapterId: string): {
    totalOperations: number;
    successCount: number;
    failureCount: number;
    successRate: number;
    averageDurationMs: number;
  } | null {
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

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
    ]);
  }

  clear(): void {
    this.adapters.clear();
    this.operationLog = [];
    this.failureCount.clear();
  }
}

export function createDefaultRegistry(): WaylandAdapterRegistry {
  return new WaylandAdapterRegistry(5);
}
