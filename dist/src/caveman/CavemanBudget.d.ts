/**
 * Caveman Budget System
 * Governance layer: per-tool, per-phase, per-agent compression caps
 */
import { CavemanStatsV1 } from './CavemanStats.js';
export interface CavemanBudgetRule {
    id: string;
    max_bytes_saved?: number;
    min_ratio?: number;
    window_ms: number;
}
export interface CavemanBudgetConfig {
    rules: CavemanBudgetRule[];
}
export declare class CavemanBudget {
    private readonly rules;
    private readonly usage;
    constructor(cfg: CavemanBudgetConfig);
    shouldCompress(statsContext: {
        tool_id?: string;
        phase_id?: number;
        agent_id?: string;
    }): boolean;
    record(stats: CavemanStatsV1): void;
    getUsage(key: string): {
        bytesSaved: number;
        windowStart: number;
    } | null;
    private resolveKeys;
}
/**
 * Default Foundry budget config
 * Tuned for sealed Node environment with bounded memory/cpu
 */
export declare const FOUNDRY_DEFAULT_BUDGET: CavemanBudgetConfig;
//# sourceMappingURL=CavemanBudget.d.ts.map