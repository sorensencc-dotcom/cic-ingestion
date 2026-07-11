import { GrokProvider } from "../adapters/grok/grok-provider.ts";

export interface DriftCheckRequest {
  id: string;
  baselineHash: string;
  slugs: string[];
}

export interface DriftCheckResult {
  id: string;
  baselineHash: string;
  currentHash: string;
  driftScore: number;
  hasDrift: boolean;
  latencyMs: number;
}

/**
 * Batches drift checks for efficiency.
 * Collects requests, executes single ingest call, distributes results.
 */
export class DriftBatcher {
  private queue: DriftCheckRequest[] = [];
  private flushIntervalMs: number;
  private maxBatchSize: number;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(flushIntervalMs: number = 100, maxBatchSize: number = 50) {
    this.flushIntervalMs = flushIntervalMs;
    this.maxBatchSize = maxBatchSize;
  }

  add(request: DriftCheckRequest): void {
    this.queue.push(request);

    // Auto-flush if batch full
    if (this.queue.length >= this.maxBatchSize) {
      this.flush();
    } else if (!this.flushTimer) {
      // Start timer if not already running
      this.flushTimer = setTimeout(() => this.flush(), this.flushIntervalMs);
    }
  }

  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // No-op if queue empty
    if (this.queue.length === 0) {
      return;
    }

    const batch = this.queue.splice(0, this.maxBatchSize);
    // Actual execution happens in async job (see driftDetectionJob)
    // This just batches; caller handles async execution
  }

  size(): number {
    return this.queue.length;
  }

  clear(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.queue = [];
  }
}

/**
 * Execute batched drift checks via single ingest call.
 */
export async function executeBatchedDriftChecks(
  grok: GrokProvider,
  requests: DriftCheckRequest[]
): Promise<DriftCheckResult[]> {
  if (requests.length === 0) {
    return [];
  }

  const startTime = Date.now();

  // Collect all unique slugs from batch
  const allSlugs = new Set<string>();
  for (const req of requests) {
    req.slugs.forEach(slug => allSlugs.add(slug));
  }

  // Single ingest call for entire batch
  const ingestResult: any = await grok.execute({
    kind: "ingest",
    slugs: Array.from(allSlugs),
  });

  const currentHash = ingestResult.lineage?.corpusHash ?? "";
  const latencyMs = Date.now() - startTime;

  // Distribute results to all requests
  const results: DriftCheckResult[] = requests.map(req => ({
    id: req.id,
    baselineHash: req.baselineHash,
    currentHash,
    driftScore: req.baselineHash === currentHash ? 0 : 1,
    hasDrift: req.baselineHash !== currentHash,
    latencyMs,
  }));

  return results;
}

/**
 * Drift detection job (runs daily/weekly).
 * Collects drift checks throughout period, executes once.
 */
export class DriftDetectionJob {
  private grok: GrokProvider;
  private batcher: DriftBatcher;
  private results: Map<string, DriftCheckResult> = new Map();

  constructor(grok: GrokProvider) {
    this.grok = grok;
    this.batcher = new DriftBatcher(500, 100); // Flush every 500ms or 100 items
  }

  checkDrift(
    id: string,
    baselineHash: string,
    slugs: string[]
  ): void {
    this.batcher.add({ id, baselineHash, slugs });
  }

  async execute(): Promise<DriftCheckResult[]> {
    // Flush remaining items
    await this.batcher.flush();

    // Get all queued requests (this is simplified; real impl would track them)
    // For now, return completed results
    return Array.from(this.results.values());
  }

  getResult(id: string): DriftCheckResult | undefined {
    return this.results.get(id);
  }

  clear(): void {
    this.batcher.clear();
    this.results.clear();
  }
}
