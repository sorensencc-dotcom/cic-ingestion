/**
 * CIC Orchestrator v3.0.0 — MCP Event Bus
 */

export function createMcpBus() {
  const listeners = {};

  return {
    on(event, handler) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    },
    emit(event, payload) {
      const handlers = listeners[event] || [];
      for (const h of handlers) {
        try {
          h(payload);
        } catch {
          // non-blocking
        }
      }
    }
  };
}
