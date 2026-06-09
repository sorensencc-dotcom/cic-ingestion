/**
 * Bridge Orchestrator (Phase 23.7.4–23.7.5)
 * Coordinates signal detection → governance routing → planner feedback → ARPS logging
 * Single integration point for autonomy → rest of CIC
 */
import { AutonomyToPlannerBridge } from './AutonomyToPlannerBridge';
import { AutonomyToARPSBridge } from './AutonomyToARPSBridge';
import { AutonomyGovernanceBridge } from './AutonomyGovernanceBridge';
export class BridgeOrchestrator {
    constructor(config) {
        this.plannerBridge = new AutonomyToPlannerBridge({
            aprControlPlaneUrl: config.aprControlPlaneUrl,
            replanThresholds: config.replanThresholds,
        });
        this.arpsBridge = new AutonomyToARPSBridge({
            memoryStoreUrl: config.memoryStoreUrl,
        });
        this.governanceBridge = new AutonomyGovernanceBridge({
            governanceControlPlaneUrl: config.governanceControlPlaneUrl,
            councilSize: config.councilSize,
            approvalThreshold: config.approvalThreshold,
            autoApproveThreshold: config.autoApproveThreshold,
        });
    }
    /**
     * Process detected signals through all bridges
     * Flow: signals → planner goals + ARPS logging
     */
    async processSignals(signals) {
        const result = {
            signalsProcessed: signals.length,
            proposalsGenerated: 0,
            proposalsRouted: 0,
            proposalsApproved: 0,
            errors: [],
            timestamp: new Date().toISOString(),
        };
        // Feed to planner (may trigger replanning)
        try {
            await this.plannerBridge.feedSignalsToPlanner(signals);
        }
        catch (err) {
            result.errors.push({
                bridge: 'planner',
                error: err instanceof Error ? err.message : 'Unknown error',
            });
        }
        // Log each signal to ARPS
        for (const signal of signals) {
            try {
                await this.arpsBridge.logSignalToARPS(signal);
            }
            catch (err) {
                result.errors.push({
                    bridge: 'arps',
                    error: err instanceof Error ? err.message : 'Unknown error',
                });
            }
        }
        return result;
    }
    /**
     * Process generated proposals through all bridges
     * Flow: proposals → governance routing + planner constraints + ARPS logging
     */
    async processProposals(proposals) {
        const result = {
            signalsProcessed: 0,
            proposalsGenerated: proposals.length,
            proposalsRouted: 0,
            proposalsApproved: 0,
            errors: [],
            timestamp: new Date().toISOString(),
        };
        for (const proposal of proposals) {
            // Route to governance if needed
            try {
                await this.governanceBridge.routeProposalToGovernance(proposal);
                result.proposalsRouted++;
            }
            catch (err) {
                result.errors.push({
                    bridge: 'governance',
                    error: err instanceof Error ? err.message : 'Unknown error',
                });
            }
            // Log to ARPS
            try {
                await this.arpsBridge.logProposalToARPS(proposal);
            }
            catch (err) {
                result.errors.push({
                    bridge: 'arps',
                    error: err instanceof Error ? err.message : 'Unknown error',
                });
            }
            // Feed to planner (as constraints)
            if (proposal.status === 'approved') {
                try {
                    await this.plannerBridge.feedProposalToPlanner(proposal);
                    result.proposalsApproved++;
                }
                catch (err) {
                    result.errors.push({
                        bridge: 'planner',
                        error: err instanceof Error ? err.message : 'Unknown error',
                    });
                }
            }
        }
        return result;
    }
    /**
     * Process governance decision feedback
     * Flow: decision → update ARPS + learn
     */
    async processGovernanceDecision(proposal, decision, reason) {
        // Log decision to ARPS
        try {
            await this.arpsBridge.logProposalFeedbackToARPS(proposal, decision, reason);
        }
        catch (err) {
            console.error('[BridgeOrchestrator] Failed to log governance feedback:', err);
            throw err;
        }
        // If approved, feed to planner
        if (decision === 'approved') {
            try {
                await this.plannerBridge.feedProposalToPlanner(proposal);
            }
            catch (err) {
                console.error('[BridgeOrchestrator] Failed to feed approved proposal to planner:', err);
                throw err;
            }
        }
        // TODO: Feed decision back to autonomy learner for threshold tuning
    }
    /**
     * Full autonomy cycle: detect → propose → route → feedback
     */
    async runFullIntegrationCycle(signals, proposals) {
        console.log('[BridgeOrchestrator] Starting full integration cycle');
        const signalResult = await this.processSignals(signals);
        const proposalResult = await this.processProposals(proposals);
        const combinedResult = {
            signalsProcessed: signalResult.signalsProcessed,
            proposalsGenerated: proposalResult.proposalsGenerated,
            proposalsRouted: proposalResult.proposalsRouted,
            proposalsApproved: proposalResult.proposalsApproved,
            errors: [...signalResult.errors, ...proposalResult.errors],
            timestamp: new Date().toISOString(),
        };
        console.log('[BridgeOrchestrator] Full cycle complete:', {
            signals: combinedResult.signalsProcessed,
            proposals: combinedResult.proposalsGenerated,
            routed: combinedResult.proposalsRouted,
            approved: combinedResult.proposalsApproved,
            errors: combinedResult.errors.length,
        });
        return combinedResult;
    }
    /**
     * Get bridge instances (for direct access if needed)
     */
    getPlanner() {
        return this.plannerBridge;
    }
    getARPS() {
        return this.arpsBridge;
    }
    getGovernance() {
        return this.governanceBridge;
    }
}
//# sourceMappingURL=BridgeOrchestrator.js.map