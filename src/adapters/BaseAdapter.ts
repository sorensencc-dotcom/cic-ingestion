export interface AdapterConfig {
  name: string;
  version: string;
  timeout: number;
  retries: number;
}

export interface AdapterInput {
  key: string;
  payload: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface AdapterOutput {
  success: boolean;
  data?: any;
  error?: string;
  hydration?: {
    cached: boolean;
    timestamp: number;
    errors?: string[];
  };
  score?: number;
  timestamp: number;
}

export abstract class BaseAdapter {
  constructor(protected config: AdapterConfig) {}

  abstract normalize(input: any): AdapterInput;
  abstract run(input: AdapterInput): Promise<AdapterOutput>;
  abstract validate(output: AdapterOutput): AdapterOutput;

  protected async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = this.config.retries
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        await this.delay(Math.pow(2, i) * 100);
      }
    }

    throw lastError;
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
