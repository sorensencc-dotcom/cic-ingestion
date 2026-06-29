# Phase 1: MAAL Architecture

## System Design

Phase 1 establishes a **deterministic routing layer** that sits between CIC pipeline and execution, classifying tasks and enforcing constraints without modifying Phase 0 or downstream logic.

### Data Flow

```
CIC Input
    │
    ├─ Task fingerprint (deterministic hash)
    │
    ├─ Routing regime selector (no randomness)
    │
    ├─ Constraint engine (per-regime budget)
    │
    ├─ Fallback graph validator (safety)
    │
    ├─ MAALRouter orchestration
    │
    ├─ EventStream ring buffer (non-blocking push)
    │
    ├─ BackgroundWriter flush (async to PostgreSQL)
    │
    └─ BridgeOrchestrator → ModelRouter → Execution
```

**Critical invariant:** MAAL is **stateless** and **deterministic**. Same input always produces same routing output.

## MAAL Core Components

### TaskFingerprinting

Classifies input by:
- `taskClass`: Enum-like string (e.g., "code_generation", "summarization")
- `complexityBucket`: 0–5 (schema size, branching depth)
- `modality`: "text" | "code" | "image+code"
- `schemaSignature`: SHA-256(input schema) → deterministic
- `tokenBucket`: 0–6 (estimated token count range)

```typescript
interface TaskFingerprint {
  taskClass: string;
  complexityBucket: 0 | 1 | 2 | 3 | 4 | 5;
  modality: "text" | "code" | "image+code";
  schemaSignature: string;
  tokenBucket: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}
```

### RoutingRegimeSelector

Returns regime for task:
- `local_only`: Execute locally (low latency, limited capacity)
- `hybrid`: Local + remote (balanced)
- `remote_allowed`: Remote models only (high capacity)

**Must be deterministic:** same fingerprint → same regime every time.

### ConstraintEngine

Per-regime budget enforcement:
- `maxCost`: Dollar ceiling (regime-dependent)
- `maxLatencyMs`: Latency ceiling (regime-dependent)
- `allowedModels`: Whitelist for regime (e.g., ["gpt-4", "claude-opus"])
- `disallowedModels`: Blacklist for regime (e.g., ["experimental"])

### FallbackGraphValidator

Validates fallback chain:
- Detects cycles (reject)
- Enforces max depth (e.g., 5 hops)
- Allows only known failure codes (e.g., "TIMEOUT", "OUT_OF_BUDGET")

## Ledger Substrate

### EventStream (Ring Buffer)

```typescript
interface EventStream {
  push(event: LedgerEvent): void;        // non-blocking, fixed size
  drain(batchSize: number): LedgerEvent[];  // extract batch
  size(): number;                        // current count
}
```

Fixed-size ring buffer. When full, oldest events overwrite. No memory pressure.

### BackgroundWriter

```typescript
interface BackgroundWriter {
  start(): void;                  // begin timer
  stop(): void;                   // cancel timer
  flush(): Promise<void>;         // write batch to DB
}
```

Timer-based (e.g., every 5s) drains EventStream batch → PostgreSQL `routing_history`, `drift_ledger`, etc.

Handles backpressure: if DB write stalls, buffers next batch up to high-water mark.

## Ledger Tables

### routing_history
Logs every routing decision:
```sql
CREATE TABLE routing_history (
  id SERIAL PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  task_fingerprint JSONB NOT NULL,
  routing_decision JSONB NOT NULL,
  regime TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### drift_ledger
Tracks model performance variance:
```sql
CREATE TABLE drift_ledger (
  id SERIAL PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  model_id TEXT NOT NULL,
  drift_score FLOAT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### model_performance_ledger
Per-model metrics:
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
```

### cost_ledger
Budget tracking:
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
```

## BridgeOrchestrator Integration

Modified to inject MAALRouter as dependency:

```typescript
interface BridgeOrchestrator {
  constructor(maalRouter: MAALRouter, ...);
  
  route(): MAALRoutingOutput {
    const fingerprint = TaskFingerprinting.compute(input);
    const routing = this.maalRouter.route(fingerprint, input);
    this.eventStream.push(routingEvent);
    return routing;
  }
}
```

**Critical:** MAALRouter called **before** ModelRouter. MAAL output **guides** but does not override ModelRouter selection (Phase 3 introduces override capability).

## MAALRouter Orchestration

```typescript
interface MAALRouter {
  route(
    fingerprint: TaskFingerprint,
    input: unknown
  ): MAALRoutingOutput {
    const regime = this.regimeSelector.select(fingerprint);
    const constraints = this.constraintEngine.derive(regime);
    const isValid = this.fallbackValidator.validate(fallbackEdges);
    
    return {
      regime,
      constraints,
      selectedModel: constraints.allowedModels[0]  // stub
    };
  }
}
```

## Determinism Contract

All MAAL components must be **fully deterministic**:
- No randomness (no Math.random())
- No Date.now() (use provided timestamps)
- No external I/O (phase 1 is computation-only)
- No mutable global state

**Verification:** Same fingerprint + regime selector should always return same regime, constraints, model.

---

See related:
- [Overview](PHASE-1_OVERVIEW.md)
- [MAAL Core](PHASE-1_MAAL_CORE.md)
- [Ledger Substrate](PHASE-1_LEDGER_SUBSTRATE.md)
- [BridgeOrchestrator](PHASE-1_BRIDGE_ORCHESTRATOR.md)
