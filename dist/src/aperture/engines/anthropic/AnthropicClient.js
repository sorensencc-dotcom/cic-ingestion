/**
 * Phase 27.1: Anthropic Client Engine
 * Deterministic model generation with cost tracking
 */
import { Anthropic } from '@anthropic-ai/sdk';
import { UsageLedger } from '../../usage/UsageLedger.js';
import { computeCost } from '../../cost/modelPricing.js';
const ALLOWED_MODELS = [
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307'
];
export class AnthropicClient {
    static client = null;
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
        // Validate model
        if (!ALLOWED_MODELS.includes(input.model)) {
            throw new Error(`Model '${input.model}' not in allowed list: ${ALLOWED_MODELS.join(', ')}`);
        }
        // Validate maxTokens
        if (input.maxTokens < 1 || input.maxTokens > 4096) {
            throw new Error(`maxTokens must be between 1 and 4096, got ${input.maxTokens}`);
        }
        // Validate temperature
        const temp = input.temperature ?? 0.0;
        if (temp < 0 || temp > 1) {
            throw new Error(`temperature must be between 0 and 1, got ${temp}`);
        }
        const client = this.getClient();
        try {
            const response = await client.messages.create({
                model: input.model,
                max_tokens: input.maxTokens,
                temperature: temp,
                system: input.systemPrompt,
                messages: [
                    {
                        role: 'user',
                        content: input.prompt
                    }
                ]
            });
            // Extract text from response
            const textContent = response.content.find(c => c.type === 'text');
            const text = textContent && 'text' in textContent ? textContent.text : '';
            const inputTokens = response.usage?.input_tokens ?? 0;
            const outputTokens = response.usage?.output_tokens ?? 0;
            // Log usage to ledger
            UsageLedger.log({
                ts: new Date().toISOString(),
                model: input.model,
                tokensIn: inputTokens,
                tokensOut: outputTokens,
                totalTokens: inputTokens + outputTokens,
                cost: computeCost(input.model, inputTokens, outputTokens),
                source: input.meta?.source ?? 'cic-unknown',
                stage: input.meta?.stage ?? 'UNKNOWN',
                agent: input.meta?.agent ?? 'unknown',
                jobId: input.meta?.jobId,
                local: input.meta?.local ?? false,
                env: process.env.CIC_ENV ?? 'prod',
            });
            return {
                text,
                inputTokens,
                outputTokens,
                stopReason: response.stop_reason ?? null
            };
        }
        catch (err) {
            throw new Error(`Anthropic API error: ${err.message}`);
        }
    }
    /**
     * Estimate cost of generation (for pre-flight)
     * Uses unified pricing table with both input and output
     */
    static estimateCost(inputTokens, model, outputTokens = 0) {
        return computeCost(model, inputTokens, outputTokens);
    }
}
//# sourceMappingURL=AnthropicClient.js.map