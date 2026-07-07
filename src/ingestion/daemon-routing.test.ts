import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import { IngestionDaemonRouting } from "./daemon-routing";

// Mock dependencies
jest.mock("src/server/cicStateStore.js");
jest.mock("../extractors/clientSessionExtractor.js");
jest.mock("../harness/replayHarness.js");
jest.mock("../drift/driftEngine.js");
jest.mock("./verify.js");
jest.mock("./ingestionRouter.js");
jest.mock("./ingestionManifest.js");
jest.mock("./operatorOverrides.js");

describe("Phase 27 Daemon Routing Integration", () => {
  let tempDir: string;
  let logPath: string;
  let mockStateStore: any;

  beforeEach(() => {
    // Create temp directory
    tempDir = path.join(__dirname, "..", "..", "..", "test-daemon-routing");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    logPath = path.join(tempDir, "client_sessions.jsonl");

    // Mock state store
    mockStateStore = {
      load: jest.fn(() => ({
        violations: [],
        drift: {},
        slaMetrics: { backlogCount: 0, lastEvaluated: Date.now(), totalTokens: 0 },
        slaSettings: { maxBacklog: 1000, maxLatencyMs: 5000, maxTokens: 100000, maxOscillations: 5 },
        activePlaybooks: {},
        governanceLockdown: false,
        promotionsFrozen: false,
        rollbacksFrozen: false,
        routingFrozen: false,
      })),
      save: jest.fn(),
    };
  });

  afterEach(() => {
    // Clean up
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
    jest.clearAllMocks();
  });

  describe("Normal routing flow", () => {
    it("should route entry and record to manifest", async () => {
      // Arrange
      const testEntry = {
        id: "test-1",
        backend: "mock",
        timestamp: Date.now(),
        response: { usage: { total_tokens: 100 } },
      };

      fs.writeFileSync(logPath, JSON.stringify(testEntry) + "\n");

      const daemon = new IngestionDaemonRouting(logPath, mockStateStore, 0);

      // Mock routing to return fast lane
      const { route } = require("./ingestionRouter.js");
      route.mockReturnValue({
        profile: "filesystem",
        lane: "fast",
        extractors: ["TextExtractor"],
      });

      // Mock extractor to succeed
      const { clientSessionExtractor } = require("../extractors/clientSessionExtractor.js");
      clientSessionExtractor.mockResolvedValue({ extracted: "data" });

      // Mock verification to pass
      const { verifyIngestionEntry } = require("./verify.js");
      verifyIngestionEntry.mockReturnValue({ ok: true });

      // Mock recordIngestion
      const { recordIngestion } = require("./ingestionManifest.js");
      recordIngestion.mockImplementation(() => {});

      // Mock other functions
      require("../drift/driftEngine.js").decayDriftScores.mockImplementation(() => {});
      require("../harness/replayHarness.js").processClientSession.mockImplementation(() => {});
      require("./operatorOverrides.js").getOverrideForEntry.mockReturnValue(null);

      // Act
      await daemon.runCycle();

      // Assert
      expect(route).toHaveBeenCalled();
      expect(recordIngestion).toHaveBeenCalled();
    });

    it("should track extractor and verification costs", async () => {
      // Arrange
      const testEntry = {
        id: "test-2",
        backend: "mock",
        timestamp: Date.now(),
      };

      fs.writeFileSync(logPath, JSON.stringify(testEntry) + "\n");

      const daemon = new IngestionDaemonRouting(logPath, mockStateStore, 0);

      const { route } = require("./ingestionRouter.js");
      route.mockReturnValue({
        profile: "api:generic",
        lane: "deep",
        extractors: ["TextExtractor", "SemanticExtractor"],
      });

      const { clientSessionExtractor } = require("../extractors/clientSessionExtractor.js");
      clientSessionExtractor.mockResolvedValue({ extracted: "data" });

      const { verifyIngestionEntry } = require("./verify.js");
      verifyIngestionEntry.mockReturnValue({ ok: true });

      const { recordIngestion } = require("./ingestionManifest.js");
      const recordCall = jest.fn();
      recordIngestion.mockImplementation(recordCall);

      require("../drift/driftEngine.js").decayDriftScores.mockImplementation(() => {});
      require("../harness/replayHarness.js").processClientSession.mockImplementation(() => {});
      require("./operatorOverrides.js").getOverrideForEntry.mockReturnValue(null);

      // Act
      await daemon.runCycle();

      // Assert
      expect(recordCall).toHaveBeenCalledWith(
        expect.objectContaining({ id: "test-2" }),
        expect.objectContaining({ profile: "api:generic", lane: "deep" }),
        expect.any(Object),
        expect.objectContaining({
          extractorCost: 0.001,
          verificationCost: 0.001,
          totalCost: 0.002,
        })
      );
    });
  });

  describe("Operator override flow", () => {
    it("should apply profile override from operator", async () => {
      // Arrange
      const testEntry = {
        id: "test-3",
        backend: "mock",
        timestamp: Date.now(),
      };

      fs.writeFileSync(logPath, JSON.stringify(testEntry) + "\n");

      const daemon = new IngestionDaemonRouting(logPath, mockStateStore, 0);

      const { route } = require("./ingestionRouter.js");
      route.mockReturnValue({
        profile: "filesystem",
        lane: "fast",
        extractors: ["TextExtractor"],
      });

      const { getOverrideForEntry, applyOverride } = require("./operatorOverrides.js");
      getOverrideForEntry.mockReturnValue({ overrideProfile: "images" });
      applyOverride.mockReturnValue({
        operatorFlags: { overrideProfile: "images" },
        profile: "images",
        lane: undefined,
      });

      const { clientSessionExtractor } = require("../extractors/clientSessionExtractor.js");
      clientSessionExtractor.mockResolvedValue({ extracted: "data" });

      const { verifyIngestionEntry } = require("./verify.js");
      verifyIngestionEntry.mockReturnValue({ ok: true });

      const { recordIngestion } = require("./ingestionManifest.js");
      const recordCall = jest.fn();
      recordIngestion.mockImplementation(recordCall);

      require("../drift/driftEngine.js").decayDriftScores.mockImplementation(() => {});
      require("../harness/replayHarness.js").processClientSession.mockImplementation(() => {});

      // Act
      await daemon.runCycle();

      // Assert
      expect(applyOverride).toHaveBeenCalled();
      expect(recordCall).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ profile: "images" }),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it("should skip entry when operator sets skip flag", async () => {
      // Arrange
      const testEntry = {
        id: "test-4",
        backend: "mock",
        timestamp: Date.now(),
      };

      fs.writeFileSync(logPath, JSON.stringify(testEntry) + "\n");

      const daemon = new IngestionDaemonRouting(logPath, mockStateStore, 0);

      const { getOverrideForEntry } = require("./operatorOverrides.js");
      getOverrideForEntry.mockReturnValue({ skip: true });

      const { clientSessionExtractor } = require("../extractors/clientSessionExtractor.js");
      const { recordIngestion } = require("./ingestionManifest.js");

      require("../drift/driftEngine.js").decayDriftScores.mockImplementation(() => {});

      // Act
      await daemon.runCycle();

      // Assert
      expect(clientSessionExtractor).not.toHaveBeenCalled();
      expect(recordIngestion).not.toHaveBeenCalled();
    });
  });

  describe("Quarantine path", () => {
    it("should quarantine entry when verification fails on deep lane", async () => {
      // Arrange
      const testEntry = {
        id: "test-5",
        backend: "mock",
        timestamp: Date.now(),
      };

      fs.writeFileSync(logPath, JSON.stringify(testEntry) + "\n");

      const daemon = new IngestionDaemonRouting(logPath, mockStateStore, 0);

      const { route } = require("./ingestionRouter.js");
      route.mockReturnValue({
        profile: "images",
        lane: "deep",
        extractors: ["ImageAnalyzer"],
      });

      const { clientSessionExtractor } = require("../extractors/clientSessionExtractor.js");
      clientSessionExtractor.mockResolvedValue({ extracted: "data" });

      const { verifyIngestionEntry } = require("./verify.js");
      verifyIngestionEntry.mockReturnValue({ ok: false, reason: "Invalid schema" });

      const { recordIngestion } = require("./ingestionManifest.js");
      recordIngestion.mockImplementation(() => {});

      require("../drift/driftEngine.js").decayDriftScores.mockImplementation(() => {});
      require("./operatorOverrides.js").getOverrideForEntry.mockReturnValue(null);

      // Act
      await daemon.runCycle();

      // Assert
      // Should record to manifest but not process/index
      expect(recordIngestion).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ lane: "deep" }),
        expect.any(Object),
        expect.any(Object)
      );
      // Should NOT call processClientSession
      const { processClientSession } = require("../harness/replayHarness.js");
      expect(processClientSession).not.toHaveBeenCalled();
    });

    it("should send to DLQ when verification fails on fast lane", async () => {
      // Arrange
      const testEntry = {
        id: "test-6",
        backend: "mock",
        timestamp: Date.now(),
      };

      fs.writeFileSync(logPath, JSON.stringify(testEntry) + "\n");

      const daemon = new IngestionDaemonRouting(logPath, mockStateStore, 0);

      const { route } = require("./ingestionRouter.js");
      route.mockReturnValue({
        profile: "filesystem",
        lane: "fast",
        extractors: ["TextExtractor"],
      });

      const { clientSessionExtractor } = require("../extractors/clientSessionExtractor.js");
      clientSessionExtractor.mockResolvedValue({ extracted: "data" });

      const { verifyIngestionEntry } = require("./verify.js");
      verifyIngestionEntry.mockReturnValue({ ok: false, reason: "Schema invalid", reasonCode: "SCHEMA_ERROR" });

      const { recordIngestion } = require("./ingestionManifest.js");
      recordIngestion.mockImplementation(() => {});

      require("../drift/driftEngine.js").decayDriftScores.mockImplementation(() => {});
      require("./operatorOverrides.js").getOverrideForEntry.mockReturnValue(null);

      // Act
      await daemon.runCycle();

      // Assert
      expect(recordIngestion).toHaveBeenCalled();
    });
  });

  describe("Cost propagation", () => {
    it("should calculate total cost correctly", async () => {
      // Arrange
      const testEntry = {
        id: "test-7",
        backend: "mock",
        timestamp: Date.now(),
      };

      fs.writeFileSync(logPath, JSON.stringify(testEntry) + "\n");

      const daemon = new IngestionDaemonRouting(logPath, mockStateStore, 0);

      const { route } = require("./ingestionRouter.js");
      route.mockReturnValue({
        profile: "pdf",
        lane: "deep",
        extractors: ["PDFExtractor", "TextExtractor"],
      });

      const { clientSessionExtractor } = require("../extractors/clientSessionExtractor.js");
      clientSessionExtractor.mockResolvedValue({ extracted: "data" });

      const { verifyIngestionEntry } = require("./verify.js");
      verifyIngestionEntry.mockReturnValue({ ok: true });

      const { recordIngestion } = require("./ingestionManifest.js");
      const recordCall = jest.fn();
      recordIngestion.mockImplementation(recordCall);

      require("../drift/driftEngine.js").decayDriftScores.mockImplementation(() => {});
      require("../harness/replayHarness.js").processClientSession.mockImplementation(() => {});
      require("./operatorOverrides.js").getOverrideForEntry.mockReturnValue(null);

      // Act
      await daemon.runCycle();

      // Assert
      const callArgs = recordCall.mock.calls[0];
      const cost = callArgs[3];
      expect(cost.totalCost).toBe(cost.extractorCost + cost.verificationCost);
    });
  });
});
