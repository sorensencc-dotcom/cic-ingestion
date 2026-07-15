export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerConfig {
  failureThreshold?: number;
  failureRateThreshold?: number;
  windowSize?: number;
  resetTimeoutMs?: number;
  name?: string;
}

export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  consecutiveFailures: number;
  totalRequests: number;
  failureCount: number;
  successCount: number;
  failureRate: number;
  lastFailureTime?: number;
}

/**
 * Circuit breaker pattern: prevents cascading failures.
 * States: CLOSED (normal) → OPEN (failing fast) → HALF_OPEN (test recovery) → CLOSED
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = "CLOSED";
  private consecutiveFailures = 0;
  private totalRequests = 0;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: number;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly failureThreshold: number;
  private readonly failureRateThreshold: number;
  private readonly windowSize: number;
  private readonly resetTimeoutMs: number;
  private readonly name: string;
  private requestWindow: boolean[] = []; // true = success, false = failure

  constructor(config?: CircuitBreakerConfig) {
    this.failureThreshold = config?.failureThreshold ?? 5;
    this.failureRateThreshold = config?.failureRateThreshold ?? 0.5;
    this.windowSize = config?.windowSize ?? 100;
    this.resetTimeoutMs = config?.resetTimeoutMs ?? 60000; // 1 minute
    this.name = config?.name ?? "CircuitBreaker";
  }

  /**
   * Execute function with circuit breaker protection.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      throw new Error(`${this.name} is OPEN (circuit breaker)`);
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.successCount++;
    this.totalRequests++;
    this.requestWindow.push(true);
    if (this.requestWindow.length > this.windowSize) {
      this.requestWindow.shift();
    }

    // Transition HALF_OPEN → CLOSED after success
    if (this.state === "HALF_OPEN") {
      this.state = "CLOSED";
      this.clearResetTimer();
    }
  }

  private recordFailure(): void {
    this.consecutiveFailures++;
    this.failureCount++;
    this.totalRequests++;
    this.lastFailureTime = Date.now();
    this.requestWindow.push(false);
    if (this.requestWindow.length > this.windowSize) {
      this.requestWindow.shift();
    }

    // Check thresholds
    const failureRate = this.failureCount / this.totalRequests;
    if (
      this.consecutiveFailures >= this.failureThreshold ||
      failureRate >= this.failureRateThreshold
    ) {
      this.state = "OPEN";
      this.scheduleReset();
    }
  }

  private scheduleReset(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
    this.resetTimer = setTimeout(() => {
      this.state = "HALF_OPEN";
      this.resetTimer = null;
    }, this.resetTimeoutMs);
  }

  private clearResetTimer(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getMetrics(): CircuitBreakerMetrics {
    const failureRate =
      this.totalRequests === 0 ? 0 : this.failureCount / this.totalRequests;
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      totalRequests: this.totalRequests,
      failureCount: this.failureCount,
      successCount: this.successCount,
      failureRate,
      lastFailureTime: this.lastFailureTime,
    };
  }

  reset(): void {
    this.state = "CLOSED";
    this.consecutiveFailures = 0;
    this.totalRequests = 0;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.requestWindow = [];
    this.clearResetTimer();
  }
}

/**
 * Circuit breaker registry for multiple providers.
 */
export class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();
  private config: CircuitBreakerConfig;

  constructor(config?: CircuitBreakerConfig) {
    this.config = config ?? {};
  }

  getOrCreate(name: string): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker({ ...this.config, name }));
    }
    return this.breakers.get(name)!;
  }

  get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  getAll(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  getMetrics(name: string): CircuitBreakerMetrics | undefined {
    return this.breakers.get(name)?.getMetrics();
  }

  getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {};
    for (const [name, breaker] of this.breakers) {
      metrics[name] = breaker.getMetrics();
    }
    return metrics;
  }

  reset(name: string): void {
    this.breakers.get(name)?.reset();
  }

  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}
