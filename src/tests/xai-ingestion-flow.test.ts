import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { GrokUnifiedAdapter } from "../adapters/grok/GrokUnifiedAdapter.js";
import { XaiDocsIngestionModule } from "../ingestion/xai-docs-mcp.js";
import { GrokProvider } from "../adapters/grok/grok-provider.js";
import { GrokMcpClient } from "../adapters/grok/grok-mcp-client.js";
import { GrokModelClient } from "../adapters/grok/grok-model-client.js";

describe("Unified Grok Provider & Ingestion Integration", () => {
  let grokProvider: GrokProvider;
  let mcpClient: jest.Mocked<GrokMcpClient>;
  let modelClient: jest.Mocked<GrokModelClient>;

  beforeEach(() => {
    mcpClient = {
      searchDocs: jest.fn(),
      getDocPage: jest.fn(),
      ingestDocs: jest.fn(),
    } as any;

    modelClient = {
      chat: jest.fn(),
    } as any;

    grokProvider = new GrokProvider(mcpClient, modelClient);
  });

  describe("GrokUnifiedAdapter Normalization", () => {
    it("maps inputs correctly to normalized AdapterInputs", () => {
      const adapter = new GrokUnifiedAdapter(
        { name: "grok-unified", version: "1.0.0", timeout: 5000, retries: 1 },
        grokProvider
      );

      expect(adapter.normalize("rate limits")).toEqual({
        key: "search",
        payload: { query: "rate limits" },
      });

      expect(adapter.normalize({ query: "api-keys", maxResults: 5 })).toEqual({
        key: "search",
        payload: { query: "api-keys", maxResults: 5 },
      });

      expect(adapter.normalize({ slug: "quickstart" })).toEqual({
        key: "get_page",
        payload: { slug: "quickstart" },
      });

      expect(adapter.normalize({ slugs: ["intro", "reference"] })).toEqual({
        key: "ingest",
        payload: { slugs: ["intro", "reference"] },
      });

      const chatInput = {
        messages: [{ role: "user", content: "hello" }],
        model: "grok-beta",
      };
      expect(adapter.normalize(chatInput)).toEqual({
        key: "chat",
        payload: {
          messages: chatInput.messages,
          model: "grok-beta",
          temperature: undefined,
          top_p: undefined,
          stream: undefined,
        },
      });
    });
  });

  describe("GrokUnifiedAdapter Run and Route execution", () => {
    it("executes RAG search request via MCP client", async () => {
      const adapter = new GrokUnifiedAdapter(
        { name: "grok-unified", version: "1.0.0", timeout: 5000, retries: 1 },
        grokProvider
      );

      mcpClient.searchDocs.mockResolvedValue({ items: [{ slug: "doc1", title: "Doc 1" }] });

      const input = adapter.normalize("test query");
      const output = await adapter.run(input);

      expect(output.success).toBe(true);
      expect(output.data).toEqual({ items: [{ slug: "doc1", title: "Doc 1" }] });
      expect(mcpClient.searchDocs).toHaveBeenCalledWith("test query", 10);
    });

    it("executes LLM chat reasoning request via Model client", async () => {
      const adapter = new GrokUnifiedAdapter(
        { name: "grok-unified", version: "1.0.0", timeout: 5000, retries: 1 },
        grokProvider
      );

      modelClient.chat.mockResolvedValue({
        id: "chat-123",
        choices: [{ message: { role: "assistant", content: "Grok response" } }],
      });

      const input = adapter.normalize({
        messages: [{ role: "user", content: "what is Maal?" }],
        model: "grok-latest",
      });

      const output = await adapter.run(input);

      expect(output.success).toBe(true);
      expect(output.data).toEqual({
        id: "chat-123",
        choices: [{ message: { role: "assistant", content: "Grok response" } }],
      });
      expect(modelClient.chat).toHaveBeenCalledWith({
        messages: [{ role: "user", content: "what is Maal?" }],
        model: "grok-latest",
        temperature: 0.2,
        top_p: 0.95,
        stream: false,
      });
    });
  });
});
