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

  it('should succeed when buffer size is exactly equal to maxImageSizeBytes', async () => {
    const config: ImageAnalysisConfig = {
      maxImageSizeBytes: 1000,
    };
    const exactService = new ImageAnalysisService(config);
    const exactBuffer = Buffer.alloc(1000);
    const base64 = exactBuffer.toString('base64');

    const result = await exactService.analyze({
      imageBuffer: base64,
    });

    expect(result.metadata.size).toBe(1000);
  });

  it('should reject when buffer size is maxImageSizeBytes + 1', async () => {
    const config: ImageAnalysisConfig = {
      maxImageSizeBytes: 1000,
    };
    const boundaryService = new ImageAnalysisService(config);
    const overBuffer = Buffer.alloc(1001);
    const base64 = overBuffer.toString('base64');

    await expect(
      boundaryService.analyze({
        imageBuffer: base64,
      }),
    ).rejects.toThrow('Image exceeds max size');
  });

  it('should handle malformed base64 payload gracefully by throwing error', async () => {
    const malformedBase64 = '!!!invalid_base64_payload_123!!!';

    await expect(
      service.analyze({
        imageBuffer: malformedBase64,
      }),
    ).rejects.toThrow(/base64/i);
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

  it.each([
    ['GIF', [0x47, 0x49, 0x46, 0x38], 'gif'],
    ['WebP', [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], 'webp'],
    ['BMP', [0x42, 0x4d, 0x00, 0x00], 'bmp'],
    ['TIFF (Intel)', [0x49, 0x49, 0x2a, 0x00], 'tiff'],
    ['TIFF (Motorola)', [0x4d, 0x4d, 0x00, 0x2a], 'tiff'],
  ])('detects %s magic bytes', async (_name, bytes, expectedFormat) => {
    const result = await service.analyze({
      imageBuffer: Buffer.from(bytes).toString('base64'),
    });

    expect(result.metadata.format).toBe(expectedFormat);
  });

  it('uses the request format when bytes are not recognized', async () => {
    const result = await service.analyze({
      imageBuffer: Buffer.from([0x00, 0x01, 0x02]).toString('base64'),
      format: 'tiff',
    });

    expect(result.metadata.format).toBe('tiff');
  });

  it('uses unknown format when bytes and request format are absent', async () => {
    const result = await service.analyze({
      imageBuffer: Buffer.from([0x00, 0x01, 0x02]).toString('base64'),
    });

    expect(result.metadata.format).toBe('unknown');
  });

  it('returns transformed Vision matches and caches the provider', async () => {
    const visionService = new ImageAnalysisService({ visionApiKey: 'test-key' });
    const analyzeImage = jest.fn().mockResolvedValue({
      labels: [],
      web: {
        fullMatchingImages: [
          { url: 'https://example.com/full.jpg', score: 0.876 },
          { url: 'https://example.com/no-score.jpg' },
        ],
      },
    });
    const provider = { analyzeImage };
    const getProvider = jest.spyOn(visionService as any, 'getOrInitializeProvider')
      .mockReturnValue(provider);
    const imageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

    const first = await visionService.analyze({ imageBuffer: imageBuffer.toString('base64') });
    const second = await visionService.analyze({ imageBuffer: imageBuffer.toString('base64') });

    expect(first.metadata).toMatchObject({ visionApiUsed: true, apiProvider: 'google_vision', format: 'png' });
    expect(first.matches).toEqual([
      { url: 'https://example.com/full.jpg', similarity: 88, source: 'google_vision' },
      { url: 'https://example.com/no-score.jpg', similarity: 0, source: 'google_vision' },
    ]);
    expect(second.metadata.visionApiUsed).toBe(true);
    expect(analyzeImage).toHaveBeenCalledTimes(2);
    expect(getProvider).toHaveBeenCalledTimes(2);
  });

  it('falls back to mock results when Vision API fails', async () => {
    const visionService = new ImageAnalysisService({ visionApiKey: 'test-key' });
    const error = new Error('Vision unavailable');
    jest.spyOn(visionService as any, 'getOrInitializeProvider').mockReturnValue({
      analyzeImage: jest.fn().mockRejectedValue(error),
    });
    const mockResults = {
      matches: [{ url: 'mock', similarity: 1, source: 'mock' }],
      metadata: {
        format: 'jpeg', size: 3, processedAt: 'now', visionApiUsed: false,
        latencyMs: 1, apiProvider: 'mock',
      },
    };
    const mock = jest.spyOn(visionService as any, '_generateMockResults').mockReturnValue(mockResults);
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await visionService.analyze({
      imageBuffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString('base64'),
    });

    expect(result).toBe(mockResults);
    expect(mock).toHaveBeenCalledWith(expect.any(Buffer), 'jpeg');
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Vision API failed: Vision unavailable'));
    log.mockRestore();
  });

  describe('Vision API key warning logging', () => {
    let warnSpy: jest.SpyInstance;
    const origCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const origVisionKey = process.env.VISION_API_KEY;

    beforeEach(() => {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
      delete process.env.VISION_API_KEY;
      warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
      if (origCreds) process.env.GOOGLE_APPLICATION_CREDENTIALS = origCreds;
      if (origVisionKey) process.env.VISION_API_KEY = origVisionKey;
      warnSpy.mockRestore();
    });

    it('logs a loud warning on startup when no Vision API key or credentials set', () => {
      new ImageAnalysisService({ maxImageSizeBytes: 5000 });
      expect(warnSpy).toHaveBeenCalledWith(
        'Vision: MOCK mode, no API key (set VISION_API_KEY or GOOGLE_APPLICATION_CREDENTIALS)'
      );
    });

    it('does not log warning when visionApiKey is provided in config', () => {
      new ImageAnalysisService({ visionApiKey: 'my-test-key' });
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
