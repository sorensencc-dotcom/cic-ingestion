-- CIC Usage & Cost Ledger
-- Unified schema capturing all LLM calls with tokens, cost, and metadata

CREATE TABLE usage_cost_ledger (
  id            SERIAL PRIMARY KEY,
  ts            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model         VARCHAR(255) NOT NULL,
  tokens_in     INTEGER NOT NULL DEFAULT 0,
  tokens_out    INTEGER NOT NULL DEFAULT 0,
  total_tokens  INTEGER NOT NULL DEFAULT 0,
  cost_usd      NUMERIC(12, 8) NOT NULL DEFAULT 0,
  source        VARCHAR(100),
  stage         VARCHAR(100),
  agent         VARCHAR(100),
  job_id        VARCHAR(255),
  local         BOOLEAN NOT NULL DEFAULT FALSE,
  env           VARCHAR(20) DEFAULT 'prod'
);

CREATE INDEX idx_usage_cost_ts ON usage_cost_ledger (ts);
CREATE INDEX idx_usage_cost_source_stage ON usage_cost_ledger (source, stage);
CREATE INDEX idx_usage_cost_agent ON usage_cost_ledger (agent);
CREATE INDEX idx_usage_cost_job_id ON usage_cost_ledger (job_id);
CREATE INDEX idx_usage_cost_env ON usage_cost_ledger (env);
