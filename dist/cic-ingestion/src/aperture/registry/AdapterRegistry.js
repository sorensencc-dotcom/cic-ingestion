/**
 * Phase 27: Aperture — Adapter Registry
 * Central registry for all executable adapters
 */
/**
 * Simple JSON Schema validator
 * Validates: type, required fields, enum
 */
function validateAgainstSchema(input, schema) {
    const errors = [];
    if (schema.type && typeof input !== schema.type) {
        errors.push(`Expected type ${schema.type}, got ${typeof input}`);
    }
    if (schema.properties && typeof input === 'object' && input !== null) {
        for (const field of schema.required || []) {
            if (!(field in input)) {
                errors.push(`Missing required field: ${field}`);
            }
        }
        for (const [field, fieldSchema] of Object.entries(schema.properties)) {
            if (field in input) {
                const value = input[field];
                const fs = fieldSchema;
                if (fs.type && typeof value !== fs.type) {
                    errors.push(`Field ${field}: expected ${fs.type}, got ${typeof value}`);
                }
                if (fs.enum && !fs.enum.includes(value)) {
                    errors.push(`Field ${field}: value ${value} not in enum [${fs.enum.join(', ')}]`);
                }
            }
        }
    }
    return {
        valid: errors.length === 0,
        ...(errors.length > 0 && { errors })
    };
}
export class AdapterRegistry {
    constructor() {
        this.adapters = new Map();
    }
    /**
     * Register or update an adapter definition
     */
    register(definition) {
        if (!definition.id || !definition.id.includes('.')) {
            throw new Error(`Invalid adapter ID: ${definition.id}. Expected format: {category}.{operation}`);
        }
        if (!definition.name || !definition.description) {
            throw new Error(`Adapter ${definition.id} missing name or description`);
        }
        if (!definition.implementation?.module || !definition.implementation?.version) {
            throw new Error(`Adapter ${definition.id} missing implementation details`);
        }
        this.adapters.set(definition.id, definition);
    }
    /**
     * Lookup adapter by ID
     */
    lookup(id) {
        return this.adapters.get(id) || null;
    }
    /**
     * List adapters by category
     */
    listByCategory(category) {
        return Array.from(this.adapters.values())
            .filter(a => a.category === category);
    }
    /**
     * Validate input against adapter's input schema
     */
    validate(id, input) {
        const adapter = this.lookup(id);
        if (!adapter) {
            return {
                valid: false,
                errors: [`Adapter ${id} not found in registry`]
            };
        }
        return validateAgainstSchema(input, adapter.inputSchema);
    }
    /**
     * Validate output against adapter's output schema
     */
    validateOutput(id, output) {
        const adapter = this.lookup(id);
        if (!adapter) {
            return {
                valid: false,
                errors: [`Adapter ${id} not found in registry`]
            };
        }
        return validateAgainstSchema(output, adapter.outputSchema);
    }
    /**
     * List all registered adapters
     */
    listAll() {
        return Array.from(this.adapters.values());
    }
    /**
     * Check if adapter is registered
     */
    exists(id) {
        return this.adapters.has(id);
    }
    /**
     * Get adapter cost
     */
    getCost(id) {
        const adapter = this.lookup(id);
        return adapter?.policy.cost ?? null;
    }
    /**
     * Get adapter max execution time
     */
    getMaxExecutionMs(id) {
        const adapter = this.lookup(id);
        return adapter?.policy.maxExecutionMs ?? null;
    }
    /**
     * Get adapter by category and operation
     */
    getByOperation(category, operation) {
        return this.lookup(`${category}.${operation}`);
    }
    /**
     * Check if adapter requires approval
     */
    requiresApproval(id) {
        const adapter = this.lookup(id);
        return adapter?.accessControl.requiresApproval ?? false;
    }
    /**
     * Get allowed agents for adapter (null = all agents)
     */
    getAllowedAgents(id) {
        const adapter = this.lookup(id);
        return adapter?.accessControl.allowedAgents ?? null;
    }
}
/**
 * Factory: Create registry with v1 adapters pre-registered
 */
