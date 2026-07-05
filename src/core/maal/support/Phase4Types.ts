import { Result } from './Result';
import { Proposal } from '../codesign/Proposal';
import { CanaryTelemetry } from '../canary/CanaryTelemetry';

export interface ProposalAccepted {
  proposal_id: string;
  received_at: Date;
}

export interface ProposalError {
  code: string;
  message: string;
}

export interface ValidationPassed {
  proposal_id: string;
  validated_at: Date;
}

export interface ValidationError {
  code: string;
  message: string;
}

export interface GovernanceApproved {
  proposal_id: string;
  approved_at: Date;
}

export interface GovernanceRejected {
  code: string;
  message: string;
}

export interface PromotionSuccess {
  proposal_id: string;
  promoted_at: Date;
}

export interface RollbackApplied {
  proposal_id: string;
  rolled_back_at: Date;
}

export interface RollbackError {
  code: string;
  message: string;
}

export interface CanaryError {
  code: string;
  message: string;
}

export interface Phase4Hooks {
  submitProposal(proposal: Proposal): Result<ProposalAccepted, ProposalError>;
  validateProposal(proposal: Proposal): Result<ValidationPassed, ValidationError>;
  governanceReview(proposal: Proposal): Result<GovernanceApproved, GovernanceRejected>;
  executeCanary(proposal: Proposal): Result<CanaryTelemetry, CanaryError>;
  promoteOrRollback(proposal_id: string, telemetry: CanaryTelemetry): Result<PromotionSuccess, RollbackApplied | RollbackError>;
}
