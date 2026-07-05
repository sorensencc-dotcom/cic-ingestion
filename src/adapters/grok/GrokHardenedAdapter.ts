import { BaseAdapter, AdapterConfig, AdapterInput, AdapterOutput } from "../BaseAdapter.js";
import { GrokProvider } from "./grok-provider.js";
import { ragSearchCache, ragContextCache, RagCache } from "src/cache/ragCache.js";
import { HardeningOrchestrator, HardeningRegistry } from "src/resilience/hardeningOrchestrator.js";

/**
 * Hardened Grok adapter with:
 * - Built-in caching (Phase A)
 * - Circuit breaker + rate limiter + timeout + retry (Phase B)
 *
 * Drop-in replacement for GrokUnifiedAdapterOptimized with production resilience.
 * Fallback providers deferred to Phase D.
 */
export class GrokHardenedAdapter extends BaseAdapter {
  private cacheEnabled: boolean;
  private contextCacheEnabled: boolean;
  private orchestrator: HardeningOrchestrator;

  constructor(
    config: AdapterConfig,
    private readonly grok: GrokProvider,
    private readonly hardeningRegistry: HardeningRegistry,
    cacheEnabled: boolean = true,
    contextCacheEnabled: boolean = true
  ) {
    super(config);
    this.cacheEnabled = cacheEnabled;
    this.contextCacheEnabled = contextCacheEnabled;

    // Create per-provider orchestrator with hardening config
    this.orchestrator = hardeningRegistry.getOrCreate({
      name: `${config.name}-orchestrator`,
      timeoutMs: 30000,
      maxRetries: 3,
      circuitBreakerFailureThreshold: 5,
      rateLimiterRequestsPerSecond: 10,
    });
  }

  normalize(input: any): AdapterInput {
    if (typeof input === "string") {
      return { key: "search", payload: { query: input } };
    }

    if (input.messages && Array.isArray(input.messages)) {
      return {
        key: "chat",
        payload: {
          messages: input.messages,
          model: input.model,
          temperature: input.temperature,
          top_p: input.top_p,
          stream: input.stream,
        },
      };
    }

    if (input.query && typeof input.query === "string") {
      return { key: "search", payload: { query: input.query, maxResults: input.maxResults } };
    }

    if (input.slug && typeof input.slug === "string") {
      return { key: "get_page", payload: { slug: input.slug } };
    }

    if (Array.isArray(input.slugs)) {
      return { key: "ingest", payload: { slugs: input.slugs } };
    }

    if (input.key && input.payload) {
      return { key: input.key, payload: input.payload };
    }

    throw new Error("Invalid unified Grok input: must contain query, messages, slug, or slugs[]");
  }

  async run(input: AdapterInput): Promise<AdapterOutput> {
    const timestamp = Date.now();

    try {
      let result: any;

      if (input.key === "search") {
        result = await this.executeSearchWithHardening(
          input.payload.query,
          input.payload.maxResults
        );
      } else if (input.key === "get_page") {
        result = await this.executeWithHardening(async () =>
          this.grok.execute({
            kind: "get_page",
            slug: input.payload.slug,
          })
        );
      } else if (input.key === "ingest") {
        result = await this.executeWithHardening(async () =>
          this.grok.execute({
            kind: "ingest",
            slugs: input.payload.slugs,
          })
        );
      } else if (input.key === "chat") {
        result = await this.executeWithHardening(async () =>
          this.grok.execute({
            kind: "chat",
            messages: input.payload.messages,
            model: input.payload.model,
            temperature: input.payload.temperature,
            top_p: input.payload.top_p,
            stream: input.payload.stream,
          })
        );
      } else {
        throw new Error(`Unknown adapter key: ${input.key}`);
      }

      const duration = Date.now() - timestamp;

      return {
        success: true,
        data: result,
        timestamp,
        metadata: {
          duration,
          timestamp,
          adapter: this.config.name,
          cacheHit: result?.fromCache ?? false,
          orchestratorMetrics: this.orchestrator.getMetrics(),
        },
      };
    } catch (error) {
      const errorTimestamp = Date.now();
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: errorTimestamp,
        metadata: {
          duration: errorTimestamp - timestamp,
          timestamp: errorTimestamp,
          adapter: this.config.name,
          orchestratorMetrics: this.orchestrator.getMetrics(),
        },
      };
    }
  }

  validate(output: AdapterOutput): AdapterOutput {
    return output;
  }

  /**
   * Execute with hardening: rate limit → circuit breaker → timeout+retry
   */
  private async executeWithHardening<T>(fn: () => Promise<T>): Promise<T> {
    return this.orchestrator.execute<T>(fn);
  }

  /**
   * Execute search with caching + hardening.
   */
  private async executeSearchWithHardening(
    query: string,
    maxResults?: number
  ): Promise<any> {
    const cacheKey = RagCache.generateKey(query, { maxResults });

    // Check cache first (Phase A optimization)
    if (this.cacheEnabled) {
      const cached = ragSearchCache.get(cacheKey);
      if (cached) {
        return { items: cached, fromCache: true };
      }
    }

    // Execute with full hardening (Phase B resilience)
    const result = await this.executeWithHardening(async () =>
      this.grok.execute({
        kind: "search",
        query,
        maxResults,
      })
    );

    // Store in cache
    if (this.cacheEnabled && result.items) {
      ragSearchCache.set(cacheKey, result.items);
    }

    return { ...result, fromCache: false };
  }

  /**
   * Enable/disable search caching.
   */
  setSearchCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
  }

  /**
   * Enable/disable context caching.
   */
  setContextCacheEnabled(enabled: boolean): void {
    this.contextCacheEnabled = enabled;
  }

  /**
   * Clear all caches.
   */
  clearCaches(): void {
    ragSearchCache.clear();
    ragContextCache.clear();
  }

  /**
   * Get cache statistics (Phase A metrics).
   */
  getCacheStats(): {
    search: any;
    context: any;
    searchHitRate: string;
    contextHitRate: string;
  } {
    return {
      search: ragSearchCache.getStats(),
      context: ragContextCache.getStats(),
      searchHitRate: (ragSearchCache.getHitRate() * 100).toFixed(1) + "%",
      contextHitRate: (ragContextCache.getHitRate() * 100).toFixed(1) + "%",
    };
  }

  /**
   * Get hardening metrics (Phase B resilience).
   */
  getHardeningMetrics(): any {
    return this.orchestrator.getMetrics();
  }

  /**
   * Get combined Phase A + Phase B metrics.
   */
  getCombinedMetrics(): {
    cache: any;
    hardening: any;
  } {
    return {
      cache: this.getCacheStats(),
      hardening: this.getHardeningMetrics(),
    };
  }
}
