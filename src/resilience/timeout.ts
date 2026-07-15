export interface TimeoutConfig {
  timeoutMs?: number;
  name?: string;
}

/**
 * Wrap promise with timeout. Rejects if duration exceeded.
 */
export class TimeoutHandler {
  private readonly timeoutMs: number;
  private readonly name: string;

  constructor(config?: TimeoutConfig) {
    this.timeoutMs = config?.timeoutMs ?? 30000; // 30s default
    this.name = config?.name ?? "TimeoutHandler";
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race<T>([fn(), this.createTimeout<T>()]);
  }

  private createTimeout<T>(): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${this.name} exceeded ${this.timeoutMs}ms`));
      }, this.timeoutMs);
    });
  }

  getConfig(): { timeoutMs: number; name: string } {
    return { timeoutMs: this.timeoutMs, name: this.name };
  }
}

/**
 * Registry of timeout handlers per endpoint.
 */
export class TimeoutHandlerRegistry {
  private handlers: Map<string, TimeoutHandler> = new Map();
  private defaultConfig: TimeoutConfig;

  constructor(defaultConfig?: TimeoutConfig) {
    this.defaultConfig = defaultConfig ?? { timeoutMs: 30000 };
  }

  getOrCreate(name: string, config?: TimeoutConfig): TimeoutHandler {
    if (!this.handlers.has(name)) {
      const cfg = config ?? this.defaultConfig;
      this.handlers.set(name, new TimeoutHandler({ ...cfg, name }));
    }
    return this.handlers.get(name)!;
  }

  get(name: string): TimeoutHandler | undefined {
    return this.handlers.get(name);
  }

  async execute<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const handler = this.getOrCreate(name);
    return handler.execute(fn);
  }
}
