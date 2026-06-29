-- Phase 4: constraint_proposals — append-only ledger for constraint change proposals.

CREATE TABLE IF NOT EXISTS constraint_proposals (
  id SERIAL PRIMARY KEY,
  proposal_id TEXT NOT NULL UNIQUE,
  submitted_by TEXT NOT NULL,
  constraint_id TEXT NOT NULL,
  action TEXT NOT NULL, -- 'add', 'modify', 'remove'
  constraint_type TEXT NOT NULL, -- 'latency', 'cost', 'correctness'
  bounds_min FLOAT,
  bounds_max FLOAT,
  rationale TEXT,
  submitted_at BIGINT NOT NULL,
  validated_at BIGINT,
  validation_result JSONB,
  governance_status TEXT, -- 'pending', 'approved', 'rejected', 'expired'
  governance_decided_at BIGINT,
  governance_decided_by TEXT,
  canary_assigned_at BIGINT,
  canary_promoted_at BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_constraint_proposals_status ON constraint_proposals(governance_status);
CREATE INDEX IF NOT EXISTS idx_constraint_proposals_type ON constraint_proposals(constraint_type);
