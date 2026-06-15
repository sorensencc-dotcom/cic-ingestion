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
export declare class MemoryStoreAdapter {
    /**
     * Convert AutonomySignal → GOVERNANCE_SIGNAL MemoryEvent
     */
    static signalToMemoryEvent(signal: AutonomySignal, sessionId: string): Omit<MemoryEvent, 'id' | 'timestamp' | 'checksum' | 'version'>;
    /**
     * Convert RoadmapProposal → APR_PLAN MemoryEvent
     */
    static proposalToMemoryEvent(proposal: RoadmapProposal, sessionId: string): Omit<MemoryEvent, 'id' | 'timestamp' | 'checksum' | 'version'>;
    /**
     * Convert TimelineEvent → PIPELINE_RUN or AGENT_TELEMETRY MemoryEvent
     */
    static timelineEventToMemoryEvent(event: TimelineEvent, sessionId: string): Omit<MemoryEvent, 'id' | 'timestamp' | 'checksum' | 'version'>;
    /**
     * Generate deterministic session ID from timestamp
     * Format: session_YYYYMMDD_XXXXX (X = milliseconds)
     */
    static generateSessionId(): string;
}
//# sourceMappingURL=MemoryStoreAdapter.d.ts.map