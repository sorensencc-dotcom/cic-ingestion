/**
 * Phase 27: Aperture — Base Adapter
 * Abstract base for all adapter implementations
 */
export class BaseAdapter {
    constructor(id, name, version, inputSchema, outputSchema) {
        this.id = id;
        this.name = name;
        this.version = version;
        this.inputSchema = inputSchema;
        this.outputSchema = outputSchema;
    }
    /**
     * Return metadata
     */
    metadata() {
        return {
            id: this.id,
            name: this.name,
            version: this.version
        };
    }
    /**
     * Validate input against schema
     */
    validate(input) {
        // TODO: Implement JSON Schema validation
        // For now, return valid
        return { valid: true };
    }
    /**
     * Return schemas
     */
    schema() {
        return {
            input: this.inputSchema,
            output: this.outputSchema
        };
    }
    /**
     * Helper: Validate output against schema
     */
    validateOutput(output) {
        // TODO: Implement JSON Schema validation
        return true;
    }
}
//# sourceMappingURL=BaseAdapter.js.map
