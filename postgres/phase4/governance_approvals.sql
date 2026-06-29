-- Phase 4: governance_approvals — append-only ledger for governance decisions.
-- CI gate rule 7: required fields present.

CREATE TABLE IF NOT EXISTS governance_approvals (
  id SERIAL PRIMARY KEY,
  proposal_id TEXT NOT NULL UNIQUE,
  proposal_type TEXT NOT NULL, -- 'regime', 'constraint', 'fallback', 'reward', 'simulator'
  submitted_by TEXT NOT NULL,
  validation_status TEXT NOT NULL, -- 'valid', 'invalid'
  validation_errors TEXT,
  governance_status TEXT NOT NULL, -- 'pending', 'approved', 'rejected', 'expired'
  decided_by TEXT,
  decided_at BIGINT,
  decision_rationale TEXT,
  expires_at BIGINT, -- 7 days from submission
  submitted_at BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_governance_approvals_status ON governance_approvals(governance_status);
CREATE INDEX IF NOT EXISTS idx_governance_approvals_type ON governance_approvals(proposal_type);
CREATE INDEX IF NOT EXISTS idx_governance_approvals_expires ON governance_approvals(expires_at);
