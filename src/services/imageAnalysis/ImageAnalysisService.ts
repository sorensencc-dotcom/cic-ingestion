import { AnalyzeImageRequest, AnalyzeImageResponse, ImageMatch, ImageAnalysisConfig } from './types';
import { GoogleVisionProvider, VisionResult } from './providers/GoogleVisionProvider';

export class ImageAnalysisService {
  private visionApiKey: string | undefined;
  private maxImageSizeBytes: number;
  private googleVisionProvider: GoogleVisionProvider | null = null;

  constructor(config: ImageAnalysisConfig) {
    this.visionApiKey = config.visionApiKey;
    this.maxImageSizeBytes = config.maxImageSizeBytes || 50 * 1024 * 1024;
  }

  private getOrInitializeProvider(): GoogleVisionProvider {
    if (!this.googleVisionProvider) {
      const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      this.googleVisionProvider = new GoogleVisionProvider(keyPath);
    }
    return this.googleVisionProvider;
  }

  async analyze(request: AnalyzeImageRequest): Promise<AnalyzeImageResponse> {
    const imageBuffer = Buffer.from(request.imageBuffer, 'base64');

    // Validate size
    if (imageBuffer.length > this.maxImageSizeBytes) {
      throw new Error(`Image exceeds max size of ${this.maxImageSizeBytes} bytes`);
    }

    const format = this._detectFormat(imageBuffer) || request.format || 'unknown';

    // Call Vision API if key available
    if (this.visionApiKey) {
      try {
        const startTime = Date.now();
        const provider = this.getOrInitializeProvider();
        const visionResult = await provider.analyzeImage(imageBuffer);
        const latencyMs = Date.now() - startTime;

        const matches = this._transformVisionResults(visionResult);

        return {
          matches,
          metadata: {
            format,
            size: imageBuffer.length,
            processedAt: new Date().toISOString(),
            visionApiUsed: true,
            latencyMs,
            apiProvider: 'google_vision',
          },
        };
      } catch (error) {
        // Graceful fallback on Vision API error
        console.log(`Vision API failed: ${(error as Error).message}, falling back to mock`);
        return this._generateMockResults(imageBuffer, format);
      }
    } else {
      // No API key: return mock results
      return this._generateMockResults(imageBuffer, format);
    }
  }

  private _detectFormat(buffer: Buffer): string | null {
    // Magic bytes for common image formats
    if (buffer.length >= 4) {
      const bytes = buffer.slice(0, 4);

      // PNG: 89 50 4E 47
      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
        return 'png';
      }

      // JPEG: FF D8 FF
      if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return 'jpeg';
      }

      // GIF: 47 49 46 (GIF8)
      if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
        return 'gif';
      }

      // WebP: RIFF ... WEBP
      if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
        if (buffer.length >= 12 && buffer.slice(8, 12).toString('ascii') === 'WEBP') {
          return 'webp';
        }
      }
    }

    return null;
  }

  private _transformVisionResults(visionResult: VisionResult): ImageMatch[] {
    const matches: ImageMatch[] = [];

    // Extract web detection results (reverse image search matches)
    if (visionResult.web?.fullMatchingImages) {
      for (const img of visionResult.web.fullMatchingImages) {
        matches.push({
          url: img.url,
          similarity: Math.round((img.score || 0) * 100),
          source: 'google_vision',
        });
      }
    }

    return matches;
  }

  private _generateMockResults(imageBuffer: Buffer, format: string): AnalyzeImageResponse {
    const mockMatches: ImageMatch[] = [
      {
        url: 'https://example.com/image1.jpg',
        similarity: 85,
        source: 'mock',
      },
      {
        url: 'https://example.com/image2.jpg',
        similarity: 72,
        source: 'mock',
      },
    ];

    return {
      matches: mockMatches,
      metadata: {
        format,
        size: imageBuffer.length,
        processedAt: new Date().toISOString(),
        visionApiUsed: false,
        latencyMs: Math.random() * 50 + 10, // Mock 10-60 ms
        apiProvider: 'mock',
      },
    };
  }
}
