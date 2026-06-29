-- Phase 5 Migration 009: Create canary_state_history table
-- Track deterministic canary state transitions with full lineage
-- Database: PostgreSQL (cic_lineage)
-- Pattern: Append-only + immutability trigger (Fracture 1)

CREATE TABLE IF NOT EXISTS canary_state_history (
  id BIGSERIAL PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN (
    'submit','validate','canary_start','canary_active',
    'violation_detected','retry','rollback','abort','promote'
  )),
  version TEXT NOT NULL,
  previous_version TEXT,
  snapshot JSONB,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_canary_state_history_proposal_id ON canary_state_history(proposal_id);
CREATE INDEX IF NOT EXISTS idx_canary_state_history_state ON canary_state_history(state);
CREATE INDEX IF NOT EXISTS idx_canary_state_history_recorded_at ON canary_state_history(recorded_at);

CREATE OR REPLACE FUNCTION canary_state_history_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'canary_state_history: append-only table. Updates/deletes forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS canary_state_history_immutable_trigger ON canary_state_history;
CREATE TRIGGER canary_state_history_immutable_trigger
BEFORE UPDATE OR DELETE ON canary_state_history
FOR EACH ROW EXECUTE FUNCTION canary_state_history_immutable();
