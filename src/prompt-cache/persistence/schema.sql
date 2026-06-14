-- Cache Registry Schema v1

CREATE TABLE IF NOT EXISTS cache_documents (
  id TEXT PRIMARY KEY,
  hash TEXT NOT NULL UNIQUE,
  tokens_estimated INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_accessed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cache_accesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id TEXT NOT NULL,
  hash TEXT NOT NULL,
  was_hit BOOLEAN NOT NULL,
  cache_read_tokens INTEGER,
  input_tokens INTEGER,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(doc_id) REFERENCES cache_documents(id)
);

CREATE TABLE IF NOT EXISTS cache_metrics (
  hash TEXT PRIMARY KEY,
  total_hits INTEGER DEFAULT 0,
  total_misses INTEGER DEFAULT 0,
  total_tokens_saved INTEGER DEFAULT 0,
  cost_with_cache REAL DEFAULT 0,
  cost_without_cache REAL DEFAULT 0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hash ON cache_documents(hash);
CREATE INDEX IF NOT EXISTS idx_doc_id ON cache_accesses(doc_id);
CREATE INDEX IF NOT EXISTS idx_timestamp ON cache_accesses(timestamp);
