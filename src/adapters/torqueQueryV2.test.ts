import { describe, expect, it } from '@jest/globals';
import {
  evaluateAndSummarizeResults,
  buildEvaluationPrompt,
  resetDefaultEvaluationChain,
  TorqueQueryV2SearchResponse,
  PostSearchEvaluationInput,
  PostSearchEvaluationOutput,
} from './torqueQueryV2';
import { FallbackChain } from '../resilience/fallbackChain';

describe('torqueQueryV2 post-search evaluation and summarization', () => {
  const mockSearchResponse: TorqueQueryV2SearchResponse = {
    query: 'query latency optimization',
    fast_path_used: true,
    candidate_pool: 20,
    results: [
      { id: 'doc-101', score: 0.94, metadata: { title: 'Index Tuning' } },
      { id: 'doc-102', score: 0.81, metadata: { title: 'Cache Strategy' } },
    ],
  };

  it('builds a structured evaluation prompt with hits', () => {
    const prompt = buildEvaluationPrompt(mockSearchResponse.query, mockSearchResponse.results);
    expect(prompt).toContain('query: "query latency optimization"');
    expect(prompt).toContain('doc-101');
    expect(prompt).toContain('doc-102');
  });

  it('evaluates and summarizes results using the default heuristic fallback chain', async () => {
    resetDefaultEvaluationChain();
    const evaluated = await evaluateAndSummarizeResults(mockSearchResponse);

    expect(evaluated.query).toBe('query latency optimization');
    expect(evaluated.scoredResults).toHaveLength(2);
    expect(evaluated.scoredResults[0].relevanceScore).toBe(0.94);
    expect(evaluated.summary).toContain('Found 2 relevant hit(s)');
    expect(evaluated.summary).toContain('doc-101');
  });

  it('evaluates and summarizes results using a custom FallbackChain', async () => {
    const customChain = new FallbackChain<PostSearchEvaluationInput, PostSearchEvaluationOutput>({
      name: 'CustomLLMEvaluationChain',
    });

    customChain.addProvider({
      name: 'mock-openrouter-llm',
      priority: 1,
      execute: async (input: PostSearchEvaluationInput): Promise<PostSearchEvaluationOutput> => {
        return {
          query: input.query,
          summary: `Synthesized summary for ${input.results.length} hit(s)`,
          scoredResults: input.results.map((r) => ({
            ...r,
            relevanceScore: 0.99,
            relevanceReasoning: 'Strong semantic match',
          })),
        };
      },
    });

    const evaluated = await evaluateAndSummarizeResults(mockSearchResponse, {
      chain: customChain,
      topNToScore: 1,
    });

    expect(evaluated.summary).toBe('Synthesized summary for 1 hit(s)');
    expect(evaluated.scoredResults).toHaveLength(1);
    expect(evaluated.scoredResults[0].relevanceScore).toBe(0.99);
    expect(customChain.getMetrics().successProvider).toBe('mock-openrouter-llm');
  });
});
