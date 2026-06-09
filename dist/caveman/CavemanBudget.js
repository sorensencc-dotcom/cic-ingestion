/**
 * Caveman Budget System
 * Governance layer: per-tool, per-phase, per-agent compression caps
 */
export class CavemanBudget {
    constructor(cfg) {
        this.rules = new Map();
        this.usage = new Map();
        for (const rule of cfg.rules) {
            this.rules.set(rule.id, rule);
        }
    }
    shouldCompress(statsContext) {
        const keys = this.resolveKeys(statsContext);
        for (const key of keys) {
            const rule = this.rules.get(key);
            if (!rule)
                continue;
            const now = Date.now();
            const usage = this.usage.get(key) ?? { bytesSaved: 0, windowStart: now };
            if (now - usage.windowStart > rule.window_ms) {
                usage.bytesSaved = 0;
                usage.windowStart = now;
            }
            if (rule.max_bytes_saved &&
                usage.bytesSaved >= rule.max_bytes_saved) {
                return false; // budget exhausted for this key
            }
        }
        return true;
    }
    record(stats) {
        const keys = this.resolveKeys({
            tool_id: stats.tool_id,
            phase_id: stats.phase_id,
            agent_id: stats.agent_id,
        });
        for (const key of keys) {
            const rule = this.rules.get(key);
            if (!rule)
                continue;
            const now = Date.now();
            const usage = this.usage.get(key) ?? { bytesSaved: 0, windowStart: now };
            if (now - usage.windowStart > rule.window_ms) {
                usage.bytesSaved = 0;
                usage.windowStart = now;
            }
            usage.bytesSaved += stats.bytes_saved;
            this.usage.set(key, usage);
        }
    }
    getUsage(key) {
        return this.usage.get(key) ?? null;
    }
    resolveKeys(ctx) {
        const keys = [];
        if (ctx.tool_id)
            keys.push(`tool:${ctx.tool_id}`);
        if (ctx.phase_id !== undefined)
            keys.push(`phase:${ctx.phase_id}`);
        if (ctx.agent_id)
            keys.push(`agent:${ctx.agent_id}`);
        return keys;
    }
}
/**
 * Default Foundry budget config
 * Tuned for sealed Node environment with bounded memory/cpu
 */
export const FOUNDRY_DEFAULT_BUDGET = {
    rules: [
        // Per-tool budgets (shell most aggressive)
        {
            id: 'tool:shell',
            max_bytes_saved: 10 * 1024 * 1024, // 10 MB per minute
            window_ms: 60000,
        },
        {
            id: 'tool:http',
            max_bytes_saved: 20 * 1024 * 1024, // 20 MB per minute
            window_ms: 60000,
        },
        {
            id: 'tool:model',
            max_bytes_saved: 50 * 1024 * 1024, // 50 MB per minute
            window_ms: 60000,
        },
        {
            id: 'tool:file',
            max_bytes_saved: 5 * 1024 * 1024, // 5 MB per minute
            window_ms: 60000,
        },
        // Per-phase budgets
        {
            id: 'phase:25',
            max_bytes_saved: 50 * 1024 * 1024, // 50 MB per 5 minutes
            window_ms: 300000,
        },
        {
            id: 'phase:26',
            max_bytes_saved: 100 * 1024 * 1024, // 100 MB per 5 minutes
            window_ms: 300000,
        },
        // Per-agent budgets
        {
            id: 'agent:foreman',
            max_bytes_saved: 100 * 1024 * 1024, // 100 MB per 10 minutes
            window_ms: 600000,
        },
        {
            id: 'agent:planner',
            max_bytes_saved: 50 * 1024 * 1024, // 50 MB per 10 minutes
            window_ms: 600000,
        },
    ],
};
//# sourceMappingURL=CavemanBudget.js.map