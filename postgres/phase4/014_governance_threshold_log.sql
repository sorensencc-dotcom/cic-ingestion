-- Phase 5 Migration 014: Create governance_threshold_log table
-- Audit trail for runtime threshold (T) updates (hot-reload)

CREATE TABLE IF NOT EXISTS governance_threshold_log (
  id BIGSERIAL PRIMARY KEY,
  old_value NUMERIC CHECK (old_value BETWEEN 0.2 AND 0.4),
  new_value NUMERIC CHECK (new_value BETWEEN 0.2 AND 0.4),
  changed_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  queued_at TIMESTAMP,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  applied_at_runtime BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_governance_threshold_log_changed_by ON governance_threshold_log(changed_by);
CREATE INDEX IF NOT EXISTS idx_governance_threshold_log_applied_at ON governance_threshold_log(applied_at);

CREATE OR REPLACE FUNCTION governance_threshold_log_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'governance_threshold_log: append-only table. Updates/deletes forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS governance_threshold_log_immutable_trigger ON governance_threshold_log;
CREATE TRIGGER governance_threshold_log_immutable_trigger
BEFORE UPDATE OR DELETE ON governance_threshold_log
FOR EACH ROW EXECUTE FUNCTION governance_threshold_log_immutable();
