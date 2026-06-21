/**
 * Phase 27: Aperture — HTTP GET Adapter
 * HTTP GET request
 */
import { BaseAdapter } from '../BaseAdapter';
import { SandboxHandle, ExecutionOptions } from '../../types';
export declare class HttpGetAdapter extends BaseAdapter {
    constructor();
    /**
     * Perform HTTP GET request
     */
    execute(input: any, sandbox: SandboxHandle, options?: ExecutionOptions): Promise<any>;
}
export declare function createHttpGetAdapter(): HttpGetAdapter;
//# sourceMappingURL=HttpGetAdapter.d.ts.map