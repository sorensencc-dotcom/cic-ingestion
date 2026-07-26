import express from 'express';
import http from 'http';
import { createImageAnalysisRouter } from '../router';
import { ImageAnalysisService } from '../ImageAnalysisService';

describe('ImageAnalysis Router', () => {
  let app: express.Application;
  let server: http.Server;
  let baseUrl: string;
  let analyzeSpy: jest.SpyInstance;

  beforeAll((done) => {
    app = express();
    app.use(express.json({ limit: '100mb' }));
    app.use('/api', createImageAnalysisRouter({ maxImageSizeBytes: 50 * 1024 * 1024 }));

    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://127.0.0.1:${addr.port}`;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    analyzeSpy = jest.spyOn(ImageAnalysisService.prototype, 'analyze');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('validates that imageBuffer is present and is a non-empty string', async () => {
    const resMissing = await fetch(`${baseUrl}/api/analyze/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(resMissing.status).toBe(400);
    const bodyMissing = (await resMissing.json()) as { error: string };
    expect(bodyMissing.error).toContain('imageBuffer is required');

    const resNonString = await fetch(`${baseUrl}/api/analyze/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBuffer: 12345 }),
    });
    expect(resNonString.status).toBe(400);
    const bodyNonString = (await resNonString.json()) as { error: string };
    expect(bodyNonString.error).toContain('imageBuffer is required');

    const resEmpty = await fetch(`${baseUrl}/api/analyze/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBuffer: '' }),
    });
    expect(resEmpty.status).toBe(400);
    const bodyEmpty = (await resEmpty.json()) as { error: string };
    expect(bodyEmpty.error).toContain('imageBuffer is required');
  });

  it('rejects oversized base64 strings exceeding limit', async () => {
    // 50MB * 1.33 = ~66.5MB limit; 70MB string exceeds it
    const oversizedBase64 = 'A'.repeat(70 * 1024 * 1024);
    const resLarge = await fetch(`${baseUrl}/api/analyze/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBuffer: oversizedBase64 }),
    });
    expect(resLarge.status).toBe(400);
    const bodyLarge = (await resLarge.json()) as { error: string };
    expect(bodyLarge.error).toContain('image too large');
  }, 15000);

  it('preserves caller requestId when explicitly provided', async () => {
    const pngBase64 = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64');

    const res = await fetch(`${baseUrl}/api/analyze/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBuffer: pngBase64,
        requestId: 'req-custom-123',
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body).toHaveProperty('matches');
    expect(analyzeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-custom-123',
        imageBuffer: pngBase64,
      })
    );
  });

  it('auto-generates requestId when omitted', async () => {
    const pngBase64 = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64');

    const res = await fetch(`${baseUrl}/api/analyze/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBuffer: pngBase64,
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body).toHaveProperty('matches');
    expect(analyzeSpy).toHaveBeenCalled();
    const callArg = analyzeSpy.mock.calls[0][0];
    expect(callArg.requestId).toBeDefined();
    expect(typeof callArg.requestId).toBe('string');
    expect(callArg.requestId.length).toBeGreaterThan(0);
  });

  it('handles errors thrown by ImageAnalysisService with 500 status', async () => {
    analyzeSpy.mockRejectedValue(new Error('Service failure'));
    const pngBase64 = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64');

    const res = await fetch(`${baseUrl}/api/analyze/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBuffer: pngBase64,
        requestId: 'err-req-456',
      }),
    });

    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string; requestId: string };
    expect(body.error).toBe('Internal server error');
    expect(body.requestId).toBe('err-req-456');
  });
});
