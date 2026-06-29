/**
 * Phase 27: Aperture — Sandbox Runtime
 * Isolated execution environment for adapters
 */
import { SandboxHandle, SandboxSpec } from '../types';
export interface CredentialInjector {
    (sandboxId: string): Promise<Record<string, string>>;
}
export interface CredentialRevoker {
    (sandboxId: string): Promise<void>;
}
export interface SandboxRuntimeOptions {
    /** Called during create() to inject time-limited credentials into the sandbox env */
    credentialInjector?: CredentialInjector;
    /** Called during cleanup() to revoke credentials issued for the sandbox */
    credentialRevoker?: CredentialRevoker;
}
export declare class SandboxRuntime {
    private sandboxes;
    private meta;
    private options;
    constructor(options?: SandboxRuntimeOptions);
    /**
     * Create isolated sandbox for agent
     */
    create(spec: SandboxSpec): Promise<SandboxHandle>;
    /**
     * Execute function within sandbox
     */
    execute<T>(handle: SandboxHandle, fn: () => Promise<T>): Promise<T>;
    /**
     * Register a child PID spawned within the sandbox for cleanup tracking.
     * Call this after spawning a child process inside the sandbox.
     */
    registerChildPid(sandboxId: string, pid: number): void;
    /**
     * Unregister a child PID (call on normal process exit to avoid kill on cleanup).
     */
    unregisterChildPid(sandboxId: string, pid: number): void;
    /**
     * Get the scoped environment for a sandbox.
     * Pass this to child_process.spawn({ env }) to enforce isolation.
     */
    getScopedEnv(sandboxId: string): Record<string, string> | null;
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
    /**
     * Cleanup sandbox
     */
    private cleanup;
}
/**
 * Factory: Create sandbox runtime
 */
export declare function createSandboxRuntime(options?: SandboxRuntimeOptions): SandboxRuntime;
//# sourceMappingURL=SandboxRuntime.d.ts.map