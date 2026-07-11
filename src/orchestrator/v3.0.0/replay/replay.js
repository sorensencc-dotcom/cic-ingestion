/**
 * CIC Orchestrator v3.0.0 — Replay Engine
 */

export function createReplayEngine() {
  const events = [];

  return {
    record(event) {
      events.push({ ...event, ts: Date.now() });
    },
    dump() {
      return [...events];
    },
    reset() {
      events.length = 0;
    }
  };
}
