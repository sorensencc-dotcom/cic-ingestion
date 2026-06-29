-- Phase 4: simulator_drift_reports — simulator evaluation log.

CREATE TABLE IF NOT EXISTS simulator_drift_reports (
  id SERIAL PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  simulator_id TEXT NOT NULL,
  drift_score NUMERIC CHECK (drift_score BETWEEN 0 AND 1),
  latency_delta NUMERIC, -- ms, can be negative
  cost_delta NUMERIC, -- $, can be negative
  success_rate_delta NUMERIC CHECK (success_rate_delta BETWEEN -1 AND 1),
  state_distribution JSONB,
  model_performance_matrix JSONB,
  requires_rollback BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (proposal_id) REFERENCES regime_proposals(proposal_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_simulator_drift_reports_proposal_id ON simulator_drift_reports(proposal_id);
CREATE INDEX IF NOT EXISTS idx_simulator_drift_reports_simulator_id ON simulator_drift_reports(simulator_id);
CREATE INDEX IF NOT EXISTS idx_simulator_drift_reports_requires_rollback ON simulator_drift_reports(requires_rollback);

-- Immutable
CREATE OR REPLACE FUNCTION simulator_drift_reports_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'simulator_drift_reports: append-only. Updates/deletes forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS simulator_drift_reports_immutable_trigger ON simulator_drift_reports;
CREATE TRIGGER simulator_drift_reports_immutable_trigger
BEFORE UPDATE OR DELETE ON simulator_drift_reports
FOR EACH ROW EXECUTE FUNCTION simulator_drift_reports_immutable();
