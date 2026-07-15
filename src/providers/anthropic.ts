import { Provider } from "../core/modelRouter";
import { ProviderError } from "../core/errors";

export const anthropicProvider: Provider = {
  async callChat(spec, payload) {
    const apiKey = process.env[spec.env];
    if (!apiKey) {
      throw new ProviderError(`Missing API key for ${spec.name} (${spec.env})`);
    }

    const systemMessages = payload.messages.filter((m) => m.role === "system");
    const userMessages = payload.messages.filter((m) => m.role !== "system");

    const body: any = {
      model: spec.name,
      messages: userMessages,
      max_tokens: payload.maxTokens ?? 4096,
      stream: payload.stream ?? false,
      temperature: payload.temperature,
    };

    if (systemMessages.length > 0) {
      body.system = systemMessages.map((m) => m.content).join("\n");
    }

    if (payload.tools && spec.supports.toolCalls) {
      body.tools = payload.tools;
    }

    const res = await fetch(`${spec.apiBase}/messages`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new ProviderError(`Anthropic error (${spec.name}): ${res.status} ${text}`);
    }

    const json: any = await res.json();
    const text = json.content?.[0]?.text ?? "";

    return {
      raw: json,
      text,
      model: spec.name,
      tokensUsed: json.usage
        ? {
            input: json.usage.input_tokens ?? 0,
            output: json.usage.output_tokens ?? 0,
          }
        : undefined,
    };
  },
};
