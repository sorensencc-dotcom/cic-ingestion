/**
 * MemoryStore: Immutable, append-only event log for CIC's long-horizon memory.
 *
 * Contract:
 * - Every event is immutable after write
 * - Events are validated against schema before write
 * - Checksums detect corruption on read
 * - Atomic writes prevent partial data
 * - Corruption quarantined, rest of log continues
 */
export interface MemoryEvent {
    id: string;
    timestamp: string;
    event_type: 'ARPS_DELTA' | 'PIPELINE_RUN' | 'AGENT_TELEMETRY' | 'GOVERNANCE_SIGNAL' | 'APR_PLAN' | 'CRO_RUN';
    source_agent: string;
    session_id: string;
    correlation_id: string;
    payload: Record<string, any>;
    retention_days: number;
    checksum?: string;
    version: number;
}
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}
export interface QueryOptions {
    event_type?: string;
    source_agent?: string;
    session_id?: string;
    correlation_id?: string;
    limit?: number;
    offset?: number;
    after_timestamp?: string;
    before_timestamp?: string;
}
export declare class MemoryStore {
    private storePath;
    private events;
    private corruptedEventIds;
    constructor(storePath?: string);
    /**
     * Load existing events from disk (on startup)
     */
    load(): Promise<void>;
    /**
     * Append a single event (immutable, atomic)
     */
    append(event: Omit<MemoryEvent, 'id' | 'timestamp' | 'checksum' | 'version'>): Promise<MemoryEvent>;
    /**
     * Query events with filters
     */
    query(options?: QueryOptions): Promise<MemoryEvent[]>;
    /**
     * Get all events (careful with large stores)
     */
    getAll(): Promise<MemoryEvent[]>;
    /**
     * Get events from last N days
     */
    getRecent(days: number): Promise<MemoryEvent[]>;
    /**
     * Get event count by type
     */
    getEventCounts(): Promise<Record<string, number>>;
    /**
     * Clear all events (destructive, use with caution)
     */
    clear(): Promise<void>;
    /**
     * Get stats about the store
     */
    getStats(): Promise<{
        total_events: number;
        corrupted_events: number;
        event_types: Record<string, number>;
        store_size_bytes: number;
        date_range: {
            oldest: string;
            newest: string;
        } | null;
    }>;
    private validateCommonFields;
    private validatePayloadSchema;
    private computeChecksum;
    private validateChecksum;
    private persistToDisk;
}
export declare function getMemoryStore(storePath?: string): Promise<MemoryStore>;
export declare function resetMemoryStore(): void;
//# sourceMappingURL=MemoryStore.d.ts.map