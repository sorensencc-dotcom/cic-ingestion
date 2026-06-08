/**
 * Autonomy → ARPS (Roadmap State) Bridge (Phase 23.7.4)
 * Logs proposals as ARPS_DELTA events
 * Feeds memory-driven autonomy back into the roadmap state (Phase 22)
 */

import { RoadmapProposal } from '../models/RoadmapProposal';
import { AutonomySignal } from '../models/AutonomySignal';

export interface ARPSDelta {
  id: string;
  type: 'autonomy_proposal' | 'autonomy_signal' | 'autonomy_feedback';
  timestamp: string; // ISO 8601
  phase?: string;
  proposalId?: string;
  signalId?: string;
  change: {
    action: string; // 'defer_phase', 'reprioritize', etc.
    from?: Record<string, any>;
    to: Record<string, any>;
    reason: string;
  };
  metadata: Record<string, any>;
}

export interface ARPSBridgeConfig {
  memoryStoreUrl: string; // MemoryQueryAPI endpoint for storing ARPS_DELTA events
}

export class AutonomyToARPSBridge {
  private config: ARPSBridgeConfig;

  constructor(config: ARPSBridgeConfig) {
    this.config = config;
  }

  /**
   * Log proposal as ARPS_DELTA event
   */
  async logProposalToARPS(proposal: RoadmapProposal): Promise<void> {
    const deltas: ARPSDelta[] = [];

    // Create one delta per action in the proposal
    for (const action of proposal.actions) {
      const delta: ARPSDelta = {
        id: `arps_${proposal.id}_${action.phase}_${Date.now()}`,
        type: 'autonomy_proposal',
        timestamp: new Date().toISOString(),
        phase: action.phase,
        proposalId: proposal.id,
        change: {
          action: action.type,
          to: {
            phase: action.phase,
            action: action.type,
            description: action.description,
            estimatedDurationChange: action.estimatedDurationChange,
            resourceRequirements: action.resourceRequirements,
            newTargetDate: action.newTargetDate,
          },
          reason: proposal.impact.rationale,
        },
        metadata: {
          confidence: proposal.confidence,
          priority: this.calculateProposalPriority(proposal),
          riskLevel: proposal.impact.riskLevel,
          affectedPhases: proposal.impact.affectedPhases,
          triggeredBySignals: proposal.triggeredBy.map((s) => ({
            id: s.id,
            type: s.type,
            severity: s.severity,
          })),
          approvalStatus: proposal.approvalStatus,
        },
      };

      deltas.push(delta);
    }

    // Send all deltas to ARPS
    try {
      for (const delta of deltas) {
        await this.sendDeltaToARPS(delta);
      }
      console.log(
        `[ARPSBridge] Logged proposal ${proposal.id} as ${deltas.length} ARPS_DELTA event(s)`
      );
    } catch (err) {
      console.error('[ARPSBridge] Failed to log proposal to ARPS:', err);
      throw err;
    }
  }

  /**
   * Log signal as ARPS_DELTA event
   */
  async logSignalToARPS(signal: AutonomySignal): Promise<void> {
    const delta: ARPSDelta = {
      id: `arps_${signal.id}`,
      type: 'autonomy_signal',
      timestamp: new Date().toISOString(),
      signalId: signal.id,
      change: {
        action: `detect_${signal.type}`,
        to: {
          signalType: signal.type,
          severity: signal.severity,
          affectedPhases: signal.affectedPhases,
          description: signal.description,
        },
        reason: `Autonomy signal detection: ${signal.description}`,
      },
      metadata: {
        confidence: signal.confidence,
        signalType: signal.type,
        severity: signal.severity,
        affectedPhases: signal.affectedPhases,
        evidenceCount: signal.evidence.length,
        recommendation: signal.recommendation,
      },
    };

    try {
      await this.sendDeltaToARPS(delta);
      console.log(
        `[ARPSBridge] Logged signal ${signal.id} (${signal.type}) to ARPS`
      );
    } catch (err) {
      console.error('[ARPSBridge] Failed to log signal to ARPS:', err);
      throw err;
    }
  }

  /**
   * Log proposal approval/rejection as feedback event
   */
  async logProposalFeedbackToARPS(
    proposal: RoadmapProposal,
    decision: 'approved' | 'rejected',
    reason?: string
  ): Promise<void> {
    const delta: ARPSDelta = {
      id: `arps_feedback_${proposal.id}_${Date.now()}`,
      type: 'autonomy_feedback',
      timestamp: new Date().toISOString(),
      proposalId: proposal.id,
      change: {
        action: decision,
        to: {
          proposalStatus: decision === 'approved' ? 'approved' : 'rejected',
          decision,
          reason: reason || (decision === 'approved' ? 'Approved by governance' : 'Rejected'),
        },
        reason: `Proposal ${decision}${reason ? `: ${reason}` : ''}`,
      },
      metadata: {
        proposalId: proposal.id,
        decision,
        rejectionReason: reason,
        triggeredBySignals: proposal.triggeredBy.map((s) => s.id),
        affectedPhases: proposal.impact.affectedPhases,
      },
    };

    try {
      await this.sendDeltaToARPS(delta);
      console.log(
        `[ARPSBridge] Logged proposal feedback: ${proposal.id} → ${decision}`
      );
    } catch (err) {
      console.error('[ARPSBridge] Failed to log proposal feedback to ARPS:', err);
      throw err;
    }
  }

  /**
   * Batch log multiple proposals
   */
  async logProposalsToARPS(proposals: RoadmapProposal[]): Promise<void> {
    for (const proposal of proposals) {
      await this.logProposalToARPS(proposal);
    }
  }

  /**
   * Helper: Send delta to ARPS (via MLA)
   */
  private async sendDeltaToARPS(delta: ARPSDelta): Promise<void> {
    // Convert delta to MLA event format
    const event = {
      id: delta.id,
      timestamp: delta.timestamp,
      type: 'ARPS_DELTA',
      correlationId: delta.proposalId || delta.signalId || 'autonomy',
      summary: `${delta.type}: ${delta.change.action}`,
      severity: this.getEventSeverity(delta),
      metadata: {
        deltaType: delta.type,
        phase: delta.phase,
        change: delta.change,
        ...delta.metadata,
      },
    };

    // Send to MLA (which feeds ARPS)
    const url = `${this.config.memoryStoreUrl}/memory/events`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      throw new Error(
        `MLA returned ${response.status}: ${response.statusText}`
      );
    }
  }

  /**
   * Helper: Map delta to event severity
   */
  private getEventSeverity(delta: ARPSDelta): string {
    if (delta.type === 'autonomy_proposal') {
      return delta.metadata.riskLevel === 'high' ? 'warning' : 'info';
    }
    if (delta.type === 'autonomy_signal') {
      return delta.metadata.severity;
    }
    return 'info';
  }

  /**
   * Helper: Calculate proposal priority (simplified)
   */
  private calculateProposalPriority(proposal: RoadmapProposal): number {
    let priority = 0;

    for (const signal of proposal.triggeredBy) {
      switch (signal.severity) {
        case 'critical':
          priority += 30;
          break;
        case 'warning':
          priority += 15;
          break;
        case 'info':
          priority += 5;
          break;
      }
      priority *= signal.confidence;
    }

    // Risk adjustment
    switch (proposal.impact.riskLevel) {
      case 'high':
        priority *= 0.8;
        break;
      case 'medium':
        priority *= 1.0;
        break;
      case 'low':
        priority *= 1.2;
        break;
    }

    return Math.min(priority, 100);
  }
}
