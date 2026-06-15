/**
 * torqueQueryRegression.test.ts
 * Retrieval-quality regression suite for TorqueQueryPlanner.
 */

import { TorqueQueryPlanner } from "../torqueQueryPlanner.js";
import QdrantClient, { QdrantQueryResult } from "../qdrantClient.js";

class FakeQdrantClient extends QdrantClient {
  #name: string;
  #results: QdrantQueryResult[];

  constructor(name: string, results: QdrantQueryResult[]) {
    super({ url: "http://fake", collection: name, vectorSize: 4 });
    this.#name = name;
    this.#results = results;
  }

  override async query(_vector: number[], limit: number) {
    return this.#results.slice(0, limit);
  }

  override collectionName() {
    return this.#name;
  }

  override async health() {
    return true;
  }

  override async stats() {
    return { points_count: this.#results.length, indexing: "ready" };
  }
}

describe("TorqueQueryPlanner retrieval quality", () => {
  const chunksClient = new FakeQdrantClient("cic_chunks", [
    { id: "chunk-1", score: 0.9, payload: { tags: ["alpha"] } },
    { id: "chunk-2", score: 0.7, payload: { tags: ["beta"] } },
  ]);

  const contextClient = new FakeQdrantClient("cic_context", [
    { id: "ctx-1", score: 0.85, payload: { kind: "summary" } },
    { id: "ctx-2", score: 0.6, payload: { kind: "contradiction" } },
  ]);

  const skillsClient = new FakeQdrantClient("cic_vertical_skills", [
    { id: "skill-1", score: 0.95, payload: { domain: "vector" } },
  ]);

  const planner = new TorqueQueryPlanner({
    chunks: { name: "chunks", client: chunksClient },
    context: { name: "context", client: contextClient },
    skills: { name: "skills", client: skillsClient },
  });

  it("fuses multi-collection results and preserves high-score items", async () => {
    const res = await planner.execute({
      vectorPrimary: [0.1, 0.2, 0.3, 0.4],
      limit: 5,
      collections: [
        { name: "chunks", client: chunksClient },
        { name: "context", client: contextClient },
        { name: "skills", client: skillsClient },
      ],
      facets: ["tags", "kind", "domain"],
    });

    const ids = res.hits.map((h) => h.id);
    expect(ids).toContain("skill-1"); // highest score
    expect(ids).toContain("chunk-1");
    expect(ids).toContain("ctx-1");
  });

  it("produces meaningful facets across collections", async () => {
    const res = await planner.execute({
      vectorPrimary: [0.1, 0.2, 0.3, 0.4],
      limit: 5,
      collections: [
        { name: "chunks", client: chunksClient },
        { name: "context", client: contextClient },
        { name: "skills", client: skillsClient },
      ],
      facets: ["tags", "kind", "domain"],
    });

    expect(res.facets.tags["alpha"]).toBeGreaterThan(0);
    expect(res.facets.kind["summary"]).toBeGreaterThan(0);
    expect(res.facets.domain["vector"]).toBeGreaterThan(0);
  });

  it("maintains diversification via MMR (no single collection dominates)", async () => {
    const res = await planner.execute({
      vectorPrimary: [0.1, 0.2, 0.3, 0.4],
      limit: 3,
      collections: [
        { name: "chunks", client: chunksClient },
        { name: "context", client: contextClient },
        { name: "skills", client: skillsClient },
      ],
      facets: [],
    });

    const collections = new Set(res.hits.map((h) => h.collection));
    expect(collections.size).toBeGreaterThan(1);
  });

  it("is stable across runs (regression guard)", async () => {
    const res1 = await planner.execute({
      vectorPrimary: [0.1, 0.2, 0.3, 0.4],
      limit: 5,
      collections: [
        { name: "chunks", client: chunksClient },
        { name: "context", client: contextClient },
        { name: "skills", client: skillsClient },
      ],
      facets: [],
    });

    const res2 = await planner.execute({
      vectorPrimary: [0.1, 0.2, 0.3, 0.4],
      limit: 5,
      collections: [
        { name: "chunks", client: chunksClient },
        { name: "context", client: contextClient },
        { name: "skills", client: skillsClient },
      ],
      facets: [],
    });

    expect(res1.hits.map((h) => h.id)).toEqual(res2.hits.map((h) => h.id));
  });
});
