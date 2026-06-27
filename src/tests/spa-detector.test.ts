import { describe, it, expect, beforeEach } from "@jest/globals";
import { SpaHydrationDetector } from "../detectors/SpaHydrationDetector";
import { AdapterOutput } from "../adapters/BaseAdapter";

describe("SpaHydrationDetector", () => {
  let detector: SpaHydrationDetector;

  beforeEach(() => {
    detector = new SpaHydrationDetector();
  });

  it("detects null results", () => {
    const failure = detector.check(null as any);

    expect(failure).toBeDefined();
    expect(failure?.reason).toBe("null result");
    expect(failure?.severity).toBe("HIGH");
  });

  it("detects missing hydration metadata", () => {
    const output: AdapterOutput = {
      success: true,
      data: { some: "data" },
      timestamp: Date.now(),
    };

    const failure = detector.check(output);

    expect(failure).toBeDefined();
    expect(failure?.reason).toBe("missing hydration metadata");
    expect(failure?.severity).toBe("MEDIUM");
  });

  it("detects hydration errors", () => {
    const output: AdapterOutput = {
      success: true,
      data: { some: "data" },
      hydration: {
        cached: false,
        timestamp: Date.now(),
        errors: ["Failed to load embeddings", "OCR timeout"],
      },
      timestamp: Date.now(),
    };

    const failure = detector.check(output);

    expect(failure).toBeDefined();
    expect(failure?.reason).toBe("hydration errors detected");
    expect(failure?.details).toEqual(["Failed to load embeddings", "OCR timeout"]);
    expect(failure?.severity).toBe("HIGH");
  });

  it("detects adapter execution failures", () => {
    const output: AdapterOutput = {
      success: false,
      error: "Network timeout",
      hydration: {
        cached: false,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    };

    const failure = detector.check(output);

    expect(failure).toBeDefined();
    expect(failure?.reason).toBe("adapter execution failed");
    expect(failure?.severity).toBe("HIGH");
  });

  it("detects low confidence scores", () => {
    const output: AdapterOutput = {
      success: true,
      data: { some: "data" },
      score: 0.2,
      hydration: {
        cached: false,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    };

    const failure = detector.check(output);

    expect(failure).toBeDefined();
    expect(failure?.reason).toBe("low confidence score");
    expect(failure?.severity).toBe("MEDIUM");
  });

  it("allows successful results", () => {
    const output: AdapterOutput = {
      success: true,
      data: { valid: "data" },
      score: 0.85,
      hydration: {
        cached: true,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    };

    const failure = detector.check(output);

    expect(failure).toBeNull();
  });

  it("checks batches of results", () => {
    const outputs: AdapterOutput[] = [
      {
        success: false,
        error: "Failed",
        hydration: { cached: false, timestamp: Date.now() },
        timestamp: Date.now(),
      },
      {
        success: true,
        data: {},
        score: 0.15,
        hydration: { cached: false, timestamp: Date.now() },
        timestamp: Date.now(),
      },
      {
        success: true,
        data: { valid: "data" },
        score: 0.9,
        hydration: { cached: true, timestamp: Date.now() },
        timestamp: Date.now(),
      },
    ];

    const failures = detector.checkBatch(outputs);

    expect(failures).toHaveLength(2);
    expect(failures[0].reason).toBe("adapter execution failed");
    expect(failures[1].reason).toBe("low confidence score");
  });

  it("assigns correct severity levels", () => {
    const highSeverity: AdapterOutput = {
      success: false,
      error: "Critical failure",
      hydration: { cached: false, timestamp: Date.now() },
      timestamp: Date.now(),
    };

    const mediumSeverity: AdapterOutput = {
      success: true,
      data: {},
      score: 0.25,
      hydration: { cached: false, timestamp: Date.now() },
      timestamp: Date.now(),
    };

    const highFailure = detector.check(highSeverity);
    const mediumFailure = detector.check(mediumSeverity);

    expect(highFailure?.severity).toBe("HIGH");
    expect(mediumFailure?.severity).toBe("MEDIUM");
  });

  it("includes error details in failure", () => {
    const output: AdapterOutput = {
      success: false,
      error: "Specific error message",
      hydration: { cached: false, timestamp: Date.now() },
      timestamp: Date.now(),
    };

    const failure = detector.check(output);

    expect(failure?.details).toBe("Specific error message");
  });

  it("handles empty hydration errors array", () => {
    const output: AdapterOutput = {
      success: true,
      data: { some: "data" },
      hydration: {
        cached: false,
        timestamp: Date.now(),
        errors: [],
      },
      timestamp: Date.now(),
    };

    const failure = detector.check(output);

    expect(failure).toBeNull();
  });

  it("differentiates between cache hit and miss", () => {
    const cached: AdapterOutput = {
      success: true,
      data: { cached: "data" },
      score: 0.85,
      hydration: {
        cached: true,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    };

    const notCached: AdapterOutput = {
      success: true,
      data: { fresh: "data" },
      score: 0.85,
      hydration: {
        cached: false,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    };

    const cachedFailure = detector.check(cached);
    const notCachedFailure = detector.check(notCached);

    expect(cachedFailure).toBeNull();
    expect(notCachedFailure).toBeNull();
  });
});
