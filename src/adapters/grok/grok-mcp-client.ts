export class GrokMcpClient {
  constructor(private readonly baseUrl: string) {}

  async searchDocs(query: string, maxResults: number): Promise<any> {
    const res = await fetch(`${this.baseUrl}/mcp/xai/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, maxResults }),
    });
    if (!res.ok) {
      throw new Error(`TorqueQuery search error: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  async getDocPage(slug: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/mcp/xai/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    if (!res.ok) {
      throw new Error(`TorqueQuery getPage error: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  async ingestDocs(slugs: string[]): Promise<any> {
    const res = await fetch(`${this.baseUrl}/mcp/xai/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slugs }),
    });
    if (!res.ok) {
      throw new Error(`TorqueQuery ingest error: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }
}
