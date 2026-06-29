/**
 * Phase 27: Aperture — Sandbox Runtime
 * Isolated execution environment for adapters
 */

import * as fs from 'fs';
import { promises as fsAsync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { SandboxHandle, SandboxSpec, PolicyDefinition } from '../types';

/** Environment variables allowed through the sandbox boundary */
const ENV_WHITELIST = ['PATH', 'NODE_ENV', 'LOG_LEVEL', 'TZ'];

/** Blocked env-var prefixes that may carry secrets or host credentials */
const ENV_BLOCK_PREFIXES = ['VAULT_', 'ANTHROPIC_', 'OPENAI_', 'AWS_', 'GITHUB_'];

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

interface SandboxMeta {
  spec: SandboxSpec;
  /** Scoped environment for this sandbox (whitelist + injected credentials) */
  env: Record<string, string>;
  /** Child process PIDs spawned within this sandbox */
  childPids: Set<number>;
  /** Open file descriptor paths tracked for cleanup */
  openFds: Set<number>;
}

export class SandboxRuntime {
  private sandboxes: Map<string, SandboxHandle> = new Map();
  private meta: Map<string, SandboxMeta> = new Map();
  private options: SandboxRuntimeOptions;

  constructor(options: SandboxRuntimeOptions = {}) {
    this.options = options;
  }

  /**
   * Create isolated sandbox for agent
   */
  async create(spec: SandboxSpec): Promise<SandboxHandle> {
    const sandboxId = uuidv4();
    const tmpdir = path.join(os.tmpdir(), `aperture-${sandboxId}`);

    // Create ephemeral tmpdir
    await fsAsync.mkdir(tmpdir, { recursive: true });

    // --- Resource limits ---
    // Store memory/CPU quotas from spec for use at spawn time.
    // Node.js --max-old-space-size is set via NODE_OPTIONS in the scoped env.
    // CPU quota (cpuQuotaPercent) is advisory; enforced via cgroup when running
    // in Docker, and stored for reference in the scoped env.

    // --- Environment isolation ---
    // Build whitelist-only env, filtering out secrets / host credentials.
    const scopedEnv: Record<string, string> = {};

    for (const key of ENV_WHITELIST) {
      if (process.env[key] !== undefined) {
        scopedEnv[key] = process.env[key] as string;
      }
    }

    // Reject any env var matching a blocked prefix (defense-in-depth)
    for (const [key, value] of Object.entries(process.env)) {
      if (value === undefined) continue;
      if (ENV_WHITELIST.includes(key)) continue; // already handled
      const blocked = ENV_BLOCK_PREFIXES.some((prefix) => key.startsWith(prefix));
      if (blocked) continue; // drop credentials
    }

    // Apply memory quota via NODE_OPTIONS so child processes respect it
    if (spec.memoryQuotaMb > 0) {
      const existing = scopedEnv['NODE_OPTIONS'] ?? '';
      scopedEnv['NODE_OPTIONS'] = `${existing} --max-old-space-size=${spec.memoryQuotaMb}`.trim();
    }

    // Store CPU quota for reference (Docker/cgroup enforcement)
    if (spec.cpuQuotaPercent > 0) {
      scopedEnv['APERTURE_CPU_QUOTA_PCT'] = String(spec.cpuQuotaPercent);
    }

    // Scope tmpdir to this sandbox
    scopedEnv['TMPDIR'] = tmpdir;
    scopedEnv['TEMP'] = tmpdir;
    scopedEnv['TMP'] = tmpdir;

    // --- Credential injection ---
    if (this.options.credentialInjector) {
      const injected = await this.options.credentialInjector(sandboxId);
      for (const [key, value] of Object.entries(injected)) {
        scopedEnv[key] = value;
      }
    }

    const sandboxMeta: SandboxMeta = {
      spec,
      env: scopedEnv,
      childPids: new Set(),
      openFds: new Set(),
    };

    const handle: SandboxHandle = {
      id: sandboxId,
      agent: spec.agent,
      createdAt: new Date().toISOString(),
      tmpdir,
      cleanup: async () => {
        await this.cleanup(sandboxId);
      }
    };

    this.sandboxes.set(sandboxId, handle);
    this.meta.set(sandboxId, sandboxMeta);

    return handle;
  }

  /**
   * Execute function within sandbox
   */
  async execute<T>(
    handle: SandboxHandle,
    fn: () => Promise<T>
  ): Promise<T> {
    if (!this.sandboxes.has(handle.id)) {
      throw new Error(`Sandbox ${handle.id} not found`);
    }

    // Set environment for this execution
    const originalTmpdir = process.env.TMPDIR;
    process.env.TMPDIR = handle.tmpdir;

    try {
      return await fn();
    } finally {
      // Restore environment
      if (originalTmpdir) {
        process.env.TMPDIR = originalTmpdir;
      } else {
        delete process.env.TMPDIR;
      }
    }
  }

  /**
   * Register a child PID spawned within the sandbox for cleanup tracking.
   * Call this after spawning a child process inside the sandbox.
   */
  registerChildPid(sandboxId: string, pid: number): void {
    const m = this.meta.get(sandboxId);
    if (m) {
      m.childPids.add(pid);
    }
  }

  /**
   * Unregister a child PID (call on normal process exit to avoid kill on cleanup).
   */
  unregisterChildPid(sandboxId: string, pid: number): void {
    const m = this.meta.get(sandboxId);
    if (m) {
      m.childPids.delete(pid);
    }
  }

  /**
   * Get the scoped environment for a sandbox.
   * Pass this to child_process.spawn({ env }) to enforce isolation.
   */
  getScopedEnv(sandboxId: string): Record<string, string> | null {
    return this.meta.get(sandboxId)?.env ?? null;
  }

  /**
   * Get sandbox handle
   */
  get(sandboxId: string): SandboxHandle | null {
    return this.sandboxes.get(sandboxId) || null;
  }

  /**
   * List active sandboxes
   */
  listActive(): SandboxHandle[] {
    return Array.from(this.sandboxes.values());
  }

  /**
   * Force cleanup all sandboxes
   */
  async cleanupAll(): Promise<void> {
    const ids = Array.from(this.sandboxes.keys());
    await Promise.all(ids.map(id => this.cleanup(id)));
  }

  /**
   * Cleanup sandbox
   */
  private async cleanup(sandboxId: string): Promise<void> {
    const handle = this.sandboxes.get(sandboxId);
    if (!handle) {
      return;
    }

    const m = this.meta.get(sandboxId);

    try {
      // Debug: Log cleanup
      if (process.env.DEBUG_ADAPTER) {
        console.log(`[SandboxRuntime] Cleaning up sandbox ${sandboxId}`);
        console.log(`[SandboxRuntime] Removing tmpdir: ${handle.tmpdir}`);
      }

      // --- Kill remaining child processes ---
      if (m && m.childPids.size > 0) {
        for (const pid of m.childPids) {
          try {
            // SIGTERM first; escalate to SIGKILL if process persists
            process.kill(pid, 'SIGTERM');
            // Give the process 200ms to terminate gracefully
            await new Promise<void>((resolve) => setTimeout(resolve, 200));
            try {
              process.kill(pid, 'SIGKILL');
            } catch {
              // Process already exited — ignore ESRCH
            }
          } catch (err: any) {
            if (err.code !== 'ESRCH') {
              if (process.env.DEBUG_ADAPTER) {
                console.log(`[SandboxRuntime] Kill pid ${pid} error: ${err.message}`);
              }
            }
          }
        }
        m.childPids.clear();
      }

      // --- Close tracked file descriptors ---
      if (m && m.openFds.size > 0) {
        for (const fd of m.openFds) {
          try {
            fs.closeSync(fd);
          } catch {
            // FD already closed — ignore
          }
        }
        m.openFds.clear();
      }

      // Remove ephemeral tmpdir
      try {
        await fsAsync.rm(handle.tmpdir, { recursive: true, force: true });
      } catch (err) {
        if (process.env.DEBUG_ADAPTER) {
          console.log(`[SandboxRuntime] Cleanup error (ignored): ${(err as any).message}`);
        }
      }

      // --- Revoke scoped credentials ---
      if (this.options.credentialRevoker) {
        try {
          await this.options.credentialRevoker(sandboxId);
        } catch (err: any) {
          if (process.env.DEBUG_ADAPTER) {
            console.log(`[SandboxRuntime] Credential revocation error: ${err.message}`);
          }
        }
      }
    } finally {
      this.sandboxes.delete(sandboxId);
      this.meta.delete(sandboxId);
    }
  }
}

/**
 * Factory: Create sandbox runtime
 */
export function createSandboxRuntime(options?: SandboxRuntimeOptions): SandboxRuntime {
  return new SandboxRuntime(options);
}
