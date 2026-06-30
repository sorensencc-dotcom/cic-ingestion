-- Phase 6: nightly_metrics — computed analytics snapshot (5 metrics per day)
-- Violation Rate, Rollback Severity Index, Cohort Stability Score, Impact Drift, Governance Risk Score
-- Analytics-ready: one row per day, immutable

CREATE TABLE IF NOT EXISTS nightly_metrics (
  id BIGSERIAL PRIMARY KEY,

  day DATE NOT NULL UNIQUE,

  violation_rate NUMERIC(6,4) NOT NULL,
  rollback_severity_index NUMERIC(6,2) NOT NULL,
  cohort_stability_score NUMERIC(6,4) NOT NULL,
  impact_drift NUMERIC(10,4) NOT NULL,

  avg_risk_score NUMERIC(6,4) NOT NULL,
  avg_threshold NUMERIC(6,4) NOT NULL,
  avg_lambda NUMERIC(6,4) NOT NULL,

  computed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nightly_metrics_day ON nightly_metrics(day DESC);
CREATE INDEX IF NOT EXISTS idx_nightly_metrics_computed_at ON nightly_metrics(computed_at DESC);

-- Immutable trigger
CREATE OR REPLACE FUNCTION nightly_metrics_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'nightly_metrics: append-only table. Updates/deletes forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nightly_metrics_immutable_trigger ON nightly_metrics;
CREATE TRIGGER nightly_metrics_immutable_trigger
BEFORE DELETE ON nightly_metrics
FOR EACH ROW EXECUTE FUNCTION nightly_metrics_immutable();

-- Allow UPSERT on day for idempotent nightly runs
CREATE OR REPLACE FUNCTION nightly_metrics_upsert(
  p_day DATE,
  p_vr NUMERIC,
  p_rsi NUMERIC,
  p_css NUMERIC,
  p_id NUMERIC,
  p_grs NUMERIC,
  p_t NUMERIC,
  p_lambda NUMERIC
) RETURNS void AS $$
BEGIN
  INSERT INTO nightly_metrics (day, violation_rate, rollback_severity_index, cohort_stability_score, impact_drift, avg_risk_score, avg_threshold, avg_lambda)
  VALUES (p_day, p_vr, p_rsi, p_css, p_id, p_grs, p_t, p_lambda)
  ON CONFLICT (day) DO UPDATE SET
    violation_rate = EXCLUDED.violation_rate,
    rollback_severity_index = EXCLUDED.rollback_severity_index,
    cohort_stability_score = EXCLUDED.cohort_stability_score,
    impact_drift = EXCLUDED.impact_drift,
    avg_risk_score = EXCLUDED.avg_risk_score,
    avg_threshold = EXCLUDED.avg_threshold,
    avg_lambda = EXCLUDED.avg_lambda,
    computed_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;
