import { Router, Request, Response } from 'express';
import { ImageAnalysisService } from './ImageAnalysisService';
import { AnalyzeImageRequest, AnalyzeImageResponse } from './types';
import { ImageAnalysisConfig } from './types';

export function createImageAnalysisRouter(config: ImageAnalysisConfig): Router {
  const router = Router();
  const imageAnalysisService = new ImageAnalysisService(config);

  function generateUUID(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  router.post('/analyze/image', async (req: Request, res: Response) => {
    try {
      const { imageBuffer, format, apiKey, requestId } = req.body;

      // Type guard: validate imageBuffer is present and is a string (base64)
      if (typeof imageBuffer !== 'string' || imageBuffer.length === 0) {
        return res.status(400).json({ error: 'imageBuffer is required (non-empty base64 string)' });
      }

      // Size validation: base64 string ~1.33x larger than binary; 50 MB binary ≈ 66 MB base64
      const maxBase64Length = 50 * 1024 * 1024 * 1.33;
      if (imageBuffer.length > maxBase64Length) {
        return res.status(400).json({ error: 'image too large (max 50 MB)' });
      }

      // Service call
      const reqId = requestId || generateUUID();
      const response: AnalyzeImageResponse = await imageAnalysisService.analyze({
        imageBuffer,
        format,
        apiKey,
        requestId: reqId,
      } as AnalyzeImageRequest);

      res.status(200).json(response);
    } catch (error) {
      const requestId = req.body?.requestId || 'unknown';
      console.error(`[${requestId}] Image analysis error:`, error);
      res.status(500).json({
        error: 'Internal server error',
        requestId,
      });
    }
  });

  return router;
}
