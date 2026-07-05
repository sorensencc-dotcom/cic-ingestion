import { GrokMcpClient } from "./grok-mcp-client.js";
import { GrokModelClient } from "./grok-model-client.js";

export type GrokRequest =
  | {
      kind: "search";
      query: string;
      maxResults?: number;
    }
  | {
      kind: "get_page";
      slug: string;
    }
  | {
      kind: "ingest";
      slugs: string[];
    }
  | {
      kind: "chat";
      messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
      model?: string;
      temperature?: number;
      top_p?: number;
      stream?: boolean;
    };

export class GrokProvider {
  constructor(
    private readonly mcp: GrokMcpClient,
    private readonly model: GrokModelClient
  ) {}

  async execute(req: GrokRequest) {
    switch (req.kind) {
      case "search":
        return this.mcp.searchDocs(req.query, req.maxResults ?? 10);

      case "get_page":
        return this.mcp.getDocPage(req.slug);

      case "ingest":
        return this.mcp.ingestDocs(req.slugs);

      case "chat":
        return this.model.chat({
          messages: req.messages,
          model: req.model ?? "grok-latest",
          temperature: req.temperature ?? 0.2,
          top_p: req.top_p ?? 0.95,
          stream: req.stream ?? false,
        });

      default:
        throw new Error(`Unknown Grok request kind: ${(req as any).kind}`);
    }
  }
}
