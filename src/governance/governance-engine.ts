import { Proposal } from './proposal-validator';

export interface GovernanceDecision {
  proposal_id: string;
  decision: 'approved' | 'rejected' | 'deferred';
  reason: string;
  reviewed_at: string;
}

export class GovernanceEngine {
  private approvalRate = 0.85; // 85% pass by default

  review(proposal: Proposal): GovernanceDecision {
    const decision =
      Math.random() < this.approvalRate ? 'approved' : 'rejected';

    return {
      proposal_id: proposal.proposal_id,
      decision: decision as 'approved' | 'rejected',
      reason:
        decision === 'approved'
          ? 'Passed governance review'
          : 'Failed cost constraints',
      reviewed_at: new Date().toISOString(),
    };
  }

  setApprovalRate(rate: number): void {
    this.approvalRate = Math.max(0, Math.min(1, rate));
  }
}
