// cic-ingestion/src/harness/replayHarness.ts
// semver: 0.1.0
// date: 2026-06-29

import { updateDriftScores, DriftEvent } from "../drift/driftEngine.js";

export interface CICState {
  drift: Record<string, number>;
}

export function processClientSession(event: DriftEvent, cicState: CICState): void {
  if (!cicState.drift) {
    cicState.drift = {};
  }
  updateDriftScores(event, cicState.drift);
}
