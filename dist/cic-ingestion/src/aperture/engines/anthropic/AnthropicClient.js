/**
 * Phase 27.1: Anthropic Client Engine
 * Deterministic model generation with cost tracking
 */
import { Anthropic } from '@anthropic-ai/sdk';
import { AnthropicResultSchema } from '../../../validation/schemas.js';
import { sanitizeText, validateTextLength } from '../../../validation/guards.js';
import { makeError, makeSuccess } from '../../../validation/envelope.js';
const ALLOWED_MODELS = [
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307'
];
export class AnthropicClient {
    /**
     * Get or create singleton client
     */
    static getClient() {
        if (!this.client) {
            const apiKey = process.env.ANTHROPIC_API_KEY;
            if (!apiKey) {
                throw new Error('ANTHROPIC_API_KEY not set');
            }
            this.client = new Anthropic({ apiKey });
        }
        return this.client;
    }
    /**
     * Generate text from prompt
     */
    static async generate(input) {
        const start = Date.now();
        // Validate model
        if (!ALLOWED_MODELS.includes(input.model)) {
            return makeError('ANTHROPIC_INVALID_MODEL', { model: input.model }, 'AnthropicClient', start);
        }
        // Validate maxTokens
        if (input.maxTokens < 1 || input.maxTokens > 4096) {
            return makeError('ANTHROPIC_INVALID_MAX_TOKENS', { maxTokens: input.maxTokens }, 'AnthropicClient', start);
        }
        // Validate temperature
        const temp = input.temperature ?? 0.0;
        if (temp < 0 || temp > 1) {
            return makeError('ANTHROPIC_INVALID_TEMPERATURE', { temperature: temp }, 'AnthropicClient', start);
        }
        const client = this.getClient();
        try {
            const response = await client.messages.create({
                model: input.model,
                max_tokens: input.maxTokens,
                temperature: temp,
                ...(input.systemPrompt && { system: input.systemPrompt }),
                messages: [
                    {
                        role: 'user',
                        content: input.prompt
                    }
                ]
            });
            // Extract text from response
            const textContent = response.content.find(c => c.type === 'text');
            let text = textContent && 'text' in textContent ? textContent.text : '';
            const raw = {
                text,
                inputTokens: response.usage?.input_tokens ?? null,
                outputTokens: response.usage?.output_tokens ?? null,
                stopReason: response.stop_reason ?? null
            };
            const parsed = AnthropicResultSchema.safeParse(raw);
            if (!parsed.success) {
                return makeError('ANTHROPIC_INVALID_RESPONSE', parsed.error, 'AnthropicClient', start);
            }
            let data = parsed.data;
            data.text = sanitizeText(data.text);
            if (data.text.length === 0) {
                return makeError('ANTHROPIC_EMPTY_RESPONSE', {}, 'AnthropicClient', start);
            }
            if (!validateTextLength(data.text)) {
                return makeError('ANTHROPIC_OVERSIZE_OUTPUT', {}, 'AnthropicClient', start);
            }
            return makeSuccess(data, 'AnthropicClient', start);
        }
        catch (err) {
            return makeError('ANTHROPIC_API_ERROR', { error: err.message }, 'AnthropicClient', start);
        }
    }
    /**
     * Estimate cost of generation (input only, for pre-flight)
     */
    static estimateCost(inputTokens, model) {
        // Rates per 1M tokens (as of Phase 27)
        const rates = {
            'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
            'claude-3-sonnet-20240229': { input: 3.0, output: 15.0 },
            'claude-3-haiku-20240307': { input: 0.25, output: 1.25 }
        };
        const rate = rates[model];
        if (!rate)
            return 0;
        return (inputTokens / 1000000) * rate.input;
    }
}
AnthropicClient.client = null;
//# sourceMappingURL=AnthropicClient.js.map
