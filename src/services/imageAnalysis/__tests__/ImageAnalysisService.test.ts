import { ImageAnalysisService } from '../ImageAnalysisService';

describe('ImageAnalysisService labels passthrough', () => {
  const onePxPng = Buffer.from(
    '89504e470d0a1a0a0000000d494844520000000100000001080600000' +
    '01f15c4890000000a49444154789c6360000002000155000005e6cc7b' +
    '000000000049454e44ae426082',
    'hex'
  ).toString('base64');

  it('mock mode (no API key) returns an empty labels array, not undefined', async () => {
    delete process.env.VISION_API_KEY;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const service = new ImageAnalysisService({});
    const result = await service.analyze({ imageBuffer: onePxPng, requestId: 'test-1' });
    expect(result.labels).toEqual([]);
  });
});
