import axios from "axios";
import {
  BaseAdapter,
  AdapterConfig,
  AdapterInput,
  AdapterOutput,
} from "../BaseAdapter";
import { FamilySearchResponse, familySearchSchema } from "./schema";

export interface FamilySearchConfig extends AdapterConfig {
  apiUrl: string;
  apiKey: string;
}

export class FamilySearchAdapter extends BaseAdapter {
  private client: axios.AxiosInstance;

  constructor(private fsConfig: FamilySearchConfig) {
    super(fsConfig);

    this.client = axios.create({
      baseURL: fsConfig.apiUrl,
      headers: {
        Authorization: `Bearer ${fsConfig.apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: fsConfig.timeout,
    });
  }

  normalize(input: any): AdapterInput {
    if (typeof input === "string") {
      return { key: input, payload: {} };
    }

    if (input.key && typeof input.key === "string") {
      return { key: input.key, payload: input.payload || {} };
    }

    throw new Error("Invalid FamilySearch input: missing or invalid key");
  }

  async run(input: AdapterInput): Promise<AdapterOutput> {
    const startTime = Date.now();

    try {
      const response = await this.withRetry(() =>
        this.client.get(`/platform/tree/persons/${input.key}`, {
          params: { includeRelationships: true, includeSources: true },
        })
      );

      const data: FamilySearchResponse = response.data;
      const timestamp = Date.now();

      return {
        success: true,
        data,
        hydration: {
          cached: false,
          timestamp,
        },
        score: this.calculateConfidence(data),
        timestamp,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  validate(output: AdapterOutput): AdapterOutput {
    if (!output.success) {
      return output;
    }

    try {
      this.validateSchema(output.data);
      return { ...output, score: Math.max(output.score || 0, 0.8) };
    } catch (error) {
      return {
        ...output,
        success: false,
        error: `Schema validation failed: ${error instanceof Error ? error.message : String(error)}`,
        score: 0,
      };
    }
  }

  private validateSchema(data: any): void {
    if (!data || typeof data !== "object") {
      throw new Error("Response is not an object");
    }

    if (!Array.isArray(data.persons)) {
      throw new Error("Missing or invalid persons array");
    }

    if (!Array.isArray(data.relationships)) {
      throw new Error("Missing or invalid relationships array");
    }

    for (const person of data.persons) {
      if (!person.pid || !person.name) {
        throw new Error("Person missing required fields: pid, name");
      }
    }
  }

  private calculateConfidence(data: FamilySearchResponse): number {
    let score = 0.5;

    if (data.persons && data.persons.length > 0) score += 0.2;
    if (data.sources && data.sources.length > 0) score += 0.15;
    if (data.citations && data.citations.length > 0) score += 0.1;

    const highQualityCitations = (data.citations || []).filter(
      (c) => c.quality === "HIGH"
    ).length;
    if (highQualityCitations > 0) score += 0.05;

    return Math.min(score, 1.0);
  }
}
