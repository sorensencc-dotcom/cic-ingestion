-- Phase 4: governance_approvals — approval audit log with 7-day TTL (BLOCK gap 2).

CREATE TABLE IF NOT EXISTS governance_approvals (
  id SERIAL PRIMARY KEY,
  proposal_id TEXT NOT NULL UNIQUE,
  proposal_type TEXT NOT NULL, -- regime, constraint, fallback, reward, simulator
  validation_status TEXT DEFAULT 'valid', -- valid, invalid
  governance_status TEXT DEFAULT 'pending', -- pending, approved, rejected
  decided_by TEXT,
  decided_at TIMESTAMP,
  expires_at TIMESTAMP, -- 7 days from approval
  rationale TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (proposal_id) REFERENCES regime_proposals(proposal_id) ON DELETE RESTRICT,
  CONSTRAINT governance_approvals_proposal_type_valid
    CHECK (proposal_type IN ('regime', 'constraint', 'fallback', 'reward', 'simulator')),
  CONSTRAINT governance_approvals_governance_status_valid
    CHECK (governance_status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_governance_approvals_proposal_id ON governance_approvals(proposal_id);
CREATE INDEX IF NOT EXISTS idx_governance_approvals_governance_status ON governance_approvals(governance_status);
CREATE INDEX IF NOT EXISTS idx_governance_approvals_expires_at ON governance_approvals(expires_at);
CREATE INDEX IF NOT EXISTS idx_governance_approvals_created_at ON governance_approvals(created_at DESC);

-- Immutable
CREATE OR REPLACE FUNCTION governance_approvals_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'governance_approvals: append-only. Updates/deletes forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS governance_approvals_immutable_trigger ON governance_approvals;
CREATE TRIGGER governance_approvals_immutable_trigger
BEFORE UPDATE OR DELETE ON governance_approvals
FOR EACH ROW EXECUTE FUNCTION governance_approvals_immutable();
