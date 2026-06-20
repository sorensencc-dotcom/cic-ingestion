/**
 * Caveman Budget System
 * Governance layer: per-tool, per-phase, per-agent compression caps
 */

import { CavemanStatsV1 } from './CavemanStats.js';

export interface CavemanBudgetRule {
  id: string; // "tool:shell", "phase:25", "agent:foreman"
  max_bytes_saved?: number; // upper bound for compression per window
  min_ratio?: number; // minimum compression ratio to consider "worth it"
  window_ms: number; // rolling window duration
}

export interface CavemanBudgetConfig {
  rules: CavemanBudgetRule[];
}

export class CavemanBudget {
  private readonly rules = new Map<string, CavemanBudgetRule>();
  private readonly usage = new Map<
    string,
    { bytesSaved: number; windowStart: number }
  >();

  constructor(cfg: CavemanBudgetConfig) {
    for (const rule of cfg.rules) {
      this.rules.set(rule.id, rule);
    }
  }

  shouldCompress(statsContext: {
    tool_id?: string;
    phase_id?: number;
    agent_id?: string;
  }): boolean {
    const keys = this.resolveKeys(statsContext);

    for (const key of keys) {
      const rule = this.rules.get(key);
      if (!rule) continue;

      const now = Date.now();
      const usage =
        this.usage.get(key) ?? { bytesSaved: 0, windowStart: now };

      if (now - usage.windowStart > rule.window_ms) {
        usage.bytesSaved = 0;
        usage.windowStart = now;
      }

      if (
        rule.max_bytes_saved &&
        usage.bytesSaved >= rule.max_bytes_saved
      ) {
        return false; // budget exhausted for this key
      }
    }

    return true;
  }

  record(stats: CavemanStatsV1): void {
    const keys = this.resolveKeys({
      tool_id: stats.tool_id,
      phase_id: stats.phase_id,
      agent_id: stats.agent_id,
    });

    for (const key of keys) {
      const rule = this.rules.get(key);
      if (!rule) continue;

      const now = Date.now();
      const usage =
        this.usage.get(key) ?? { bytesSaved: 0, windowStart: now };

      if (now - usage.windowStart > rule.window_ms) {
        usage.bytesSaved = 0;
        usage.windowStart = now;
      }

      usage.bytesSaved += stats.bytes_saved;
      this.usage.set(key, usage);
    }
  }

  getUsage(key: string): { bytesSaved: number; windowStart: number } | null {
    return this.usage.get(key) ?? null;
  }

  private resolveKeys(ctx: {
    tool_id?: string;
    phase_id?: number;
    agent_id?: string;
  }): string[] {
    const keys: string[] = [];
    if (ctx.tool_id) keys.push(`tool:${ctx.tool_id}`);
    if (ctx.phase_id !== undefined) keys.push(`phase:${ctx.phase_id}`);
    if (ctx.agent_id) keys.push(`agent:${ctx.agent_id}`);
    return keys;
  }
}

/**
 * Default Foundry budget config
 * Tuned for sealed Node environment with bounded memory/cpu
 */
export const FOUNDRY_DEFAULT_BUDGET: CavemanBudgetConfig = {
  rules: [
    // Per-tool budgets (shell most aggressive)
    {
      id: 'tool:shell',
      max_bytes_saved: 10 * 1024 * 1024, // 10 MB per minute
      window_ms: 60_000,
    },
    {
      id: 'tool:http',
      max_bytes_saved: 20 * 1024 * 1024, // 20 MB per minute
      window_ms: 60_000,
    },
    {
      id: 'tool:model',
      max_bytes_saved: 50 * 1024 * 1024, // 50 MB per minute
      window_ms: 60_000,
    },
    {
      id: 'tool:file',
      max_bytes_saved: 5 * 1024 * 1024, // 5 MB per minute
      window_ms: 60_000,
    },

    // Per-phase budgets
    {
      id: 'phase:25',
      max_bytes_saved: 50 * 1024 * 1024, // 50 MB per 5 minutes
      window_ms: 300_000,
    },
    {
      id: 'phase:26',
      max_bytes_saved: 100 * 1024 * 1024, // 100 MB per 5 minutes
      window_ms: 300_000,
    },

    // Per-agent budgets
    {
      id: 'agent:foreman',
      max_bytes_saved: 100 * 1024 * 1024, // 100 MB per 10 minutes
      window_ms: 600_000,
    },
    {
      id: 'agent:planner',
      max_bytes_saved: 50 * 1024 * 1024, // 50 MB per 10 minutes
      window_ms: 600_000,
    },
  ],
};

