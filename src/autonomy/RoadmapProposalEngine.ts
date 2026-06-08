/**
 * Roadmap proposal engine for Memory-Driven Autonomy (Phase 23.7)
 * Converts autonomy signals into actionable roadmap proposals
 */

import { AutonomySignal } from './models/AutonomySignal';
import {
  RoadmapProposal,
  ProposalAction,
  ProposalImpact,
  scoreProposalPriority,
  requiresGovernanceApproval,
} from './models/RoadmapProposal';

export interface RoadmapContext {
  currentPhases: PhaseInfo[];
  criticalPathPhases: string[];
  estimatedCompletionDate: Date;
}

export interface PhaseInfo {
  name: string; // 'Phase 24', 'Phase 25.3'
  status: 'pending' | 'in_progress' | 'complete';
  estimatedDuration: number; // hours
  dependencies: string[];
  estimatedStartDate: Date;
  estimatedEndDate: Date;
}

export class RoadmapProposalEngine {
  /**
   * Generate proposals from autonomy signals
   */
  async generateProposals(
    signals: AutonomySignal[],
    context: RoadmapContext
  ): Promise<RoadmapProposal[]> {
    if (signals.length === 0) {
      return [];
    }

    // Group signals by affected phase
    const signalsByPhase = this.groupSignalsByPhase(signals);
    const proposals: RoadmapProposal[] = [];

    for (const [phase, phaseSignals] of Object.entries(signalsByPhase)) {
      const proposal = this.proposalFromSignals(phase, phaseSignals, context);
      if (proposal) {
        proposals.push(proposal);
      }
    }

    return proposals;
  }

  /**
   * Generate a single proposal from grouped signals for a phase
   */
  private proposalFromSignals(
    phase: string,
    signals: AutonomySignal[],
    context: RoadmapContext
  ): RoadmapProposal | null {
    const criticalSignals = signals.filter((s) => s.severity === 'critical');
    const warningSignals = signals.filter((s) => s.severity === 'warning');

    if (signals.length === 0) {
      return null;
    }

    const actions: ProposalAction[] = [];
    let estimatedDurationChange = 0;

    // Determine actions based on signal types
    for (const signal of signals) {
      switch (signal.type) {
        case 'drift':
          actions.push({
            type: 'reprioritize',
            phase,
            description: `Reprioritize ${phase} due to drift. Recommend review of dependencies and goals.`,
            estimatedDurationChange: 4, // 4 hours for review
          });
          estimatedDurationChange += 4;
          break;

        case 'instability':
          actions.push({
            type: 'allocate_resources',
            phase,
            description: `Allocate additional resources to stabilize ${phase}.`,
            resourceRequirements: { engineers: 1, hours_per_week: 20 },
            estimatedDurationChange: -8, // might speed up with more resources
          });
          estimatedDurationChange -= 8;
          break;

        case 'regression':
          // Defer phase if regression is severe
          if (signal.severity === 'critical') {
            const newDate = new Date(context.estimatedCompletionDate);
            newDate.setDate(newDate.getDate() + 3); // defer 3 days

            actions.push({
              type: 'defer_phase',
              phase,
              description: `Defer ${phase} to allow time for regression investigation and fixes.`,
              newTargetDate: newDate.toISOString(),
              estimatedDurationChange: 72, // 3 days
            });
            estimatedDurationChange += 72;
          }
          break;

        case 'opportunity':
          actions.push({
            type: 'accelerate_phase',
            phase,
            description: `Accelerate ${phase} given consistently high success rates.`,
            estimatedDurationChange: -12, // speed up by 12 hours
          });
          estimatedDurationChange -= 12;
          break;
      }
    }

    if (actions.length === 0) {
      return null;
    }

    // Calculate impact
    const impact = this.calculateImpact(phase, actions, context);

    // Determine dependencies that need approval
    const dependencies = this.calculateAffectedDependencies(phase, context);

    // Create proposal
    const proposal: RoadmapProposal = {
      id: `proposal_${phase}_${Date.now()}`,
      timestamp: new Date().toISOString(),
      triggeredBy: signals,
      actions,
      impact: {
        ...impact,
        dependencies,
        rationale: this.generateRationale(signals, phase),
      },
      confidence: this.calculateProposalConfidence(signals),
      status: 'pending',
      metadata: {
        signal_count: signals.length,
        critical_signals: criticalSignals.length,
        warning_signals: warningSignals.length,
      },
    };

    // Check if governance approval is needed
    if (requiresGovernanceApproval(proposal)) {
      proposal.status = 'pending';
      proposal.approvalStatus = {
        requestedAt: new Date().toISOString(),
        votesRequired: 3, // example: 3 council members
        votesReceived: 0,
      };
    }

    return proposal;
  }

  /**
   * Calculate proposal impact on roadmap
   */
  private calculateImpact(
    phase: string,
    actions: ProposalAction[],
    context: RoadmapContext
  ): ProposalImpact {
    const affectedPhases = new Set([phase]);
    let estimatedDurationChange = 0;
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    for (const action of actions) {
      estimatedDurationChange += action.estimatedDurationChange || 0;

      // Risk assessment
      if (action.type === 'defer_phase' || action.type === 'split_phase') {
        riskLevel = 'high';
      } else if (action.type === 'add_phase' || action.type === 'merge_phases') {
        riskLevel = 'medium';
      }
    }

    // Find dependent phases
    const phaseInfo = context.currentPhases.find((p) => p.name === phase);
    const dependencies = phaseInfo?.dependencies || [];

    for (const dep of dependencies) {
      affectedPhases.add(dep);
    }

    return {
      affectedPhases: Array.from(affectedPhases),
      estimatedDurationChange,
      riskLevel,
      dependencies: dependencies,
      rationale: '', // populated separately
    };
  }

  /**
   * Calculate affected dependencies
   */
  private calculateAffectedDependencies(
    phase: string,
    context: RoadmapContext
  ): string[] {
    const phaseInfo = context.currentPhases.find((p) => p.name === phase);
    if (!phaseInfo) {
      return [];
    }

    // Find all phases that depend on this phase
    const dependents = context.currentPhases
      .filter((p) => p.dependencies.includes(phase))
      .map((p) => p.name);

    return dependents;
  }

  /**
   * Generate human-readable rationale
   */
  private generateRationale(signals: AutonomySignal[], phase: string): string {
    const signalTypes = signals.map((s) => s.type).join(', ');
    const avgConfidence =
      signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length;

    return `Proposal triggered by ${signals.length} signal(s) (${signalTypes}) affecting ${phase}. Average confidence: ${(avgConfidence * 100).toFixed(0)}%. Recommendations from signals have been aggregated into proposed actions.`;
  }

  /**
   * Calculate overall proposal confidence
   */
  private calculateProposalConfidence(signals: AutonomySignal[]): number {
    const avgConfidence =
      signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length;
    const criticalCount = signals.filter((s) => s.severity === 'critical').length;

    // Boost confidence if multiple critical signals
    const multiplier = 1 + (criticalCount - 1) * 0.1;

    return Math.min(1.0, avgConfidence * multiplier);
  }

  /**
   * Helper: Group signals by affected phase
   */
  private groupSignalsByPhase(signals: AutonomySignal[]): Record<string, AutonomySignal[]> {
    const grouped: Record<string, AutonomySignal[]> = {};

    for (const signal of signals) {
      for (const phase of signal.affectedPhases) {
        if (!grouped[phase]) {
          grouped[phase] = [];
        }
        grouped[phase].push(signal);
      }
    }

    return grouped;
  }
}
