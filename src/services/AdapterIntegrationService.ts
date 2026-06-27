import { AdapterRegistry } from "../adapters/AdapterRegistry";
import { BaseAdapter, AdapterInput, AdapterOutput } from "../adapters/BaseAdapter";
import { WarmPoolManager } from "./WarmPoolManager";
import { SpaHydrationDetector } from "../detectors/SpaHydrationDetector";
import { VerticalDriftDetector } from "../detectors/VerticalDriftDetector";
import { SLOViolationWebhook, SLOEvent } from "../webhooks/SLOViolationWebhook";

export interface ExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  driftSignals: any[];
  hydrationFailures: any[];
  stats: {
    executionTime: number;
    warmPoolHit: boolean;
    hitRate: number;
  };
}

export class AdapterIntegrationService {
  private registry: AdapterRegistry;
  private warmPool: WarmPoolManager;
  private spaDetector: SpaHydrationDetector;
  private driftDetector: VerticalDriftDetector;
  private sloWebhook: SLOViolationWebhook;

  constructor(
    registry?: AdapterRegistry,
    warmPool?: WarmPoolManager,
    spaDetector?: SpaHydrationDetector,
    driftDetector?: VerticalDriftDetector,
    sloWebhook?: SLOViolationWebhook
  ) {
    this.registry = registry || new AdapterRegistry();
    this.warmPool = warmPool || new WarmPoolManager();
    this.spaDetector = spaDetector || new SpaHydrationDetector();
    this.driftDetector = driftDetector || new VerticalDriftDetector();
    this.sloWebhook = sloWebhook || new SLOViolationWebhook();
  }

  registerAdapter(name: string, adapter: BaseAdapter): void {
    this.registry.register(name, adapter);
  }

  async execute(
    adapterName: string,
    payload: any
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const driftSignals: any[] = [];
    const hydrationFailures: any[] = [];

    const adapter = this.registry.get(adapterName);
    if (!adapter) {
      throw new Error(`Adapter not found: ${adapterName}`);
    }

    try {
      const normalized = adapter.normalize(payload);

      const hydrated = await this.warmPool.hydrate(normalized);
      const warmPoolHit = hydrated.warm;

      const result = await adapter.run({
        ...normalized,
        metadata: hydrated.metadata,
      });

      const driftSignal = this.driftDetector.check(result, adapterName);
      if (driftSignal) {
        driftSignals.push(driftSignal);
        await this.sloWebhook.emitDrift(driftSignal, adapterName);
      }

      const hydrationFailure = this.spaDetector.check(result);
      if (hydrationFailure) {
        hydrationFailures.push(hydrationFailure);
        await this.sloWebhook.emitHydrationFailure(hydrationFailure, adapterName);
      }

      const validated = adapter.validate(result);

      const executionTime = Date.now() - startTime;
      const poolStats = this.warmPool.getStats();

      return {
        success: validated.success,
        data: validated.data,
        error: validated.error,
        driftSignals,
        hydrationFailures,
        stats: {
          executionTime,
          warmPoolHit,
          hitRate: poolStats.hitRate,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const poolStats = this.warmPool.getStats();

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        driftSignals,
        hydrationFailures,
        stats: {
          executionTime,
          warmPoolHit: false,
          hitRate: poolStats.hitRate,
        },
      };
    }
  }

  async executeBatch(
    adapterName: string,
    payloads: any[]
  ): Promise<ExecutionResult[]> {
    return Promise.all(payloads.map((p) => this.execute(adapterName, p)));
  }

  invalidateWarmPool(key?: string): number {
    if (key) {
      this.warmPool.invalidate(key) ? 1 : 0;
      return 1;
    }

    const stats = this.warmPool.getStats();
    this.warmPool.clear();
    return stats.poolSize;
  }

  getWarmPoolStats() {
    return this.warmPool.getStats();
  }

  getRegisteredAdapters(): Record<string, BaseAdapter> {
    return this.registry.getAll();
  }

  getDriftBaseline(adapterId: string): number | null {
    return this.driftDetector.getBaseline(adapterId);
  }

  resetDriftBaseline(adapterId: string): void {
    this.driftDetector.resetBaseline(adapterId);
  }

  async shutdown(): Promise<void> {
    this.warmPool.destroy();
  }
}
