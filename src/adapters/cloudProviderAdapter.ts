/**
 * Unified Cloud Provider Adapter Contract
 * Supports multiple cloud LLM providers (Grok MCP, Grok Routing, etc.)
 *
 * File: cloudProviderAdapter.ts
 * Date: 2026-07-02
 * Semver: 1.0.0
 */

export interface CloudModelRequest {
  model: string;
  prompt: string;
  max_tokens?: number;
  temperature?: number;
  metadata?: Record<string, any>;
}

export interface CloudModelResponse {
  model: string;
  completion: string;
  tokens_used: number;
  latency_ms: number;
  provider: string;
}

/**
 * Cloud provider adapter interface.
 * Implement this for each cloud provider (Grok MCP, Grok Routing, etc.)
 */
export interface CloudProviderAdapter {
  name: string;
  supportsModel(model: string): boolean;
  invoke(req: CloudModelRequest): Promise<CloudModelResponse>;
}

/**
 * Deterministic routing rule for model → provider selection.
 */
export interface DeterministicRoutingRule {
  model: string;
  provider: string;
  max_latency_ms?: number;
  max_tokens?: number;
  priority?: number; // Higher = higher priority
}

/**
 * Unified cloud gateway with deterministic model → provider routing.
 * No heuristics, only explicit rules.
 */
export class UnifiedCloudGateway {
  private adapters: CloudProviderAdapter[];
  private rules: DeterministicRoutingRule[];

  constructor(adapters: CloudProviderAdapter[], rules: DeterministicRoutingRule[]) {
    this.adapters = adapters;
    this.rules = rules;

    // Sort rules by priority (higher first)
    this.rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * Deterministically select provider for model.
   * Throws if no rule matches.
   */
  private selectProvider(model: string): CloudProviderAdapter {
    const rule = this.rules.find(r => r.model === model);
    if (!rule) {
      throw new Error(`No deterministic routing rule for model: ${model}`);
    }

    const adapter = this.adapters.find(a => a.name === rule.provider);
    if (!adapter) {
      throw new Error(`Adapter not found for provider: ${rule.provider}`);
    }

    return adapter;
  }

  /**
   * Route and invoke model via deterministic provider selection.
   * Enforces latency and token caps.
   */
  async route(req: CloudModelRequest): Promise<CloudModelResponse> {
    const adapter = this.selectProvider(req.model);
    const res = await adapter.invoke(req);

    // Enforce caps
    const rule = this.rules.find(r => r.model === req.model)!;

    if (rule.max_latency_ms && res.latency_ms > rule.max_latency_ms) {
      throw new Error(
        `Latency ${res.latency_ms}ms exceeds cap ${rule.max_latency_ms}ms for model ${req.model}`
      );
    }

    if (rule.max_tokens && res.tokens_used > rule.max_tokens) {
      throw new Error(
        `Tokens ${res.tokens_used} exceed cap ${rule.max_tokens} for model ${req.model}`
      );
    }

    return res;
  }

  /**
   * Get all registered adapters.
   */
  getAdapters(): CloudProviderAdapter[] {
    return this.adapters;
  }

  /**
   * Get all routing rules.
   */
  getRules(): DeterministicRoutingRule[] {
    return this.rules;
  }

  /**
   * Add or update a routing rule.
   */
  addRule(rule: DeterministicRoutingRule): void {
    const existing = this.rules.findIndex(r => r.model === rule.model);
    if (existing >= 0) {
      this.rules[existing] = rule;
    } else {
      this.rules.push(rule);
    }
  }
}
