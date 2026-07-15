import { CircuitBreaker } from "./circuitBreaker";
import { RateLimiter } from "./rateLimiter";
import { TimeoutHandler } from "./timeout";
import { RetryHandler } from "./retry";
import { FallbackChain } from "./fallbackChain";

export interface HardeningConfig {
  name: string;
  circuitBreakerFailureThreshold?: number;
  rateLimiterRequestsPerSecond?: number;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface HardeningMetrics {
  name: string;
  circuitBreaker: any;
  rateLimiter: any;
  timeout: any;
  retry: any;
  fallback: any;
}

/**
 * Composite hardening orchestrator: combines all resilience patterns.
 * Execution flow:
 * 1. Rate limit check (reject if over limit)
 * 2. Circuit breaker check (fail-fast if OPEN)
 * 3. Retry loop with timeout wrapper
 * 4. Fallback chain (try alternate providers)
 */
export class HardeningOrchestrator {
  private circuitBreaker: CircuitBreaker;
  private rateLimiter: RateLimiter;
  private timeoutHandler: TimeoutHandler;
  private retryHandler: RetryHandler;
  private fallbackChain: FallbackChain;
  private readonly name: string;

  constructor(config: HardeningConfig) {
    this.name = config.name;
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: config.circuitBreakerFailureThreshold ?? 5,
      name: `${config.name}-cb`,
    });
    this.rateLimiter = new RateLimiter({
      requestsPerSecond: config.rateLimiterRequestsPerSecond ?? 10,
      name: `${config.name}-rl`,
    });
    this.timeoutHandler = new TimeoutHandler({
      timeoutMs: config.timeoutMs ?? 30000,
      name: `${config.name}-timeout`,
    });
    this.retryHandler = new RetryHandler({
      maxAttempts: config.maxRetries ?? 3,
      name: `${config.name}-retry`,
    });
    this.fallbackChain = new FallbackChain({
      name: `${config.name}-fallback`,
    });
  }

  /**
   * Execute with full hardening: rate limit → circuit breaker → timeout+retry → fallback
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Step 1: Rate limit
    if (!this.rateLimiter.tryConsume()) {
      throw new Error(`${this.name} rate limit exceeded`);
    }

    // Step 2: Circuit breaker (with fallback on failure)
    try {
      return await this.circuitBreaker.execute(async () => {
        // Step 3: Retry with timeout
        return this.retryHandler.execute(async () => {
          return this.timeoutHandler.execute(fn);
        });
      });
    } catch (primaryError) {
      // Step 4: Attempt fallback chain if providers registered
      if (!this.fallbackChain.hasProviders()) {
        throw primaryError;
      }
      try {
        return await this.fallbackChain.execute<T>();
      } catch (fallbackError: any) {
        const err = new Error(
          `${this.name} primary and all fallback providers failed: ${fallbackError.message}`
        );
        (err as any).cause = primaryError;
        throw err;
      }
    }
  }

  /**
   * Execute with async rate limiting (waits if needed).
   */
  async executeWithAsyncRateLimit<T>(fn: () => Promise<T>): Promise<T> {
    // Step 1: Rate limit (blocking)
    await this.rateLimiter.consume();
    // Step 2-4: Same as above
    return this.execute(fn);
  }

  addFallbackProvider(name: string, execute: <T>() => Promise<T>, priority = 100): void {
    this.fallbackChain.addProvider({
      name,
      execute,
      priority,
    });
  }

  getMetrics(): HardeningMetrics {
    return {
      name: this.name,
      circuitBreaker: this.circuitBreaker.getMetrics(),
      rateLimiter: this.rateLimiter.getMetrics(),
      timeout: this.timeoutHandler.getConfig(),
      retry: this.retryHandler.getMetrics(),
      fallback: this.fallbackChain.getMetrics(),
    };
  }

  reset(): void {
    this.circuitBreaker.reset();
    this.rateLimiter.reset();
    this.retryHandler.reset();
    this.fallbackChain.reset();
  }
}

/**
 * Registry of hardening orchestrators per provider.
 */
export class HardeningRegistry {
  private orchestrators: Map<string, HardeningOrchestrator> = new Map();

  getOrCreate(config: HardeningConfig): HardeningOrchestrator {
    if (!this.orchestrators.has(config.name)) {
      this.orchestrators.set(config.name, new HardeningOrchestrator(config));
    }
    return this.orchestrators.get(config.name)!;
  }

  get(name: string): HardeningOrchestrator | undefined {
    return this.orchestrators.get(name);
  }

  getMetrics(name: string): HardeningMetrics | undefined {
    return this.orchestrators.get(name)?.getMetrics();
  }

  getAllMetrics(): Record<string, HardeningMetrics> {
    const metrics: Record<string, HardeningMetrics> = {};
    for (const [name, orchestrator] of this.orchestrators) {
      metrics[name] = orchestrator.getMetrics();
    }
    return metrics;
  }

  reset(name: string): void {
    this.orchestrators.get(name)?.reset();
  }

  resetAll(): void {
    for (const orchestrator of this.orchestrators.values()) {
      orchestrator.reset();
    }
  }
}
