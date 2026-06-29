-- Phase 5 Migration 010: Create governance_violation_log table
-- Record violation detections during canary execution (Fracture 3)

CREATE TABLE IF NOT EXISTS governance_violation_log (
  id BIGSERIAL PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  violation_class TEXT NOT NULL CHECK (violation_class IN (
    'soft_violation_minor',
    'soft_violation_major',
    'hard_violation_structural',
    'hard_violation_runtime'
  )),
  grs_at_time NUMERIC CHECK (grs_at_time BETWEEN 0 AND 1),
  detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_governance_violation_log_proposal_id ON governance_violation_log(proposal_id);
CREATE INDEX IF NOT EXISTS idx_governance_violation_log_violation_class ON governance_violation_log(violation_class);
CREATE INDEX IF NOT EXISTS idx_governance_violation_log_detected_at ON governance_violation_log(detected_at);

CREATE OR REPLACE FUNCTION governance_violation_log_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'governance_violation_log: append-only table. Updates/deletes forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS governance_violation_log_immutable_trigger ON governance_violation_log;
CREATE TRIGGER governance_violation_log_immutable_trigger
BEFORE UPDATE OR DELETE ON governance_violation_log
FOR EACH ROW EXECUTE FUNCTION governance_violation_log_immutable();
