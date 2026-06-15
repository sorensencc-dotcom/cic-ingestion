export type MemoryEventType = "ARPS_DELTA" | "PIPELINE_RUN" | "AGENT_TELEMETRY" | "GOVERNANCE_SIGNAL" | "APR_PLAN" | "CRO_RUN";
export interface TimeRange {
    from: Date;
    to: Date;
}
export interface QueryOptions {
    limit?: number;
    offset?: number;
    timeRange?: TimeRange;
}
export interface TypeQueryOptions extends QueryOptions {
    eventType: MemoryEventType;
}
export interface CorrelationQueryOptions extends QueryOptions {
    correlationId: string;
}
export interface SessionQueryOptions extends QueryOptions {
    sessionId: string;
}
export interface MemoryEventEnvelope {
    id: string;
    eventType: MemoryEventType;
    timestamp: string;
    payload: Record<string, any>;
    sourceAgent: string;
    sessionId: string;
    correlationId: string;
    checksum: string;
}
export interface QueryResult {
    events: MemoryEventEnvelope[];
    total: number;
    limit?: number;
    offset?: number;
}
export interface SessionReconstructionResult {
    sessionId: string;
    startTime: string;
    endTime: string;
    eventCount: number;
    events: MemoryEventEnvelope[];
    eventTypeBreakdown: Record<MemoryEventType, number>;
}
export interface GovernanceLineageResult {
    correlationId: string;
    events: MemoryEventEnvelope[];
    governanceDecisions: MemoryEventEnvelope[];
    executionTrace: MemoryEventEnvelope[];
}
//# sourceMappingURL=memory-query.types.d.ts.map