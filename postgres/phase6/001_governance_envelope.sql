-- Phase 6: governance_envelope — canonical governance state for each proposal
-- Tracks version, lineage depth, risk score, adaptive thresholds, lambda weight

CREATE TABLE IF NOT EXISTS governance_envelope (
  proposal_id TEXT PRIMARY KEY,
  current_version TEXT NOT NULL,
  previous_version TEXT NOT NULL,
  lineage_depth INT NOT NULL DEFAULT 1,
  last_violation JSONB, -- {type, severity, occurred_at}
  last_rollback JSONB,  -- {reason, occurred_at}
  risk_score NUMERIC(4,3) NOT NULL DEFAULT 0.0,
  hybrid_threshold NUMERIC(4,3) NOT NULL DEFAULT 0.30,
  lambda_weight NUMERIC(4,3) NOT NULL DEFAULT 0.37,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT risk_score_range CHECK (risk_score >= 0 AND risk_score <= 1.0),
  CONSTRAINT threshold_range CHECK (hybrid_threshold >= 0.20 AND hybrid_threshold <= 0.40),
  CONSTRAINT lambda_range CHECK (lambda_weight >= 0.20 AND lambda_weight <= 0.60)
);

CREATE INDEX IF NOT EXISTS idx_governance_envelope_updated_at ON governance_envelope(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_governance_envelope_risk_score ON governance_envelope(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_governance_envelope_lineage_depth ON governance_envelope(lineage_depth DESC);
