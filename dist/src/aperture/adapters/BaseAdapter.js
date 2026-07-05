/**
 * Phase 27: Aperture — Base Adapter
 * Abstract base for all adapter implementations
 */
import Ajv from 'ajv';
const ajv = new Ajv({ allErrors: true });
export class BaseAdapter {
    id;
    name;
    version;
    inputSchema;
    outputSchema;
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
        if (!this.inputSchema) {
            return { valid: true };
        }
        const validate = ajv.compile(this.inputSchema);
        const valid = validate(input);
        if (!valid) {
            const errors = (validate.errors ?? []).map((e) => `${e.instancePath || '(root)'} ${e.message}`);
            return { valid: false, errors };
        }
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
        if (!this.outputSchema) {
            return true;
        }
        const validate = ajv.compile(this.outputSchema);
        const valid = validate(output);
        if (!valid) {
            const messages = (validate.errors ?? []).map((e) => `${e.instancePath || '(root)'} ${e.message}`);
            console.error('[BaseAdapter] Output schema validation failed:', messages);
        }
        return valid;
    }
}
//# sourceMappingURL=BaseAdapter.js.map