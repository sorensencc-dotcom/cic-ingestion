-- Phase 4: constraint_proposals — append-only constraint delta log.

CREATE TABLE IF NOT EXISTS constraint_proposals (
  id SERIAL PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  constraint_id TEXT NOT NULL,
  action TEXT NOT NULL, -- add, modify, remove
  constraint_type TEXT,
  bounds_min NUMERIC,
  bounds_max NUMERIC,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (proposal_id) REFERENCES regime_proposals(proposal_id) ON DELETE RESTRICT,
  CONSTRAINT constraint_proposals_action_valid CHECK (action IN ('add', 'modify', 'remove'))
);

CREATE INDEX IF NOT EXISTS idx_constraint_proposals_proposal_id ON constraint_proposals(proposal_id);
CREATE INDEX IF NOT EXISTS idx_constraint_proposals_constraint_id ON constraint_proposals(constraint_id);
CREATE INDEX IF NOT EXISTS idx_constraint_proposals_created_at ON constraint_proposals(created_at DESC);

-- Immutable
CREATE OR REPLACE FUNCTION constraint_proposals_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'constraint_proposals: append-only. Updates/deletes forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS constraint_proposals_immutable_trigger ON constraint_proposals;
CREATE TRIGGER constraint_proposals_immutable_trigger
BEFORE UPDATE OR DELETE ON constraint_proposals
FOR EACH ROW EXECUTE FUNCTION constraint_proposals_immutable();
