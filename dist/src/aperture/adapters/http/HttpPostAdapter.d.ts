/**
 * Phase 27: Aperture — HTTP POST Adapter
 * HTTP POST request with JSON payload
 */
import { BaseAdapter } from '../BaseAdapter';
import { SandboxHandle, ExecutionOptions } from '../../types';
export declare class HttpPostAdapter extends BaseAdapter {
    constructor();
    /**
     * Perform HTTP POST request
     */
    execute(input: any, sandbox: SandboxHandle, options?: ExecutionOptions): Promise<any>;
}
export declare function createHttpPostAdapter(): HttpPostAdapter;
//# sourceMappingURL=HttpPostAdapter.d.ts.map