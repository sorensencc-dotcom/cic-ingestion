/**
 * Autonomy → APR (Planner) Bridge (Phase 23.7.4)
 * Converts autonomy signals into planner goals and triggers replanning
 * Feeds memory-driven autonomy into the autonomous planner (Phase 25)
 */

import { AutonomySignal } from '../models/AutonomySignal.js';
import { RoadmapProposal } from '../models/RoadmapProposal.js';

export interface PlannerGoal {
  id: string;
  type: 'drift_mitigation' | 'stabilization' | 'regression_fix' | 'acceleration';
  description: string;
  priority: number; // 0–100
  targetPhase: string;
  requiredActions: string[];
  deadline?: string; // ISO 8601
  confidence: number;
  source: 'autonomy';
  timestamp: string;
  relatedSignals: string[]; // signal IDs
}

export interface APRPlanRequest {
  goals: PlannerGoal[];
  replan: boolean; // trigger immediate replanning
  context: {
    triggeredBy: 'signal_detection' | 'proposal_approval';
    timestamp: string;
  };
}

export interface PlannerBridgeConfig {
  aprControlPlaneUrl: string;
  replanThresholds: {
    criticalSignalCount: number; // e.g., 2+ critical signals → replan
    totalPriorityScore: number; // e.g., >150 → replan
  };
}

export class AutonomyToPlannerBridge {
  private config: PlannerBridgeConfig;

  constructor(config: PlannerBridgeConfig) {
    this.config = config;
  }

  /**
   * Convert signals to planner goals
   */
  async feedSignalsToPlanner(signals: AutonomySignal[]): Promise<void> {
    if (signals.length === 0) {
      console.log('No signals to feed to planner');
      return;
    }

    // Convert signals → goals
    const goals = this.convertSignalsToGoals(signals);

    // Decide whether to trigger replanning
    const shouldReplan = this.shouldTriggerReplan(signals, goals);

    // Build planner request
    const request: APRPlanRequest = {
      goals,
      replan: shouldReplan,
      context: {
        triggeredBy: 'signal_detection',
        timestamp: new Date().toISOString(),
      },
    };

    // Send to APR control plane
    try {
      await this.sendToPlannerControlPlane(request);
      console.log(
        `[PlannerBridge] Sent ${goals.length} goals to planner${
          shouldReplan ? ' (replan triggered)' : ''
        }`
      );
    } catch (err) {
      console.error('[PlannerBridge] Failed to send goals to planner:', err);
      throw err;
    }
  }

  /**
   * Feed approved proposals back to planner as constraints/updates
   */
  async feedProposalToPlanner(proposal: RoadmapProposal): Promise<void> {
    if (proposal.status !== 'approved') {
      console.log(
        `Proposal ${proposal.id} not approved, not feeding to planner`
      );
      return;
    }

    // Convert proposal actions → planner constraints
    const constraints = this.convertProposalToConstraints(proposal);

    const request = {
      constraints,
      context: {
        triggeredBy: 'proposal_approval',
        proposalId: proposal.id,
        timestamp: new Date().toISOString(),
      },
    };

    try {
      await this.sendConstraintsToPlannerControlPlane(request);
      console.log(
        `[PlannerBridge] Applied constraints from proposal ${proposal.id}`
      );
    } catch (err) {
      console.error('[PlannerBridge] Failed to apply proposal constraints:', err);
      throw err;
    }
  }

