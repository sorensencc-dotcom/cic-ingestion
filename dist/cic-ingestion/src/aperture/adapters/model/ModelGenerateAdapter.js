/**
 * Phase 27: Aperture — Model Generate Adapter
 * Generate text using LLM model
 */
import { BaseAdapter } from '../BaseAdapter.js';
import { ValidationUtils } from '../ValidationUtils.js';
import { AnthropicClient } from '../../engines/anthropic/AnthropicClient.js';
import { ModelGenerateResultSchema } from '../../../validation/schemas.js';
import { sanitizeText, validateTextLength } from '../../../validation/guards.js';
import { makeError, makeSuccess } from '../../../validation/envelope.js';
export class ModelGenerateAdapter extends BaseAdapter {
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
    async execute(input, _sandbox, _options) {
        const start = Date.now();
        const { prompt, model = 'claude-3-sonnet-20240229', maxTokens = 1000, temperature = 0.0, systemPrompt } = input;
        // Validate prompt
        if (!prompt || typeof prompt !== 'string') {
            return makeError('INVALID_INPUT', { prompt }, 'ModelGenerateAdapter', start);
        }
        // Validate body size (prompt)
        const sizeValidation = ValidationUtils.validateBodySize(prompt);
        if (!sizeValidation.valid) {
            return makeError('INPUT_TOO_LARGE', { error: sizeValidation.error }, 'ModelGenerateAdapter', start);
        }
        // Validate model
        if (!ModelGenerateAdapter.ALLOWED_MODELS.includes(model)) {
            return makeError('INVALID_MODEL', { model }, 'ModelGenerateAdapter', start);
        }
        // Validate maxTokens (tighter bounds)
        if (maxTokens < 1 || maxTokens > 4096) {
            return makeError('INVALID_MAX_TOKENS', { maxTokens }, 'ModelGenerateAdapter', start);
        }
        // Validate temperature
        if (temperature < 0 || temperature > 1) {
            return makeError('INVALID_TEMPERATURE', { temperature }, 'ModelGenerateAdapter', start);
        }
        try {
            // Call Anthropic (returns envelope)
            const response = await AnthropicClient.generate({
                model,
                prompt,
                maxTokens,
                systemPrompt,
                temperature
            });
            if (!response.ok) {
                return makeError('ANTHROPIC_CLIENT_ERROR', response.error, 'ModelGenerateAdapter', start);
            }
            const clientResult = response.data;
            const raw = {
                text: clientResult.text,
                tokens: clientResult.outputTokens
            };
            const parsed = ModelGenerateResultSchema.safeParse(raw);
            if (!parsed.success) {
                return makeError('MODEL_INVALID_OUTPUT', parsed.error, 'ModelGenerateAdapter', start);
            }
            let data = parsed.data;
            // Text already sanitized by AnthropicClient, but re-sanitize for safety
            data.text = sanitizeText(data.text);
            if (!validateTextLength(data.text)) {
                return makeError('MODEL_OVERSIZE_OUTPUT', {}, 'ModelGenerateAdapter', start);
            }
            return makeSuccess(data, 'ModelGenerateAdapter', start);
        }
        catch (err) {
            return makeError('MODEL_GENERATE_FAILED', { error: err.message }, 'ModelGenerateAdapter', start);
        }
    }
}
ModelGenerateAdapter.ALLOWED_MODELS = [
    'claude-3-sonnet-20240229',
    'claude-3-opus-20240229',
    'claude-3-haiku-20240307'
];
export function createModelGenerateAdapter() {
    return new ModelGenerateAdapter();
}
//# sourceMappingURL=ModelGenerateAdapter.js.map
