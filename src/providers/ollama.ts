import { Provider } from "../core/modelRouter";
import { ProviderError } from "../core/errors";

export const ollamaProvider: Provider = {
  async callChat(spec, payload) {
    const body: any = {
      model: spec.name,
      messages: payload.messages,
      stream: payload.stream ?? false,
      options: {
        temperature: payload.temperature,
        num_predict: payload.maxTokens,
      },
    };

    if (payload.tools && spec.supports.toolCalls) {
      body.tools = payload.tools;
    }

    const res = await fetch(`${spec.apiBase}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new ProviderError(`Ollama error (${spec.name}): ${res.status} ${text}`);
    }

    const json: any = await res.json();
    const text = json.message?.content ?? "";

    return {
      raw: json,
      text,
      model: spec.name,
      tokensUsed: {
        input: json.prompt_eval_count ?? 0,
        output: json.eval_count ?? 0,
      },
    };
  },
};
