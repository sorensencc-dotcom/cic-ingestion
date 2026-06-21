/**
 * Phase 27: Aperture — Model Generate Adapter
 * Generate text using LLM model
 */
import { BaseAdapter } from '../BaseAdapter';
import { SandboxHandle, ExecutionOptions } from '../../types';
export declare class ModelGenerateAdapter extends BaseAdapter {
    private static readonly ALLOWED_MODELS;
    constructor();
    /**
     * Generate text using Anthropic SDK
     * Validated, bounded, cost-tracked model invocation
     */
    execute(input: any, _sandbox: SandboxHandle, _options?: ExecutionOptions): Promise<any>;
}
export declare function createModelGenerateAdapter(): ModelGenerateAdapter;
//# sourceMappingURL=ModelGenerateAdapter.d.ts.map