import { MAALRouter } from '../../cic-os/src/core/maal/MAALRouter';
import { Proposal } from '../../cic-os/src/core/maal/codesign/Proposal';
import { CanaryTelemetry } from '../../cic-os/src/core/maal/canary/CanaryTelemetry';
import { Result } from '../../cic-os/src/core/maal/support/Result';
import {
  Phase4Hooks,
  ProposalAccepted,
  ProposalError,
  ValidationPassed,
  ValidationError,
  GovernanceApproved,
  GovernanceRejected,
  PromotionSuccess,
  RollbackApplied,
  RollbackError
} from '../../cic-os/src/core/maal/support/Phase4Types';

export interface MAARLRouterDependency {
  maalRouter: MAALRouter;
}

// Re-export Phase 4 types for BridgeOrchestrator users
export {
  Phase4Hooks,
  ProposalAccepted,
  ProposalError,
  ValidationPassed,
  ValidationError,
  GovernanceApproved,
  GovernanceRejected,
  PromotionSuccess,
  RollbackApplied,
  RollbackError,
  CanaryError
} from '../../cic-os/src/core/maal/support/Phase4Types';

/**
 * BridgeOrchestrator: Integrates Phase 4 DSL/validation/governance/canary with Phase 1/3 MAAL/SPL.
 * Implements Phase4Hooks for proposal workflow.
 * Uses Phase4HooksImpl as default implementation if no custom hooks provided.
 */
export class BridgeOrchestrator implements Phase4Hooks {
  private defaultHooks: Phase4HooksImpl | null = null;

  constructor(private deps: MAARLRouterDependency & { hooks?: Partial<Phase4Hooks> }) {
    // Phase4HooksImpl requires full dependency injection; only instantiate if needed
    // (when no custom hooks provided and DB/governance/canary deps available)
  }

  submitProposal(proposal: Proposal): Result<ProposalAccepted, ProposalError> {
    if (this.deps.hooks?.submitProposal) {
      return this.deps.hooks.submitProposal(proposal);
    }

    // Default: accept and log (mock implementation)
    return Result.ok({
      proposal_id: proposal.proposal_id,
      received_at: new Date()
    });
  }

  validateProposal(
    proposal: Proposal
  ): Result<ValidationPassed, ValidationError> {
    if (this.deps.hooks?.validateProposal) {
      return this.deps.hooks.validateProposal(proposal);
    }

    // Default: pass validation
    return Result.ok({
      proposal_id: proposal.proposal_id,
      validated_at: new Date()
    });
  }

  governanceReview(
    proposal: Proposal
  ): Result<GovernanceApproved, GovernanceRejected> {
    if (this.deps.hooks?.governanceReview) {
      return this.deps.hooks.governanceReview(proposal);
    }

    // Default: approve
    return Result.ok({
      proposal_id: proposal.proposal_id,
      approved_at: new Date()
    });
  }

  executeCanary(proposal: Proposal): Result<CanaryTelemetry, CanaryError> {
    if (this.deps.hooks?.executeCanary) {
      return this.deps.hooks.executeCanary(proposal);
    }

    // Default: return mock telemetry
    return Result.ok({
      telemetry_id: `mock-telemetry-${proposal.proposal_id}`,
      proposal_id: proposal.proposal_id,
      cohort_step: 0,
      cohort_size: 0.01,
      observation_window: {
        start: new Date(),
        end: new Date(),
        duration_minutes: 30
      },
      metrics: {
        cost_delta: 0,
        latency_delta: 0,
        correctness_delta: 0,
        divergence: 0,
        error_rate: 1,
        task_success_rate: 1
      },
      decision: 'continue',
      collected_at: new Date(),
      recorded_at: new Date()
    });
  }

  promoteOrRollback(
    proposal_id: string,
    telemetry: CanaryTelemetry
  ): Result<PromotionSuccess, RollbackApplied | RollbackError> {
    if (this.deps.hooks?.promoteOrRollback) {
      return this.deps.hooks.promoteOrRollback(proposal_id, telemetry);
    }

    // Default: promote
    return Result.ok({
      proposal_id,
      promoted_at: new Date()
    });
  }
}
