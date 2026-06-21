/**
 * Phase 27: Aperture — File Read Adapter
 * Read file contents
 */
import { BaseAdapter } from '../BaseAdapter';
import { SandboxHandle, ExecutionOptions } from '../../types';
export declare class FileReadAdapter extends BaseAdapter {
    constructor();
    /**
     * Read file from sandbox directory
     */
    execute(input: any, sandbox: SandboxHandle, _options?: ExecutionOptions): Promise<any>;
}
export declare function createFileReadAdapter(): FileReadAdapter;
//# sourceMappingURL=FileReadAdapter.d.ts.map