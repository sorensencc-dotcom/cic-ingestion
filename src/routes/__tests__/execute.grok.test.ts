import express from "express";
import { AddressInfo } from "net";
import { Server } from "http";
import { AdapterRegistry } from "../../adapters/AdapterRegistry";
import { AdapterInput, AdapterOutput, BaseAdapter } from "../../adapters/BaseAdapter";
import { AdapterIntegrationService } from "../../services/AdapterIntegrationService";
import { createExecuteRouter } from "../execute";

const ROUTE_KEY = "test-route-key-0123456789";
const ROUTES = ["/grok", "/xai-docs-mcp", "/batch/grok"];

class TestAdapter extends BaseAdapter {
  constructor(name: string) {
    super({ name, version: "1", timeout: 1000, retries: 1 });
  }

  normalize(input: unknown): AdapterInput {
    const value = typeof input === "object" && input !== null
      ? input as Record<string, unknown>
      : {};
    return { key: String(value.key ?? "test"), payload: {} };
  }

  async run(input: AdapterInput): Promise<AdapterOutput> {
    return { success: true, data: { key: input.key }, timestamp: 1 };
  }

  validate(output: AdapterOutput): AdapterOutput {
    return output;
  }
}

describe("credentialed Grok execute routes", () => {
  let server: Server;
  let service: AdapterIntegrationService;
  let base: string;

  beforeEach(async () => {
    process.env.CIC_CREDENTIALED_ROUTE_KEY = ROUTE_KEY;
    const registry = new AdapterRegistry();
    registry.register("grok", new TestAdapter("grok"));
    registry.register("xai-docs-mcp", new TestAdapter("xai-docs-mcp"));
    service = new AdapterIntegrationService(registry);

    const app = express();
    app.use(express.json());
    app.use("/execute", createExecuteRouter(service));
    await new Promise<void>((resolve) => (server = app.listen(0, resolve)));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  const post = (path: string, key: string | null = ROUTE_KEY) =>
    fetch(`${base}/execute${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(key ? { "x-cic-route-key": key } : {}),
      },
      body: JSON.stringify(path.startsWith("/batch/") ? [{ key: "test" }] : { key: "test" }),
    });

  afterEach(async () => {
    delete process.env.CIC_CREDENTIALED_ROUTE_KEY;
    service?.destroy();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  it.each(ROUTES)("rejects %s without a route key", async (path) => {
    const response = await post(path, null);
    expect(response.status).toBe(401);
  });

  it.each(ROUTES)("fails closed for %s when the route key is unset", async (path) => {
    delete process.env.CIC_CREDENTIALED_ROUTE_KEY;
    const response = await post(path);
    expect(response.status).toBe(401);
  });

  it.each(ROUTES)("allows %s with a valid route key", async (path) => {
    const response = await post(path);
    expect(response.status).toBe(200);
  });
});
