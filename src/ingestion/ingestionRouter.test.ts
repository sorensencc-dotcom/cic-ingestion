import { route } from "./ingestionRouter";
import { RoutedIngestionDecision } from "./types";

describe("Phase 27 Ingestion Router", () => {
  describe("route() function", () => {
    it("should route filesystem source to fast lane", () => {
      const entry = {
        id: "fs-1",
        source: "filesystem",
        mediaType: "text/plain",
        size: 1024,
      };
      const decision = route(entry);
      expect(decision.profile).toBe("filesystem");
      expect(decision.lane).toBe("fast");
      expect(decision.extractors).toContain("TextExtractor");
    });

    it("should route api:generic to fast lane", () => {
      const entry = {
        id: "api-1",
        source: "api:custom",
        mediaType: "application/json",
        size: 5000,
      };
      const decision = route(entry);
      expect(decision.profile).toBe("api:generic");
      expect(decision.lane).toBe("fast");
      expect(decision.extractors.length).toBeGreaterThan(0);
    });

    it("should route image/* to deep lane", () => {
      const entry = {
        id: "img-1",
        source: "images",
        mediaType: "image/jpeg",
        size: 2000000,
      };
      const decision = route(entry);
      expect(decision.profile).toBe("images");
      expect(decision.lane).toBe("deep");
      expect(decision.extractors).toContain("ImageAnalyzer");
    });

    it("should route PDF to deep lane", () => {
      const entry = {
        id: "pdf-1",
        source: "documents",
        mediaType: "application/pdf",
        size: 5000000,
      };
      const decision = route(entry);
      expect(decision.profile).toBe("pdf");
      expect(decision.lane).toBe("deep");
      expect(decision.extractors).toContain("PDFExtractor");
    });

    it("should route oversized entry to quarantine", () => {
      const entry = {
        id: "large-1",
        source: "filesystem",
        mediaType: "text/plain",
        size: 200 * 1024 * 1024,
      };
      const decision = route(entry);
      expect(decision.lane).toBe("quarantine");
    });

    it("should route DLQ repeat with max retries to quarantine", () => {
      const entry = {
        id: "retry-1",
        source: "filesystem",
        mediaType: "text/plain",
        size: 1024,
        fromDLQ: true,
        retryCount: 5,
      };
      const decision = route(entry);
      expect(decision.lane).toBe("quarantine");
    });

    it("should route unknown source to deep lane for safety", () => {
      const entry = {
        id: "unknown-1",
        source: "unknown",
        mediaType: "text/plain",
        size: 1024,
      };
      const decision = route(entry);
      expect(decision.profile).toBe("filesystem");
      expect(decision.lane).toBe("deep");
    });

    it("should route api:familysearch to deep lane with operator approval", () => {
      const entry = {
        id: "fs-1",
        source: "api:familysearch",
        mediaType: "application/json",
        size: 1024,
      };
      const decision = route(entry);
      expect(decision.lane).toBe("deep");
    });

    it("should include all extractors from profile", () => {
      const entry = {
        id: "multi-1",
        source: "pdf",
        mediaType: "application/pdf",
        size: 1000000,
      };
      const decision = route(entry);
      expect(decision.extractors.length).toBeGreaterThan(1);
      expect(Array.isArray(decision.extractors)).toBe(true);
    });

    it("should handle missing fields gracefully", () => {
      const entry = {};
      const decision = route(entry);
      expect(decision).toBeDefined();
      expect(decision.profile).toBeDefined();
      expect(decision.lane).toBeDefined();
      expect(Array.isArray(decision.extractors)).toBe(true);
    });
  });

  describe("routing heuristics", () => {
    it("fast lane for small, known sources", () => {
      const entry = {
        id: "fast-1",
        source: "filesystem",
        mediaType: "text/plain",
        size: 100,
        retryCount: 0,
      };
      const decision = route(entry);
      expect(decision.lane).toBe("fast");
    });

    it("deep lane for large PDFs", () => {
      const entry = {
        id: "deep-1",
        source: "documents",
        mediaType: "application/pdf",
        size: 50 * 1024 * 1024,
        retryCount: 0,
      };
      const decision = route(entry);
      expect(decision.lane).toBe("deep");
    });

    it("quarantine for repeated failures", () => {
      const entry = {
        id: "quarantine-1",
        source: "api:generic",
        mediaType: "application/json",
        size: 5000,
        fromDLQ: true,
        retryCount: 10,
      };
      const decision = route(entry);
      expect(decision.lane).toBe("quarantine");
    });
  });
});
