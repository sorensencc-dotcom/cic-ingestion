import { GrokProvider } from "../adapters/grok/grok-provider.js";

export async function grokRagQuery(
  grok: GrokProvider,
  userQuestion: string
) {
  const search: any = await grok.execute({ kind: "search", query: userQuestion, maxResults: 8 });

  const context = (search.items || []).map((i: any) => `- ${i.title}\n${i.snippet}`).join("\n\n");

  const messages = [
    { role: "system", content: "You are a helpful assistant using xAI docs as context." },
    { role: "user", content: `Context:\n${context}\n\nQuestion:\n${userQuestion}` },
  ];

  return grok.execute({ kind: "chat", messages: messages as any });
}
