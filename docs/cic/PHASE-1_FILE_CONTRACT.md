# Phase 1: File Contract

**Status:** Immutable (locked)  
**Version:** v0.1.0-maal-foundation

## Scope

Phase 1 creates exactly 10 files across 3 directories. Zero additional files permitted.

## Directory Structure

```
cic-os/
  src/
    core/
      ledger/
        - EventStream.ts
        - BackgroundWriter.ts
        - index.ts
      maal/
        - TaskFingerprint.ts
        - RoutingRegimeSelector.ts
        - ConstraintEngine.ts
        - FallbackGraphValidator.ts
        - MAALRouter.ts
        - MAALRoutingOutput.ts
        - index.ts

cic-ingestion/
  src/
    orchestrator/
      - BridgeOrchestrator.ts (modified only)

postgres/
  ledgers/
    - routing_history.sql
    - drift_ledger.sql
    - model_performance_ledger.sql
    - cost_ledger.sql
```

## File Specifications

### cic-os/src/core/ledger/EventStream.ts

```typescript
export interface LedgerEvent {
  id: string;
  timestamp: number;
  eventType: string;
  data: unknown;
}

export class EventStream {
  constructor(maxSize: number);
  push(event: LedgerEvent): void;
  drain(batchSize: number): LedgerEvent[];
  size(): number;
}

export const createEventStream = (maxSize: number): EventStream => {...};
```

**Lines:** 30–50  
**Exports:** `LedgerEvent`, `EventStream`, `createEventStream`

---

### cic-os/src/core/ledger/BackgroundWriter.ts

```typescript
export interface BackgroundWriterConfig {
  flushIntervalMs?: number;
  batchSize?: number;
  highWaterMark?: number;
  connectionPool: PgPool;
}

export class BackgroundWriter {
  constructor(config: BackgroundWriterConfig, eventStream: EventStream);
  start(): void;
  stop(): void;
  flush(): Promise<void>;
}

export const createBackgroundWriter = (...): BackgroundWriter => {...};
```

**Lines:** 30–60  
**Exports:** `BackgroundWriterConfig`, `BackgroundWriter`, `createBackgroundWriter`

---

### cic-os/src/core/ledger/index.ts

```typescript
export { LedgerEvent, EventStream, createEventStream } from "./EventStream";
export { BackgroundWriterConfig, BackgroundWriter, createBackgroundWriter } from "./BackgroundWriter";
```

**Lines:** 1–5

---

### cic-os/src/core/maal/TaskFingerprint.ts

```typescript
export interface TaskFingerprint {
  taskClass: string;
  complexityBucket: 0 | 1 | 2 | 3 | 4 | 5;
  modality: "text" | "code" | "image+code";
  schemaSignature: string;
  tokenBucket: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

export class TaskFingerprinter {
  compute(input: unknown): TaskFingerprint;
}

export const createTaskFingerprinter = (): TaskFingerprinter => {...};
```

**Lines:** 30–50  
**Exports:** `TaskFingerprint`, `TaskFingerprinter`, `createTaskFingerprinter`

---

### cic-os/src/core/maal/RoutingRegimeSelector.ts

```typescript
export type RoutingRegime = "local_only" | "hybrid" | "remote_allowed";

export interface RoutingRegimeSelector {
  select(fingerprint: TaskFingerprint): RoutingRegime;
}

export const createRoutingRegimeSelector = (): RoutingRegimeSelector => {...};
```

**Lines:** 20–40  
**Exports:** `RoutingRegime`, `RoutingRegimeSelector`, `createRoutingRegimeSelector`

---

### cic-os/src/core/maal/ConstraintEngine.ts

```typescript
export interface RoutingConstraints {
  maxCost: number;
  maxLatencyMs: number;
  allowedModels: string[];
  disallowedModels: string[];
}

export interface ConstraintEngine {
  derive(regime: RoutingRegime): RoutingConstraints;
}

export const createConstraintEngine = (): ConstraintEngine => {...};
```

**Lines:** 30–50  
**Exports:** `RoutingConstraints`, `ConstraintEngine`, `createConstraintEngine`

---

### cic-os/src/core/maal/FallbackGraphValidator.ts

