/**
 * Wayland Caveman Integration
 * Post-processor for all Wayland tool outputs
 * Compresses before returning to orchestrator
 */
import { CavemanCompressor } from '../autonomy/CavemanCompressor.js';
import { CavemanBudget } from './CavemanBudget.js';
import { createCavemanStats, logCavemanStats } from './CavemanStats.js';
export class WaylandCavemanIntegration {
    constructor(caveman, budgetConfig, options) {
        this.caveman = caveman;
        this.budget = new CavemanBudget(budgetConfig);
        this.agentId = options?.agent_id;
        this.phaseId = options?.phase_id;
    }
    async processToolOutput(toolId, output) {
        // Check budget
        const shouldCompress = this.budget.shouldCompress({
            tool_id: toolId,
            agent_id: this.agentId,
            phase_id: this.phaseId,
        });
        if (!shouldCompress) {
            // Budget exhausted, return raw with zero stats
            const stats = createCavemanStats(0, 0, {
                pipeline_stage: 'wayland.tool',
                tool_id: toolId,
                agent_id: this.agentId,
                phase_id: this.phaseId,
                recompression_blocked: true,
            });
            return {
                ...output,
                CAVEMAN_STATS: stats,
            };
        }
        try {
            // Measure compression
            let originalJson;
            try {
                originalJson = JSON.stringify(output);
            }
            catch (err) {
                console.error(`[Wayland] JSON.stringify failed for tool ${toolId}:`, err);
                return {
                    ...output,
                    CAVEMAN_STATS: createCavemanStats(0, 0, {
                        pipeline_stage: 'wayland.tool',
                        tool_id: toolId,
                        agent_id: this.agentId,
                        phase_id: this.phaseId,
                        compression_error: 'stringify_failed',
                    }),
                };
            }
            const bytesIn = originalJson.length;
            // Compress data payload if present
            let compressedData = output.data;
            if (output.ok && output.data) {
                const result = this.caveman.compress(output.data);
                compressedData = result.data;
            }
            // Build compressed response
            const response = {
                tool_id: output.tool_id,
                ok: output.ok,
                data: compressedData,
                error: output.error,
                metadata: output.metadata,
                CAVEMAN_STATS: createCavemanStats(bytesIn, 0, {
                    pipeline_stage: 'wayland.tool',
                    tool_id: toolId,
                    agent_id: this.agentId,
                    phase_id: this.phaseId,
                }),
            };
            // Recalculate stats with compressed size
            let compressedJson;
            try {
                compressedJson = JSON.stringify(response);
            }
            catch (err) {
                console.error(`[Wayland] JSON.stringify failed for compressed response ${toolId}:`, err);
                compressedJson = originalJson;
            }
            const bytesOut = compressedJson.length;
            response.CAVEMAN_STATS = createCavemanStats(bytesIn, bytesOut, {
                pipeline_stage: 'wayland.tool',
                tool_id: toolId,
                agent_id: this.agentId,
                phase_id: this.phaseId,
            });
            // Record against budget
            this.budget.record(response.CAVEMAN_STATS);
            // Log
            logCavemanStats(`wayland:${toolId}`, response.CAVEMAN_STATS);
            return response;
        }
        catch (err) {
            console.error(`[Wayland] processToolOutput error for tool ${toolId}:`, err);
            throw err;
        }
    }
    /**
     * Batch process multiple tool outputs
     */
    async processBatch(outputs) {
        try {
            return await Promise.all(outputs.map(({ tool_id, output }) => this.processToolOutput(tool_id, output)));
        }
        catch (err) {
            console.error('[Wayland] Batch processing error:', err);
            throw err;
        }
    }
    /**
     * Get current budget usage for monitoring
     */
    getBudgetStatus() {
        const keys = [
            `tool:shell`,
            `tool:http`,
            `tool:model`,
            `tool:file`,
            `phase:${this.phaseId}`,
            `agent:${this.agentId}`,
        ];
        const status = {};
        for (const key of keys) {
            const usage = this.budget.getUsage(key);
            if (usage) {
                status[key] = {
                    bytes_saved: usage.bytesSaved,
                    window_start: usage.windowStart,
                    window_age_ms: Date.now() - usage.windowStart,
                };
            }
        }
        return status;
    }
}
/**
 * Factory for creating Wayland-integrated Caveman instances
 */
export function createWaylandCavemanIntegration(budgetConfig, options) {
    const caveman = new CavemanCompressor();
    return new WaylandCavemanIntegration(caveman, budgetConfig, options);
}
//# sourceMappingURL=WaylandCavemanIntegration.js.map
