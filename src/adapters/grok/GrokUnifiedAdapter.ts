import { BaseAdapter, AdapterConfig, AdapterInput, AdapterOutput } from "../BaseAdapter.js";
import { GrokProvider } from "./grok-provider.js";

export class GrokUnifiedAdapter extends BaseAdapter {
  constructor(
    config: AdapterConfig,
    private readonly grok: GrokProvider
  ) {
    super(config);
  }

  normalize(input: any): AdapterInput {
    if (typeof input === "string") {
      return { key: "search", payload: { query: input } };
    }

    if (input.messages && Array.isArray(input.messages)) {
      return {
        key: "chat",
        payload: {
          messages: input.messages,
          model: input.model,
          temperature: input.temperature,
          top_p: input.top_p,
          stream: input.stream,
        },
      };
    }

    if (input.query && typeof input.query === "string") {
      return { key: "search", payload: { query: input.query, maxResults: input.maxResults } };
    }

    if (input.slug && typeof input.slug === "string") {
      return { key: "get_page", payload: { slug: input.slug } };
    }

    if (Array.isArray(input.slugs)) {
      return { key: "ingest", payload: { slugs: input.slugs } };
    }

    if (input.key && input.payload) {
      return { key: input.key, payload: input.payload };
    }

    throw new Error("Invalid unified Grok input: must contain query, messages, slug, or slugs[]");
  }

  async run(input: AdapterInput): Promise<AdapterOutput> {
    const timestamp = Date.now();

    try {
      let result: any;

      if (input.key === "search") {
        result = await this.withRetry(() =>
          this.grok.execute({
            kind: "search",
            query: input.payload.query,
            maxResults: input.payload.maxResults,
          })
        );
      } else if (input.key === "get_page") {
        result = await this.withRetry(() =>
          this.grok.execute({
            kind: "get_page",
            slug: input.payload.slug,
          })
        );
      } else if (input.key === "ingest") {
        result = await this.withRetry(() =>
          this.grok.execute({
            kind: "ingest",
            slugs: input.payload.slugs,
          })
        );
      } else if (input.key === "chat") {
        result = await this.withRetry(() =>
          this.grok.execute({
            kind: "chat",
            messages: input.payload.messages,
            model: input.payload.model,
            temperature: input.payload.temperature,
            top_p: input.payload.top_p,
            stream: input.payload.stream,
          })
        );
      } else {
        throw new Error(`Unsupported unified Grok operation: ${input.key}`);
      }

      return {
        success: true,
        data: result,
        timestamp,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || String(error),
        timestamp,
      };
    }
  }

  validate(output: AdapterOutput): AdapterOutput {
    if (!output.success) {
      return output;
    }

    try {
      this.validateSchema(output.data);
      return { ...output, score: Math.max(output.score || 0, 0.9) };
    } catch (error: any) {
      return {
        ...output,
        success: false,
        error: `Schema validation failed: ${error.message}`,
        score: 0,
      };
    }
  }

  private validateSchema(data: any): void {
    if (!data || typeof data !== "object") {
      throw new Error("Response is not an object");
    }
  }
}
