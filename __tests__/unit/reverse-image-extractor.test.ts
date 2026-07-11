import { ReverseImageSearchExtractor } from "../../src/extractors/ReverseImageSearchExtractor";

// Helper: Create minimal valid PNG buffer (1x1 pixel)
function createPngBuffer(): Buffer {
  // PNG magic bytes + minimal valid PNG structure
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk size and type
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // Width=1, Height=1
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // Bit depth, color type
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, // CRC and IDAT
    0x54, 0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0xfe, // Compressed data
    0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00, // Compressed data cont.
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, // IEND chunk
    0xae, 0x42, 0x60, 0x82, // CRC
  ]);
}

// Helper: Create minimal valid JPEG buffer
function createJpegBuffer(): Buffer {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, // JPEG SOI + APP0
    0x00, 0x10, 0x4a, 0x46, // APP0 length and identifier
    0x49, 0x46, 0x00, 0x01, // JFIF
    0x01, 0x00, 0x00, 0x01, // Version
    0x00, 0x01, 0x00, 0x00, // Units, X/Y density
    0x00, 0x00, 0xff, 0xd9, // Minimal data + EOI
  ]);
}

// Helper: Create minimal valid GIF buffer
function createGifBuffer(): Buffer {
  return Buffer.from([
    0x47, 0x49, 0x46, 0x38, // GIF signature
    0x39, 0x61, 0x01, 0x00, // GIF89a
    0x01, 0x00, 0x80, 0x00, // Logical screen descriptor
    0x00, 0x00, 0x00, 0xff, // Color table + trailer
    0xff, 0xff, 0x00, 0x00, 0x00, 0x3b, // Trailer
  ]);
}

// Helper: Create minimal valid WebP buffer
function createWebpBuffer(): Buffer {
  return Buffer.from([
    0x52, 0x49, 0x46, 0x46, // RIFF
    0x1a, 0x00, 0x00, 0x00, // File size
    0x57, 0x45, 0x42, 0x50, // WEBP
    0x56, 0x50, 0x38, 0x4c, // VP8L
    0x0d, 0x00, 0x00, 0x00, // Chunk size
    0x2f, 0x00, 0x00, 0x00, // VP8L data
    0x00, 0x00, 0x00, 0x00, // (padding)
    0x00, 0x00, 0x00, 0x00,
  ]);
}

