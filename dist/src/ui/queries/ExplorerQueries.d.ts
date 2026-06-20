/**
 * Query client for Memory Explorer UI (Phase 23.6)
 * Communicates with MemoryQueryAPI to fetch timeline, drift, and health data
 */
import { TimelineEvent, TimelineFilter, DriftMetric, HealthMetric, CorrelationTrace } from '../models/TimelineEvent.js';
export interface ExplorerQueryOptions {
    baseUrl: string;
    timeout?: number;
    pollInterval?: number;
}
export declare class ExplorerClient {
    private baseUrl;
    private timeout;
    private pollInterval;
    private subscriptions;
    constructor(options: ExplorerQueryOptions);
    /**
     * Fetch timeline events with optional filtering
     */
    getTimeline(filter: TimelineFilter, limit?: number): Promise<TimelineEvent[]>;
    /**
     * Fetch drift metrics for a given window
     */
    getDriftMetrics(window: 'hourly' | 'daily' | 'weekly'): Promise<DriftMetric[]>;
    /**
     * Fetch health metrics for a given window
     */
    getHealthMetrics(window: '1h' | '24h' | '7d'): Promise<HealthMetric[]>;
    /**
     * Reconstruct correlation trace from correlation ID
     */
    getCorrelationTrace(correlationId: string): Promise<CorrelationTrace>;
    /**
     * Subscribe to real-time event updates
     * Returns unsubscribe function
     */
    subscribeToEvents(callback: (event: TimelineEvent) => void, filter?: TimelineFilter): () => void;
    /**
     * Generic fetch with timeout and error handling
     */
    private fetch;
    /**
     * Calculate critical path (simplistic DAG of causality)
     * Assumes temporal ordering indicates causality
     */
    private calculateCriticalPath;
    /**
     * Cleanup subscriptions
     */
    destroy(): void;
}
//# sourceMappingURL=ExplorerQueries.d.ts.map