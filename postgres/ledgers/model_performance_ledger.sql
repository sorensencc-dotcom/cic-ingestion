CREATE TABLE model_performance_ledger (
  id SERIAL PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  model_name VARCHAR(255) NOT NULL,
  latency_ms INTEGER,
  cost_units NUMERIC,
  success BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW()
);
