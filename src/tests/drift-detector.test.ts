import { describe, it, expect, beforeEach } from "@jest/globals";
import { VerticalDriftDetector } from "../detectors/VerticalDriftDetector";
import { AdapterOutput } from "../adapters/BaseAdapter";

describe("VerticalDriftDetector", () => {
  let detector: VerticalDriftDetector;

  beforeEach(() => {
    detector = new VerticalDriftDetector();
  });

  it("detects null results", () => {
    const signal = detector.check(null as any);

    expect(signal).toBeDefined();
    expect(signal?.type).toBe("NULL_RESULT");
    expect(signal?.severity).toBe("CRITICAL");
  });

  it("detects failed adapter execution", () => {
    const output: AdapterOutput = {
      success: false,
      error: "Connection timeout",
      timestamp: Date.now(),
    };

    const signal = detector.check(output);

    expect(signal).toBeDefined();
    expect(signal?.type).toBe("TIMEOUT");
    expect(signal?.severity).toBe("HIGH");
  });

  it("detects confidence drops", () => {
    const output: AdapterOutput = {
      success: true,
      data: { result: "low confidence" },
      score: 0.2,
      timestamp: Date.now(),
    };

    const signal = detector.check(output);

    expect(signal).toBeDefined();
    expect(signal?.type).toBe("CONFIDENCE_DROP");
    expect(signal?.severity).toBe("CRITICAL");
  });

  it("allows scores above threshold", () => {
    const output: AdapterOutput = {
      success: true,
      data: { result: "ok" },
      score: 0.8,
      timestamp: Date.now(),
    };

    const signal = detector.check(output);

    expect(signal).toBeNull();
  });

  it("detects schema drift from baseline", () => {
    const output1: AdapterOutput = {
      success: true,
      data: { result: "first" },
      score: 0.9,
      timestamp: Date.now(),
    };

    const output2: AdapterOutput = {
      success: true,
      data: { result: "drifted" },
      score: 0.4,
      timestamp: Date.now(),
    };

    detector.check(output1, "test-adapter");

    const signal = detector.check(output2, "test-adapter");

    expect(signal).toBeDefined();
    expect(signal?.type).toBe("SCHEMA_MISMATCH");
    expect(signal?.severity).toBe("MEDIUM");
  });

  it("checks batches of results", () => {
    const outputs: AdapterOutput[] = [
      { success: false, error: "Failed", timestamp: Date.now() },
      { success: true, data: {}, score: 0.1, timestamp: Date.now() },
      { success: true, data: {}, score: 0.9, timestamp: Date.now() },
    ];

    const signals = detector.checkBatch(outputs);

    expect(signals).toHaveLength(2);
    expect(signals[0].type).toBe("TIMEOUT");
    expect(signals[1].type).toBe("CONFIDENCE_DROP");
  });

  it("manages per-adapter baselines", () => {
    const output: AdapterOutput = {
      success: true,
      data: { result: "ok" },
      score: 0.75,
      timestamp: Date.now(),
    };

    detector.check(output, "adapter-1");

    const baseline = detector.getBaseline("adapter-1");
    expect(baseline).toBe(0.75);

    detector.resetBaseline("adapter-1");

    const resetBaseline = detector.getBaseline("adapter-1");
    expect(resetBaseline).toBeNull();
  });

  it("clears all baselines", () => {
    const output: AdapterOutput = {
      success: true,
      data: { result: "ok" },
      score: 0.8,
      timestamp: Date.now(),
    };

    detector.check(output, "adapter-1");
    detector.check(output, "adapter-2");
    detector.check(output, "adapter-3");

    expect(detector.getBaseline("adapter-1")).toBeDefined();
    expect(detector.getBaseline("adapter-2")).toBeDefined();
    expect(detector.getBaseline("adapter-3")).toBeDefined();

    detector.clearBaselines();

    expect(detector.getBaseline("adapter-1")).toBeNull();
    expect(detector.getBaseline("adapter-2")).toBeNull();
    expect(detector.getBaseline("adapter-3")).toBeNull();
  });

  it("assigns correct severity levels", () => {
    const criticalScore: AdapterOutput = {
      success: true,
      data: {},
      score: 0.15,
      timestamp: Date.now(),
    };

    const mediumScore: AdapterOutput = {
      success: true,
      data: {},
      score: 0.35,
      timestamp: Date.now(),
    };

    const criticalSignal = detector.check(criticalScore);
    const mediumSignal = detector.check(mediumScore);

    expect(criticalSignal?.severity).toBe("CRITICAL");
    expect(mediumSignal?.severity).toBe("HIGH");
  });

  it("tracks metadata in drift details", () => {
    const output1: AdapterOutput = {
      success: true,
      data: {},
      score: 0.85,
      timestamp: Date.now(),
    };

    const output2: AdapterOutput = {
      success: true,
      data: {},
      score: 0.45,
      timestamp: Date.now(),
    };

    detector.check(output1, "test");
    const signal = detector.check(output2, "test");

    expect(signal?.details).toBeDefined();
    expect(signal?.details.current).toBe(0.45);
    expect(signal?.details.baseline).toBe(0.85);
    expect(signal?.details.drift).toBeDefined();
  });
});
