import { GrokUnifiedAdapter } from "../adapters/grok/GrokUnifiedAdapter.js";
import { GrokProvider } from "../adapters/grok/grok-provider.js";
import { GrokMcpClient } from "../adapters/grok/grok-mcp-client.js";
import { GrokModelClient } from "../adapters/grok/grok-model-client.js";

export type XaiDocsIngestionRequest =
  | { mode: "slug"; slug: string }
  | { mode: "slugs"; slugs: string[] }
  | { mode: "query"; query: string; maxResults?: number };

export type XaiDocsIngestionSummary = {
  source: "xai-docs-mcp";
  mode: "slug" | "slugs" | "query";
  query?: string;
  slugs: string[];
  docIds: string[];
  chunkCount: number;
  ingestionJobId?: string;
};

export class XaiDocsIngestionModule {
  private adapter: GrokUnifiedAdapter;

  constructor(torqueQueryBaseUrl: string) {
    const grokMcpClient = new GrokMcpClient(torqueQueryBaseUrl);
    const grokModelClient = new GrokModelClient("https://api.x.ai", "mock");
    const grokProvider = new GrokProvider(grokMcpClient, grokModelClient);
    this.adapter = new GrokUnifiedAdapter(
      {
        name: "xai-docs-mcp",
        version: "1.0.0",
        timeout: 30000,
        retries: 2,
      },
      grokProvider
    );
  }

  async ingest(request: XaiDocsIngestionRequest): Promise<XaiDocsIngestionSummary> {
    switch (request.mode) {
      case "slug": {
        const normalized = this.adapter.normalize({ slug: request.slug });
        const result = await this.adapter.run(normalized);

        if (!result.success) {
          throw new Error(`xAI Docs Ingestion failed: ${result.error}`);
        }

        const data = result.data;
        return {
          source: "xai-docs-mcp",
          mode: "slug",
          slugs: [request.slug],
          docIds: (data.docs || []).map((d: any) => d.id),
          chunkCount: data.chunkCount || 0,
          ingestionJobId: data.lineage?.ingestionJobId,
        };
      }

      case "slugs": {
        const normalized = this.adapter.normalize({ slugs: request.slugs });
        const result = await this.adapter.run(normalized);

        if (!result.success) {
          throw new Error(`xAI Docs Ingestion failed: ${result.error}`);
        }

        const data = result.data;
        return {
          source: "xai-docs-mcp",
          mode: "slugs",
          slugs: request.slugs,
          docIds: (data.docs || []).map((d: any) => d.id),
          chunkCount: data.chunkCount || 0,
          ingestionJobId: data.lineage?.ingestionJobId,
        };
      }

      case "query": {
        const searchInput = this.adapter.normalize({ query: request.query, maxResults: request.maxResults });
        const searchResult = await this.adapter.run(searchInput);

        if (!searchResult.success) {
          throw new Error(`xAI Docs search failed: ${searchResult.error}`);
        }

        const slugs = (searchResult.data.items || []).map((item: any) => item.slug);

        if (slugs.length === 0) {
          return {
            source: "xai-docs-mcp",
            mode: "query",
            query: request.query,
            slugs: [],
            docIds: [],
            chunkCount: 0,
          };
        }

        const ingestInput = this.adapter.normalize({ slugs });
        const ingestResult = await this.adapter.run(ingestInput);

        if (!ingestResult.success) {
          throw new Error(`xAI Docs ingestion failed for matched slugs: ${ingestResult.error}`);
        }

        const data = ingestResult.data;
        return {
          source: "xai-docs-mcp",
          mode: "query",
          query: request.query,
          slugs,
          docIds: (data.docs || []).map((d: any) => d.id),
          chunkCount: data.chunkCount || 0,
          ingestionJobId: data.lineage?.ingestionJobId,
        };
      }
    }
  }
}
