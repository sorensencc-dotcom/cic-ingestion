# Phase 1: Ledger Substrate

## Overview

Ledger substrate provides **durable, non-blocking** logging of all routing decisions and model performance metrics.

Two-tier design:
1. **EventStream (in-memory)**: Ring buffer, non-blocking push
2. **BackgroundWriter (async)**: Timer-based flush to PostgreSQL

## EventStream (Ring Buffer)

### Purpose

In-memory queue that buffers LedgerEvent before async write to DB. Ring buffer prevents memory bloat.

### Interface

```typescript
export interface LedgerEvent {
  id: string;              // unique event ID
  timestamp: number;       // milliseconds
  eventType: string;       // "routing_decision", "model_outcome", "constraint_violation"
  data: unknown;           // event payload
}

export interface EventStream {
  push(event: LedgerEvent): void;
  drain(batchSize: number): LedgerEvent[];
  size(): number;
}
```

### Implementation Details

- **Size**: Fixed (e.g., 10,000 events) — configurable
- **Push**: O(1) non-blocking append. If full, overwrites oldest.
- **Drain**: Returns up to `batchSize` events. Removes from buffer.
- **Size**: Returns current count.

### Example

```typescript
const stream = new EventStream(10000);

stream.push({
  id: "evt-1",
  timestamp: Date.now(),
  eventType: "routing_decision",
  data: {
    fingerprint: { taskClass: "code_gen", ... },
    regime: "hybrid",
    selectedModel: "gpt-3.5"
  }
});

const batch = stream.drain(100);  // fetch up to 100
console.log(stream.size());       // remaining count
```

---

## BackgroundWriter

### Purpose

Asynchronously flushes EventStream batches to PostgreSQL on timer.

### Interface

```typescript
export interface BackgroundWriterConfig {
  flushIntervalMs?: number;       // timer interval (default: 5000)
  batchSize?: number;             // max events per flush (default: 100)
  highWaterMark?: number;         // pause if stream.size() > this (default: 5000)
  connectionPool: PgPool;         // PostgreSQL pool
}

export interface BackgroundWriter {
  start(): void;                  // begin timer
  stop(): void;                   // cancel timer
  flush(): Promise<void>;         // write pending batch to DB
}
```

### Behavior

1. **Timer starts** on `.start()`. Every `flushIntervalMs`:
   - Check if `stream.size() > highWaterMark`. If yes, skip (backpressure).
   - Drain up to `batchSize` events.
   - Batch write to `routing_history`, `drift_ledger`, etc.
   - Log flush result (success/error).

2. **Backpressure handling**: If DB is slow, stops draining to prevent OOM.

3. **Graceful stop** on `.stop()`. Cancels timer.

4. **Manual flush** via `.flush()` (for tests, graceful shutdown).

### Example

```typescript
const writer = new BackgroundWriter({
  flushIntervalMs: 5000,
  batchSize: 100,
  highWaterMark: 5000,
  connectionPool: pg_pool
});

writer.start();

// Timer fires every 5s, drains EventStream → PostgreSQL

await writer.flush();  // manual flush
writer.stop();         // cancel timer
```

---

## PostgreSQL Schema

### routing_history

Logs every routing decision.

```sql
CREATE TABLE routing_history (
  id SERIAL PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  task_fingerprint JSONB NOT NULL,
  routing_decision JSONB NOT NULL,
  regime TEXT NOT NULL,
  selected_model TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_routing_history_timestamp ON routing_history(timestamp);
CREATE INDEX idx_routing_history_regime ON routing_history(regime);
```

**Columns:**
- `task_fingerprint`: TaskFingerprint JSONB
  ```json
  {
    "taskClass": "code_gen",
    "complexityBucket": 2,
    "modality": "code",
    "schemaSignature": "a1b2c3d4...",
    "tokenBucket": 3
  }
  ```
- `routing_decision`: MAALRoutingOutput JSONB
  ```json
  {
    "regime": "hybrid",
    "constraints": {
      "maxCost": 0.10,
      "maxLatencyMs": 5000,
      "allowedModels": ["local-mistral", "gpt-3.5"],
      "disallowedModels": []
    }
  }
  ```

---

### drift_ledger

Tracks per-model performance variance.

```sql
CREATE TABLE drift_ledger (
  id SERIAL PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  model_id TEXT NOT NULL,
  drift_score FLOAT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_drift_ledger_model ON drift_ledger(model_id, timestamp);
```

**Columns:**
- `model_id`: "gpt-3.5", "gpt-4", "claude-opus", etc.
- `drift_score`: Cosine distance from baseline (0–1, 0=no drift, 1=complete divergence)

---

### model_performance_ledger

Per-model aggregated metrics.

```sql
CREATE TABLE model_performance_ledger (
  id SERIAL PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  model_id TEXT NOT NULL,
  avg_latency_ms FLOAT NOT NULL,
  avg_cost FLOAT NOT NULL,
  success_rate FLOAT NOT NULL,
  sample_count INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_model_perf_model ON model_performance_ledger(model_id, timestamp);
```

**Columns:**
- `avg_latency_ms`: Mean response time
- `avg_cost`: Mean cost per invocation
- `success_rate`: 0–1 (successful completions / total invocations)
- `sample_count`: Number of samples in this window

---

### cost_ledger

Tracks budget utilization and overages.

```sql
CREATE TABLE cost_ledger (
  id SERIAL PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  regime TEXT NOT NULL,
  cost_used FLOAT NOT NULL,
  cost_budget FLOAT NOT NULL,
  overages INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cost_ledger_regime ON cost_ledger(regime, timestamp);
```

**Columns:**
- `regime`: "local_only", "hybrid", or "remote_allowed"
- `cost_used`: Sum of costs in time window
- `cost_budget`: Allocated budget
- `overages`: Count of requests that exceeded cost ceiling

---

## Data Flow

```
CIC → TaskFingerprinting → MAALRouter → EventStream (push)
                                              │
                                              ├─ ring buffer (non-blocking)
                                              │
                                              └─ BackgroundWriter (timer-based)
                                                   │
                                                   ├─ wait 5s
                                                   │
                                                   └─ drain(100) → PostgreSQL batch insert
                                                        ├─ routing_history
                                                        ├─ drift_ledger
                                                        ├─ model_performance_ledger
                                                        └─ cost_ledger
```

---

## Durability Contract

- **EventStream**: In-memory buffer. Lost on process crash.
- **BackgroundWriter**: Async flush every 5s. At-least-once delivery (no deduplication).
- **PostgreSQL**: Durable ACID storage. Source of truth.

**Recovery:** Restart process, ledger picks up from last flush timestamp.

---

## Performance Characteristics

- **Push latency**: ~0.1ms (O(1) ring buffer append)
- **Drain latency**: ~1ms for 100 events
- **Flush latency**: ~50ms for batch insert (50–100 events)
- **Memory overhead**: ~10MB for 10k events

---

See related:
- [Architecture](PHASE-1_ARCHITECTURE.md)
- [MAAL Core](PHASE-1_MAAL_CORE.md)
- [BridgeOrchestrator](PHASE-1_BRIDGE_ORCHESTRATOR.md)