export function createV1Registry() {
    const registry = new AdapterRegistry();
    // Shell adapters
    registry.register({
        id: 'shell.exec',
        name: 'Shell Execute',
        description: 'Execute shell command (restricted)',
        category: 'shell',
        inputSchema: {
            type: 'object',
            properties: {
                command: { type: 'string' },
                args: { type: 'array', items: { type: 'string' } },
                timeout: { type: 'number' }
            },
            required: ['command']
        },
        outputSchema: {
            type: 'object',
            properties: {
                stdout: { type: 'string' },
                stderr: { type: 'string' },
                exitCode: { type: 'number' }
            }
        },
        policy: {
            cost: 10,
            maxExecutionMs: 30000,
            maxRetries: 1,
            deterministic: false
        },
        accessControl: {
            requiresApproval: true
        },
        implementation: {
            module: 'adapters/shell/exec.ts',
            version: '1.0.0'
        }
    });
    // File adapters
    registry.register({
        id: 'file.read',
        name: 'File Read',
        description: 'Read file contents',
        category: 'file',
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string' },
                encoding: { type: 'string', enum: ['utf8', 'binary'] }
            },
            required: ['path']
        },
        outputSchema: {
            type: 'object',
            properties: {
                data: { type: 'string' },
                size: { type: 'number' },
                mtime: { type: 'string' }
            }
        },
        policy: {
            cost: 2,
            maxExecutionMs: 5000,
            maxRetries: 3,
            deterministic: true
        },
        accessControl: {
            requiresApproval: false
        },
        implementation: {
            module: 'adapters/file/read.ts',
            version: '1.0.0'
        }
    });
    registry.register({
        id: 'file.write',
        name: 'File Write',
        description: 'Write to file',
        category: 'file',
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string' },
                data: { type: 'string' },
                mode: { type: 'string', enum: ['w', 'a'] }
            },
            required: ['path', 'data']
        },
        outputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string' },
                size: { type: 'number' },
                success: { type: 'boolean' }
            }
        },
        policy: {
            cost: 5,
            maxExecutionMs: 5000,
            maxRetries: 1,
            deterministic: true
        },
        accessControl: {
            requiresApproval: true
        },
        implementation: {
            module: 'adapters/file/write.ts',
            version: '1.0.0'
        }
    });
    // HTTP adapters
    registry.register({
        id: 'http.get',
        name: 'HTTP GET',
        description: 'HTTP GET request',
        category: 'http',
        inputSchema: {
            type: 'object',
            properties: {
                url: { type: 'string' },
                headers: { type: 'object' },
                timeout: { type: 'number' }
            },
            required: ['url']
        },
        outputSchema: {
            type: 'object',
            properties: {
                status: { type: 'number' },
                headers: { type: 'object' },
                body: { type: 'string' },
                size: { type: 'number' }
            }
        },
        policy: {
            cost: 3,
            maxExecutionMs: 30000,
            maxRetries: 2,
            deterministic: false
        },
        accessControl: {
            requiresApproval: false
        },
        implementation: {
            module: 'adapters/http/get.ts',
            version: '1.0.0'
        }
    });
    // Model adapters
    registry.register({
        id: 'model.generate',
        name: 'Model Generate',
        description: 'Generate text via LLM',
        category: 'model',
        inputSchema: {
            type: 'object',
            properties: {
                prompt: { type: 'string' },
                model: { type: 'string' },
                maxTokens: { type: 'number' }
            },
            required: ['prompt']
        },
        outputSchema: {
            type: 'object',
            properties: {
                text: { type: 'string' },
                tokens: { type: 'number' },
                model: { type: 'string' }
            }
        },
        policy: {
            cost: 20,
            maxExecutionMs: 60000,
            maxRetries: 1,
            deterministic: false
        },
        accessControl: {
            requiresApproval: true
        },
        implementation: {
            module: 'adapters/model/generate.ts',
            version: '1.0.0'
        }
    });
    return registry;
}
//# sourceMappingURL=AdapterRegistry.js.map
