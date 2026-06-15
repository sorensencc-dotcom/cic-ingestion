/**
 * MemoryQueryClient — HTTP client for Phase 23.2 Memory Query API
 * Fetches signals and metrics for governance context
 */
export interface MemoryEvent {
    id: string;
    event_type: string;
    source_agent: string;
    session_id: string;
    correlation_id: string;
    timestamp: string;
    payload: unknown;
    checksum?: string;
    retention_days: number;
    version: number;
}
export interface QueryResult {
    events: MemoryEvent[];
    total: number;
    limit: number;
    offset: number;
    queried_at: string;
}
export declare class MemoryQueryClient {
    private http;
    constructor(baseUrl?: string);
    /**
     * Get events by correlation ID (links to proposal)
     */
    getEventsByProposal(proposalId: string): Promise<MemoryEvent[]>;
    /**
     * Get governance signal events
     */
    getGovernanceSignals(): Promise<MemoryEvent[]>;
    /**
     * Get recent events (last N days)
     */
    getRecentEvents(days?: number): Promise<MemoryEvent[]>;
    /**
     * Get metric summaries (drift/health)
     */
    getSummaries(metric?: 'drift' | 'health'): Promise<unknown>;
    /**
     * Get store statistics
     */
    getStats(): Promise<unknown>;
}
//# sourceMappingURL=MemoryQueryClient.d.ts.map