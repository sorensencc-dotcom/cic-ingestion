-- CIC Memory Store Schema - Phase 1.0 + Phase 1.1
-- Deterministic initialization for PostgreSQL

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "jsonb";

-- ===== Phase 23: Memory Store =====
CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(50) NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  decay_factor FLOAT DEFAULT 1.0,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
CREATE INDEX IF NOT EXISTS idx_memories_expires ON memories(expires_at);
CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at DESC);

-- ===== Phase 24: Governance Engine =====
CREATE TABLE IF NOT EXISTS governance_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposal_id UUID NOT NULL,
  decision_type VARCHAR(50) NOT NULL,
  council_votes JSONB,
  policy_rails JSONB,
  decay_status VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  audit_log JSONB
);

CREATE INDEX IF NOT EXISTS idx_gov_proposal ON governance_decisions(proposal_id);
CREATE INDEX IF NOT EXISTS idx_gov_decision_type ON governance_decisions(decision_type);

-- ===== Phase 25: Knowledge Graph =====
CREATE TABLE IF NOT EXISTS graph_vertices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label VARCHAR(100) NOT NULL,
  properties JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS graph_edges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES graph_vertices(id),
  target_id UUID NOT NULL REFERENCES graph_vertices(id),
  relationship VARCHAR(100) NOT NULL,
  weight FLOAT DEFAULT 1.0,
  properties JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_edges_source ON graph_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON graph_edges(target_id);
CREATE INDEX IF NOT EXISTS idx_vertices_label ON graph_vertices(label);

-- ===== Phase 1.1: Audit Trail =====
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  component VARCHAR(50) NOT NULL,
  action VARCHAR(100) NOT NULL,
  actor VARCHAR(100),
  details JSONB,
  severity VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_component ON audit_log(component);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

-- ===== Phase 1.1: Determinism Log =====
CREATE TABLE IF NOT EXISTS determinism_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_scenario VARCHAR(100) NOT NULL,
  input_hash VARCHAR(64) NOT NULL,
  output_hash VARCHAR(64),
  match BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_determinism_scenario ON determinism_log(test_scenario);
CREATE INDEX IF NOT EXISTS idx_determinism_match ON determinism_log(match);

-- ===== Phase 1.1: Metrics =====
CREATE TABLE IF NOT EXISTS metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  component VARCHAR(50) NOT NULL,
  metric_name VARCHAR(100) NOT NULL,
  value FLOAT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_metrics_component ON metrics(component);
CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp DESC);

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cic;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cic;
