import QdrantClient, { QdrantPoint } from "./qdrantClient.js";
import QdrantObservability from "./qdrantObservability.js";

export interface CICChunk {
  id: string;
  docId: string;
  sourcePath: string;
  timestamp: number;
  tags: string[];
  people: string[];
  places: string[];
  metadata: Record<string, unknown>;
  text: string;
  vector: number[];
}

export class HarvesterIndexer {
  #client: QdrantClient;
  #observability?: QdrantObservability;

  constructor(client: QdrantClient, observability?: QdrantObservability) {
    this.#client = client;
    this.#observability = observability;
  }

  async indexChunk(chunk: CICChunk): Promise<void> {
    const point: QdrantPoint = {
      id: chunk.id,
      vector: chunk.vector,
      payload: {
        doc_id: chunk.docId,
        chunk_id: chunk.id,
        source_path: chunk.sourcePath,
        timestamp: chunk.timestamp,
        tags: chunk.tags,
        people: chunk.people,
        places: chunk.places,
        metadata: chunk.metadata,
        text: chunk.text,
      },
    };

    const start = performance.now();
    await this.#client.upsert([point]);
    if (this.#observability) {
      this.#observability.recordIndexLatency(performance.now() - start);
    }
  }

  async bulkIndex(chunks: CICChunk[]): Promise<void> {
    const points: QdrantPoint[] = chunks.map((chunk) => ({
      id: chunk.id,
      vector: chunk.vector,
      payload: {
        doc_id: chunk.docId,
        chunk_id: chunk.id,
        source_path: chunk.sourcePath,
        timestamp: chunk.timestamp,
        tags: chunk.tags,
        people: chunk.people,
        places: chunk.places,
        metadata: chunk.metadata,
        text: chunk.text,
      },
    }));

    const start = performance.now();
    await this.#client.upsert(points);
    if (this.#observability) {
      this.#observability.recordIndexLatency(performance.now() - start);
    }
  }
}

export default HarvesterIndexer;
