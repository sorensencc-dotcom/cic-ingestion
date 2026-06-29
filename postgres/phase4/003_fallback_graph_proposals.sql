-- Phase 4: fallback_graph_proposals — fallback DAG restructuring log.

CREATE TABLE IF NOT EXISTS fallback_graph_proposals (
  id SERIAL PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  fallback_id TEXT NOT NULL,
  predecessors TEXT[] DEFAULT '{}',
  successors TEXT[] DEFAULT '{}',
  weight NUMERIC CHECK (weight BETWEEN 0 AND 1),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (proposal_id) REFERENCES regime_proposals(proposal_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_fallback_graph_proposals_proposal_id ON fallback_graph_proposals(proposal_id);
CREATE INDEX IF NOT EXISTS idx_fallback_graph_proposals_fallback_id ON fallback_graph_proposals(fallback_id);

-- Immutable
CREATE OR REPLACE FUNCTION fallback_graph_proposals_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'fallback_graph_proposals: append-only. Updates/deletes forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fallback_graph_proposals_immutable_trigger ON fallback_graph_proposals;
CREATE TRIGGER fallback_graph_proposals_immutable_trigger
BEFORE UPDATE OR DELETE ON fallback_graph_proposals
FOR EACH ROW EXECUTE FUNCTION fallback_graph_proposals_immutable();
