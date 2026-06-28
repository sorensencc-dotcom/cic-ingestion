CREATE TABLE cost_ledger (
  id SERIAL PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  model_name VARCHAR(255) NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_units NUMERIC,
  created_at TIMESTAMP DEFAULT NOW()
);
