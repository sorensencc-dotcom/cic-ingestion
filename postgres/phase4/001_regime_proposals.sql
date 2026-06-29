-- Phase 4: regime_proposals — append-only proposal log.
-- No UPDATE/DELETE; audit trail immutable.

CREATE TABLE IF NOT EXISTS regime_proposals (
  id SERIAL PRIMARY KEY,
  proposal_id TEXT UNIQUE NOT NULL,
  submitted_by TEXT NOT NULL,
  regime_id TEXT NOT NULL,
  model_selector JSONB,
  fallback_behavior JSONB,
  constraints JSONB,
  rationale TEXT,
  governance_status TEXT DEFAULT 'pending', -- pending, approved, rejected
  validation_status TEXT DEFAULT 'valid', -- valid, invalid
  canary_assigned_at TIMESTAMP,
  canary_promoted_at TIMESTAMP,
  canary_rolled_back_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT regime_proposals_no_update CHECK (true)
);

CREATE INDEX IF NOT EXISTS idx_regime_proposals_proposal_id ON regime_proposals(proposal_id);
CREATE INDEX IF NOT EXISTS idx_regime_proposals_governance_status ON regime_proposals(governance_status);
CREATE INDEX IF NOT EXISTS idx_regime_proposals_created_at ON regime_proposals(created_at DESC);

-- Prevent modification (trigger-based insurance)
CREATE OR REPLACE FUNCTION regime_proposals_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'regime_proposals: append-only table. Updates/deletes forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS regime_proposals_immutable_trigger ON regime_proposals;
CREATE TRIGGER regime_proposals_immutable_trigger
BEFORE UPDATE OR DELETE ON regime_proposals
FOR EACH ROW EXECUTE FUNCTION regime_proposals_immutable();
