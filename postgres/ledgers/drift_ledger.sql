CREATE TABLE drift_ledger (
  id SERIAL PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  drift_type VARCHAR(255) NOT NULL,
  severity VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
