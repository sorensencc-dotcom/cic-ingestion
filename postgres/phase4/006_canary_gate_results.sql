-- Phase 4: canary_gate_results — execution log with metrics (CI gate rule 6).

CREATE TABLE IF NOT EXISTS canary_gate_results (
  id SERIAL PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  observation_window_ms INT,
  cohort_size_percent INT CHECK (cohort_size_percent BETWEEN 1 AND 100),
  avg_latency_ms NUMERIC,
  avg_cost NUMERIC,
  success_rate NUMERIC CHECK (success_rate BETWEEN 0 AND 1),
  error_rate NUMERIC CHECK (error_rate BETWEEN 0 AND 1),
  drift_score NUMERIC CHECK (drift_score BETWEEN 0 AND 1),
  growth_decision TEXT, -- grow, pause, rollback_soft, rollback_hard
  sample_count INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (proposal_id) REFERENCES regime_proposals(proposal_id) ON DELETE RESTRICT,
  CONSTRAINT canary_gate_results_growth_decision_valid
    CHECK (growth_decision IN ('grow', 'pause', 'rollback_soft', 'rollback_hard'))
);

CREATE INDEX IF NOT EXISTS idx_canary_gate_results_proposal_id ON canary_gate_results(proposal_id);
CREATE INDEX IF NOT EXISTS idx_canary_gate_results_growth_decision ON canary_gate_results(growth_decision);
CREATE INDEX IF NOT EXISTS idx_canary_gate_results_created_at ON canary_gate_results(created_at DESC);

-- Immutable
CREATE OR REPLACE FUNCTION canary_gate_results_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'canary_gate_results: append-only. Updates/deletes forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS canary_gate_results_immutable_trigger ON canary_gate_results;
CREATE TRIGGER canary_gate_results_immutable_trigger
BEFORE UPDATE OR DELETE ON canary_gate_results
FOR EACH ROW EXECUTE FUNCTION canary_gate_results_immutable();
