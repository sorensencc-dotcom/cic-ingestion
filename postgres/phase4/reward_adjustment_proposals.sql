-- Phase 4: reward_adjustment_proposals — append-only ledger for reward function changes.

CREATE TABLE IF NOT EXISTS reward_adjustment_proposals (
  id SERIAL PRIMARY KEY,
  proposal_id TEXT NOT NULL UNIQUE,
  submitted_by TEXT NOT NULL,
  component_id TEXT NOT NULL, -- 'success', 'latency', 'cost', etc.
  new_weight FLOAT,
  new_threshold FLOAT,
  old_weight FLOAT,
  old_threshold FLOAT,
  rationale TEXT,
  submitted_at BIGINT NOT NULL,
  validated_at BIGINT,
  validation_result JSONB,
  governance_status TEXT,
  governance_decided_at BIGINT,
  governance_decided_by TEXT,
  canary_promoted_at BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reward_proposals_status ON reward_adjustment_proposals(governance_status);
CREATE INDEX IF NOT EXISTS idx_reward_proposals_component ON reward_adjustment_proposals(component_id);
