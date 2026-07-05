import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { AdapterIntegrationService } from "../services/AdapterIntegrationService";
import { AdapterRegistry } from "../adapters/AdapterRegistry";
import { BaseAdapter, AdapterConfig, AdapterInput, AdapterOutput } from "../adapters/BaseAdapter";

class MockAdapter extends BaseAdapter {
  normalize(input: any): AdapterInput {
    return { key: input.key || "mock", payload: input.payload || {} };
  }

  async run(input: AdapterInput): Promise<AdapterOutput> {
    return {
      success: true,
      data: { mock: "data", key: input.key },
      score: 0.9,
      timestamp: Date.now(),
    };
  }

  validate(output: AdapterOutput): AdapterOutput {
    return output;
  }
}

class FailingAdapter extends BaseAdapter {
  normalize(input: any): AdapterInput {
    return { key: input.key || "fail", payload: input.payload || {} };
  }

  async run(input: AdapterInput): Promise<AdapterOutput> {
    return {
      success: false,
      error: "Simulated adapter failure",
      timestamp: Date.now(),
    };
  }

  validate(output: AdapterOutput): AdapterOutput {
    return output;
  }
}

class LowConfidenceAdapter extends BaseAdapter {
  normalize(input: any): AdapterInput {
    return { key: input.key || "low", payload: input.payload || {} };
  }

  async run(input: AdapterInput): Promise<AdapterOutput> {
    return {
      success: true,
      data: { low: "confidence" },
      score: 0.2,
      timestamp: Date.now(),
    };
  }

  validate(output: AdapterOutput): AdapterOutput {
    return output;
  }
}

describe("AdapterIntegrationService", () => {
  let service: AdapterIntegrationService;
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = new AdapterRegistry();
    service = new AdapterIntegrationService(registry);
  });

  it("executes adapter successfully", async () => {
    const config: AdapterConfig = { name: "mock", version: "1.0.0", timeout: 5000, retries: 3 };
    const adapter = new MockAdapter(config);
    service.registerAdapter("mock", adapter);

    const result = await service.execute("mock", { key: "test-1" });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.key).toBe("test-1");
    expect(result.stats.executionTime).toBeGreaterThan(0);
  });

  it("handles adapter not found", async () => {
    expect(() => service.execute("nonexistent", {})).rejects.toThrow(
      "Adapter not found: nonexistent"
    );
  });

  it("detects adapter execution failures", async () => {
    const config: AdapterConfig = { name: "fail", version: "1.0.0", timeout: 5000, retries: 3 };
    const adapter = new FailingAdapter(config);
    service.registerAdapter("fail", adapter);

    const result = await service.execute("fail", { key: "fail-1" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Simulated adapter failure");
    expect(result.driftSignals.length).toBeGreaterThan(0);
  });

  it("detects low confidence scores", async () => {
    const config: AdapterConfig = { name: "low", version: "1.0.0", timeout: 5000, retries: 3 };
    const adapter = new LowConfidenceAdapter(config);
    service.registerAdapter("low", adapter);

    const result = await service.execute("low", { key: "low-1" });

    expect(result.success).toBe(true);
    expect(result.driftSignals.length).toBeGreaterThan(0);
  });

  it("tracks warm pool hits", async () => {
    const config: AdapterConfig = { name: "mock", version: "1.0.0", timeout: 5000, retries: 3 };
    const adapter = new MockAdapter(config);
    service.registerAdapter("mock", adapter);

    const result1 = await service.execute("mock", { key: "pool-test" });
    const result2 = await service.execute("mock", { key: "pool-test" });

    expect(result1.stats.warmPoolHit).toBe(false);
    expect(result2.stats.warmPoolHit).toBe(true);
  });

  it("executes batch operations", async () => {
    const config: AdapterConfig = { name: "mock", version: "1.0.0", timeout: 5000, retries: 3 };
    const adapter = new MockAdapter(config);
    service.registerAdapter("mock", adapter);

    const results = await service.executeBatch("mock", [
      { key: "batch-1" },
      { key: "batch-2" },
      { key: "batch-3" },
    ]);

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.success)).toBe(true);
  });

  it("invalidates warm pool", async () => {
    const config: AdapterConfig = { name: "mock", version: "1.0.0", timeout: 5000, retries: 3 };
    const adapter = new MockAdapter(config);
    service.registerAdapter("mock", adapter);

    await service.execute("mock", { key: "invalidate-test" });

    const statsBefore = service.getWarmPoolStats();
    expect(statsBefore.poolSize).toBeGreaterThan(0);

    service.invalidateWarmPool();

    const statsAfter = service.getWarmPoolStats();
    expect(statsAfter.poolSize).toBe(0);
  });

  it("returns registered adapters", () => {
    const config: AdapterConfig = { name: "mock", version: "1.0.0", timeout: 5000, retries: 3 };
    const adapter = new MockAdapter(config);
    service.registerAdapter("mock", adapter);

    const adapters = service.getRegisteredAdapters();
    expect(adapters["mock"]).toBe(adapter);
  });

  it("manages drift baselines", async () => {
    const config: AdapterConfig = { name: "mock", version: "1.0.0", timeout: 5000, retries: 3 };
    const adapter = new MockAdapter(config);
    service.registerAdapter("mock", adapter);

    await service.execute("mock", { key: "drift-1" });

    const baseline = service.getDriftBaseline("mock");
    expect(baseline).toBe(0.9);

    service.resetDriftBaseline("mock");

    const resetBaseline = service.getDriftBaseline("mock");
    expect(resetBaseline).toBeNull();
  });

  it("handles execution errors gracefully", async () => {
    const errorAdapter = new MockAdapter({
      name: "error",
      version: "1.0.0",
      timeout: 5000,
      retries: 3,
    });

    (errorAdapter.run as any) = jest.fn().mockRejectedValue(new Error("Network error") as never);
    service.registerAdapter("error", errorAdapter);

    const result = await service.execute("error", { key: "error-1" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Network error");
  });
});
