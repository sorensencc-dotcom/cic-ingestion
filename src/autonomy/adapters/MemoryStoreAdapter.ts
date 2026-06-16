/**
 * MemoryStoreAdapter — Stub for Docker isolation (Phase 2.5)
 * Provides minimal interface without rewrite-mcp dependency
 */

export class MemoryStoreAdapter {
  static generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static signalToMemoryEvent(signal: any, sessionId: string): any {
    return {
      type: 'signal',
      payload: signal,
      sessionId,
      timestamp: new Date().toISOString(),
    };
  }

  static proposalToMemoryEvent(proposal: any, sessionId: string): any {
    return {
      type: 'proposal',
      payload: proposal,
      sessionId,
      timestamp: new Date().toISOString(),
    };
  }
}
