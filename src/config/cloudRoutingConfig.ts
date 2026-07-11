/**
 * Deterministic cloud routing configuration
 * Defines model → provider rules and latency/token caps.
 *
 * File: cloudRoutingConfig.ts
 * Date: 2026-07-02
 * Semver: 1.0.0
 */

import { UnifiedCloudGateway, DeterministicRoutingRule } from '../adapters/cloudProviderAdapter.ts';
import { GrokMcpAdapter } from '../adapters/grokMcpAdapter.ts';
import { GrokRoutingAdapter } from '../adapters/grokRoutingAdapter.ts';

// Initialize adapters
const adapters = [
  new GrokMcpAdapter(),
  new GrokRoutingAdapter()
];

// Define deterministic routing rules
const rules: DeterministicRoutingRule[] = [
  {
    model: 'grok-mcp-ops',
    provider: 'grok-mcp',
    max_latency_ms: 800,
    max_tokens: 2048,
    priority: 10
  },
  {
    model: 'grok-mcp-rag',
    provider: 'grok-mcp',
    max_latency_ms: 1200,
    max_tokens: 4096,
    priority: 10
  },
  {
    model: 'grok-rt-general',
    provider: 'grok-routing',
    max_latency_ms: 1500,
    max_tokens: 4096,
    priority: 5
  }
];

// Export unified gateway singleton
export const cloudGateway = new UnifiedCloudGateway(adapters, rules);

/**
 * Print routing configuration (for debugging).
 */
export function printCloudRoutingConfig(): void {
  console.log('=== Cloud Routing Configuration ===');
  console.log('Adapters:');
  cloudGateway.getAdapters().forEach(a => {
    console.log(`  - ${a.name}`);
  });
  console.log('Rules:');
  cloudGateway.getRules().forEach(r => {
    console.log(`  - ${r.model} → ${r.provider} (latency: ${r.max_latency_ms}ms, tokens: ${r.max_tokens})`);
  });
}
