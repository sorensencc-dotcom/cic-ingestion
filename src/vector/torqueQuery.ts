import QdrantClient, { QdrantQueryResult } from "./qdrantClient.js";
import QdrantObservability from "./qdrantObservability.js";

export interface TorqueQueryRequest {
  vector: number[];
  limit: number;
}

export interface TorqueQueryHit {
  id: string;
  score: number;
  payload: Record<string, unknown> | null;
}

export class TorqueQueryEngine {
  #client: QdrantClient;
  #observability?: QdrantObservability;

  constructor(client: QdrantClient, observability?: QdrantObservability) {
    this.#client = client;
    this.#observability = observability;
  }

  async search(req: TorqueQueryRequest): Promise<TorqueQueryHit[]> {
    const start = performance.now();
    const results: QdrantQueryResult[] = await this.#client.query(
      req.vector,
      req.limit
    );
    if (this.#observability) {
      this.#observability.recordSearchLatency(performance.now() - start);
    }

    return results.map((r) => ({
      id: r.id,
      score: r.score,
      payload: r.payload,
    }));
  }
}

export default TorqueQueryEngine;