  /**
   * Helper: Convert signals to planner goals
   */
  private convertSignalsToGoals(signals: AutonomySignal[]): PlannerGoal[] {
    const goals: PlannerGoal[] = [];

    for (const signal of signals) {
      switch (signal.type) {
        case 'drift':
          goals.push({
            id: `goal_drift_${signal.id}`,
            type: 'drift_mitigation',
            description: `Mitigate drift detected in ${signal.affectedPhases.join(
              ', '
            )}: ${signal.description}`,
            priority: this.signalSeverityToPriority(signal.severity) * signal.confidence,
            targetPhase: signal.affectedPhases[0],
            requiredActions: [
              'review_dependencies',
              'validate_assumptions',
              'update_arps',
            ],
            confidence: signal.confidence,
            source: 'autonomy',
            timestamp: new Date().toISOString(),
            relatedSignals: [signal.id],
          });
          break;

        case 'instability':
          goals.push({
            id: `goal_stability_${signal.id}`,
            type: 'stabilization',
            description: `Stabilize ${signal.affectedPhases.join(
              ', '
            )}: ${signal.description}`,
            priority: this.signalSeverityToPriority(signal.severity) * signal.confidence,
            targetPhase: signal.affectedPhases[0],
            requiredActions: [
              'allocate_resources',
              'increase_testing',
              'monitor_metrics',
            ],
            deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            confidence: signal.confidence,
            source: 'autonomy',
            timestamp: new Date().toISOString(),
            relatedSignals: [signal.id],
          });
          break;

        case 'regression':
          goals.push({
            id: `goal_regression_${signal.id}`,
            type: 'regression_fix',
            description: `Fix regression in ${signal.affectedPhases.join(
              ', '
            )}: ${signal.description}`,
            priority: this.signalSeverityToPriority(signal.severity) * signal.confidence,
            targetPhase: signal.affectedPhases[0],
            requiredActions: [
              'root_cause_analysis',
              'performance_optimization',
              'rollback_if_needed',
            ],
            deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
            confidence: signal.confidence,
            source: 'autonomy',
            timestamp: new Date().toISOString(),
            relatedSignals: [signal.id],
          });
          break;

        case 'opportunity':
          goals.push({
            id: `goal_acceleration_${signal.id}`,
            type: 'acceleration',
            description: `Accelerate ${signal.affectedPhases.join(
              ', '
            )}: ${signal.description}`,
            priority:
              (this.signalSeverityToPriority(signal.severity) * signal.confidence) / 2, // lower priority
            targetPhase: signal.affectedPhases[0],
            requiredActions: [
              'increase_resource_allocation',
              'parallelize_work',
              'optimize_dependencies',
            ],
            confidence: signal.confidence,
            source: 'autonomy',
            timestamp: new Date().toISOString(),
            relatedSignals: [signal.id],
          });
          break;
      }
    }

    return goals;
  }

  /**
   * Helper: Determine if signals warrant replanning
   */
  private shouldTriggerReplan(
    signals: AutonomySignal[],
    goals: PlannerGoal[]
  ): boolean {
    // Count critical signals
    const criticalCount = signals.filter(
      (s) => s.severity === 'critical'
    ).length;

    if (criticalCount >= this.config.replanThresholds.criticalSignalCount) {
      return true;
    }

    // Sum priority scores
    const totalPriority = goals.reduce((sum, g) => sum + g.priority, 0);

    if (totalPriority >= this.config.replanThresholds.totalPriorityScore) {
      return true;
    }

    return false;
  }

  /**
   * Helper: Convert proposal actions to planner constraints
   */
  private convertProposalToConstraints(
    proposal: RoadmapProposal
  ): Record<string, any> {
    const constraints: Record<string, any> = {
      proposalId: proposal.id,
      phaseConstraints: {},
      dependencies: [],
    };

    for (const action of proposal.actions) {
      switch (action.type) {
        case 'defer_phase':
          constraints.phaseConstraints[action.phase] = {
            type: 'defer',
            targetDate: action.newTargetDate,
            reason: action.description,
          };
          break;

        case 'accelerate_phase':
          constraints.phaseConstraints[action.phase] = {
            type: 'accelerate',
            reason: action.description,
          };
          break;

        case 'reprioritize':
          constraints.phaseConstraints[action.phase] = {
            type: 'reprioritize',
            newPosition: action.newPosition,
            reason: action.description,
          };
          break;

        case 'allocate_resources':
          constraints.phaseConstraints[action.phase] = {
            type: 'allocate_resources',
            resources: action.resourceRequirements,
            reason: action.description,
          };
          break;

        case 'add_phase':
          constraints.newPhase = {
            phase: action.phase,
            insertAfter: action.phase,
            reason: action.description,
          };
          break;

        case 'merge_phases':
          constraints.mergePhases = {
            target: action.phase,
            source: action.targetPhase,
            reason: action.description,
          };
          break;
      }
    }

    return constraints;
  }

  /**
   * Helper: Map signal severity to priority score
   */
  private signalSeverityToPriority(severity: string): number {
    switch (severity) {
      case 'critical':
        return 100;
      case 'warning':
        return 60;
      case 'info':
        return 30;
      default:
        return 0;
    }
  }

  /**
   * Send goals to APR control plane
   */
  private async sendToPlannerControlPlane(request: APRPlanRequest): Promise<void> {
    const url = `${this.config.aprControlPlaneUrl}/apr/goals`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(
        `APR returned ${response.status}: ${response.statusText}`
      );
    }
  }

  /**
   * Send proposal constraints to APR control plane
   */
  private async sendConstraintsToPlannerControlPlane(
    request: any
  ): Promise<void> {
    const url = `${this.config.aprControlPlaneUrl}/apr/constraints`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(
        `APR returned ${response.status}: ${response.statusText}`
      );
    }
  }
}

