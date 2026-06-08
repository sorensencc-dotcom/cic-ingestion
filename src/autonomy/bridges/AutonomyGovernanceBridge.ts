/**
 * Autonomy → Governance (Council) Bridge (Phase 23.7.5)
 * Routes proposals to Phase 24 Council for voting
 * Integrates memory-driven autonomy with governance (Phase 24)
 */

import { RoadmapProposal } from '../models/RoadmapProposal';
import { requiresGovernanceApproval, scoreProposalPriority } from '../models/RoadmapProposal';

export interface GovernanceVoteRequest {
  proposalId: string;
  title: string;
  description: string;
  rationale: string;
  riskLevel: 'low' | 'medium' | 'high';
  affectedPhases: string[];
  requiredApprovals: number;
  votingDeadline: string; // ISO 8601
  metadata: Record<string, any>;
}

export interface CouncilVote {
  proposalId: string;
  voterId: string; // council member ID
  decision: 'approve' | 'reject' | 'abstain';
  reason?: string;
  timestamp: string; // ISO 8601
}

export interface GovernanceDecision {
  proposalId: string;
  status: 'approved' | 'rejected';
  approvalCount: number;
  rejectionCount: number;
  abstainCount: number;
  votes: CouncilVote[];
  decidedAt: string; // ISO 8601
  rationale: string;
}

export interface GovernanceBridgeConfig {
  governanceControlPlaneUrl: string;
  councilSize: number; // total council members
  approvalThreshold: number; // percentage (e.g., 66 for 2/3 majority)
  autoApproveThreshold: number; // confidence threshold for auto-approval (e.g., 0.95)
}

export class AutonomyGovernanceBridge {
  private config: GovernanceBridgeConfig;

  constructor(config: GovernanceBridgeConfig) {
    this.config = config;
  }

  /**
   * Route proposal to governance if it requires approval
   */
  async routeProposalToGovernance(proposal: RoadmapProposal): Promise<void> {
    // Check if approval is needed
    if (!requiresGovernanceApproval(proposal)) {
      console.log(
        `[GovernanceBridge] Proposal ${proposal.id} does not require approval`
      );
      return;
    }

    // Check for auto-approval (high confidence + low risk)
    if (this.shouldAutoApprove(proposal)) {
      await this.autoApproveProposal(proposal);
      return;
    }

    // Build governance vote request
    const voteRequest = this.buildVoteRequest(proposal);

    try {
      await this.submitToGovernance(voteRequest);
      console.log(
        `[GovernanceBridge] Routed proposal ${proposal.id} to Council for voting`
      );
    } catch (err) {
      console.error('[GovernanceBridge] Failed to route to governance:', err);
      throw err;
    }
  }

  /**
   * Record council vote
   */
  async recordVote(
    proposalId: string,
    voterId: string,
    decision: 'approve' | 'reject' | 'abstain',
    reason?: string
  ): Promise<void> {
    const vote: CouncilVote = {
      proposalId,
      voterId,
      decision,
      reason,
      timestamp: new Date().toISOString(),
    };

    try {
      await this.submitVote(vote);
      console.log(
        `[GovernanceBridge] Recorded vote from ${voterId} on proposal ${proposalId}: ${decision}`
      );
    } catch (err) {
      console.error('[GovernanceBridge] Failed to record vote:', err);
      throw err;
    }
  }

  /**
   * Finalize governance decision
   */
  async finalizeDecision(proposal: RoadmapProposal, votes: CouncilVote[]): Promise<GovernanceDecision> {
    const approvals = votes.filter((v) => v.decision === 'approve').length;
    const rejections = votes.filter((v) => v.decision === 'reject').length;
    const abstains = votes.filter((v) => v.decision === 'abstain').length;

    // Calculate approval percentage (excluding abstains from denominator)
    const votingCount = approvals + rejections;
    const approvalPercentage =
      votingCount > 0 ? (approvals / votingCount) * 100 : 0;

    // Decide
    const approved =
      approvalPercentage >= this.config.approvalThreshold &&
      approvals >= Math.ceil(this.config.councilSize / 2);

    const decision: GovernanceDecision = {
      proposalId: proposal.id,
      status: approved ? 'approved' : 'rejected',
      approvalCount: approvals,
      rejectionCount: rejections,
      abstainCount: abstains,
      votes,
      decidedAt: new Date().toISOString(),
      rationale: `Council vote: ${approvals}/${votingCount} in favor (${approvalPercentage.toFixed(1)}%), threshold=${this.config.approvalThreshold}%`,
    };

    try {
      await this.recordDecision(decision);
      console.log(
        `[GovernanceBridge] Finalized proposal ${proposal.id}: ${decision.status}`
      );
    } catch (err) {
      console.error('[GovernanceBridge] Failed to record decision:', err);
      throw err;
    }

    return decision;
  }

