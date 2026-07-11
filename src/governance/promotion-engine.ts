import { Proposal } from './proposal-validator';
import { CanaryMetrics } from './canary-engine';

export interface PromotionDecision {
  proposal_id: string;
  decision: 'promoted' | 'rolled_back' | 'held';
  reason: string;
  executed_at: string;
}

export class PromotionEngine {
  promote(
    proposal: Proposal,
    canaryMetrics: CanaryMetrics
  ): PromotionDecision {
    let decision: 'promoted' | 'rolled_back' | 'held' = 'held';
    let reason = '';

    if (canaryMetrics.decision === 'promote') {
      decision = 'promoted';
      reason = 'Canary metrics passed threshold';
    } else if (canaryMetrics.error_rate > 0.05) {
      decision = 'rolled_back';
      reason = 'Error rate exceeded threshold';
    } else {
      decision = 'held';
      reason = 'Awaiting next canary observation';
    }

    return {
      proposal_id: proposal.proposal_id,
      decision,
      reason,
      executed_at: new Date().toISOString(),
    };
  }
}
