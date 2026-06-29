/**
 * Phase 4: MAAL Co-Design + Canary-Gated Evolution
 * Public API exports.
 */

// Support
export { Result, Ok, Err } from './support/Result';
export { ValidationResult, ValidationError, ValidationWarning, ValidationResultBuilder } from './support/ValidationResult';
export { ImmutabilityGuard, ImmutabilityCheckpoint } from './support/ImmutabilityGuard';

// Codesign
export {
  RegimeDelta,
  ConstraintDelta,
  FallbackDelta,
  RewardDelta,
  SimulatorDelta,
  ProposalDelta,
  Proposal,
  ProposalMetadata,
} from './codesign/ProposalTypes';
export { ProposalBuilder } from './codesign/Proposal';
export { GLOBAL_ROUTING_BOUNDS, GlobalRoutingBounds } from './codesign/GlobalRoutingBounds';
export { ProposalParser, ProposalParseError } from './codesign/ProposalParser';
export { ProposalValidationEngine } from './codesign/ProposalValidationEngine';
export { ProposalValidationEngineImpl } from './codesign/ProposalValidationEngineImpl';

// Governance
export { GovernanceDecision, GovernanceDecisionLog } from './governance/GovernanceDecisions';
export { GovernanceCaps, MetricThresholds, DEFAULT_GOVERNANCE_CAPS, DEFAULT_METRIC_THRESHOLDS } from './governance/GovernanceCaps';
export { GovernanceReview, GovernanceReviewRequest, GovernanceReviewError } from './governance/GovernanceReview';

// Canary
export { CanaryGrowthConfig, CanaryGrowthConfigStore } from './canary/CanaryGrowthConfig';
export { CanaryAssignment, CanaryAssignmentEngine } from './canary/CanaryAssignment';
export { CanaryCohortController, CohortMetrics } from './canary/CanaryCohortController';
export { CanaryTelemetryPoint, CanaryTelemetryCollector } from './canary/CanaryTelemetry';
export { CanaryError, CANARY_ERRORS } from './canary/CanaryError';
export { CanaryGateOrchestrator, CanaryGateOrchestrationResult, CanaryGateOrchestrationError } from './canary/CanaryGateOrchestrator';

// Integration
export {
  BridgeOrchestrator,
  SubmitProposalError,
  ValidateProposalError,
  GovernanceReviewError,
  ExecuteCanaryError,
  PromoteOrRollbackError,
  GovernanceDecision,
  PromotionDecision,
} from './BridgeOrchestrator';
