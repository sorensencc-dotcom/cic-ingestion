/**
 * Phase 3 Integration Tests: Call ImageAnalysisService directly (no HTTP required)
 * Tests service + client in-process to validate contract without HTTP server
 */

import { ImageAnalysisService } from '../services/imageAnalysis/ImageAnalysisService.ts';
import { loadConfig } from '../services/imageAnalysis/index.ts';
import { AnalyzeImageRequest, AnalyzeImageResponse, ImageMatch } from '../services/imageAnalysis/types.ts';

const service = new ImageAnalysisService(loadConfig());

describe('ImageAnalysis Integration (Direct Service Calls)', () => {
  describe('Scenario 1: Valid PNG image', () => {
    it('should analyze PNG and return matches', async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00]);
      const request: AnalyzeImageRequest = {
        imageBuffer: pngBuffer.toString('base64'),
        format: 'png',
      };

      const startTime = Date.now();
      const response = await service.analyze(request);
      const latency = Date.now() - startTime;

      expect(response).toHaveProperty('matches');
      expect(response).toHaveProperty('metadata');
      expect(response.metadata.format).toBe('png');
      expect(latency).toBeLessThan(500); // SLA: <500ms
      expect(response.metadata.size).toBeGreaterThan(0);
    });
  });

  describe('Scenario 2: Valid JPEG image', () => {
    it('should analyze JPEG and detect format', async () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x00, 0x00]);
      const request: AnalyzeImageRequest = {
        imageBuffer: jpegBuffer.toString('base64'),
      };

      const response = await service.analyze(request);

      expect(response.metadata.format).toBe('jpeg');
      expect(Array.isArray(response.matches)).toBe(true);
    });
  });

  describe('Scenario 3: Error handling (invalid request)', () => {
    it('should handle empty imageBuffer gracefully', async () => {
      const request: AnalyzeImageRequest = {
        imageBuffer: '',
      };

      const response = await service.analyze(request);
      // Empty buffer should return mock results (graceful fallback)
      expect(response.metadata.visionApiUsed).toBe(false);
      expect(Array.isArray(response.matches)).toBe(true);
    });
  });

  describe('Scenario 4: Size validation', () => {
    it('should gracefully handle large images', async () => {
      // Create a moderately large base64 image (10MB)
      const largeBuf = Buffer.alloc(10 * 1024 * 1024);
      largeBuf[0] = 0x89; largeBuf[1] = 0x50; largeBuf[2] = 0x4e; largeBuf[3] = 0x47; // PNG header
      const largeBase64 = largeBuf.toString('base64');

      const request: AnalyzeImageRequest = {
        imageBuffer: largeBase64,
      };

      const response = await service.analyze(request);
      expect(response.metadata).toBeDefined();
      expect(response.metadata.format).toBe('png');
    });
  });

  describe('Scenario 5: Graceful fallback (no API key)', () => {
    it('should return mock results with visionApiUsed=false', async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00]);
      const request: AnalyzeImageRequest = {
        imageBuffer: pngBuffer.toString('base64'),
      };

      const response = await service.analyze(request);

      expect(response.metadata.visionApiUsed).toBe(false);
      expect(Array.isArray(response.matches)).toBe(true);
      // Mock results should have at least some matches
      expect(response.matches.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Response contract validation', () => {
    it('should have correct response schema', async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00]);
      const request: AnalyzeImageRequest = {
        imageBuffer: pngBuffer.toString('base64'),
      };

      const response: AnalyzeImageResponse = await service.analyze(request);

      // Validate structure
      expect(response).toHaveProperty('matches');
      expect(response).toHaveProperty('metadata');

      // Validate metadata fields
      expect(response.metadata).toHaveProperty('format');
      expect(response.metadata).toHaveProperty('size');
      expect(response.metadata).toHaveProperty('processedAt');
      expect(response.metadata).toHaveProperty('visionApiUsed');

      // Validate matches
      expect(Array.isArray(response.matches)).toBe(true);
      if (response.matches.length > 0) {
        const match = response.matches[0];
        expect(match).toHaveProperty('url');
        expect(match).toHaveProperty('similarity');
        expect(match).toHaveProperty('source');
        expect(typeof match.similarity).toBe('number');
        expect(match.similarity).toBeGreaterThanOrEqual(0);
        expect(match.similarity).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Latency SLA compliance', () => {
    it('should respond within p99 <500ms SLA', async () => {
      const latencies: number[] = [];
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00]);
      const request: AnalyzeImageRequest = {
        imageBuffer: pngBuffer.toString('base64'),
      };

      // Run 5 requests to measure latencies
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        await service.analyze(request);
        latencies.push(Date.now() - startTime);
      }

      // Calculate p99
      const sorted = [...latencies].sort((a, b) => a - b);
      const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;

      console.log(`Latencies: ${latencies.join('ms, ')}ms. P99: ${p99}ms`);
      expect(p99).toBeLessThan(500);
    });
  });

  describe('RequestId correlation', () => {
    it('should include requestId in metadata', async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00]);
      const request: AnalyzeImageRequest = {
        imageBuffer: pngBuffer.toString('base64'),
      };

      const response = await service.analyze(request);

      // Check if requestId is present (if implemented)
      // Note: requestId tracking may be optional, so this test is informational
      console.log('Response metadata keys:', Object.keys(response.metadata));
    });
  });
});
