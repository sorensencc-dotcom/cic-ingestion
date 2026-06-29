-- Phase 4: canary_growth_configs — configuration audit log (BLOCK gap 5 persistence).
-- Config changes append-only; no in-place mutation.

CREATE TABLE IF NOT EXISTS canary_growth_configs (
  id SERIAL PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  cohort_cap_percent INT CHECK (cohort_cap_percent BETWEEN 1 AND 100),
  growth_curve TEXT NOT NULL, -- linear, exponential, adaptive
  observation_window_ms INT,
  metrics_check_interval_ms INT,
  thresholds JSONB, -- max_cost_delta, max_latency_delta, min_success_rate, max_drift_score
  approved_by TEXT,
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (proposal_id) REFERENCES regime_proposals(proposal_id) ON DELETE RESTRICT,
  CONSTRAINT canary_growth_configs_growth_curve_valid
    CHECK (growth_curve IN ('linear', 'exponential', 'adaptive'))
);

CREATE INDEX IF NOT EXISTS idx_canary_growth_configs_proposal_id ON canary_growth_configs(proposal_id);
CREATE INDEX IF NOT EXISTS idx_canary_growth_configs_created_at ON canary_growth_configs(created_at DESC);

-- Immutable
CREATE OR REPLACE FUNCTION canary_growth_configs_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'canary_growth_configs: append-only. Updates/deletes forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS canary_growth_configs_immutable_trigger ON canary_growth_configs;
CREATE TRIGGER canary_growth_configs_immutable_trigger
BEFORE UPDATE OR DELETE ON canary_growth_configs
FOR EACH ROW EXECUTE FUNCTION canary_growth_configs_immutable();
