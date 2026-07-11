/**
 * CIC Orchestrator v3.0.0 — Module Registry
 */

export function createRegistry(modules = {}) {
  return Object.freeze({ ...modules });
}
