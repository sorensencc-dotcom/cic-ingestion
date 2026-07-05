/**
 * Phase 27: Aperture — Model Generate Adapter
 * Generate text using LLM model
 */
import { BaseAdapter } from '../BaseAdapter';
import { ValidationUtils } from '../ValidationUtils';
import { AnthropicClient } from '../../engines/anthropic/AnthropicClient';
export class ModelGenerateAdapter extends BaseAdapter {
    static ALLOWED_MODELS = [
        'claude-3-sonnet-20240229',
        'claude-3-opus-20240229',
        'claude-3-haiku-20240307'
    ];
    constructor() {
        const inputSchema = {
            type: 'object',
            properties: {
                prompt: { type: 'string' },
                model: {
                    type: 'string',
                    enum: ModelGenerateAdapter.ALLOWED_MODELS
                },
                maxTokens: { type: 'number' },
                temperature: { type: 'number' }
            },
            required: ['prompt', 'model']
        };
        const outputSchema = {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                text: { type: 'string' },
                model: { type: 'string' },
                inputTokens: { type: 'number' },
                outputTokens: { type: 'number' },
                timestamp: { type: 'string' }
            }
        };
        super('model.generate', 'Model Generate', '1.0.0', inputSchema, outputSchema);
    }
    /**
     * Generate text using Anthropic SDK
     * Validated, bounded, cost-tracked model invocation
     */
    async execute(input, sandbox, options) {
        const { prompt, model = 'claude-3-sonnet-20240229', maxTokens = 1000, temperature = 0.0, systemPrompt } = input;
        const timestamp = Date.now();
        // Validate prompt
        if (!prompt || typeof prompt !== 'string') {
            return {
                success: false,
                model,
                error: 'Invalid input: prompt must be a string',
                timestamp
            };
        }
        // Validate body size (prompt)
        const sizeValidation = ValidationUtils.validateBodySize(prompt);
        if (!sizeValidation.valid) {
            return {
                success: false,
                model,
                error: sizeValidation.error,
                timestamp
            };
        }
        // Validate model
        if (!ModelGenerateAdapter.ALLOWED_MODELS.includes(model)) {
            return {
                success: false,
                model,
                error: `model must be one of: ${ModelGenerateAdapter.ALLOWED_MODELS.join(', ')}`,
                timestamp
            };
        }
        // Validate maxTokens (tighter bounds)
        if (maxTokens < 1 || maxTokens > 4096) {
            return {
                success: false,
                model,
                error: 'maxTokens must be between 1 and 4096',
                timestamp
            };
        }
        // Validate temperature
        if (temperature < 0 || temperature > 1) {
            return {
                success: false,
                model,
                error: 'temperature must be between 0 and 1',
                timestamp
            };
        }
        try {
            // Call Anthropic
            const result = await AnthropicClient.generate({
                model,
                prompt,
                maxTokens,
                systemPrompt,
                temperature,
                meta: input.meta
            });
            // Validate output size
            const outputSizeValidation = ValidationUtils.validateBodySize(result.text);
            if (!outputSizeValidation.valid) {
                return {
                    success: false,
                    model,
                    error: `Output too large: ${outputSizeValidation.error}`,
                    timestamp
                };
            }
            return {
                success: true,
                text: result.text,
                model,
                inputTokens: result.inputTokens,
                outputTokens: result.outputTokens,
                timestamp
            };
        }
        catch (err) {
            return {
                success: false,
                model,
                error: err.message,
                timestamp
            };
        }
    }
}
export function createModelGenerateAdapter() {
    return new ModelGenerateAdapter();
}
//# sourceMappingURL=ModelGenerateAdapter.js.map