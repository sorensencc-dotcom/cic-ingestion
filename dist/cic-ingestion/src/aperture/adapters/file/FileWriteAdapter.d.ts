/**
 * Phase 27: Aperture — File Write Adapter
 * Write file contents to sandbox
 */
import { BaseAdapter } from '../BaseAdapter';
import { SandboxHandle, ExecutionOptions } from '../../types';
export declare class FileWriteAdapter extends BaseAdapter {
    constructor();
    /**
     * Write file to sandbox directory
     */
    execute(input: any, sandbox: SandboxHandle, options?: ExecutionOptions): Promise<any>;
}
export declare function createFileWriteAdapter(): FileWriteAdapter;
//# sourceMappingURL=FileWriteAdapter.d.ts.map