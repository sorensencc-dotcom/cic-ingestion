-- Phase 4: simulator_drift_reports — append-only ledger for simulator/live mismatch reports.

CREATE TABLE IF NOT EXISTS simulator_drift_reports (
  id SERIAL PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  canary_cohort_id TEXT NOT NULL,
  drift_score FLOAT NOT NULL, -- 0-1, higher = more drift
  latency_delta FLOAT, -- predicted vs actual
  cost_delta FLOAT, -- predicted vs actual
  success_rate_delta FLOAT, -- predicted vs actual
  sample_count INT,
  reported_at BIGINT NOT NULL,
  requires_rollback BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_simulator_drift_proposal ON simulator_drift_reports(proposal_id);
CREATE INDEX IF NOT EXISTS idx_simulator_drift_score ON simulator_drift_reports(drift_score DESC);
