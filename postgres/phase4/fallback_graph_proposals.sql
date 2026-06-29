-- Phase 4: fallback_graph_proposals — append-only ledger for fallback graph changes.

CREATE TABLE IF NOT EXISTS fallback_graph_proposals (
  id SERIAL PRIMARY KEY,
  proposal_id TEXT NOT NULL UNIQUE,
  submitted_by TEXT NOT NULL,
  fallback_id TEXT NOT NULL,
  predecessors TEXT[], -- array of predecessor IDs
  successors TEXT[], -- array of successor IDs
  weight FLOAT,
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

CREATE INDEX IF NOT EXISTS idx_fallback_proposals_status ON fallback_graph_proposals(governance_status);
