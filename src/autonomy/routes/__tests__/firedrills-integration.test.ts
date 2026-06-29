import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { AutonomyAPIServer } from "../../AutonomyAPIServer.js";
import fetch from "node-fetch";

describe("D-Phase: Fire-Drill Integration (AutonomyAPIServer)", () => {
  let server: AutonomyAPIServer;
  const baseUrl = "http://localhost:3099";

  beforeEach(async () => {
    server = new AutonomyAPIServer({
      port: 3099,
      host: "localhost"
    });
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  it("GET /health returns server status", async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    const data = await response.json() as any;
    expect(data.service).toBe("cic-autonomy-api");
    expect(data.status).toBe("ok");
  });

  it("GET /autonomy lists all endpoints", async () => {
    const response = await fetch(`${baseUrl}/autonomy`);
    expect(response.status).toBe(200);
    const data = await response.json() as any;
    expect(data.endpoints.firedrills).toBeDefined();
    expect(data.endpoints.execution).toBeDefined();
  });

  it("POST /autonomy/firedrills/run executes drills", async () => {
    const response = await fetch(`${baseUrl}/autonomy/firedrills/run`, {
      method: "POST"
    });
    expect(response.status).toBe(200);
    const data = await response.json() as any;
    expect(data.report).toBeDefined();
    expect(data.report.totalDrills).toBe(6);
  });

  it("GET /autonomy/firedrills/report returns last report", async () => {
    await fetch(`${baseUrl}/autonomy/firedrills/run`, { method: "POST" });
    const response = await fetch(`${baseUrl}/autonomy/firedrills/report`);
    expect(response.status).toBe(200);
    const data = await response.json() as any;
    expect(data.totalDrills).toBe(6);
    expect(data.passRate).toBeDefined();
  });

  it("GET /autonomy/firedrills/health returns quick status", async () => {
    const response = await fetch(`${baseUrl}/autonomy/firedrills/health`);
    expect(response.status).toBe(200);
    const data = await response.json() as any;
    expect(typeof data.healthy).toBe("boolean");
    expect(data.status).toMatch(/ready|degraded/);
  });
});
