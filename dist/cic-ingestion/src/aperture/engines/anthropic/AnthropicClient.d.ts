/**
 * Phase 27.1: Anthropic Client Engine
 * Deterministic model generation with cost tracking
 */
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
export declare class AnthropicClient {
    private static client;
    /**
     * Get or create singleton client
     */
    private static getClient;
    /**
     * Generate text from prompt
     */
    static generate(input: AnthropicGenerateInput): Promise<any>;
    /**
     * Estimate cost of generation (input only, for pre-flight)
     */
    static estimateCost(inputTokens: number, model: string): number;
}
//# sourceMappingURL=AnthropicClient.d.ts.map