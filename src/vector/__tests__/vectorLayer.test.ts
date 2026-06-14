import VectorLayer from "../vectorLayer.js";
import { VectorSelfHealer } from "../vectorSelfHealing.js";

describe("VectorLayer", () => {
  const url = "http://localhost:6333";
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("initializes and performs basic index, search, context write, and health check", async () => {
    // 1. Mock collection checks: all 404 to trigger creation
    fetchMock.mockResolvedValueOnce({
      status: 404,
      text: async () => JSON.stringify({ status: "error", error: "Not Found" }),
    });
    // Mock collection creation
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ result: true }),
    });

    // Context collection check (404)
    fetchMock.mockResolvedValueOnce({
      status: 404,
      text: async () => JSON.stringify({ status: "error", error: "Not Found" }),
    });
    // Context collection creation
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ result: true }),
    });

    // Skills collection check (404)
    fetchMock.mockResolvedValueOnce({
      status: 404,
      text: async () => JSON.stringify({ status: "error", error: "Not Found" }),
    });
    // Skills collection creation
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ result: true }),
    });

    const layer = new VectorLayer({
      url,
      collections: {
        chunks: "test_cic_chunks",
        context: "test_cic_context",
        skills: "test_cic_skills",
      },
      vectorSize: 4,
    });

    await layer.ensureCollections();

    // 2. Mock indexing (upsert)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ result: { status: "completed" } }),
    });

    await layer.chunks.indexer.indexChunk({
      id: "chunk-1",
      docId: "doc-1",
      sourcePath: "/tmp/doc-1.txt",
      timestamp: Date.now(),
      tags: ["test"],
      people: [],
      places: [],
      metadata: {},
      text: "hello world",
      vector: [0.1, 0.2, 0.3, 0.4],
    });

    // 3. Mock query (search)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          result: [
            {
              id: "chunk-1",
              score: 0.99,
              payload: { text: "hello world" },
            },
          ],
        }),
    });

    const hits = await layer.chunks.search.search({
      vector: [0.1, 0.2, 0.3, 0.4],
      limit: 5,
    });

    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].id).toBe("chunk-1");
    expect(hits[0].score).toBe(0.99);

    // 4. Mock context write (upsert)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ result: { status: "completed" } }),
    });

    await layer.context.writer.write({
      id: "ctx-1",
      vector: [0.4, 0.3, 0.2, 0.1],
      summary: "test summary",
      kind: "summary",
      docId: "doc-1",
      metadata: { test: true },
    });

    // 5. Mock health checks for healthSummary (one for each collection)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "ok" }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "ok" }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "ok" }),
    });

    const health = await layer.health();
    expect(health.chunks).toBe(true);
    expect(health.context).toBe(true);
    expect(health.skills).toBe(true);
  });

  it("handles unhealthy collections via self-healer", async () => {
    const layer = new VectorLayer({
      url,
      collections: {
        chunks: "test_cic_chunks",
        context: "test_cic_context",
        skills: "test_cic_skills",
      },
      vectorSize: 4,
    });

    // Health check returns unhealthy for chunks, healthy for the rest
    fetchMock.mockRejectedValueOnce(new Error("Network Error")); // chunks health fails
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "ok" }), // context health OK
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "ok" }), // skills health OK
    });

    // Healing triggers ensureCollections:
    // Chunks collection check (404)
    fetchMock.mockResolvedValueOnce({
      status: 404,
      text: async () => JSON.stringify({ status: "error", error: "Not Found" }),
    });
    // Chunks collection creation
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ result: true }),
    });

    // Context collection check (200 - already exists)
    fetchMock.mockResolvedValueOnce({
      status: 200,
      text: async () => JSON.stringify({ status: "ok" }),
    });

    // Skills collection check (200 - already exists)
    fetchMock.mockResolvedValueOnce({
      status: 200,
      text: async () => JSON.stringify({ status: "ok" }),
    });

    const healer = new VectorSelfHealer(layer, 1000);
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    await healer.check();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "VectorSelfHealer: unhealthy collections",
      ["chunks"]
    );

    consoleErrorSpy.mockRestore();
  });
});
