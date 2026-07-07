import * as fs from "fs";
import * as path from "path";
import Ajv from "ajv";
import { IngestionProfiles, Lane } from "./types";

describe("Phase 27 Ingestion Profiles", () => {
  let profiles: IngestionProfiles;
  let schema: any;
  let ajv: InstanceType<typeof Ajv>;

  beforeAll(() => {
    const profilesPath = path.join(
      __dirname,
      "ingestionProfiles.json"
    );
    const schemaPath = path.join(
      __dirname,
      "ingestionProfiles.schema.json"
    );

    profiles = JSON.parse(fs.readFileSync(profilesPath, "utf-8"));
    schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
    ajv = new Ajv();
  });

  describe("Profile loading", () => {
    it("should load ingestionProfiles.json", () => {
      expect(profiles).toBeDefined();
      expect(Object.keys(profiles).length).toBeGreaterThan(0);
    });

    it("should load ingestionProfiles.schema.json", () => {
      expect(schema).toBeDefined();
      expect(schema.$schema).toBe("http://json-schema.org/draft-07/schema#");
    });
  });

  describe("Schema validation", () => {
    it("should validate profiles against schema", () => {
      const validate = ajv.compile(schema);
      const valid = validate(profiles);
      if (!valid) {
        console.error("Validation errors:", validate.errors);
      }
      expect(valid).toBe(true);
    });
  });

  describe("Profile structure", () => {
    it("should have at least one profile", () => {
      expect(Object.keys(profiles).length).toBeGreaterThan(0);
    });

    it("should have required profiles defined", () => {
      expect(profiles.filesystem).toBeDefined();
      expect(profiles["api:familysearch"]).toBeDefined();
      expect(profiles.images).toBeDefined();
      expect(profiles.pdf).toBeDefined();
    });

    it("each profile should have defaultLane", () => {
      for (const [name, profile] of Object.entries(profiles)) {
        expect(profile.defaultLane).toBeDefined();
        expect(["fast", "deep", "quarantine"]).toContain(profile.defaultLane);
      }
    });

    it("each profile should have extractors array", () => {
      for (const [name, profile] of Object.entries(profiles)) {
        expect(Array.isArray(profile.extractors)).toBe(true);
        expect(profile.extractors.length).toBeGreaterThan(0);
      }
    });

    it("each profile should have optional maxRetries", () => {
      for (const [name, profile] of Object.entries(profiles)) {
        if (profile.maxRetries !== undefined) {
          expect(typeof profile.maxRetries).toBe("number");
          expect(profile.maxRetries).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  describe("Specific profiles", () => {
    it("filesystem profile should be fast lane", () => {
      expect(profiles.filesystem.defaultLane).toBe("fast");
    });

    it("filesystem profile should have TextExtractor", () => {
      expect(profiles.filesystem.extractors).toContain("TextExtractor");
    });

    it("api:familysearch should be deep lane", () => {
      expect(profiles["api:familysearch"].defaultLane).toBe("deep");
    });

    it("api:familysearch should require operator approval", () => {
      expect(profiles["api:familysearch"].requiresOperatorApproval).toBe(true);
    });

    it("images should be deep lane", () => {
      expect(profiles.images.defaultLane).toBe("deep");
    });

    it("images should have ImageAnalyzer extractor", () => {
      expect(profiles.images.extractors).toContain("ImageAnalyzer");
    });

    it("pdf should have PDFExtractor", () => {
      expect(profiles.pdf.extractors).toContain("PDFExtractor");
    });
  });

  describe("Profile validation rules", () => {
    it("should reject profile with invalid lane", () => {
      const invalidProfile = {
        filesystem: {
          defaultLane: "invalid-lane" as any,
          extractors: ["TextExtractor"],
        },
      };
      const validate = ajv.compile(schema);
      expect(validate(invalidProfile)).toBe(false);
    });

    it("should reject profile with empty extractors", () => {
      const invalidProfile = {
        filesystem: {
          defaultLane: "fast",
          extractors: [],
        },
      };
      const validate = ajv.compile(schema);
      expect(validate(invalidProfile)).toBe(false);
    });

    it("should reject profile without required fields", () => {
      const invalidProfile = {
        filesystem: {
          defaultLane: "fast",
          // missing extractors
        },
      };
      const validate = ajv.compile(schema);
      expect(validate(invalidProfile as any)).toBe(false);
    });

    it("should reject profile with additional unknown properties", () => {
      const invalidProfile = {
        filesystem: {
          defaultLane: "fast",
          extractors: ["TextExtractor"],
          unknownField: "value",
        },
      };
      const validate = ajv.compile(schema);
      expect(validate(invalidProfile as any)).toBe(false);
    });
  });

  describe("Profile lane defaults", () => {
    it("should have appropriate lanes for profile types", () => {
      // Fast lane profiles
      expect(profiles.filesystem.defaultLane).toBe("fast");
      expect(profiles["api:generic"].defaultLane).toBe("fast");

      // Deep lane profiles
      expect(profiles["api:familysearch"].defaultLane).toBe("deep");
      expect(profiles.images.defaultLane).toBe("deep");
      expect(profiles.pdf.defaultLane).toBe("deep");
    });
  });

  describe("Extractor coverage", () => {
    it("should map extractors that exist", () => {
      const extractors = new Set<string>();
      for (const profile of Object.values(profiles)) {
        for (const extractor of profile.extractors) {
          extractors.add(extractor);
        }
      }
      // This test documents which extractors are referenced
      // In production, you would validate these exist
      expect(extractors.size).toBeGreaterThan(0);
    });
  });
});
