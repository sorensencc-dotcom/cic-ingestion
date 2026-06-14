import QdrantClient, { QdrantQueryResult } from "./qdrantClient.js";

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

  constructor(client: QdrantClient) {
    this.#client = client;
  }

  async search(req: TorqueQueryRequest): Promise<TorqueQueryHit[]> {
    const results: QdrantQueryResult[] = await this.#client.query(
      req.vector,
      req.limit
    );

    return results.map((r) => ({
      id: r.id,
      score: r.score,
      payload: r.payload,
    }));
  }
}

export default TorqueQueryEngine;
