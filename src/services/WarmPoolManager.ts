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

// Phase 5: Execution orchestrator warm pool
export interface WarmExecutorContainer {
  id: string;
  toolId: string;
  startedAt: number;
  lastUsed: number;
  isHealthy: boolean;
  execCount: number;
}

export interface ExecutorPoolStats {
  totalContainers: number;
  activeContainers: number;
  avgStartupTime: number;
  containerHitRate: number;
}

export class WarmPoolManager {
  private pool = new Map<string, WarmPoolEntry>();
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  // Phase 5: Execution orchestrator warm pool
  private executorPool = new Map<string, WarmExecutorContainer>();
  private executorStats = {
    totalStartupTime: 0,
    totalStartups: 0,
    containerReuseCount: 0,
  };
  private readonly WARM_POOL_SIZE = 5; // Maintain 5 warm containers
  private readonly CONTAINER_TTL = 600000; // 10 minutes
  private readonly TRUSTED_TOOLS = new Set(['read', 'write', 'grep', 'execute_bash']); // Fast-path eligible

  private defaultTTL: number;
  private maxPoolSize: number;
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

  /**
   * Phase 5: Get warm executor container for tool.
   * Reuse from pool if available, otherwise create new (cold start 1500ms → warm 200ms).
   */
  getWarmExecutor(toolId: string): WarmExecutorContainer {
    const now = Date.now();

    // Check for available warm container for this tool
    for (const [, container] of this.executorPool) {
      if (container.toolId === toolId && container.isHealthy) {
        // Reuse warm container
        container.lastUsed = now;
        container.execCount++;
        this.executorStats.containerReuseCount++;
        return container;
      }
    }

    // No warm container: create new (cold start)
    const newContainer: WarmExecutorContainer = {
      id: `executor-${Date.now()}-${Math.random()}`,
      toolId,
      startedAt: now,
      lastUsed: now,
      isHealthy: true,
      execCount: 1,
    };

    // Add to pool if space available
    if (this.executorPool.size < this.WARM_POOL_SIZE) {
      this.executorPool.set(newContainer.id, newContainer);
    }

    return newContainer;
  }

  /**
   * Check if tool is eligible for fast-path (trusted tools only).
   * Fast-path skips full initialization, uses direct invocation.
   */
  isTrustedTool(toolId: string): boolean {
    return this.TRUSTED_TOOLS.has(toolId);
  }

  /**
   * Record executor startup time for warm pool optimization.
   */
  recordExecutorStartup(toolId: string, startupTime: number): void {
    this.executorStats.totalStartupTime += startupTime;
    this.executorStats.totalStartups++;
  }

  /**
   * Get executor pool statistics.
   */
  getExecutorPoolStats(): ExecutorPoolStats {
    const healthyContainers = Array.from(this.executorPool.values()).filter(c => c.isHealthy).length;
    const avgStartupTime = this.executorStats.totalStartups > 0
      ? this.executorStats.totalStartupTime / this.executorStats.totalStartups
      : 0;

    return {
      totalContainers: this.executorPool.size,
      activeContainers: healthyContainers,
      avgStartupTime,
      containerHitRate: this.executorStats.totalStartups > 0
        ? this.executorStats.containerReuseCount / (this.executorStats.containerReuseCount + this.executorStats.totalStartups)
        : 0,
    };
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

      // Clean hydration pool
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

      // Clean executor pool (Phase 5)
      for (const [id, container] of this.executorPool) {
        if (now - container.lastUsed > this.CONTAINER_TTL) {
          this.executorPool.delete(id);
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
