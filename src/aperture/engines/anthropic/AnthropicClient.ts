/**
 * Phase 27.1: Anthropic Client Engine
 * Deterministic model generation with cost tracking
 */

import { Anthropic } from '@anthropic-ai/sdk';

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

      return {
        text,
        inputTokens: response.usage?.input_tokens ?? null,
        outputTokens: response.usage?.output_tokens ?? null,
        stopReason: response.stop_reason ?? null
      };
    } catch (err: any) {
      throw new Error(`Anthropic API error: ${err.message}`);
    }
  }

  /**
   * Estimate cost of generation (input only, for pre-flight)
   */
  static estimateCost(inputTokens: number, model: string): number {
    // Rates per 1M tokens (as of Phase 27)
    const rates: Record<string, { input: number; output: number }> = {
      'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
      'claude-3-sonnet-20240229': { input: 3.0, output: 15.0 },
      'claude-3-haiku-20240307': { input: 0.25, output: 1.25 }
    };

    const rate = rates[model];
    if (!rate) return 0;

    return (inputTokens / 1_000_000) * rate.input;
  }
}
