import { ImageAnalysisConfig } from './types';

export function loadConfig(): ImageAnalysisConfig {
  return {
    port: parseInt(process.env.CIC_INGESTION_PORT || '3000', 10),
    visionApiKey: process.env.VISION_API_KEY,
    visionApiProvider: process.env.VISION_API_PROVIDER || 'google_vision',
    maxImageSizeBytes: 50 * 1024 * 1024, // 50 MB
  };
}
