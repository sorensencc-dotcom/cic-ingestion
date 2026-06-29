-- Phase 5 Migration 017: Create lineage_edges table
-- Relationships between lineage events (unified graph)

CREATE TABLE IF NOT EXISTS lineage_edges (
  parent_event_id BIGINT NOT NULL,
  child_event_id BIGINT NOT NULL,
  edge_type TEXT NOT NULL CHECK (edge_type IN ('caused_by','preceded_by','rolled_back_to')),
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (parent_event_id, child_event_id),
  FOREIGN KEY (parent_event_id) REFERENCES lineage_events(id) ON DELETE RESTRICT,
  FOREIGN KEY (child_event_id) REFERENCES lineage_events(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_lineage_edges_parent_id ON lineage_edges(parent_event_id);
CREATE INDEX IF NOT EXISTS idx_lineage_edges_child_id ON lineage_edges(child_event_id);
CREATE INDEX IF NOT EXISTS idx_lineage_edges_edge_type ON lineage_edges(edge_type);

CREATE OR REPLACE FUNCTION lineage_edges_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'lineage_edges: append-only table. Updates/deletes forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lineage_edges_immutable_trigger ON lineage_edges;
CREATE TRIGGER lineage_edges_immutable_trigger
BEFORE UPDATE OR DELETE ON lineage_edges
FOR EACH ROW EXECUTE FUNCTION lineage_edges_immutable();
