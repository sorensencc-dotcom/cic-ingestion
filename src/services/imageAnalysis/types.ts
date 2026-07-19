export interface AnalyzeImageRequest {
  imageBuffer: string; // base64-encoded image
  format?: string; // detected format (png, jpeg, webp, gif, etc.)
  apiKey?: string; // optional per-request API key override
  requestId?: string; // correlation ID for logging
}

export interface ImageMatch {
  url: string;
  similarity: number; // 0-100
  source: string; // e.g., 'google_vision'
}

export interface AnalysisMetadata {
  format: string;
  size: number; // bytes of decoded image
  processedAt: string; // ISO 8601
  visionApiUsed: boolean;
  latencyMs: number;
  apiProvider: string; // 'google_vision' or fallback name
}

export interface AnalyzeImageResponse {
  matches: ImageMatch[];
  metadata: AnalysisMetadata;
}

export interface ImageAnalysisConfig {
  port?: number;
  visionApiKey?: string;
  visionApiProvider?: string;
  maxImageSizeBytes?: number;
}
