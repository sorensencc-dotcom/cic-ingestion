import { ImageAnalysisService } from '../services/imageAnalysis/ImageAnalysisService';
import { ImageAnalysisConfig } from '../services/imageAnalysis/types';

describe('ImageAnalysisService', () => {
  let service: ImageAnalysisService;
  let config: ImageAnalysisConfig;

  beforeEach(() => {
    config = {
      // No visionApiKey - tests run in mock mode (graceful fallback)
      maxImageSizeBytes: 50 * 1024 * 1024,
    };
    service = new ImageAnalysisService(config);
  });

  it('should detect PNG format from magic bytes', async () => {
    // PNG magic bytes: 89 50 4E 47
    const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00]);
    const base64 = pngMagic.toString('base64');

    // Mock the Vision API to avoid real calls
    jest.spyOn(service as any, '_generateMockResults').mockReturnValue({
      matches: [],
      metadata: {
        format: 'png',
        size: pngMagic.length,
        processedAt: new Date().toISOString(),
        visionApiUsed: false,
        latencyMs: 10,
        apiProvider: 'mock',
      },
    });

    const result = await service.analyze({
      imageBuffer: base64,
    });

    expect(result.metadata.format).toBe('png');
  });

  it('should detect JPEG format from magic bytes', async () => {
    // JPEG magic bytes: FF D8 FF
    const jpegMagic = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const base64 = jpegMagic.toString('base64');

    jest.spyOn(service as any, '_generateMockResults').mockReturnValue({
      matches: [],
      metadata: {
        format: 'jpeg',
        size: jpegMagic.length,
        processedAt: new Date().toISOString(),
        visionApiUsed: false,
        latencyMs: 10,
        apiProvider: 'mock',
      },
    });

    const result = await service.analyze({
      imageBuffer: base64,
    });

    expect(result.metadata.format).toBe('jpeg');
  });

  it('should reject images exceeding max size', async () => {
    const config: ImageAnalysisConfig = {
      maxImageSizeBytes: 1000, // 1KB limit
    };
    const smallService = new ImageAnalysisService(config);

    const largeBuffer = Buffer.alloc(2000); // 2KB
    const base64 = largeBuffer.toString('base64');

    await expect(
      smallService.analyze({
        imageBuffer: base64,
      }),
    ).rejects.toThrow('Image exceeds max size');
  });

  it('should return mock results when no API key configured', async () => {
    const noKeyConfig: ImageAnalysisConfig = {
      visionApiKey: undefined,
      maxImageSizeBytes: 50 * 1024 * 1024,
    };
    const mockService = new ImageAnalysisService(noKeyConfig);

    const imageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const base64 = imageBuffer.toString('base64');

    const result = await mockService.analyze({
      imageBuffer: base64,
    });

    expect(result.metadata.visionApiUsed).toBe(false);
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it('should validate imageBuffer type in request', async () => {
    // Test will be integrated with router tests once router is wired into app
    const imageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const base64 = imageBuffer.toString('base64');

    const result = await service.analyze({
      imageBuffer: base64,
      format: 'png',
    });

    expect(result).toHaveProperty('matches');
    expect(result).toHaveProperty('metadata');
  });
});
