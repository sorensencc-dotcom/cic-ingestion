/**
 * Wayland Caveman Integration
 * Post-processor for all Wayland tool outputs
 * Compresses before returning to orchestrator
 */
import { CavemanCompressor } from '../autonomy/CavemanCompressor';
import { CavemanBudgetConfig } from './CavemanBudget';
import { CavemanStatsV1 } from './CavemanStats';
export interface WaylandToolOutput {
    tool_id: string;
    ok: boolean;
    data?: any;
    error?: string;
    metadata?: Record<string, any>;
}
export interface WaylandCavemanResponse extends WaylandToolOutput {
    CAVEMAN_STATS: CavemanStatsV1;
}
export declare class WaylandCavemanIntegration {
    private readonly caveman;
    private readonly budget;
    private readonly agentId?;
    private readonly phaseId?;
    constructor(caveman: CavemanCompressor, budgetConfig: CavemanBudgetConfig, options?: {
        agent_id?: string;
        phase_id?: number;
    });
    processToolOutput(toolId: string, output: WaylandToolOutput): Promise<WaylandCavemanResponse>;
    /**
     * Batch process multiple tool outputs
     */
    processBatch(outputs: Array<{
        tool_id: string;
        output: WaylandToolOutput;
    }>): Promise<WaylandCavemanResponse[]>;
    /**
     * Get current budget usage for monitoring
     */
    getBudgetStatus(): Record<string, any>;
}
/**
 * Factory for creating Wayland-integrated Caveman instances
 */
export declare function createWaylandCavemanIntegration(budgetConfig: CavemanBudgetConfig, options?: {
    agent_id?: string;
    phase_id?: number;
}): WaylandCavemanIntegration;
//# sourceMappingURL=WaylandCavemanIntegration.d.ts.map