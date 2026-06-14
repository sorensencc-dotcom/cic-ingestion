import QdrantClient, { QdrantPoint } from "./qdrantClient.js";

export interface ContextItem {
  id: string;
  vector: number[];
  summary: string;
  kind: string; // "summary" | "contradiction" | "lead" | ...
  docId?: string;
  metadata?: Record<string, unknown>;
}

export class ContextStoreWriter {
  #client: QdrantClient;

  constructor(client: QdrantClient) {
    this.#client = client;
  }

  async write(item: ContextItem): Promise<void> {
    const payload: Record<string, unknown> = {
      summary: item.summary,
      kind: item.kind,
      doc_id: item.docId ?? null,
      metadata: item.metadata ?? {},
    };

    const point: QdrantPoint = {
      id: item.id,
      vector: item.vector,
      payload,
    };

    await this.#client.upsert([point]);
  }
}

export default ContextStoreWriter;
