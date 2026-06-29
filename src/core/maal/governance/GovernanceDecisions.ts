/**
 * Phase 4: Governance decisions — approval/rejection tracking.
 */

export interface GovernanceDecision {
  readonly proposalId: string;
  readonly status: 'pending' | 'approved' | 'rejected' | 'expired';
  readonly decidedBy?: string; // approver ID
  readonly decidedAt?: number; // timestamp
  readonly rationale?: string;
  readonly expiresAt?: number; // TTL: 7 days from submission
}

export class GovernanceDecisionLog {
  private decisions: Map<string, GovernanceDecision> = new Map();

  recordDecision(decision: GovernanceDecision): void {
    this.decisions.set(decision.proposalId, decision);
  }

  getDecision(proposalId: string): GovernanceDecision | undefined {
    return this.decisions.get(proposalId);
  }

  isExpired(proposalId: string): boolean {
    const decision = this.decisions.get(proposalId);
    if (!decision || !decision.expiresAt) return false;
    return Date.now() > decision.expiresAt;
  }

  getAllDecisions(): GovernanceDecision[] {
    return Array.from(this.decisions.values());
  }
}
