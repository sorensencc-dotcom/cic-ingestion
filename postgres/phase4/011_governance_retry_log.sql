-- Phase 5 Migration 011: Create governance_retry_log table
-- Track adaptive retry logic during canary execution

CREATE TABLE IF NOT EXISTS governance_retry_log (
  id BIGSERIAL PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  retry_count INT NOT NULL,
  grs_at_time NUMERIC CHECK (grs_at_time BETWEEN 0 AND 1),
  max_allowed INT,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_governance_retry_log_proposal_id ON governance_retry_log(proposal_id);
CREATE INDEX IF NOT EXISTS idx_governance_retry_log_recorded_at ON governance_retry_log(recorded_at);

CREATE OR REPLACE FUNCTION governance_retry_log_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'governance_retry_log: append-only table. Updates/deletes forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS governance_retry_log_immutable_trigger ON governance_retry_log;
CREATE TRIGGER governance_retry_log_immutable_trigger
BEFORE UPDATE OR DELETE ON governance_retry_log
FOR EACH ROW EXECUTE FUNCTION governance_retry_log_immutable();
