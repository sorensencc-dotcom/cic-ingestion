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
import { canonicalize, computeHash, estimateTokens } from './canonicalize.js';
import { CacheRegistry, CacheMetrics, CacheSummary } from './registry.js';
import { BatchOperationsManager, BatchAnalysisRequest, BatchAnalysisResult } from './batch.js';
import { CacheConfig, DEFAULT_CACHE_CONFIG } from './config/index.js';

export interface GenerateOptions {
  docId: string;
  docText: string;
  userPrompt: string;
  model?: string;
  maxTokens?: number;
  registryDbPath?: string;
}

export interface GenerateResult {
  response: string;
  metadata: {
    docId: string;
    cacheHit: boolean;
    cacheReadTokens: number;
    inputTokens: number;
    outputTokens: number;
    costWithCache: number;
    costWithoutCache: number;
    costSavings: number;
    timestamp: string;
  };
}

export class CICPromptCacheRouter {
  private client: Anthropic;
  private registry: CacheRegistry;
  private batchManager: BatchOperationsManager;
  private config: CacheConfig;

  constructor(config?: CacheConfig, registryDbPath?: string) {
    this.config = config || DEFAULT_CACHE_CONFIG;
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    // Use config.registryPath if no explicit path provided
    const dbPath = registryDbPath || this.config.registryPath;
    this.registry = new CacheRegistry(dbPath);
    this.batchManager = new BatchOperationsManager(this.registry, 3);
  }

  async generateWithCache(opts: GenerateOptions): Promise<GenerateResult> {
    const {
      docId,
      docText,
      userPrompt,
      model = this.config.model,
      maxTokens = 2000,
    } = opts;

    // Normalize document
    const canonicalText = canonicalize(docText);
    const contentHash = await computeHash(canonicalText);
    const lengthTokens = estimateTokens(canonicalText);

    // Register if not already registered
    this.registry.registerDoc(docId, contentHash, lengthTokens);

    // Check if document is cache-eligible
    const isCacheEligible = this.registry.isRegistered(contentHash);

    // Build messages with cache_control on document
    const contentArray: any[] = isCacheEligible
      ? [
          {
            type: 'text' as const,
            text: docText,
            cache_control: { type: 'ephemeral' as const },
          },
          {
            type: 'text' as const,
            text: userPrompt,
          },
        ]
      : [
          {
            type: 'text' as const,
            text: docText,
          },
          {
            type: 'text' as const,
            text: userPrompt,
          },
        ];

    const messages: Anthropic.MessageParam[] = [
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
    const cacheReadTokens = (usage as any).cache_read_input_tokens || 0;
    const cacheHit = cacheReadTokens > 0;
    const inputTokens = usage.input_tokens;
    const outputTokens = usage.output_tokens;

    // Log to registry
    this.registry.logAccess(
      docId,
      contentHash,
      cacheHit,
      cacheReadTokens,
      inputTokens
    );

    // Estimate cost using configured pricing tiers
    const {
      inputCost: inputPricing,
      cacheReadCost: cacheReadPricing,
      outputCost: outputPricing,
    } = this.config.pricingTiers;

    const inputCost = (inputTokens / 1_000_000) * inputPricing;
    const cacheReadCost = (cacheReadTokens / 1_000_000) * cacheReadPricing;
    const outputCost = (outputTokens / 1_000_000) * outputPricing;
    const totalCost = inputCost + cacheReadCost + outputCost;

    // Cost if no cache
    const costWithoutCache =
      ((inputTokens + cacheReadTokens) / 1_000_000) * inputPricing + outputCost;
    const costSavings = costWithoutCache - totalCost;

    // Extract response text
    const responseText =
      response.content[0].type === 'text' ? response.content[0].text : '';

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

  async generateBatchWithCache(req: BatchAnalysisRequest): Promise<BatchAnalysisResult> {
    return this.batchManager.generateBatchWithCache(req, async (doc, task) => {
      const result = await this.generateWithCache({
        docId: doc.docId,
        docText: doc.docText,
        userPrompt: task.systemPrompt,
        model: this.config.model,
      });

      return {
        analysis: result.response,
        hit: result.metadata.cacheHit,
        costSavings: result.metadata.costSavings,
      };
    });
  }

  getMetrics(contentHash: string): CacheMetrics | null {
    return this.registry.getMetrics(contentHash);
  }

  getSummary(): CacheSummary {
    return this.registry.summary();
  }

  clearRegistry(): void {
    this.registry.clear();
  }
}
