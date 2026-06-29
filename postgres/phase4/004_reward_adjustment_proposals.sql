-- Phase 4: reward_adjustment_proposals — reward component tuning log.

CREATE TABLE IF NOT EXISTS reward_adjustment_proposals (
  id SERIAL PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  component_id TEXT NOT NULL, -- success, latency, cost, etc.
  new_weight NUMERIC CHECK (new_weight BETWEEN 0 AND 1),
  new_threshold NUMERIC CHECK (new_threshold BETWEEN 0 AND 1),
  old_weight NUMERIC,
  old_threshold NUMERIC,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (proposal_id) REFERENCES regime_proposals(proposal_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_reward_adjustment_proposals_proposal_id ON reward_adjustment_proposals(proposal_id);
CREATE INDEX IF NOT EXISTS idx_reward_adjustment_proposals_component_id ON reward_adjustment_proposals(component_id);

-- Immutable
CREATE OR REPLACE FUNCTION reward_adjustment_proposals_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'reward_adjustment_proposals: append-only. Updates/deletes forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reward_adjustment_proposals_immutable_trigger ON reward_adjustment_proposals;
CREATE TRIGGER reward_adjustment_proposals_immutable_trigger
BEFORE UPDATE OR DELETE ON reward_adjustment_proposals
FOR EACH ROW EXECUTE FUNCTION reward_adjustment_proposals_immutable();
