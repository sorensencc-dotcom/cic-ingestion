import { Provider } from "../core/modelRouter";
import { ProviderError } from "../core/errors";

export const googleProvider: Provider = {
  async callChat(spec, payload) {
    const apiKey = process.env[spec.env];
    if (!apiKey) {
      throw new ProviderError(`Missing API key for ${spec.name} (${spec.env})`);
    }

    let systemInstruction: { parts: Array<{ text: string }> } | undefined;
    const contents: any[] = [];

    for (const m of payload.messages) {
      if (m.role === "system") {
        if (!systemInstruction) {
          systemInstruction = { parts: [] };
        }
        systemInstruction.parts.push({ text: m.content });
      } else {
        contents.push({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        });
      }
    }

    const body: any = {
      contents,
      generationConfig: {
        temperature: payload.temperature,
        maxOutputTokens: payload.maxTokens,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = systemInstruction;
    }

    if (payload.tools && spec.supports.toolCalls) {
      body.tools = [{ functionDeclarations: payload.tools }];
    }

    const res = await fetch(
      `${spec.apiBase}/models/${spec.name}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new ProviderError(`Google error (${spec.name}): ${res.status} ${text}`);
    }

    const json: any = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    return {
      raw: json,
      text,
      model: spec.name,
      tokensUsed: json.usageMetadata
        ? {
            input: json.usageMetadata.promptTokenCount ?? 0,
            output: json.usageMetadata.candidatesTokenCount ?? 0,
          }
        : undefined,
    };
  },
};