  /**
   * Helper: Check if proposal should be auto-approved
   */
  private shouldAutoApprove(proposal: RoadmapProposal): boolean {
    // Auto-approve if:
    // 1. Confidence is very high (>95%)
    // 2. Risk is low
    // 3. No triggering signals are critical

    if (proposal.confidence < this.config.autoApproveThreshold) {
      return false;
    }

    if (proposal.impact.riskLevel !== 'low') {
      return false;
    }

    const hasCritical = proposal.triggeredBy.some((s) => s.severity === 'critical');
    if (hasCritical) {
      return false; // critical signals should go to council
    }

    return true;
  }

  /**
   * Helper: Auto-approve proposal (bypass council)
   */
  private async autoApproveProposal(proposal: RoadmapProposal): Promise<void> {
    const decision: GovernanceDecision = {
      proposalId: proposal.id,
      status: 'approved',
      approvalCount: this.config.councilSize,
      rejectionCount: 0,
      abstainCount: 0,
      votes: [],
      decidedAt: new Date().toISOString(),
      rationale: `Auto-approved: confidence=${(proposal.confidence * 100).toFixed(1)}%, risk=low`,
    };

    try {
      await this.recordDecision(decision);
      console.log(
        `[GovernanceBridge] Auto-approved proposal ${proposal.id} (no council vote needed)`
      );
    } catch (err) {
      console.error('[GovernanceBridge] Failed to auto-approve:', err);
      throw err;
    }
  }

  /**
   * Helper: Build governance vote request
   */
  private buildVoteRequest(proposal: RoadmapProposal): GovernanceVoteRequest {
    const priority = scoreProposalPriority(proposal);
    const votingDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    return {
      proposalId: proposal.id,
      title: `Roadmap Proposal: ${proposal.actions.map((a) => a.type).join(', ')}`,
      description: proposal.impact.rationale,
      rationale: `Proposal generated from ${proposal.triggeredBy.length} signal(s): ${proposal.triggeredBy
        .map((s) => `${s.type} (${s.severity})`)
        .join(', ')}`,
      riskLevel: proposal.impact.riskLevel,
      affectedPhases: proposal.impact.affectedPhases,
      requiredApprovals: Math.ceil((this.config.councilSize * this.config.approvalThreshold) / 100),
      votingDeadline: votingDeadline.toISOString(),
      metadata: {
        priority,
        confidence: proposal.confidence,
        durationChange: proposal.impact.estimatedDurationChange,
        triggeredBySignals: proposal.triggeredBy.map((s) => ({
          id: s.id,
          type: s.type,
          severity: s.severity,
        })),
        proposedActions: proposal.actions.map((a) => ({
          type: a.type,
          phase: a.phase,
          description: a.description,
        })),
      },
    };
  }

  /**
   * Submit vote request to governance control plane
   */
  private async submitToGovernance(request: GovernanceVoteRequest): Promise<void> {
    const url = `${this.config.governanceControlPlaneUrl}/governance/votes`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(
        `Governance returned ${response.status}: ${response.statusText}`
      );
    }
  }

  /**
   * Submit individual vote
   */
  private async submitVote(vote: CouncilVote): Promise<void> {
    const url = `${this.config.governanceControlPlaneUrl}/governance/votes/${vote.proposalId}/vote`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vote),
    });

    if (!response.ok) {
      throw new Error(
        `Governance returned ${response.status}: ${response.statusText}`
      );
    }
  }

  /**
   * Record finalized decision
   */
  private async recordDecision(decision: GovernanceDecision): Promise<void> {
    const url = `${this.config.governanceControlPlaneUrl}/governance/decisions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(decision),
    });

    if (!response.ok) {
      throw new Error(
        `Governance returned ${response.status}: ${response.statusText}`
      );
    }
  }
}
