import * as fs from "fs";
import * as path from "path";
import {
  recordIngestion,
  loadManifest,
  backfillFromProcessedLines,
} from "./ingestionManifest";
import { RoutedIngestionDecision, VerificationResult, Cost, FileLockedError } from "./types";

const MANIFEST_DIR = path.join(__dirname, "..", "..");
const MANIFEST_PATH = path.join(MANIFEST_DIR, "ingestionManifest.jsonl");
const LOCK_PATH = path.join(MANIFEST_DIR, "ingestionManifest.lock");
const TEMP_PATH = path.join(MANIFEST_DIR, "ingestionManifest.tmp");

describe("Phase 27 Ingestion Manifest", () => {
  beforeEach(() => {
    // Clean up test files
    for (const file of [MANIFEST_PATH, LOCK_PATH, TEMP_PATH]) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }
  });

  describe("recordIngestion()", () => {
    it("should write valid JSONL record", () => {
      const entry = {
        id: "test-1",
        source: "filesystem",
        mediaType: "text/plain",
        size: 1024,
        retryCount: 0,
      };

      const decision: RoutedIngestionDecision = {
        profile: "filesystem",
        lane: "fast",
        extractors: ["TextExtractor"],
      };

      const verification: VerificationResult = {
        passed: true,
        errors: [],
        cost: 0.001,
      };

      const cost: Cost = {
        extractorCost: 0.001,
        verificationCost: 0.001,
        totalCost: 0.002,
      };

      recordIngestion(entry, decision, verification, cost);

      expect(fs.existsSync(MANIFEST_PATH)).toBe(true);
      const lines = fs
        .readFileSync(MANIFEST_PATH, "utf-8")
        .split("\n")
        .filter((l) => l.trim());
      expect(lines.length).toBe(1);

      const record = JSON.parse(lines[0]);
      expect(record.id).toBe("test-1");
      expect(record.profile).toBe("filesystem");
      expect(record.lane).toBe("fast");
      expect(record.routingVersion).toBe("1.0.0");
      expect(record.cost.totalCost).toBe(0.002);
    });

    it("should have all required fields", () => {
      const entry = {
        id: "test-2",
        source: "api:generic",
        mediaType: "application/json",
        size: 5000,
        retryCount: 1,
      };

      const decision: RoutedIngestionDecision = {
        profile: "api:generic",
        lane: "deep",
        extractors: ["TextExtractor", "SemanticExtractor"],
      };

      const verification: VerificationResult = {
        passed: false,
        errors: ["Schema validation failed"],
        cost: 0.005,
      };

      const cost: Cost = {
        extractorCost: 0.005,
        verificationCost: 0.005,
        totalCost: 0.01,
      };

      recordIngestion(entry, decision, verification, cost);

      const lines = fs
        .readFileSync(MANIFEST_PATH, "utf-8")
        .split("\n")
        .filter((l) => l.trim());
      const record = JSON.parse(lines[0]);

      expect(record.id).toBeDefined();
      expect(record.source).toBeDefined();
      expect(record.mediaType).toBeDefined();
      expect(record.profile).toBeDefined();
      expect(record.lane).toBeDefined();
      expect(record.extractorsRun).toBeDefined();
      expect(record.verification).toBeDefined();
      expect(record.operatorFlags).toBeDefined();
      expect(record.timestamps).toBeDefined();
      expect(record.routingVersion).toBeDefined();
      expect(record.retryCount).toBeDefined();
      expect(record.cost).toBeDefined();
    });

    it("should append multiple records", () => {
      for (let i = 0; i < 3; i++) {
        const entry = { id: `test-${i}`, source: "filesystem" };
        const decision: RoutedIngestionDecision = {
          profile: "filesystem",
          lane: "fast",
          extractors: ["TextExtractor"],
        };
        const verification: VerificationResult = {
          passed: true,
          errors: [],
          cost: 0.001,
        };
        const cost: Cost = {
          extractorCost: 0.001,
          verificationCost: 0.001,
          totalCost: 0.002,
        };

        recordIngestion(entry, decision, verification, cost);
      }

      const lines = fs
        .readFileSync(MANIFEST_PATH, "utf-8")
        .split("\n")
        .filter((l) => l.trim());
      expect(lines.length).toBe(3);
    });

    it("should propagate cost fields", () => {
      const entry = { id: "cost-1", source: "filesystem" };
      const decision: RoutedIngestionDecision = {
        profile: "filesystem",
        lane: "fast",
        extractors: ["TextExtractor"],
      };
      const verification: VerificationResult = {
        passed: true,
        errors: [],
        cost: 0.003,
      };
      const cost: Cost = {
        extractorCost: 0.002,
        verificationCost: 0.003,
        totalCost: 0.005,
      };

      recordIngestion(entry, decision, verification, cost);

      const lines = fs
        .readFileSync(MANIFEST_PATH, "utf-8")
        .split("\n")
        .filter((l) => l.trim());
      const record = JSON.parse(lines[0]);

      expect(record.cost.extractorCost).toBe(0.002);
      expect(record.cost.verificationCost).toBe(0.003);
      expect(record.cost.totalCost).toBe(0.005);
    });
  });

  describe("loadManifest()", () => {
    it("should load valid records", () => {
      const entry = { id: "load-1", source: "filesystem" };
      const decision: RoutedIngestionDecision = {
        profile: "filesystem",
        lane: "fast",
        extractors: ["TextExtractor"],
      };
      const verification: VerificationResult = {
        passed: true,
        errors: [],
        cost: 0.001,
      };
      const cost: Cost = {
        extractorCost: 0.001,
        verificationCost: 0.001,
        totalCost: 0.002,
      };

      recordIngestion(entry, decision, verification, cost);

      const records = loadManifest();
      expect(records.length).toBe(1);
      expect(records[0].id).toBe("load-1");
    });

    it("should skip malformed lines", () => {
      const entry = { id: "malformed-test", source: "filesystem" };
      const decision: RoutedIngestionDecision = {
        profile: "filesystem",
        lane: "fast",
        extractors: ["TextExtractor"],
      };
      const verification: VerificationResult = {
        passed: true,
        errors: [],
        cost: 0.001,
      };
      const cost: Cost = {
        extractorCost: 0.001,
        verificationCost: 0.001,
        totalCost: 0.002,
      };

      recordIngestion(entry, decision, verification, cost);

      // Append malformed line
      fs.appendFileSync(MANIFEST_PATH, "{ invalid json\n", { encoding: "utf-8" });
      fs.appendFileSync(MANIFEST_PATH, 'not json at all\n', { encoding: "utf-8" });

      // Should load valid record and skip garbage
      const records = loadManifest();
      expect(records.length).toBe(1);
      expect(records[0].id).toBe("malformed-test");
    });

    it("should return empty array if manifest does not exist", () => {
      const records = loadManifest();
      expect(Array.isArray(records)).toBe(true);
      expect(records.length).toBe(0);
    });

    it("should preserve record order", () => {
      for (let i = 0; i < 5; i++) {
        const entry = { id: `order-${i}`, source: "filesystem" };
        const decision: RoutedIngestionDecision = {
          profile: "filesystem",
          lane: "fast",
          extractors: ["TextExtractor"],
        };
        const verification: VerificationResult = {
          passed: true,
          errors: [],
          cost: 0.001,
        };
        const cost: Cost = {
          extractorCost: 0.001,
          verificationCost: 0.001,
          totalCost: 0.002,
        };

        recordIngestion(entry, decision, verification, cost);
      }

      const records = loadManifest();
      expect(records.length).toBe(5);
      for (let i = 0; i < 5; i++) {
        expect(records[i].id).toBe(`order-${i}`);
      }
    });
  });

  describe("backfillFromProcessedLines()", () => {
    it("should synthesize legacy records", () => {
      const processedLines = [
        {
          id: "legacy-1",
          source: "filesystem",
          mediaType: "text/plain",
          extractors: ["TextExtractor"],
          verified: true,
          errors: [],
        },
      ];

      backfillFromProcessedLines(processedLines);

      const records = loadManifest();
      expect(records.length).toBe(1);
      expect(records[0].id).toBe("legacy-1");
      expect(records[0].routingVersion).toBe("legacy");
      expect(records[0].lane).toBe("fast");
      expect(records[0].profile).toBe("filesystem");
    });

    it("should mark failed verification in legacy records", () => {
      const processedLines = [
        {
          id: "legacy-fail",
          source: "api:generic",
          mediaType: "application/json",
          extractors: ["TextExtractor"],
          verified: false,
          errors: ["Validation failed"],
        },
      ];

      backfillFromProcessedLines(processedLines);

      const records = loadManifest();
      expect(records[0].verification.passed).toBe(false);
      expect(records[0].verification.errors).toContain("Validation failed");
    });
  });

  describe("concurrent lock safety", () => {
    it("should detect file locked error during concurrent write attempt", (done) => {
      const entry1 = { id: "concurrent-1", source: "filesystem" };
      const decision: RoutedIngestionDecision = {
        profile: "filesystem",
        lane: "fast",
        extractors: ["TextExtractor"],
      };
      const verification: VerificationResult = {
        passed: true,
        errors: [],
        cost: 0.001,
      };
      const cost: Cost = {
        extractorCost: 0.001,
        verificationCost: 0.001,
        totalCost: 0.002,
      };

      // Manually create lock file to simulate concurrent access
      fs.writeFileSync(LOCK_PATH, "");

      try {
        recordIngestion(entry1, decision, verification, cost);
        // If we get here, lock wasn't detected
        fs.unlinkSync(LOCK_PATH);
        done(new Error("Expected FileLockedError"));
      } catch (err: any) {
        expect(err).toBeInstanceOf(FileLockedError);
        fs.unlinkSync(LOCK_PATH);
        done();
      }
    });
  });
});
