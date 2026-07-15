export interface FallbackProvider {
  name: string;
  execute: <T>() => Promise<T>;
  priority: number;
}

export type FallbackProviderState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface FallbackChainConfig {
  name?: string;
  breakOnSuccess?: boolean;
  providerFailureThreshold?: number;
  providerResetTimeoutMs?: number;
}

export interface FallbackChainMetrics {
  name: string;
  totalAttempts: number;
  attempts: Record<string, number>;
  successes: Record<string, number>;
  failures: Record<string, number>;
  lastError?: string;
  successProvider?: string;
  providerStates: Record<string, FallbackProviderState>;
  hasProviders: boolean;
}

interface InternalProviderState {
  state: FallbackProviderState;
  consecutiveFailures: number;
  resetTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * Fallback chain: try providers in order, with per-provider health state machine.
 * States: CLOSED (eligible) → OPEN (failing, skip) → HALF_OPEN (test) → CLOSED
 * Default: Grok → OpenRouter → Ollama
 * Falls through to next on failure.
 */
export class FallbackChain {
  private providers: FallbackProvider[] = [];
  private readonly name: string;
  private readonly breakOnSuccess: boolean;
  private readonly providerFailureThreshold: number;
  private readonly providerResetTimeoutMs: number;
  private totalAttempts = 0;
  private attempts: Record<string, number> = {};
  private successes: Record<string, number> = {};
  private failures: Record<string, number> = {};
  private lastError?: string;
  private successProvider?: string;
  private providerStates: Map<string, InternalProviderState> = new Map();

  constructor(config?: FallbackChainConfig) {
    this.name = config?.name ?? "FallbackChain";
    this.breakOnSuccess = config?.breakOnSuccess ?? true;
    this.providerFailureThreshold = config?.providerFailureThreshold ?? 3;
    this.providerResetTimeoutMs = config?.providerResetTimeoutMs ?? 30000;
  }

  addProvider(provider: FallbackProvider): void {
    this.providers.push(provider);
    this.providers.sort((a, b) => a.priority - b.priority);

    // Initialize metrics
    this.attempts[provider.name] = 0;
    this.successes[provider.name] = 0;
    this.failures[provider.name] = 0;

    // Initialize provider state
    this.providerStates.set(provider.name, {
      state: "CLOSED",
      consecutiveFailures: 0,
      resetTimer: null,
    });
  }

  async execute<T>(): Promise<T> {
    if (this.providers.length === 0) {
      throw new Error(`${this.name} has no providers configured`);
    }

    let lastError: Error | undefined;

    // Filter to non-OPEN providers first (CLOSED + HALF_OPEN)
    const eligibleProviders = this.providers.filter((p) => {
      const state = this.providerStates.get(p.name);
      return state?.state !== "OPEN";
    });

    // Fall through to all providers if everything is OPEN (last-resort fallback)
    const providersToTry = eligibleProviders.length > 0 ? eligibleProviders : this.providers;

    for (const provider of providersToTry) {
      const providerState = this.providerStates.get(provider.name)!;
      this.totalAttempts++;
      this.attempts[provider.name]++;

      try {
        const result = await provider.execute<T>();

        // Success: reset state and counter
        providerState.state = "CLOSED";
        providerState.consecutiveFailures = 0;
        if (providerState.resetTimer) {
          clearTimeout(providerState.resetTimer);
          providerState.resetTimer = null;
        }

        this.successes[provider.name]++;
        this.successProvider = provider.name;
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.lastError = lastError.message;
        this.failures[provider.name]++;

        // Update provider state on failure
        providerState.consecutiveFailures++;

        if (
          providerState.state === "CLOSED" &&
          providerState.consecutiveFailures >= this.providerFailureThreshold
        ) {
          // Transition CLOSED → OPEN
          providerState.state = "OPEN";
          // Schedule reset timer (OPEN → HALF_OPEN)
          if (providerState.resetTimer) {
            clearTimeout(providerState.resetTimer);
          }
          providerState.resetTimer = setTimeout(() => {
            providerState.state = "HALF_OPEN";
            providerState.resetTimer = null;
          }, this.providerResetTimeoutMs);
        } else if (providerState.state === "HALF_OPEN") {
          // Failure in HALF_OPEN: back to OPEN, restart cooldown
          providerState.state = "OPEN";
          if (providerState.resetTimer) {
            clearTimeout(providerState.resetTimer);
          }
          providerState.resetTimer = setTimeout(() => {
            providerState.state = "HALF_OPEN";
            providerState.resetTimer = null;
          }, this.providerResetTimeoutMs);
        }
      }
    }

    throw (
      lastError || new Error(`${this.name} exhausted all ${this.providers.length} providers`)
    );
  }

  hasProviders(): boolean {
    return this.providers.length > 0;
  }

  getMetrics(): FallbackChainMetrics {
    const providerStates: Record<string, FallbackProviderState> = {};
    for (const [name, state] of this.providerStates) {
      providerStates[name] = state.state;
    }

    return {
      name: this.name,
      totalAttempts: this.totalAttempts,
      attempts: { ...this.attempts },
      successes: { ...this.successes },
      failures: { ...this.failures },
      lastError: this.lastError,
      successProvider: this.successProvider,
      providerStates,
      hasProviders: this.hasProviders(),
    };
  }

  reset(): void {
    this.totalAttempts = 0;
    for (const name of Object.keys(this.attempts)) {
      this.attempts[name] = 0;
      this.successes[name] = 0;
      this.failures[name] = 0;
    }
    this.lastError = undefined;
    this.successProvider = undefined;

    // Reset per-provider state
    for (const [, state] of this.providerStates) {
      if (state.resetTimer) {
        clearTimeout(state.resetTimer);
      }
      state.state = "CLOSED";
      state.consecutiveFailures = 0;
      state.resetTimer = null;
    }
  }
}

/**
 * Registry of fallback chains per endpoint.
 */
export class FallbackChainRegistry {
  private chains: Map<string, FallbackChain> = new Map();

  getOrCreate(name: string, config?: FallbackChainConfig): FallbackChain {
    if (!this.chains.has(name)) {
      this.chains.set(name, new FallbackChain({ ...config, name }));
    }
    return this.chains.get(name)!;
  }

  get(name: string): FallbackChain | undefined {
    return this.chains.get(name);
  }

  getMetrics(name: string): FallbackChainMetrics | undefined {
    return this.chains.get(name)?.getMetrics();
  }

  getAllMetrics(): Record<string, FallbackChainMetrics> {
    const metrics: Record<string, FallbackChainMetrics> = {};
    for (const [name, chain] of this.chains) {
      metrics[name] = chain.getMetrics();
    }
    return metrics;
  }

  reset(name: string): void {
    this.chains.get(name)?.reset();
  }

  resetAll(): void {
    for (const chain of this.chains.values()) {
      chain.reset();
    }
  }
}
