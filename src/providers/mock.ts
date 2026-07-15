import { Provider, ChatPayload, ChatResult } from "../core/modelRouter";
import { ModelSpec } from "../core/modelSpec";

class MockProvider implements Provider {
  async callChat(spec: ModelSpec, payload: ChatPayload): Promise<ChatResult> {
    const text = `[MOCK:${payload.model}] ${payload.messages.map((m) => m.content).join(" ")}`;
    const raw: any = { content: [{ type: "text", text }], model: spec.name };

    if (payload.requires?.toolCalls) {
      raw.tool_calls = [];
    }

    return {
      raw,
      text,
      model: spec.name,
      tokensUsed: { input: 1, output: 1 },
    };
  }
}

export const mockProvider = new MockProvider();
