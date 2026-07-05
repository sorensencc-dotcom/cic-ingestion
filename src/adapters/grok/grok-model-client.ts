export class GrokModelClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string
  ) {}

  async chat(req: {
    messages: Array<{ role: string; content: string }>;
    model: string;
    temperature: number;
    top_p: number;
    stream: boolean;
  }) {
    const url = `${this.baseUrl.replace(/\/$/, "")}/v1/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(req),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Grok model error: ${res.status} ${res.statusText} - ${text}`);
    }

    return req.stream ? res.body : res.json();
  }
}
