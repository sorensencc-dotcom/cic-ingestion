/**
 * Phase 27: Aperture — Sandbox Runtime
 * Isolated execution environment for adapters
 */
import { SandboxHandle, SandboxSpec } from '../types';
export declare class SandboxRuntime {
    private sandboxes;
    /**
     * Create isolated sandbox for agent
     */
    create(spec: SandboxSpec): Promise<SandboxHandle>;
    /**
     * Execute function within sandbox
     */
    execute<T>(handle: SandboxHandle, fn: () => Promise<T>): Promise<T>;
    /**
     * Cleanup sandbox
     */
    private cleanup;
    /**
     * Get sandbox handle
     */
    get(sandboxId: string): SandboxHandle | null;
    /**
     * List active sandboxes
     */
    listActive(): SandboxHandle[];
    /**
     * Force cleanup all sandboxes
     */
    cleanupAll(): Promise<void>;
}
/**
 * Factory: Create sandbox runtime
 */
export declare function createSandboxRuntime(): SandboxRuntime;
//# sourceMappingURL=SandboxRuntime.d.ts.map