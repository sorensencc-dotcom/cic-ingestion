export interface RetryConfig {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  name?: string;
}

export interface RetryMetrics {
  name: string;
  totalAttempts: number;
  retries: number;
  failures: number;
  successes: number;
  lastError?: string;
}

/**
 * Retry with exponential backoff.
 * Delays: 100ms → 200ms → 400ms → 800ms (capped)
 */
export class RetryHandler {
  private readonly maxAttempts: number;
  private readonly initialDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly backoffMultiplier: number;
  private readonly name: string;
  private totalAttempts = 0;
  private retries = 0;
  private failures = 0;
  private successes = 0;
  private lastError?: string;

  constructor(config?: RetryConfig) {
    this.maxAttempts = config?.maxAttempts ?? 3;
    this.initialDelayMs = config?.initialDelayMs ?? 100;
    this.maxDelayMs = config?.maxDelayMs ?? 5000;
    this.backoffMultiplier = config?.backoffMultiplier ?? 2;
    this.name = config?.name ?? "RetryHandler";
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      this.totalAttempts++;
      try {
        const result = await fn();
        this.successes++;
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.lastError = lastError.message;

        if (attempt < this.maxAttempts) {
          const delay = this.calculateDelay(attempt - 1);
          this.retries++;
          await this.sleep(delay);
        } else {
          this.failures++;
        }
      }
    }

    throw lastError || new Error(`${this.name} failed after ${this.maxAttempts} attempts`);
  }

  private calculateDelay(attemptIndex: number): number {
    const exponentialDelay = this.initialDelayMs * Math.pow(this.backoffMultiplier, attemptIndex);
    return Math.min(exponentialDelay, this.maxDelayMs);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getMetrics(): RetryMetrics {
    return {
      name: this.name,
      totalAttempts: this.totalAttempts,
      retries: this.retries,
      failures: this.failures,
      successes: this.successes,
      lastError: this.lastError,
    };
  }

  reset(): void {
    this.totalAttempts = 0;
    this.retries = 0;
    this.failures = 0;
    this.successes = 0;
    this.lastError = undefined;
  }
}

/**
 * Registry of retry handlers per endpoint.
 */
export class RetryHandlerRegistry {
  private handlers: Map<string, RetryHandler> = new Map();
  private defaultConfig: RetryConfig;

  constructor(defaultConfig?: RetryConfig) {
    this.defaultConfig = defaultConfig ?? { maxAttempts: 3 };
  }

  getOrCreate(name: string, config?: RetryConfig): RetryHandler {
    if (!this.handlers.has(name)) {
      const cfg = config ?? this.defaultConfig;
      this.handlers.set(name, new RetryHandler({ ...cfg, name }));
    }
    return this.handlers.get(name)!;
  }

  get(name: string): RetryHandler | undefined {
    return this.handlers.get(name);
  }

  async execute<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const handler = this.getOrCreate(name);
    return handler.execute(fn);
  }

  getMetrics(name: string): RetryMetrics | undefined {
    return this.handlers.get(name)?.getMetrics();
  }

  getAllMetrics(): Record<string, RetryMetrics> {
    const metrics: Record<string, RetryMetrics> = {};
    for (const [name, handler] of this.handlers) {
      metrics[name] = handler.getMetrics();
    }
    return metrics;
  }

  reset(name: string): void {
    this.handlers.get(name)?.reset();
  }

  resetAll(): void {
    for (const handler of this.handlers.values()) {
      handler.reset();
    }
  }
}
