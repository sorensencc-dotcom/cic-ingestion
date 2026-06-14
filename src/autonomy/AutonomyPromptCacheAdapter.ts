/**
 * Integration adapter: AutonomyService + Prompt Cache Router
 * Enables autonomy agents to use prompt caching for document analysis
 *
 * Usage (in AutonomyService):
 *   const adapter = new AutonomyPromptCacheAdapter();
 *   const result = await adapter.analyzeDocumentWithCache({
 *     docId: 'kroll_batch_001',
 *     docText: archivalContent,
 *     task: 'extract_findings',
 *   });
 */

import { CICPromptCacheRouter } from '../prompt-cache/router';

export type AnalysisTask =
  | 'extract_findings'
  | 'identify_gaps'
  | 'propose_actions'
  | 'summarize_content'
  | 'detect_patterns';

export interface DocumentAnalysisRequest {
  docId: string;
  docText: string;
  task: AnalysisTask;
  context?: string;
}

export interface DocumentAnalysisResult {
  analysis: string;
  task: AnalysisTask;
  cacheMetadata: {
    cacheHit: boolean;
    cacheReadTokens: number;
    inputTokens: number;
    outputTokens: number;
    costSavings: number;
  };
}

export class AutonomyPromptCacheAdapter {
  private router: CICPromptCacheRouter;

  constructor(registryDbPath?: string) {
    this.router = new CICPromptCacheRouter(registryDbPath);
  }

  async analyzeDocumentWithCache(
    req: DocumentAnalysisRequest
  ): Promise<DocumentAnalysisResult> {
    const { docId, docText, task, context } = req;

    // Build task-specific prompt
    const userPrompt = this.buildPromptForTask(task, context);

    // Generate with caching
    const result = await this.router.generateWithCache({
      docId,
      docText,
      userPrompt,
      maxTokens: 2000,
    });

    return {
      analysis: result.response,
      task,
      cacheMetadata: {
        cacheHit: result.metadata.cacheHit,
        cacheReadTokens: result.metadata.cacheReadTokens,
        inputTokens: result.metadata.inputTokens,
        outputTokens: result.metadata.outputTokens,
        costSavings: result.metadata.costSavings,
      },
    };
  }

  private buildPromptForTask(task: AnalysisTask, context?: string): string {
    const baseContext = context ? `Context: ${context}\n\n` : '';

    switch (task) {
      case 'extract_findings':
        return `${baseContext}Analyze the provided document and extract key findings. Format as bullet points.`;

      case 'identify_gaps':
        return `${baseContext}Identify missing information, research gaps, or unresolved questions in the document.`;

      case 'propose_actions':
        return `${baseContext}Based on the document, propose concrete next steps or actions.`;

      case 'summarize_content':
        return `${baseContext}Provide a concise summary of the document in 2-3 paragraphs.`;

      case 'detect_patterns':
        return `${baseContext}Identify recurring patterns, themes, or anomalies in the document.`;

      default:
        return `${baseContext}Analyze the document and provide insights.`;
    }
  }

  /**
   * Get metrics for a specific document
   */
  getDocumentMetrics(contentHash: string) {
    return this.router.getMetrics(contentHash);
  }

  /**
   * Get aggregate cache statistics
   */
  getCacheStatistics() {
    return this.router.getSummary();
  }

  /**
   * Clear registry (use carefully)
   */
  clearRegistry(): void {
    this.router.clearRegistry();
  }

  /**
   * Log current cache status
   */
  logCacheStatus(): void {
    const stats = this.router.getSummary();
    console.log('[PromptCache] Cache Status:', {
      eligible_documents: stats.eligible_docs,
      hit_rate: `${stats.overall_hit_rate_percent.toFixed(1)}%`,
      total_hits: stats.total_cache_hits,
      total_misses: stats.total_cache_misses,
      tokens_saved: stats.total_cache_read_tokens_saved,
    });
  }
}
