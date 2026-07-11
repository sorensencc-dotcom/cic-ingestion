/**
 * Grok Routing Adapter — Grok Routing cloud provider integration
 * Routes requests to optimal model instances dynamically.
 *
 * File: grokRoutingAdapter.ts
 * Date: 2026-07-02
 * Semver: 1.0.0
 */

import fetch from 'node-fetch';
import { CloudModelRequest, CloudModelResponse, CloudProviderAdapter } from './cloudProviderAdapter.ts';

export class GrokRoutingAdapter implements CloudProviderAdapter {
  name = 'grok-routing';
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string = 'https://api.grok-routing.example.com', apiKey: string = '') {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey || process.env.GROK_ROUTING_API_KEY || '';
  }

  supportsModel(model: string): boolean {
    return model.startsWith('grok-rt-');
  }

  async invoke(req: CloudModelRequest): Promise<CloudModelResponse> {
    const started = Date.now();

    if (!this.apiKey) {
      throw new Error('Grok Routing API key not configured (set GROK_ROUTING_API_KEY)');
    }

    try {
      const res = await fetch(`${this.baseUrl}/v1/route`, {
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
        throw new Error(`Grok Routing API error: ${res.status} ${res.statusText}`);
      }

      const json = (await res.json()) as any;
      const latency_ms = Date.now() - started;

      // Grok Routing returns the concrete routed model instance
      return {
        model: json.model || req.model,
        completion: json.choices?.[0]?.text || json.completion || '',
        tokens_used: json.usage?.total_tokens || 0,
        latency_ms,
        provider: this.name
      };
    } catch (err) {
      throw new Error(`Grok Routing invocation error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
