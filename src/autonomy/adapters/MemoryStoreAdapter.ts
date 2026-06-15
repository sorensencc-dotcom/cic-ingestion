/**
 * MemoryStoreAdapter — normalizes ingestion events to MemoryStore format
 * Bridges autonomy signals/proposals to persistent memory store
 *
 * Maps:
 * - AutonomySignal → GOVERNANCE_SIGNAL event
 * - RoadmapProposal → APR_PLAN event
 * - TimelineEvent → PIPELINE_RUN or AGENT_TELEMETRY
 */

import { AutonomySignal } from '../models/AutonomySignal';
import { RoadmapProposal } from '../models/RoadmapProposal';
import { TimelineEvent } from '../../ui/models/TimelineEvent';
import type { MemoryEvent } from '../../../../rewrite-mcp/src/memory/MemoryStore';

/**
 * Custom lightweight UUID v4 generator to avoid external runtime/compile dependencies.
 */
function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class MemoryStoreAdapter {
  /**
   * Convert AutonomySignal → GOVERNANCE_SIGNAL MemoryEvent
   */
  static signalToMemoryEvent(signal: AutonomySignal, sessionId: string): Omit<MemoryEvent, 'id' | 'timestamp' | 'checksum' | 'version'> {
    return {
      event_type: 'GOVERNANCE_SIGNAL',
      source_agent: 'autonomy-engine',
      session_id: sessionId,
      correlation_id: `corr_${generateUuid().substring(0, 8)}`,
      retention_days: 90,
      payload: {
        signal_type: signal.type,
        entity_type: 'phase',
        entity_id: signal.affectedPhases[0] || 'unknown',
        decision: signal.severity === 'critical' ? 'escalate' : 'monitor',
        reason: signal.description,
        operator: '',
        approval_count: 0,
        approval_threshold: 1,
        metadata: {
          confidence: signal.confidence,
          timestamp: signal.timestamp,
          affectedPhases: signal.affectedPhases,
          rationale: (signal.metadata && signal.metadata.rationale) || (signal as any).rationale || '',
        },
      },
    };
  }

  /**
   * Convert RoadmapProposal → APR_PLAN MemoryEvent
   */
  static proposalToMemoryEvent(proposal: RoadmapProposal, sessionId: string): Omit<MemoryEvent, 'id' | 'timestamp' | 'checksum' | 'version'> {
    return {
      event_type: 'APR_PLAN',
      source_agent: 'proposal-engine',
      session_id: sessionId,
      correlation_id: `corr_${proposal.id.substring(0, 8)}`,
      retention_days: 180,
      payload: {
        plan_id: proposal.id,
        goal: proposal.impact.rationale,
        plan_type: 'roadmap_amendment',
        status: proposal.status,
        task_count: proposal.actions.length,
        task_graph: proposal.actions,
        critical_path_hours: proposal.impact.estimatedDurationChange || 0,
        risk_level: proposal.impact.riskLevel || 'medium',
        risk_factors: proposal.impact.dependencies || [],
        agent_consensus_score: proposal.confidence || 0.5,
        agents_involved: [proposal.metadata.proposedBy || 'proposal-engine'],
      },
    };
  }

  /**
   * Convert TimelineEvent → PIPELINE_RUN or AGENT_TELEMETRY MemoryEvent
   */
  static timelineEventToMemoryEvent(event: TimelineEvent, sessionId: string): Omit<MemoryEvent, 'id' | 'timestamp' | 'checksum' | 'version'> {
    if (event.type === 'PIPELINE_RUN') {
      return {
        event_type: 'PIPELINE_RUN',
        source_agent: (event as any).source || event.metadata.source || 'unknown',
        session_id: sessionId,
        correlation_id: `corr_${generateUuid().substring(0, 8)}`,
        retention_days: 60,
        payload: {
          pipeline_name: (event as any).name || event.metadata.name || 'unnamed',
          pipeline_id: event.id || generateUuid(),
          status: (event as any).status || event.metadata.status || 'pending',
          start_time: event.timestamp,
          end_time: new Date().toISOString(),
          duration_ms: event.metrics?.duration_ms || 0,
          items_processed: event.metrics?.items_processed || 0,
          items_successful: event.metrics?.items_successful || 0,
          items_failed: event.metrics?.items_failed || 0,
          error_summary: (event as any).error || event.metadata.error || undefined,
          metrics: event.metrics || {},
          failed_items: undefined,
        },
      };
    }

    // Default: AGENT_TELEMETRY
    return {
      event_type: 'AGENT_TELEMETRY',
      source_agent: (event as any).source || event.metadata.source || 'unknown',
      session_id: sessionId,
      correlation_id: `corr_${generateUuid().substring(0, 8)}`,
      retention_days: 30,
      payload: {
        agent_name: (event as any).name || event.metadata.name || 'unknown',
        agent_class: 'autonomy',
        status: (event as any).status || event.metadata.status || 'running',
        uptime_seconds: event.metrics?.uptime_seconds || 0,
        task_count: event.metrics?.task_count || 0,
        task_success_rate: event.metrics?.task_success_rate || 0,
        last_error: (event as any).error || event.metadata.error || undefined,
        last_error_time: undefined,
        performance: event.metrics || {},
        degradation_reason: undefined,
      },
    };
  }

  /**
   * Generate deterministic session ID from timestamp
   * Format: session_YYYYMMDD_XXXXX (X = milliseconds)
   */
  static generateSessionId(): string {
    const now = new Date();
    const date = now.toISOString().split('T')[0].replace(/-/g, '');
    const ms = String(Date.now() % 100000).padStart(5, '0');
    return `session_${date}_${ms}`;
  }
}
