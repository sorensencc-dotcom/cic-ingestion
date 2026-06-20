/**
 * MemoryStoreAdapter — Stub for Docker isolation (Phase 2.5)
 * Provides minimal interface without rewrite-mcp dependency
 */
export declare class MemoryStoreAdapter {
    static generateSessionId(): string;
    static signalToMemoryEvent(signal: any, sessionId: string): any;
    static proposalToMemoryEvent(proposal: any, sessionId: string): any;
}
//# sourceMappingURL=MemoryStoreAdapter.d.ts.map