/**
 * MemoryStoreAdapter — Stub for Docker isolation (Phase 2.5)
 * Provides minimal interface without rewrite-mcp dependency
 */
export class MemoryStoreAdapter {
    static generateSessionId() {
        return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    static signalToMemoryEvent(signal, sessionId) {
        return {
            type: 'signal',
            payload: signal,
            sessionId,
            timestamp: new Date().toISOString(),
        };
    }
    static proposalToMemoryEvent(proposal, sessionId) {
        return {
            type: 'proposal',
            payload: proposal,
            sessionId,
            timestamp: new Date().toISOString(),
        };
    }
}
//# sourceMappingURL=MemoryStoreAdapter.js.map