CREATE TABLE routing_history (
  id SERIAL PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  task_fingerprint JSONB NOT NULL,
  routing_decision JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
