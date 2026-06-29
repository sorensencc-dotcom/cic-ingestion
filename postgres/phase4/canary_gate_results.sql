-- Phase 4: canary_gate_results — append-only ledger for canary execution telemetry.
-- CI gate rule 6: All promotions emit canary_gate_results.

CREATE TABLE IF NOT EXISTS canary_gate_results (
  id SERIAL PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  canary_cohort_id TEXT NOT NULL,
  cohort_size_percent FLOAT NOT NULL,
  observation_window_ms INT,
  avg_latency_ms FLOAT,
  avg_cost FLOAT,
  success_rate FLOAT,
  error_rate FLOAT,
  drift_score FLOAT,
  sample_count INT,
  growth_decision TEXT, -- 'grow', 'pause', 'rollback'
  recorded_at BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_canary_results_proposal ON canary_gate_results(proposal_id);
CREATE INDEX IF NOT EXISTS idx_canary_results_cohort ON canary_gate_results(canary_cohort_id);
CREATE INDEX IF NOT EXISTS idx_canary_results_recorded ON canary_gate_results(recorded_at DESC);
