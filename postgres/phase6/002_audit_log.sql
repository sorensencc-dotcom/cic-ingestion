-- Phase 6: audit_log — append-only, tamper-evident governance + canary events
-- Hash-chained for lineage integrity; immutable

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  record_id UUID NOT NULL DEFAULT gen_random_uuid(),
  proposal_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'submit','validate','canary_start','canary_end','violation','rollback','abort','promotion',
    'governance_threshold_update','lambda_update','sandbox_drift','lineage_event',
    'impact_measurement','cohort_event'
  )),
  severity TEXT CHECK (severity IN ('low','medium','high')),
  category TEXT CHECK (category IN ('governance','canary','sandbox','config','lineage','impact')),
  policy_metadata JSONB,
  details JSONB,
  occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  previous_record_id UUID,
  previous_record_hash TEXT,
  record_hash TEXT,

  UNIQUE (record_id)
);

CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type_occurred_at ON audit_log(event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_proposal_id ON audit_log(proposal_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_severity ON audit_log(severity);
CREATE INDEX IF NOT EXISTS idx_audit_log_category ON audit_log(category);
CREATE INDEX IF NOT EXISTS idx_audit_log_occurred_at ON audit_log(occurred_at DESC);

-- Immutable trigger
CREATE OR REPLACE FUNCTION audit_log_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log: append-only table. Updates/deletes forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_immutable_trigger ON audit_log;
CREATE TRIGGER audit_log_immutable_trigger
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
