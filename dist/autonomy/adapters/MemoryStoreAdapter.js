/**
 * MemoryStoreAdapter — normalizes ingestion events to MemoryStore format
 * Bridges autonomy signals/proposals to persistent memory store
 *
 * Maps:
 * - AutonomySignal → GOVERNANCE_SIGNAL event
 * - RoadmapProposal → APR_PLAN event
 * - TimelineEvent → PIPELINE_RUN or AGENT_TELEMETRY
 */
import { v4 as uuidv4 } from 'uuid';
export class MemoryStoreAdapter {
    /**
     * Convert AutonomySignal → GOVERNANCE_SIGNAL MemoryEvent
     */
    static signalToMemoryEvent(signal, sessionId) {
        return {
            event_type: 'GOVERNANCE_SIGNAL',
            source_agent: 'autonomy-engine',
            session_id: sessionId,
            correlation_id: `corr_${uuidv4().substring(0, 8)}`,
            retention_days: 90,
            payload: {
                signal_type: signal.type,
                entity_type: 'phase',
                entity_id: signal.affectedPhases[0] || 'unknown',
                decision: signal.severity === 'critical' ? 'escalate' : 'monitor',
                reason: signal.description,
                operator: undefined,
                approval_count: 0,
                approval_threshold: 1,
                metadata: {
                    confidence: signal.confidence,
                    timestamp: signal.timestamp,
                    affectedPhases: signal.affectedPhases,
                    rationale: signal.rationale,
                },
            },
        };
    }
    /**
     * Convert RoadmapProposal → APR_PLAN MemoryEvent
     */
    static proposalToMemoryEvent(proposal, sessionId) {
        return {
            event_type: 'APR_PLAN',
            source_agent: 'proposal-engine',
            session_id: sessionId,
            correlation_id: `corr_${proposal.id.substring(0, 8)}`,
            retention_days: 180,
            payload: {
                plan_id: proposal.id,
                goal: proposal.description,
                plan_type: 'roadmap_amendment',
                status: proposal.status,
                task_count: proposal.tasks?.length || 0,
                task_graph: proposal.tasks || [],
                critical_path_hours: proposal.estimatedHours || 0,
                risk_level: proposal.risk || 'medium',
                risk_factors: proposal.dependencies || [],
                agent_consensus_score: proposal.consensus || 0.5,
                agents_involved: [proposal.proposedBy],
            },
        };
    }
    /**
     * Convert TimelineEvent → PIPELINE_RUN or AGENT_TELEMETRY MemoryEvent
     */
    static timelineEventToMemoryEvent(event, sessionId) {
        if (event.type === 'pipeline_run') {
            return {
                event_type: 'PIPELINE_RUN',
                source_agent: event.source || 'unknown',
                session_id: sessionId,
                correlation_id: `corr_${uuidv4().substring(0, 8)}`,
                retention_days: 60,
                payload: {
                    pipeline_name: event.name || 'unnamed',
                    pipeline_id: event.id || uuidv4(),
                    status: event.status || 'pending',
                    start_time: event.timestamp,
                    end_time: new Date().toISOString(),
                    duration_ms: event.metrics?.duration_ms || 0,
                    items_processed: event.metrics?.items_processed || 0,
                    items_successful: event.metrics?.items_successful || 0,
                    items_failed: event.metrics?.items_failed || 0,
                    error_summary: event.error || undefined,
                    metrics: event.metrics || {},
                    failed_items: undefined,
                },
            };
        }
        // Default: AGENT_TELEMETRY
        return {
            event_type: 'AGENT_TELEMETRY',
            source_agent: event.source || 'unknown',
            session_id: sessionId,
            correlation_id: `corr_${uuidv4().substring(0, 8)}`,
            retention_days: 30,
            payload: {
                agent_name: event.name || 'unknown',
                agent_class: 'autonomy',
                status: event.status || 'running',
                uptime_seconds: event.metrics?.uptime_seconds || 0,
                task_count: event.metrics?.task_count || 0,
                task_success_rate: event.metrics?.task_success_rate || 0,
                last_error: event.error || undefined,
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
    static generateSessionId() {
        const now = new Date();
        const date = now.toISOString().split('T')[0].replace(/-/g, '');
        const ms = String(Date.now() % 100000).padStart(5, '0');
        return `session_${date}_${ms}`;
    }
}
//# sourceMappingURL=MemoryStoreAdapter.js.map