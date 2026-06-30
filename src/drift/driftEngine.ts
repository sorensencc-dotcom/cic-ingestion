// cic-ingestion/src/drift/driftEngine.ts
// semver: 0.1.0
// date: 2026-06-29

import { createAuditEvent, appendAuditEvent } from "../../../governance/audit-policy.js";

export interface DriftSignals {
  latency?: number;
  tokens?: number;
  backend: string;
}

export interface DriftEvent {
  driftSignals: DriftSignals;
}

export function updateDriftScores(
  event: DriftEvent,
  driftState: Record<string, number>
): void {
  const { backend, latency = 0, tokens = 0 } = event.driftSignals;

  // Simple drift heuristic: penalty for high latency (>1500ms) or high token counts (>3000 tokens)
  const score =
    (latency > 1500 ? 0.3 : 0) +
    (tokens > 3000 ? 0.3 : 0);

  if (driftState[backend] === undefined) {
    driftState[backend] = 0;
  }

  const oldScore = driftState[backend];
  driftState[backend] = Math.min(1, driftState[backend] + score);

  if (score > 0) {
    try {
      const auditEvent = createAuditEvent(
        "drift_score_updated",
        "drift_engine",
        `drift-update-${backend}-${Date.now()}`,
        "production",
        "success",
        `Drift score for backend ${backend} increased from ${oldScore.toFixed(3)} to ${driftState[backend].toFixed(3)} (latency: ${latency}ms, tokens: ${tokens})`,
        [],
        []
      );
      appendAuditEvent(auditEvent);
    } catch (e: any) {
      console.error("[driftEngine] failed to write score update audit:", e.message);
    }
  }
}

export function decayDriftScores(
  driftState: Record<string, number>,
  rate = 0.95
): void {
  let decayedAny = false;
  for (const backend in driftState) {
    const oldScore = driftState[backend];
    let newScore = Math.max(0, oldScore * rate);
    if (newScore < 0.01) {
      newScore = 0;
    }
    driftState[backend] = newScore;
    if (oldScore !== newScore) decayedAny = true;
  }

  if (decayedAny) {
    try {
      const auditEvent = createAuditEvent(
        "drift_decay",
        "drift_engine",
        `drift-decay-${Date.now()}`,
        "production",
        "success",
        `Drift decay of ${((1 - rate) * 100).toFixed(0)}% applied to all backends`,
        [],
        []
      );
      appendAuditEvent(auditEvent);
    } catch (e: any) {
      console.error("[driftEngine] failed to write decay audit:", e.message);
    }
  }
}
