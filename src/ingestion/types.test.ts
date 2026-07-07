import {
  Lane,
  OperatorFlags,
  RoutedIngestionDecision,
  VerificationResult,
  ExtractorResult,
  Cost,
  ManifestRecord,
  IngestionProfile,
  IngestionProfiles,
  FileLockedError,
} from "./types";

describe("Phase 27 Type System", () => {
  describe("Lane enum", () => {
    it("should allow valid lane values", () => {
      const lanes: Lane[] = ["fast", "deep", "quarantine"];
      expect(lanes).toHaveLength(3);
    });

    it("should have correct type", () => {
      const lane: Lane = "fast";
      expect(lane).toBe("fast");
    });
  });

  describe("OperatorFlags interface", () => {
    it("should allow all flag combinations", () => {
      const flags: OperatorFlags = {
        forceReingest: true,
        skip: false,
        quarantine: false,
        overrideProfile: "filesystem",
        overrideLane: "deep",
      };
      expect(flags).toBeDefined();
    });

    it("should allow partial flags", () => {
      const flags: OperatorFlags = {
        skip: true,
      };
      expect(flags.skip).toBe(true);
    });

    it("should allow empty flags", () => {
      const flags: OperatorFlags = {};
      expect(Object.keys(flags)).toHaveLength(0);
    });
  });

  describe("RoutedIngestionDecision interface", () => {
    it("should create valid routing decision", () => {
      const decision: RoutedIngestionDecision = {
        profile: "filesystem",
        lane: "fast",
        extractors: ["TextExtractor", "SemanticExtractor"],
      };
      expect(decision.profile).toBe("filesystem");
      expect(decision.lane).toBe("fast");
      expect(decision.extractors).toHaveLength(2);
    });
  });

  describe("VerificationResult interface", () => {
    it("should track passed verification with cost", () => {
      const result: VerificationResult = {
        passed: true,
        errors: [],
        cost: 0.005,
      };
      expect(result.passed).toBe(true);
      expect(result.cost).toBe(0.005);
    });

    it("should track failed verification with errors", () => {
      const result: VerificationResult = {
        passed: false,
        errors: ["Invalid schema", "Missing required field"],
        cost: 0.003,
      };
      expect(result.passed).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe("ExtractorResult interface", () => {
    it("should contain output and cost", () => {
      const result: ExtractorResult = {
        output: { text: "extracted content" },
        cost: 0.001,
      };
      expect(result.output).toBeDefined();
      expect(result.cost).toBe(0.001);
    });
  });

  describe("Cost interface", () => {
    it("should sum extractor + verification costs", () => {
      const cost: Cost = {
        extractorCost: 0.005,
        verificationCost: 0.003,
        totalCost: 0.008,
      };
      expect(cost.totalCost).toBe(cost.extractorCost + cost.verificationCost);
    });
  });

  describe("ManifestRecord interface", () => {
    it("should contain all required fields", () => {
      const record: ManifestRecord = {
        id: "test-123",
        source: "filesystem",
        mediaType: "text/plain",
        profile: "filesystem",
        lane: "fast",
        extractorsRun: ["TextExtractor"],
        verification: {
          passed: true,
          errors: [],
        },
        operatorFlags: {},
        timestamps: {
          ingested: new Date().toISOString(),
          verified: new Date().toISOString(),
        },
        routingVersion: "1.0.0",
        retryCount: 0,
        cost: {
          extractorCost: 0.001,
          verificationCost: 0.001,
          totalCost: 0.002,
        },
      };
      expect(record.id).toBe("test-123");
      expect(record.routingVersion).toBe("1.0.0");
      expect(record.retryCount).toBe(0);
      expect(record.cost).toBeDefined();
    });

    it("should allow optional cost field", () => {
      const record: ManifestRecord = {
        id: "test-456",
        source: "api:generic",
        mediaType: "application/json",
        profile: "api:generic",
        lane: "deep",
        extractorsRun: ["TextExtractor", "SemanticExtractor"],
        verification: {
          passed: false,
          errors: ["Schema validation failed"],
        },
        operatorFlags: {
          quarantine: true,
        },
        timestamps: {},
        routingVersion: "1.0.0",
        retryCount: 1,
      };
      expect(record.cost).toBeUndefined();
    });
  });

  describe("IngestionProfile interface", () => {
    it("should define profile structure", () => {
      const profile: IngestionProfile = {
        defaultLane: "fast",
        extractors: ["TextExtractor"],
        maxSizeMB: 5,
        requiresOperatorApproval: false,
        maxRetries: 3,
      };
      expect(profile.defaultLane).toBe("fast");
      expect(profile.extractors).toHaveLength(1);
    });
  });

  describe("IngestionProfiles interface", () => {
    it("should map profile names to profiles", () => {
      const profiles: IngestionProfiles = {
        filesystem: {
          defaultLane: "fast",
          extractors: ["TextExtractor"],
        },
        images: {
          defaultLane: "deep",
          extractors: ["ImageAnalyzer"],
        },
      };
      expect(Object.keys(profiles)).toHaveLength(2);
      expect(profiles.filesystem.defaultLane).toBe("fast");
    });
  });

  describe("FileLockedError exception", () => {
    it("should be an Error subclass", () => {
      const error = new FileLockedError();
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("FileLockedError");
    });

    it("should have default message", () => {
      const error = new FileLockedError();
      expect(error.message).toContain("locked");
    });

    it("should accept custom message", () => {
      const error = new FileLockedError("Custom lock message");
      expect(error.message).toBe("Custom lock message");
    });
  });
});
