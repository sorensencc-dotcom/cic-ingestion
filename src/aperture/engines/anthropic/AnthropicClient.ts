/**
 * Phase 27.1: Anthropic Client Engine
 * Deterministic model generation with cost tracking
 */

import { Anthropic } from '@anthropic-ai/sdk';
import { UsageLedger } from 'src/lib/usage/UsageLedger.js';
import { computeCost } from 'src/lib/cost/modelPricing.js';

const ALLOWED_MODELS = [
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307'
];

export interface AnthropicGenerateInput {
  model: string;
  prompt: string;
  maxTokens: number;
  systemPrompt?: string;
  temperature?: number;
  meta?: {
    source?: string;
    stage?: string;
    agent?: string;
    jobId?: string;
    local?: boolean;
  };
}

export interface AnthropicGenerateOutput {
  text: string;
  inputTokens: number | null;
  outputTokens: number | null;
  stopReason: string | null;
}

export class AnthropicClient {
  private static client: Anthropic | null = null;

  /**
   * Get or create singleton client
   */
  private static getClient(): Anthropic {
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
  static async generate(input: AnthropicGenerateInput): Promise<AnthropicGenerateOutput> {
    // Validate model
    if (!ALLOWED_MODELS.includes(input.model)) {
      throw new Error(
        `Model '${input.model}' not in allowed list: ${ALLOWED_MODELS.join(', ')}`
      );
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
        env: (process.env.CIC_ENV as 'dev' | 'prod' | undefined) ?? 'prod',
      });

      return {
        text,
        inputTokens,
        outputTokens,
        stopReason: response.stop_reason ?? null
      };
    } catch (err: any) {
      throw new Error(`Anthropic API error: ${err.message}`);
    }
  }

  /**
   * Estimate cost of generation (for pre-flight)
   * Uses unified pricing table with both input and output
   */
  static estimateCost(inputTokens: number, model: string, outputTokens = 0): number {
    return computeCost(model, inputTokens, outputTokens);
  }
}
