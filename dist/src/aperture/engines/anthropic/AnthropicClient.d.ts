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
export declare class AnthropicClient {
    private static client;
    /**
     * Get or create singleton client
     */
    private static getClient;
    /**
     * Generate text from prompt
     */
    static generate(input: AnthropicGenerateInput): Promise<AnthropicGenerateOutput>;
    /**
     * Estimate cost of generation (for pre-flight)
     * Uses unified pricing table with both input and output
     */
    static estimateCost(inputTokens: number, model: string, outputTokens?: number): number;
}
//# sourceMappingURL=AnthropicClient.d.ts.map