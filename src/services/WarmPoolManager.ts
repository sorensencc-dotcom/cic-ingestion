import { AdapterInput, AdapterOutput } from "../adapters/BaseAdapter";

export interface WarmPoolEntry {
  key: string;
  data: any;
  timestamp: number;
  ttl: number;
  hits: number;
}

export interface HydrationState {
  embeddings: any[];
  ocr: any;
  models: string[];
  cached: boolean;
  hitRate: number;
}

export class WarmPoolManager {
  private pool = new Map<string, WarmPoolEntry>();
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  private readonly defaultTTL = 3600000; // 1 hour
  private readonly maxPoolSize = 1000;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(ttl = 3600000, maxSize = 1000) {
    this.defaultTTL = ttl;
    this.maxPoolSize = maxSize;
    this.startCleanupInterval();
  }

  async hydrate(input: AdapterInput): Promise<AdapterInput & { warm: boolean; hydration: HydrationState }> {
    const key = this.computeKey(input);

    if (this.pool.has(key)) {
      const entry = this.pool.get(key)!;
      entry.hits++;
      this.stats.hits++;

      return {
        ...input,
        warm: true,
        hydration: {
          embeddings: entry.data.embeddings || [],
          ocr: entry.data.ocr || null,
          models: entry.data.models || [],
          cached: true,
          hitRate: this.getHitRate(),
        },
      };
    }

    this.stats.misses++;

    const hydrated = await this.buildWarmState(input);
    this.pool.set(key, {
      key,
      data: hydrated,
      timestamp: Date.now(),
      ttl: this.defaultTTL,
      hits: 0,
    });

    return {
      ...input,
      warm: false,
      hydration: {
        embeddings: hydrated.embeddings || [],
        ocr: hydrated.ocr || null,
        models: hydrated.models || [],
        cached: false,
        hitRate: this.getHitRate(),
      },
    };
  }

  async hydrateMany(inputs: AdapterInput[]): Promise<(AdapterInput & { warm: boolean; hydration: HydrationState })[]> {
    return Promise.all(inputs.map((i) => this.hydrate(i)));
  }

  private async buildWarmState(input: AdapterInput): Promise<any> {
    return {
      embeddings: [],
      ocr: null,
      models: [],
    };
  }

  private computeKey(input: AdapterInput): string {
    return `${input.key}:${JSON.stringify(input.metadata || {})}`;
  }

  invalidate(key: string): boolean {
    return this.pool.delete(key);
  }

  invalidateByPrefix(prefix: string): number {
    let count = 0;
    for (const [k] of this.pool) {
      if (k.startsWith(prefix)) {
        this.pool.delete(k);
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.pool.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  getStats() {
    return {
      ...this.stats,
      poolSize: this.pool.size,
      hitRate: this.getHitRate(),
    };
  }

  private getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total === 0 ? 0 : this.stats.hits / total;
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let evicted = 0;

      for (const [k, v] of this.pool) {
        if (now - v.timestamp > v.ttl) {
          this.pool.delete(k);
          evicted++;
        }
      }

      if (this.pool.size > this.maxPoolSize) {
        const entriesToRemove = this.pool.size - this.maxPoolSize;
        const sorted = Array.from(this.pool.values()).sort(
          (a, b) => a.hits - b.hits || a.timestamp - b.timestamp
        );

        for (let i = 0; i < entriesToRemove; i++) {
          this.pool.delete(sorted[i].key);
          evicted++;
        }
      }

      this.stats.evictions += evicted;
    }, 60000); // cleanup every minute
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}
