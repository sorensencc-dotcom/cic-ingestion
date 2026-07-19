// @ts-ignore - @google-cloud/vision has incomplete types
import { ImageAnnotatorClient } from '@google-cloud/vision';

export interface Label {
  description: string;
  score: number;
}

export interface WebDetection {
  bestGuessLabels?: Array<{ label: string }>;
  fullMatchingImages?: Array<{ url: string; score?: number }>;
}

export interface VisionResult {
  labels: Label[];
  web: WebDetection;
}

export class GoogleVisionProvider {
  private client: any;

  constructor(keyFilePath?: string) {
    this.client = new ImageAnnotatorClient({
      keyFilename: keyFilePath,
    });
  }

  async analyzeImage(imageBuffer: Buffer): Promise<VisionResult> {
    const request = {
      image: { content: imageBuffer },
      features: [
        { type: 'LABEL_DETECTION' },
        { type: 'WEB_DETECTION' },
      ],
    };

    const [result] = await this.client.annotateImage(request);
    return {
      labels: result.labelAnnotations || [],
      web: result.webDetection || {},
    };
  }
}
