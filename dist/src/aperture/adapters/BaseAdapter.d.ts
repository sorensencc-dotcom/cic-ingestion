/**
 * Phase 27: Aperture — Base Adapter
 * Abstract base for all adapter implementations
 */
import { JSONSchema7 } from 'json-schema';
import { Adapter, SandboxHandle, ExecutionOptions } from '../types';
export declare abstract class BaseAdapter implements Adapter {
    protected id: string;
    protected name: string;
    protected version: string;
    protected inputSchema: JSONSchema7;
    protected outputSchema: JSONSchema7;
    constructor(id: string, name: string, version: string, inputSchema: JSONSchema7, outputSchema: JSONSchema7);
    /**
     * Return metadata
     */
    metadata(): {
        id: string;
        name: string;
        version: string;
    };
    /**
     * Validate input against schema
     */
    validate(input: any): {
        valid: boolean;
        errors?: string[];
    };
    /**
     * Execute adapter (must be implemented by subclass)
     */
    abstract execute(input: any, sandbox: SandboxHandle, options?: ExecutionOptions): Promise<any>;
    /**
     * Return schemas
     */
    schema(): {
        input: JSONSchema7;
        output: JSONSchema7;
    };
    /**
     * Helper: Validate output against schema
     */
    protected validateOutput(output: any): boolean;
}
//# sourceMappingURL=BaseAdapter.d.ts.map