```typescript
export interface FallbackEdge {
  from: string;
  to: string;
  onFailureCode: string;
}

export interface FallbackGraphValidator {
  validate(edges: FallbackEdge[]): boolean;
}

export const createFallbackGraphValidator = (): FallbackGraphValidator => {...};
```

**Lines:** 20–40  
**Exports:** `FallbackEdge`, `FallbackGraphValidator`, `createFallbackGraphValidator`

---

### cic-os/src/core/maal/MAALRouter.ts

```typescript
export interface MAALRoutingOutput {
  regime: RoutingRegime;
  constraints: RoutingConstraints;
  selectedModel?: string;
}

export interface MAALRouter {
  route(
    fingerprint: TaskFingerprint,
    input: unknown
  ): MAALRoutingOutput;
}

export const createMAALRouter = (
  fingerprinter: TaskFingerprinter,
  regimeSelector: RoutingRegimeSelector,
  constraintEngine: ConstraintEngine,
  fallbackValidator: FallbackGraphValidator
): MAALRouter => {...};
```

**Lines:** 40–70  
**Exports:** `MAALRoutingOutput`, `MAALRouter`, `createMAALRouter`

---

### cic-os/src/core/maal/MAALRoutingOutput.ts

```typescript
// Alias/re-export if needed, or integrate into MAALRouter.ts
export type MAALRoutingOutput = { ... };
```

(May be folded into MAALRouter.ts)

---

### cic-os/src/core/maal/index.ts

```typescript
export { TaskFingerprint, TaskFingerprinter, createTaskFingerprinter } from "./TaskFingerprint";
export { RoutingRegime, RoutingRegimeSelector, createRoutingRegimeSelector } from "./RoutingRegimeSelector";
export { RoutingConstraints, ConstraintEngine, createConstraintEngine } from "./ConstraintEngine";
export { FallbackEdge, FallbackGraphValidator, createFallbackGraphValidator } from "./FallbackGraphValidator";
export { MAALRoutingOutput, MAALRouter, createMAALRouter } from "./MAALRouter";
```

**Lines:** 1–10

---

### cic-ingestion/src/orchestrator/BridgeOrchestrator.ts

**Modifications only.** Existing file.

Add:
```typescript
import { MAALRouter } from "cic-os/src/core/maal";

export interface BridgeOrchestratorConfig {
  maalRouter: MAALRouter;
  eventStream: EventStream;
  backgroundWriter: BackgroundWriter;
  modelRouter: ModelRouter;
}

export class BridgeOrchestrator {
  constructor(config: BridgeOrchestratorConfig);
  
  async route(input: unknown): Promise<ExecutionResult> {
    const fingerprint = ...;
    const maalOutput = this.maalRouter.route(fingerprint, input);
    this.eventStream.push(...);
    return this.modelRouter.select(input, maalOutput.constraints);
  }
}
```

**Modified lines:** ~30–60 (new methods)  
**Existing code:** Untouched

---

### postgres/ledgers/routing_history.sql

```sql
CREATE TABLE routing_history (
  id SERIAL PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  task_fingerprint JSONB NOT NULL,
  routing_decision JSONB NOT NULL,
  regime TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_routing_history_timestamp ON routing_history(timestamp);
CREATE INDEX idx_routing_history_regime ON routing_history(regime);
```

---

### postgres/ledgers/drift_ledger.sql

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

---

### postgres/ledgers/model_performance_ledger.sql

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

---

### postgres/ledgers/cost_ledger.sql

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

---

## Validation Checklist

- [ ] All 10 files exist with correct paths
- [ ] All TypeScript exports match signatures above
- [ ] All SQL schemas match DDL above
- [ ] No additional directories beyond `ledger/`, `maal/`
- [ ] No additional files (no utils, factories, helpers)
- [ ] BridgeOrchestrator modified only, not rewritten
- [ ] All interfaces have factory functions (createX)
- [ ] All classes are constructible with config objects
- [ ] No SPL code, training code, or Phase 2/3 dependencies

---

See related:
- [Overview](PHASE-1_OVERVIEW.md)
- [Implementation Order](PHASE-1_IMPLEMENTATION_ORDER.md)
