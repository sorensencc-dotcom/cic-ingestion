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

export class SandboxRuntime {
  private sandboxes: Map<string, SandboxHandle> = new Map();

  /**
   * Create isolated sandbox for agent
   */
  async create(spec: SandboxSpec): Promise<SandboxHandle> {
    const sandboxId = uuidv4();
    const tmpdir = path.join(os.tmpdir(), `aperture-${sandboxId}`);

    // Create ephemeral tmpdir
    await fsAsync.mkdir(tmpdir, { recursive: true });

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

    // TODO: Set resource limits (memory, CPU, FDs)
    // TODO: Scope environment variables
    // TODO: Inject scoped credentials

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
   * Cleanup sandbox
   */
  private async cleanup(sandboxId: string): Promise<void> {
    const handle = this.sandboxes.get(sandboxId);
    if (!handle) {
      return;
    }

    try {
      // Debug: Log cleanup
      if (process.env.DEBUG_ADAPTER) {
        console.log(`[SandboxRuntime] Cleaning up sandbox ${sandboxId}`);
        console.log(`[SandboxRuntime] Removing tmpdir: ${handle.tmpdir}`);
      }

      // Remove ephemeral tmpdir
      try {
        await fsAsync.rm(handle.tmpdir, { recursive: true, force: true });
      } catch (err) {
        if (process.env.DEBUG_ADAPTER) {
          console.log(`[SandboxRuntime] Cleanup error (ignored): ${(err as any).message}`);
        }
      }

      // TODO: Revoke scoped credentials
      // TODO: Close any open file descriptors
      // TODO: Kill any remaining processes
    } finally {
      this.sandboxes.delete(sandboxId);
    }
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
}

/**
 * Factory: Create sandbox runtime
 */
export function createSandboxRuntime(): SandboxRuntime {
  return new SandboxRuntime();
}
