-- Phase 4: canary_growth_configs — append-only ledger for growth configuration.
-- CI gate rule 7: CanaryGrowthConfig read from DB, not config files.
-- BLOCK Gap 5: Persistence of governance-approved growth strategy.

CREATE TABLE IF NOT EXISTS canary_growth_configs (
  id SERIAL PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  cohort_cap_percent FLOAT NOT NULL,
  growth_curve TEXT NOT NULL, -- 'linear', 'exponential', 'adaptive'
  observation_window_ms INT NOT NULL,
  metrics_check_interval_ms INT NOT NULL,
  max_cost_delta FLOAT NOT NULL,
  max_latency_delta FLOAT NOT NULL,
  min_success_rate FLOAT NOT NULL,
  max_drift_score FLOAT NOT NULL,
  approved_by TEXT NOT NULL, -- governance approver ID
  approved_at BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_canary_growth_proposal ON canary_growth_configs(proposal_id);
CREATE INDEX IF NOT EXISTS idx_canary_growth_approved ON canary_growth_configs(approved_at DESC);
