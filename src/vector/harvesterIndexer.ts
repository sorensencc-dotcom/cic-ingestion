import QdrantClient, { QdrantPoint } from "./qdrantClient.js";

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

  constructor(client: QdrantClient) {
    this.#client = client;
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

    await this.#client.upsert([point]);
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

    await this.#client.upsert(points);
  }
}

export default HarvesterIndexer;
