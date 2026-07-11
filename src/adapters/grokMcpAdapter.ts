/**
 * Grok MCP Adapter — Grok MCP cloud provider integration
 *
 * File: grokMcpAdapter.ts
 * Date: 2026-07-02
 * Semver: 1.0.0
 */

import fetch from 'node-fetch';
import { CloudModelRequest, CloudModelResponse, CloudProviderAdapter } from './cloudProviderAdapter.ts';

export class GrokMcpAdapter implements CloudProviderAdapter {
  name = 'grok-mcp';
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string = 'https://api.grok-mcp.example.com', apiKey: string = '') {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey || process.env.GROK_MCP_API_KEY || '';
  }

  supportsModel(model: string): boolean {
    return model.startsWith('grok-mcp-');
  }

  async invoke(req: CloudModelRequest): Promise<CloudModelResponse> {
    const started = Date.now();

    if (!this.apiKey) {
      throw new Error('Grok MCP API key not configured (set GROK_MCP_API_KEY)');
    }

    try {
      const res = await fetch(`${this.baseUrl}/v1/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: req.model,
          prompt: req.prompt,
          max_tokens: req.max_tokens || 2048,
          temperature: req.temperature || 0.7,
          metadata: req.metadata
        })
      });

      if (!res.ok) {
        throw new Error(`Grok MCP API error: ${res.status} ${res.statusText}`);
      }

      const json = (await res.json()) as any;
      const latency_ms = Date.now() - started;

      return {
        model: req.model,
        completion: json.choices?.[0]?.text || json.completion || '',
        tokens_used: json.usage?.total_tokens || 0,
        latency_ms,
        provider: this.name
      };
    } catch (err) {
      throw new Error(`Grok MCP invocation error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
