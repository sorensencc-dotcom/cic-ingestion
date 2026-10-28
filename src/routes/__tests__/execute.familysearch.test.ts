import express from "express";
import { AddressInfo } from "net";
import { Server } from "http";
import { AdapterRegistry } from "../../adapters/AdapterRegistry";
import { AdapterIntegrationService } from "../../services/AdapterIntegrationService";
import { createExecuteRouter } from "../execute";
import { AdapterInput, AdapterOutput } from "../../adapters/BaseAdapter";
import { FamilySearchSource } from "../../adapters/FamilySearchRouteAdapter";
import { registerFamilySearchFromEnv } from "../../config/familySearchRegistration";

const ok = (data: unknown): AdapterOutput => ({ success: true, data, score: 0.9, timestamp: 1 });

function makeSource(overrides: Partial<FamilySearchSource> = {}) {
  const source = {
    run: jest.fn(async (input: AdapterInput) => ok({ persons: [{ pid: input.key, name: "A" }], relationships: [] })),
    validate: jest.fn((o: AdapterOutput) => o),
    search: jest.fn(async (p: Record<string, unknown>) => ok({ results: [p] })),
    ...overrides,
  };
  return source;
}

describe("POST /execute/:adapter (familysearch)", () => {
  let server: Server;
  let service: AdapterIntegrationService;
  let base: string;
  let source: ReturnType<typeof makeSource>;

  async function start(env: NodeJS.ProcessEnv, src = makeSource()) {
    source = src;
    const registry = new AdapterRegistry();
    registerFamilySearchFromEnv(registry, env, { info: jest.fn(), warn: jest.fn() }, () => src);
    service = new AdapterIntegrationService(registry);
    const app = express();
    app.use(express.json());
    app.use("/execute", createExecuteRouter(service));
    await new Promise<void>((r) => (server = app.listen(0, r)));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  const post = (path: string, body: unknown) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  afterEach(async () => {
    service?.destroy();
    await new Promise((r) => server?.close(r));
  });

  it("person mode returns the chat-agent response shape", async () => {
    await start({ FAMILYSEARCH_API_KEY: "k" });
    const res = await post("/execute/familysearch", { key: "KW7S-ZZZ", payload: { mode: "person" } });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.persons[0].pid).toBe("KW7S-ZZZ");
    expect(Array.isArray(body.driftSignals)).toBe(true);
    expect(Array.isArray(body.hydrationFailures)).toBe(true);
    expect(typeof body.stats.hitRate).toBe("number");
    expect(source.search).not.toHaveBeenCalled();
  });

  it("defaults to person mode when payload is empty", async () => {
    await start({ FAMILYSEARCH_API_KEY: "k" });
    const res = await post("/execute/familysearch", { key: "PID-1", payload: {} });
    expect(res.status).toBe(200);
    expect(source.run).toHaveBeenCalledTimes(1);
  });

  it("search mode passes payload (minus mode) as search params", async () => {
    await start({ FAMILYSEARCH_API_KEY: "k" });
    const res = await post("/execute/familysearch", {
      key: "ignored",
      payload: { mode: "search", surname: "Sorensen", birthYear: 1900 },
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(source.search).toHaveBeenCalledWith({ surname: "Sorensen", birthYear: 1900 });
    expect(source.run).not.toHaveBeenCalled();
    expect(body.data.results).toEqual([{ surname: "Sorensen", birthYear: 1900 }]);
  });

  it("does not serve a cached search result for different params", async () => {
    await start({ FAMILYSEARCH_API_KEY: "k" });
    await post("/execute/familysearch", { key: "x", payload: { mode: "search", surname: "A" } });
    await post("/execute/familysearch", { key: "x", payload: { mode: "search", surname: "B" } });
    expect(source.search).toHaveBeenCalledTimes(2);
  });

  it("returns 404 for an unknown adapter", async () => {
    await start({ FAMILYSEARCH_API_KEY: "k" });
    const res = await post("/execute/nope", { key: "a", payload: {} });
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
  });

  it("returns 404 for familysearch when credentials are absent", async () => {
    await start({});
    const res = await post("/execute/familysearch", { key: "a", payload: {} });
    expect(res.status).toBe(404);
  });

  it("logs a clear warning and skips registration without credentials", () => {
    const registry = new AdapterRegistry();
    const log = { info: jest.fn(), warn: jest.fn() };
    expect(registerFamilySearchFromEnv(registry, {}, log)).toBe(false);
    expect(registry.has("familysearch")).toBe(false);
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("FAMILYSEARCH_API_KEY"));
  });

  it("returns 502 when the upstream call fails", async () => {
    await start(
      { FAMILYSEARCH_API_KEY: "k" },
      makeSource({ run: jest.fn(async () => ({ success: false, error: "HTTP 503", timestamp: 1 })) })
    );
    const res = await post("/execute/familysearch", { key: "PID", payload: {} });
    const body = await res.json();
    expect(res.status).toBe(502);
    expect(body.success).toBe(false);
    expect(body.error).toContain("503");
  });

  it("returns 502 when search upstream fails", async () => {
    await start(
      { FAMILYSEARCH_API_KEY: "k" },
      makeSource({ search: jest.fn(async () => ({ success: false, error: "timeout", timestamp: 1 })) })
    );
    const res = await post("/execute/familysearch", { key: "k", payload: { mode: "search", surname: "x" } });
    expect(res.status).toBe(502);
  });

  it("returns 400 when person mode has no key", async () => {
    await start({ FAMILYSEARCH_API_KEY: "k" });
    const res = await post("/execute/familysearch", { payload: {} });
    expect(res.status).toBe(400);
  });
});
