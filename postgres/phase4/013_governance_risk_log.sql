-- Phase 5 Migration 013: Create governance_risk_log table
-- Log full GRS computation inputs for long-memory learning (Phase 6)

CREATE TABLE IF NOT EXISTS governance_risk_log (
  id BIGSERIAL PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  v_violation_rate NUMERIC CHECK (v_violation_rate BETWEEN 0 AND 1),
  r_retry_rate NUMERIC CHECK (r_retry_rate BETWEEN 0 AND 1),
  c_cohort_instability NUMERIC CHECK (c_cohort_instability BETWEEN 0 AND 1),
  i_impact_drift NUMERIC CHECK (i_impact_drift BETWEEN 0 AND 1),
  computed_grs NUMERIC CHECK (computed_grs BETWEEN 0 AND 1),
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_governance_risk_log_proposal_id ON governance_risk_log(proposal_id);
CREATE INDEX IF NOT EXISTS idx_governance_risk_log_computed_grs ON governance_risk_log(computed_grs);
CREATE INDEX IF NOT EXISTS idx_governance_risk_log_recorded_at ON governance_risk_log(recorded_at);

CREATE OR REPLACE FUNCTION governance_risk_log_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'governance_risk_log: append-only table. Updates/deletes forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS governance_risk_log_immutable_trigger ON governance_risk_log;
CREATE TRIGGER governance_risk_log_immutable_trigger
BEFORE UPDATE OR DELETE ON governance_risk_log
FOR EACH ROW EXECUTE FUNCTION governance_risk_log_immutable();
