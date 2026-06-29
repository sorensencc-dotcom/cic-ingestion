-- Phase 5 Migration 015: Create sandbox_drift_log table
-- Ingest sandbox drift reports from escalation (Fracture 4)

CREATE TABLE IF NOT EXISTS sandbox_drift_log (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  from_tier TEXT,
  to_tier TEXT,
  violation_type TEXT,
  drift_score NUMERIC CHECK (drift_score BETWEEN 0 AND 1),
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sandbox_drift_log_type ON sandbox_drift_log(type);
CREATE INDEX IF NOT EXISTS idx_sandbox_drift_log_violation_type ON sandbox_drift_log(violation_type);
CREATE INDEX IF NOT EXISTS idx_sandbox_drift_log_recorded_at ON sandbox_drift_log(recorded_at);

CREATE OR REPLACE FUNCTION sandbox_drift_log_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'sandbox_drift_log: append-only table. Updates/deletes forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sandbox_drift_log_immutable_trigger ON sandbox_drift_log;
CREATE TRIGGER sandbox_drift_log_immutable_trigger
BEFORE UPDATE OR DELETE ON sandbox_drift_log
FOR EACH ROW EXECUTE FUNCTION sandbox_drift_log_immutable();
