import QdrantClient from "./qdrantClient.js";

export interface QdrantHealthSummary {
  collection: string;
  healthy: boolean;
}

export interface QdrantCollectionMetrics {
  collection: string;
  healthy: boolean;
  pointCount: number | null;
  indexStatus: string | null;
  lastSearchLatencyMs: number | null;
  lastIndexLatencyMs: number | null;
}

export class QdrantObservability {
  #client: QdrantClient;
  #lastSearchLatencyMs: number | null = null;
  #lastIndexLatencyMs: number | null = null;

  constructor(client: QdrantClient) {
    this.#client = client;
  }

  recordSearchLatency(ms: number) {
    this.#lastSearchLatencyMs = ms;
  }

  recordIndexLatency(ms: number) {
    this.#lastIndexLatencyMs = ms;
  }

  async healthSummary(): Promise<QdrantHealthSummary> {
    const healthy = await this.#client.health();
    return {
      collection: this.#client.collectionName(),
      healthy,
    };
  }

  async metrics(): Promise<QdrantCollectionMetrics> {
    const healthy = await this.#client.health();

    let pointCount: number | null = null;
    let indexStatus: string | null = null;

    try {
      const stats = await this.#client.stats();
      pointCount = stats.points_count ?? null;
      indexStatus = stats.indexing ?? null;
    } catch {
      // leave null
    }

    return {
      collection: this.#client.collectionName(),
      healthy,
      pointCount,
      indexStatus,
      lastSearchLatencyMs: this.#lastSearchLatencyMs,
      lastIndexLatencyMs: this.#lastIndexLatencyMs,
    };
  }
}

export default QdrantObservability;
