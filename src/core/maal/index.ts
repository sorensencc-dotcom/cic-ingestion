/**
 * Phase 4: MAAL Co-Design + Canary-Gated Evolution
 * Public API exports.
 */

// Support
import { Result, Ok, Err } from './support/Result';
import { ValidationResult, ValidationError, ValidationWarning, ValidationResultBuilder } from './support/ValidationResult';
import { ImmutabilityGuard, ImmutabilityCheckpoint } from './support/ImmutabilityGuard';

// Codesign
import {
  RegimeDelta,
  ConstraintDelta,
  FallbackDelta,
  RewardDelta,
  SimulatorDelta,
  ProposalDelta,
  Proposal,
  ProposalMetadata,
} from './codesign/ProposalTypes';
import { ProposalBuilder } from './codesign/Proposal';
import { GLOBAL_ROUTING_BOUNDS, GlobalRoutingBounds } from './codesign/GlobalRoutingBounds';
import { ProposalParser, ProposalParseError } from './codesign/ProposalParser';
import { ProposalValidationEngine } from './codesign/ProposalValidationEngine';
import { ProposalValidationEngineImpl } from './codesign/ProposalValidationEngineImpl';

// Governance
import { GovernanceDecision, GovernanceDecisionLog } from './governance/GovernanceDecisions';
import { GovernanceCaps, MetricThresholds, DEFAULT_GOVERNANCE_CAPS, DEFAULT_METRIC_THRESHOLDS } from './governance/GovernanceCaps';
import { GovernanceReview, GovernanceReviewRequest, GovernanceReviewError } from './governance/GovernanceReview';

// Canary
import { CanaryGrowthConfig, CanaryGrowthConfigStore } from './canary/CanaryGrowthConfig';
import { CanaryAssignment, CanaryAssignmentEngine } from './canary/CanaryAssignment';
import { CanaryCohortController, CohortMetrics } from './canary/CanaryCohortController';
import { CanaryTelemetryPoint, CanaryTelemetryCollector } from './canary/CanaryTelemetry';
import { CanaryError, CANARY_ERRORS } from './canary/CanaryError';
import { CanaryGateOrchestrator, CanaryGateOrchestrationResult, CanaryGateOrchestrationError } from './canary/CanaryGateOrchestrator';

// Integration
import {
  BridgeOrchestrator,
  SubmitProposalError,
  ValidateProposalError,
  GovernanceReviewError as BridgeGovernanceReviewError,
  ExecuteCanaryError,
  PromoteOrRollbackError,
  PromotionDecision,
} from './BridgeOrchestrator';

export type {
  Result,
  RegimeDelta,
  ConstraintDelta,
  FallbackDelta,
  RewardDelta,
  SimulatorDelta,
  ProposalDelta,
  Proposal,
  ProposalMetadata,
  GlobalRoutingBounds,
  ProposalParseError,
  GovernanceDecision,
  GovernanceDecisionLog,
  GovernanceCaps,
  MetricThresholds,
  GovernanceReviewRequest,
  GovernanceReviewError,
  CanaryGrowthConfig,
  CanaryGrowthConfigStore,
  CanaryAssignment,
  CohortMetrics,
  CanaryTelemetryPoint,
  CanaryGateOrchestrationResult,
  CanaryGateOrchestrationError,
  SubmitProposalError,
  ValidateProposalError,
  ExecuteCanaryError,
  PromoteOrRollbackError,
  PromotionDecision,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ImmutabilityGuard,
  ImmutabilityCheckpoint,
  ProposalValidationEngine,
  CanaryError,
};

export {
  Ok,
  Err,
  ValidationResultBuilder,
  ProposalBuilder,
  GLOBAL_ROUTING_BOUNDS,
  ProposalParser,
  ProposalValidationEngineImpl,
  DEFAULT_GOVERNANCE_CAPS,
  DEFAULT_METRIC_THRESHOLDS,
  GovernanceReview,
  CanaryAssignmentEngine,
  CanaryCohortController,
  CanaryTelemetryCollector,
  CANARY_ERRORS,
  CanaryGateOrchestrator,
  BridgeOrchestrator,
};