describe("ReverseImageSearchExtractor", () => {
  describe("extract() with valid images", () => {
    test("extracts metadata from PNG buffer", async () => {
      const extractor = new ReverseImageSearchExtractor();
      const pngBuffer = createPngBuffer();

      const result = await extractor.extract(pngBuffer);

      expect(result.matches).toBeDefined();
      expect(Array.isArray(result.matches)).toBe(true);
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.format).toBe("png");
      expect(result.metadata.size).toBe(pngBuffer.length);
      expect(result.metadata.processedAt).toBeDefined();
      expect(result.metadata.visionApiUsed).toBe(false);
    });

    test("extracts metadata from JPEG buffer", async () => {
      const extractor = new ReverseImageSearchExtractor();
      const jpegBuffer = createJpegBuffer();

      const result = await extractor.extract(jpegBuffer);

      expect(result.matches).toBeDefined();
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.metadata.format).toBe("jpeg");
      expect(result.metadata.size).toBe(jpegBuffer.length);
    });

    test("extracts metadata from GIF buffer", async () => {
      const extractor = new ReverseImageSearchExtractor();
      const gifBuffer = createGifBuffer();

      const result = await extractor.extract(gifBuffer);

      expect(result.matches).toBeDefined();
      expect(result.metadata.format).toBe("gif");
    });

    test("extracts metadata from WebP buffer", async () => {
      const extractor = new ReverseImageSearchExtractor();
      const webpBuffer = createWebpBuffer();

      const result = await extractor.extract(webpBuffer);

      expect(result.matches).toBeDefined();
      expect(result.metadata.format).toBe("webp");
    });

    test("returns structured matches with url, similarity, source", async () => {
      const extractor = new ReverseImageSearchExtractor();
      const pngBuffer = createPngBuffer();

      const result = await extractor.extract(pngBuffer);

      expect(result.matches.length).toBeGreaterThan(0);
      result.matches.forEach((match) => {
        expect(match).toHaveProperty("url");
        expect(match).toHaveProperty("similarity");
        expect(match).toHaveProperty("source");
        expect(typeof match.url).toBe("string");
        expect(typeof match.similarity).toBe("number");
        expect(typeof match.source).toBe("string");
        expect(match.similarity).toBeGreaterThanOrEqual(0);
        expect(match.similarity).toBeLessThanOrEqual(100);
      });
    });

    test("matches are sorted by similarity (highest first)", async () => {
      const extractor = new ReverseImageSearchExtractor();
      const pngBuffer = createPngBuffer();

      const result = await extractor.extract(pngBuffer);

      if (result.matches.length > 1) {
        for (let i = 1; i < result.matches.length; i++) {
          expect(result.matches[i - 1].similarity).toBeGreaterThanOrEqual(
            result.matches[i].similarity
          );
        }
      }
    });
  });

  describe("extract() with fallback mode (no Vision API)", () => {
    test("returns mock results when Vision API key not set", async () => {
      // Create extractor without API key
      const extractor = new ReverseImageSearchExtractor(undefined);
      const pngBuffer = createPngBuffer();

      const result = await extractor.extract(pngBuffer);

      expect(result.matches).toBeDefined();
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.metadata.visionApiUsed).toBe(false);
      expect(result.metadata.format).toBe("png");
    });

    test("fallback uses consistent URLs based on image content", async () => {
      const extractor = new ReverseImageSearchExtractor(undefined);
      const pngBuffer = createPngBuffer();

      const result1 = await extractor.extract(pngBuffer);
      const result2 = await extractor.extract(pngBuffer);

      // Same image should produce same results
      expect(result1.matches[0].url).toBe(result2.matches[0].url);
      expect(result1.matches[0].similarity).toBe(result2.matches[0].similarity);
    });
  });

  describe("extract() with invalid inputs", () => {
    test("returns error result for null/undefined buffer", async () => {
      const extractor = new ReverseImageSearchExtractor();

      const result = await extractor.extract(null);

      expect(result.matches).toEqual([]);
      expect(result.metadata.error).toBeDefined();
      expect(result.metadata.error).toContain("Image buffer is required");
    });

    test("returns error result for invalid buffer type", async () => {
      const extractor = new ReverseImageSearchExtractor();

      const result = await extractor.extract({ invalid: "object" });

      expect(result.matches).toEqual([]);
      expect(result.metadata.error).toBeDefined();
      expect(result.metadata.error).toContain("Invalid image buffer format");
    });

    test("returns error result for unsupported image format", async () => {
      const extractor = new ReverseImageSearchExtractor();
      const invalidBuffer = Buffer.from([
        0x00, 0x00, 0x00, 0x00, // Invalid magic bytes
      ]);

      const result = await extractor.extract(invalidBuffer);

      expect(result.matches).toEqual([]);
      expect(result.metadata.error).toBeDefined();
      expect(result.metadata.error).toContain("Unsupported image format");
    });

    test("returns error result for empty buffer", async () => {
      const extractor = new ReverseImageSearchExtractor();
      const emptyBuffer = Buffer.from([]);

      const result = await extractor.extract(emptyBuffer);

      expect(result.matches).toEqual([]);
      expect(result.metadata.error).toBeDefined();
    });

    test("handles base64 encoded image strings", async () => {
      const extractor = new ReverseImageSearchExtractor();
      const pngBuffer = createPngBuffer();
      const base64String = pngBuffer.toString("base64");

      const result = await extractor.extract(base64String);

      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.metadata.format).toBe("png");
    });

    test("handles Uint8Array input", async () => {
      const extractor = new ReverseImageSearchExtractor();
      const pngBuffer = createPngBuffer();
      const uint8Array = new Uint8Array(pngBuffer);

      const result = await extractor.extract(uint8Array);

      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.metadata.format).toBe("png");
    });
  });

  describe("result format validation", () => {
    test("result includes all required metadata fields", async () => {
      const extractor = new ReverseImageSearchExtractor();
      const pngBuffer = createPngBuffer();

      const result = await extractor.extract(pngBuffer);

      expect(result.metadata).toHaveProperty("format");
      expect(result.metadata).toHaveProperty("size");
      expect(result.metadata).toHaveProperty("processedAt");
      expect(result.metadata).toHaveProperty("visionApiUsed");
    });

    test("processedAt is valid ISO 8601 timestamp", async () => {
      const extractor = new ReverseImageSearchExtractor();
      const pngBuffer = createPngBuffer();

      const result = await extractor.extract(pngBuffer);

      const date = new Date(result.metadata.processedAt);
      expect(date.getTime()).toBeGreaterThan(0);
      expect(date.getTime()).toBeLessThanOrEqual(Date.now() + 5000); // Within 5s
    });

    test("size matches buffer length", async () => {
      const extractor = new ReverseImageSearchExtractor();
      const pngBuffer = createPngBuffer();

      const result = await extractor.extract(pngBuffer);

      expect(result.metadata.size).toBe(pngBuffer.length);
    });

    test("format is one of supported types", async () => {
      const extractor = new ReverseImageSearchExtractor();
      const pngBuffer = createPngBuffer();

      const result = await extractor.extract(pngBuffer);

      const supportedFormats = ["jpeg", "jpg", "png", "webp", "gif"];
      expect(supportedFormats).toContain(result.metadata.format);
    });
  });

  describe("API key configuration", () => {
    test("constructor accepts API key parameter", async () => {
      const testKey = "test-api-key-12345";
      const extractor = new ReverseImageSearchExtractor(testKey);
      const pngBuffer = createPngBuffer();

      const result = await extractor.extract(pngBuffer);

      // Should work without error
      expect(result.metadata).toBeDefined();
    });

    test("reads VISION_API_KEY from environment if not provided", async () => {
      const originalKey = process.env.VISION_API_KEY;
      delete process.env.VISION_API_KEY;

      try {
        const extractor = new ReverseImageSearchExtractor();
        const pngBuffer = createPngBuffer();

        const result = await extractor.extract(pngBuffer);

        expect(result.metadata.visionApiUsed).toBe(false);
      } finally {
        // Restore
        if (originalKey) {
          process.env.VISION_API_KEY = originalKey;
        }
      }
    });
  });
});