-- Phase 4: regime_proposals — append-only ledger for regime change proposals.

CREATE TABLE IF NOT EXISTS regime_proposals (
  id SERIAL PRIMARY KEY,
  proposal_id TEXT NOT NULL UNIQUE,
  submitted_by TEXT NOT NULL,
  regime_id TEXT NOT NULL,
  model_selector TEXT,
  fallback_behavior TEXT,
  constraints JSONB,
  rationale TEXT,
  submitted_at BIGINT NOT NULL,
  validated_at BIGINT,
  validation_result JSONB,
  governance_status TEXT, -- 'pending', 'approved', 'rejected', 'expired'
  governance_decided_at BIGINT,
  governance_decided_by TEXT,
  governance_rationale TEXT,
  canary_assigned_at BIGINT,
  canary_promoted_at BIGINT,
  canary_rolled_back_at BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_regime_proposals_status ON regime_proposals(governance_status);
CREATE INDEX IF NOT EXISTS idx_regime_proposals_submitted_at ON regime_proposals(submitted_at DESC);
