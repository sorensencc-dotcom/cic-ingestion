import {
  ExtractorRegistry,
  getExtractor,
  getRegistry,
  resetRegistry,
} from "../../src/extractors/registry";
import { ReverseImageSearchExtractor } from "../../src/extractors/ReverseImageSearchExtractor";
import { IExtractor } from "../../src/extractors/IExtractor";

describe("ExtractorRegistry", () => {
  let registry: ExtractorRegistry;

  beforeEach(() => {
    registry = new ExtractorRegistry();
  });

  describe("register and getExtractor", () => {
    test("returns registered extractor instance", () => {
      const extractor = registry.getExtractor("image");
      expect(extractor).toBeInstanceOf(ReverseImageSearchExtractor);
    });

    test("caches extractor instances", () => {
      const extractor1 = registry.getExtractor("image");
      const extractor2 = registry.getExtractor("image");
      expect(extractor1).toBe(extractor2); // Same instance
    });

    test("throws error for unregistered extractor", () => {
      expect(() => registry.getExtractor("unknown")).toThrow(
        /not found/i
      );
    });

    test("lists available extractors", () => {
      const extractors = registry.listExtractors();
      expect(extractors).toContain("image");
      expect(Array.isArray(extractors)).toBe(true);
    });

    test("accepts configuration when creating extractor", () => {
      const config = { apiKey: "test-key-123" };
      const extractor = registry.getExtractor("image", config);
      expect(extractor).toBeInstanceOf(ReverseImageSearchExtractor);
    });

    test("creates separate instances for different configs", () => {
      const ext1 = registry.getExtractor("image", { apiKey: "key1" });
      const ext2 = registry.getExtractor("image", { apiKey: "key2" });
      // Different configs should create different instances
      expect(ext1).not.toBe(ext2);
    });
  });

  describe("custom extractor registration", () => {
    test("allows registering custom extractors", () => {
      class CustomExtractor extends IExtractor {
        async extract(input: any): Promise<any> {
          return { custom: true };
        }
      }

      registry.register("custom" as any, CustomExtractor);
      const extractor = registry.getExtractor("custom");
      expect(extractor).toBeInstanceOf(CustomExtractor);
    });

    test("custom extractor can be retrieved and used", async () => {
      class TestExtractor extends IExtractor {
        async extract(input: any): Promise<any> {
          return { result: "test", input };
        }
      }

      registry.register("test" as any, TestExtractor);
      const extractor = registry.getExtractor("test");
      const result = await extractor.extract("sample");

      expect(result.result).toBe("test");
      expect(result.input).toBe("sample");
    });
  });

  describe("cache management", () => {
    test("clearCache removes cached instances", () => {
      const ext1 = registry.getExtractor("image");
      registry.clearCache();
      const ext2 = registry.getExtractor("image");
      expect(ext1).not.toBe(ext2); // Different instances after cache clear
    });

    test("cache is cleared before each test", () => {
      const ext1 = registry.getExtractor("image");
      // Create new registry in beforeEach, so ext2 should be different
      registry = new ExtractorRegistry();
      const ext2 = registry.getExtractor("image");
      expect(ext1).not.toBe(ext2);
    });
  });

  describe("unregister", () => {
    test("removes extractor from registry", () => {
      registry.unregister("image");
      expect(() => registry.getExtractor("image")).toThrow();
    });

    test("clears cached instances when unregistering", () => {
      const ext1 = registry.getExtractor("image");
      registry.unregister("image");
      registry.register("image", ReverseImageSearchExtractor);
      const ext2 = registry.getExtractor("image");
      expect(ext1).not.toBe(ext2);
    });
  });

  describe("global singleton registry", () => {
    beforeEach(() => {
      resetRegistry();
    });

    test("getRegistry returns same instance across calls", () => {
      const reg1 = getRegistry();
      const reg2 = getRegistry();
      expect(reg1).toBe(reg2);
    });

    test("getExtractor function uses global registry", () => {
      const extractor = getExtractor("image");
      expect(extractor).toBeInstanceOf(ReverseImageSearchExtractor);
    });

    test("global registry can be reset", () => {
      const reg1 = getRegistry();
      resetRegistry();
      const reg2 = getRegistry();
      expect(reg1).not.toBe(reg2); // New instance after reset
    });

    test("resetRegistry clears cache", () => {
      const ext1 = getExtractor("image");
      resetRegistry();
      const ext2 = getExtractor("image");
      expect(ext1).not.toBe(ext2);
    });
  });

  describe("default extractors", () => {
    test("image extractor is registered by default", () => {
      const extractors = registry.listExtractors();
      expect(extractors).toContain("image");
    });

    test("image extractor is ReverseImageSearchExtractor", () => {
      const extractor = registry.getExtractor("image");
      expect(extractor).toBeInstanceOf(ReverseImageSearchExtractor);
    });
  });

  describe("error handling", () => {
    test("provides helpful error message with available extractors", () => {
      try {
        registry.getExtractor("nonexistent");
        fail("Should have thrown error");
      } catch (error) {
        expect((error as Error).message).toContain("not found");
        expect((error as Error).message).toContain("image");
      }
    });

    test("handles missing configuration gracefully", () => {
      const extractor = registry.getExtractor("image", undefined);
      expect(extractor).toBeInstanceOf(ReverseImageSearchExtractor);
    });
  });
});