-- Phase 5 Migration 012: Create governance_promotion_log table
-- Record GRS-gated promotion decisions (Gate C)

CREATE TABLE IF NOT EXISTS governance_promotion_log (
  id BIGSERIAL PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  grs NUMERIC CHECK (grs BETWEEN 0 AND 1),
  ics NUMERIC CHECK (ics BETWEEN 0 AND 1),
  lcs NUMERIC CHECK (lcs BETWEEN 0 AND 1),
  verdict TEXT NOT NULL CHECK (verdict IN ('approved', 'rejected', 'deferred')),
  promoted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_governance_promotion_log_proposal_id ON governance_promotion_log(proposal_id);
CREATE INDEX IF NOT EXISTS idx_governance_promotion_log_verdict ON governance_promotion_log(verdict);
CREATE INDEX IF NOT EXISTS idx_governance_promotion_log_promoted_at ON governance_promotion_log(promoted_at);

CREATE OR REPLACE FUNCTION governance_promotion_log_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'governance_promotion_log: append-only table. Updates/deletes forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS governance_promotion_log_immutable_trigger ON governance_promotion_log;
CREATE TRIGGER governance_promotion_log_immutable_trigger
BEFORE UPDATE OR DELETE ON governance_promotion_log
FOR EACH ROW EXECUTE FUNCTION governance_promotion_log_immutable();
