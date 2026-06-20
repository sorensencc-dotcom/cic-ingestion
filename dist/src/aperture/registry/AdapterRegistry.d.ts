/**
 * Phase 27: Aperture — Adapter Registry
 * Central registry for all executable adapters
 */
import { AdapterDefinition } from '../types';
export declare class AdapterRegistry {
    private adapters;
    /**
     * Register or update an adapter definition
     */
    register(definition: AdapterDefinition): void;
    /**
     * Lookup adapter by ID
     */
    lookup(id: string): AdapterDefinition | null;
    /**
     * List adapters by category
     */
    listByCategory(category: string): AdapterDefinition[];
    /**
     * Validate input against adapter's input schema
     */
    validate(id: string, input: any): {
        valid: boolean;
        errors?: string[];
    };
    /**
     * Validate output against adapter's output schema
     */
    validateOutput(id: string, output: any): {
        valid: boolean;
        errors?: string[];
    };
    /**
     * List all registered adapters
     */
    listAll(): AdapterDefinition[];
    /**
     * Check if adapter is registered
     */
    exists(id: string): boolean;
    /**
     * Get adapter cost
     */
    getCost(id: string): number | null;
    /**
     * Get adapter max execution time
     */
    getMaxExecutionMs(id: string): number | null;
    /**
     * Get adapter by category and operation
     */
    getByOperation(category: string, operation: string): AdapterDefinition | null;
    /**
     * Check if adapter requires approval
     */
    requiresApproval(id: string): boolean;
    /**
     * Get allowed agents for adapter (null = all agents)
     */
    getAllowedAgents(id: string): string[] | null;
}
/**
 * Factory: Create registry with v1 adapters pre-registered
 */
export declare function createV1Registry(): AdapterRegistry;
//# sourceMappingURL=AdapterRegistry.d.ts.map