import QdrantClient from "./qdrantClient.js";

export interface QdrantHealthSummary {
  collection: string;
  healthy: boolean;
}

export class QdrantObservability {
  #client: QdrantClient;

  constructor(client: QdrantClient) {
    this.#client = client;
  }

  async healthSummary(): Promise<QdrantHealthSummary> {
    const healthy = await this.#client.health();
    return {
      collection: this.#client.collectionName,
      healthy,
    };
  }
}

export default QdrantObservability;
