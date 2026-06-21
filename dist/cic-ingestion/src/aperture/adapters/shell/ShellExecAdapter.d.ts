/**
 * Phase 27: Aperture — Shell Exec Adapter
 * Execute shell commands (restricted)
 */
import { BaseAdapter } from '../BaseAdapter';
import { SandboxHandle, ExecutionOptions } from '../../types';
export declare class ShellExecAdapter extends BaseAdapter {
    constructor();
    /**
     * Execute shell command in sandbox
     */
    execute(input: any, sandbox: SandboxHandle, options?: ExecutionOptions): Promise<any>;
}
export declare function createShellExecAdapter(): ShellExecAdapter;
//# sourceMappingURL=ShellExecAdapter.d.ts.map