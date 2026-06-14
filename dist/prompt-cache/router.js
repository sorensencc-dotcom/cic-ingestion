/**
 * CIC Prompt Cache Router
 * Main integration point for autonomy agents to leverage prompt caching
 *
 * Usage:
 *   const router = new CICPromptCacheRouter();
 *   const { response, metadata } = await router.generateWithCache({
 *     docId: 'kroll_batch_001',
 *     docText: longArchivalText,
 *     userPrompt: 'Analyze this batch...',
 *   });
 */
import { Anthropic } from '@anthropic-ai/sdk';
import { canonicalize, computeHash, estimateTokens } from './canonicalize';
import { CacheRegistry } from './registry';
export class CICPromptCacheRouter {
    constructor(registryDbPath) {
        this.model = 'claude-3-5-sonnet-20241022';
        this.client = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
        this.registry = new CacheRegistry(registryDbPath);
    }
    async generateWithCache(opts) {
        const { docId, docText, userPrompt, model = this.model, maxTokens = 2000, } = opts;
        // Normalize document
        const canonicalText = canonicalize(docText);
        const contentHash = await computeHash(canonicalText);
        const lengthTokens = estimateTokens(canonicalText);
        // Register if not already registered
        this.registry.registerDoc(docId, contentHash, lengthTokens);
        // Check if document is cache-eligible
        const isCacheEligible = this.registry.isRegistered(contentHash);
        // Build messages with cache_control on document
        const contentArray = isCacheEligible
            ? [
                {
                    type: 'text',
                    text: docText,
                    cache_control: { type: 'ephemeral' },
                },
                {
                    type: 'text',
                    text: userPrompt,
                },
            ]
            : [
                {
                    type: 'text',
                    text: docText,
                },
                {
                    type: 'text',
                    text: userPrompt,
                },
            ];
        const messages = [
            {
                role: 'user',
                content: contentArray,
            },
        ];
        // Call Anthropic API
        const response = await this.client.messages.create({
            model,
            max_tokens: maxTokens,
            messages,
        });
        // Extract usage data
        const usage = response.usage;
        const cacheReadTokens = usage.cache_read_input_tokens || 0;
        const cacheHit = cacheReadTokens > 0;
        const inputTokens = usage.input_tokens;
        const outputTokens = usage.output_tokens;
        // Log to registry
        this.registry.logAccess(docId, contentHash, cacheHit, cacheReadTokens, inputTokens);
        // Estimate cost (Sonnet 3.5 pricing as of 2026)
        const inputCost = (inputTokens / 1000000) * 3.0;
        const cacheReadCost = (cacheReadTokens / 1000000) * 0.3;
        const outputCost = (outputTokens / 1000000) * 15.0;
        const totalCost = inputCost + cacheReadCost + outputCost;
        // Cost if no cache
        const costWithoutCache = ((inputTokens + cacheReadTokens) / 1000000) * 3.0 + outputCost;
        const costSavings = costWithoutCache - totalCost;
        // Extract response text
        const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
        return {
            response: responseText,
            metadata: {
                docId,
                cacheHit,
                cacheReadTokens,
                inputTokens,
                outputTokens,
                costWithCache: totalCost,
                costWithoutCache,
                costSavings,
                timestamp: new Date().toISOString(),
            },
        };
    }
    getMetrics(contentHash) {
        return this.registry.getMetrics(contentHash);
    }
    getSummary() {
        return this.registry.summary();
    }
    clearRegistry() {
        this.registry.clear();
    }
}
//# sourceMappingURL=router.js.map