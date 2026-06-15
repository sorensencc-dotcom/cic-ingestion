/**
 * Timeline event types and data models for Memory Explorer UI (Phase 23.6)
 */
export type EventType = 'ARPS_DELTA' | 'PIPELINE_RUN' | 'AGENT_TELEMETRY' | 'GOVERNANCE_SIGNAL' | 'APR_PLAN' | 'CRO_RUN' | 'AUTONOMY_SIGNAL';
export type EventSeverity = 'info' | 'warning' | 'error' | 'critical';
export interface TimelineEvent {
    id: string;
    timestamp: string;
    type: EventType;
    correlationId: string;
    sessionId?: string;
    summary: string;
    severity: EventSeverity;
    metadata: Record<string, any>;
    metrics?: Record<string, any>;
    relatedEventIds?: string[];
}
export interface TimelineEventGroup {
    period: string;
    startTime: string;
    endTime: string;
    events: TimelineEvent[];
    eventCount: number;
}
export interface TimelineFilter {
    startDate?: Date;
    endDate?: Date;
    types?: EventType[];
    severity?: EventSeverity[];
    correlationId?: string;
    sessionId?: string;
    searchText?: string;
}
export interface DriftMetric {
    timestamp: string;
    driftScore: number;
    signals: {
        semantic_drift: number;
        temporal_drift: number;
        narrative_drift: number;
        causal_drift: number;
    };
    severity: 'normal' | 'warning' | 'critical';
}
export interface HealthMetric {
    window: '1h' | '24h' | '7d';
    timestamp: string;
    uptime: number;
    successRate: number;
    p50Latency: number;
    p99Latency: number;
    errorCount: number;
    eventCount: number;
}
export interface CorrelationTrace {
    correlationId: string;
    initiatingEvent: TimelineEvent;
    relatedEvents: TimelineEvent[];
    timeline: TimelineEvent[];
    criticalPath?: TimelineEvent[];
    duration: number;
}
//# sourceMappingURL=TimelineEvent.d.ts.map