/**
 * Roadmap proposal types and data models (Phase 23.7)
 * Proposals generated from autonomy signals to adjust CIC roadmap
 */

import { AutonomySignal } from './AutonomySignal.js';

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'executed';

export type ProposalActionType =
  | 'reprioritize'
  | 'allocate_resources'
  | 'add_phase'
  | 'defer_phase'
  | 'accelerate_phase'
  | 'split_phase'
  | 'merge_phases';

export interface ProposalAction {
  type: ProposalActionType;
  phase: string; // e.g., 'Phase 24', 'Phase 25.3'
  description: string;
  estimatedDurationChange?: number; // hours
  resourceRequirements?: Record<string, number>;
  newPosition?: number; // for reprioritize
  newTargetDate?: string; // ISO 8601, for defer/accelerate
  targetPhase?: string; // for merge
}

export interface ProposalImpact {
  affectedPhases: string[];
  estimatedDurationChange: number; // hours
  riskLevel: 'low' | 'medium' | 'high';
  dependencies: string[]; // phases that depend on affected phases
  rationale: string;
}

export interface RoadmapProposal {
  id: string;
  timestamp: string; // ISO 8601
  triggeredBy: AutonomySignal[]; // supporting signals
  actions: ProposalAction[];
  impact: ProposalImpact;
  confidence: number; // 0.0–1.0
  status: ProposalStatus;
  approvalStatus?: {
    requestedAt: string;
    votesRequired: number;
    votesReceived: number;
    councilVotes?: VoteRecord[];
  };
  rejectionReason?: string;
  executedAt?: string; // ISO 8601
  metadata: Record<string, any>;
}

export interface VoteRecord {
  voterId: string; // council member ID
  decision: 'approve' | 'reject' | 'abstain';
  reason?: string;
  timestamp: string; // ISO 8601
}

export interface SimulationResult {
  proposalId: string;
  simulationType: string; // 'what_if', 'rollback', etc.
  outcomes: {
    phaseDurations: Record<string, number>; // phase -> duration in hours
    riskScore: number; // 0.0–1.0
    estimatedCompletion: string; // ISO 8601
    criticalPath: string[]; // phases on critical path
  };
  confidence: number;
}

/**
 * Proposal priority scoring based on signals and impact
 */
export function scoreProposalPriority(proposal: RoadmapProposal): number {
  let score = 0;

  // Signal severity contributes to priority
  for (const signal of proposal.triggeredBy) {
    switch (signal.severity) {
      case 'critical':
        score += 10;
        break;
      case 'warning':
        score += 5;
        break;
      case 'info':
        score += 1;
        break;
    }
    score *= signal.confidence;
  }

  // Risk level affects priority
  switch (proposal.impact.riskLevel) {
    case 'low':
      score *= 1.2;
      break;
    case 'medium':
      score *= 1.0;
      break;
    case 'high':
      score *= 0.8;
      break;
  }

  return Math.min(score, 100); // Cap at 100
}

/**
 * Check if proposal requires governance approval
 */
export function requiresGovernanceApproval(proposal: RoadmapProposal): boolean {
  const priority = scoreProposalPriority(proposal);

  // High-risk or high-priority proposals need approval
  return (
    proposal.impact.riskLevel === 'high' ||
    priority > 50 ||
    proposal.triggeredBy.some((sig) => sig.severity === 'critical')
  );
}

/**
 * Estimate roadmap completion date after proposal execution
 */
export function estimateCompletionAfterProposal(
  baseCompletionDate: Date,
  proposal: RoadmapProposal
): Date {
  const durationChangeMs = proposal.impact.estimatedDurationChange * 3600000; // hours to ms
  return new Date(baseCompletionDate.getTime() + durationChangeMs);
}

