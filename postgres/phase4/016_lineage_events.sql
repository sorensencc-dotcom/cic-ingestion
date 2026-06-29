-- Phase 5 Migration 016: Create lineage_events table
-- Unified PostgreSQL lineage graph (Fracture 7)
-- All governance + build + sandbox events route through this table

CREATE TABLE IF NOT EXISTS lineage_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'submit','validate','canary_start','violation','retry','rollback','abort','promote'
  )),
  source_system TEXT NOT NULL CHECK (source_system IN ('governance','build','sandbox')),
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  payload JSONB,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lineage_events_entity_id ON lineage_events(entity_id);
CREATE INDEX IF NOT EXISTS idx_lineage_events_event_type ON lineage_events(event_type);
CREATE INDEX IF NOT EXISTS idx_lineage_events_source_system ON lineage_events(source_system);
CREATE INDEX IF NOT EXISTS idx_lineage_events_recorded_at ON lineage_events(recorded_at);

CREATE OR REPLACE FUNCTION lineage_events_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'lineage_events: append-only table. Updates/deletes forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lineage_events_immutable_trigger ON lineage_events;
CREATE TRIGGER lineage_events_immutable_trigger
BEFORE UPDATE OR DELETE ON lineage_events
FOR EACH ROW EXECUTE FUNCTION lineage_events_immutable();
