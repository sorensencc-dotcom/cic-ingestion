# Phase 1: Implementation Order (12 Steps)

**Strict execution sequence.** Each step builds on prior steps. Steps 6–12 have method signatures.

---

## STEP 1: Create Directory Skeleton

Create:
```
cic-os/src/core/ledger/
cic-os/src/core/maal/
cic-ingestion/src/orchestrator/  (existing, no changes yet)
postgres/ledgers/
```

**Output:** Empty directories.

---

## STEP 2: Scaffold Ledger Event Types

Create:
- `cic-os/src/core/ledger/LedgerEvent.ts` (type def)
- `cic-os/src/core/ledger/EventStream.ts` (interface)
- `cic-os/src/core/ledger/BackgroundWriter.ts` (interface)

**EventStream interface:**
```typescript
export interface EventStream {
  push(event: LedgerEvent): void;
  drain(batchSize: number): LedgerEvent[];
  size(): number;
}
```

**BackgroundWriter interface:**
```typescript
export interface BackgroundWriter {
  start(): void;
  stop(): void;
  flush(): Promise<void>;
}
```

---

## STEP 3: Scaffold MAAL Core Interfaces

Create:
- `cic-os/src/core/maal/TaskFingerprint.ts`
- `cic-os/src/core/maal/RoutingRegimeSelector.ts`
- `cic-os/src/core/maal/ConstraintEngine.ts`
- `cic-os/src/core/maal/FallbackGraphValidator.ts`
- `cic-os/src/core/maal/MAALRouter.ts`
- `cic-os/src/core/maal/MAALRoutingOutput.ts`

**TaskFingerprint:**
```typescript
export interface TaskFingerprint {
  taskClass: string;
  complexityBucket: 0 | 1 | 2 | 3 | 4 | 5;
  modality: "text" | "code" | "image+code";
  schemaSignature: string;
  tokenBucket: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}
```

**RoutingRegimeSelector:**
```typescript
export type RoutingRegime = "local_only" | "hybrid" | "remote_allowed";

export interface RoutingRegimeSelector {
  select(fingerprint: TaskFingerprint): RoutingRegime;
}
```

**ConstraintEngine:**
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
```

**FallbackGraphValidator:**
```typescript
export interface FallbackEdge {
  from: string;
  to: string;
  onFailureCode: string;
}

export interface FallbackGraphValidator {
  validate(edges: FallbackEdge[]): boolean;
}
```

**MAALRouter:**
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
```

---

## STEP 4: Add BridgeOrchestrator Dependency Interface

Modify: `cic-ingestion/src/orchestrator/BridgeOrchestrator.ts`

Add interface (no implementation changes):
```typescript
export interface MAARLRouterDependency {
  maalRouter: MAALRouter;
}
```

---

## STEP 5: Scaffold SQL Ledger Schemas

Create:
- `postgres/ledgers/routing_history.sql`
- `postgres/ledgers/drift_ledger.sql`
- `postgres/ledgers/model_performance_ledger.sql`
- `postgres/ledgers/cost_ledger.sql`

Each file contains CREATE TABLE + indexes (see File Contract).

---

## STEP 6: Implement MAALRouter

Implement:
```typescript
export class MAALRouter {
  constructor(
    fingerprinter: TaskFingerprinter,
    regimeSelector: RoutingRegimeSelector,
    constraintEngine: ConstraintEngine,
    fallbackValidator: FallbackGraphValidator
  ) { ... }
  
  route(
    fingerprint: TaskFingerprint,
    input: unknown
  ): MAALRoutingOutput {
    // Orchestrate above components
    // Return placeholder output (no actual logic yet, or full logic if ready)
  }
}
```

**Logic (full implementation):**
```typescript
route(fingerprint, input) {
  const regime = this.regimeSelector.select(fingerprint);
  const constraints = this.constraintEngine.derive(regime);
  const isValid = this.fallbackValidator.validate(fallbackEdges);
  
  if (!isValid) throw new Error("Invalid fallback graph");
  
  return {
    regime,
    constraints,
    selectedModel: constraints.allowedModels[0]  // deterministic tiebreak
  };
}
```

---

## STEP 7: Implement ConstraintEngine

Implement:
```typescript
export class ConstraintEngine {
  derive(regime: RoutingRegime): RoutingConstraints {
    // Return per-regime constraints
    // See PHASE-1_MAAL_CORE.md for rules
  }
}
```

---

## STEP 8: Implement RoutingRegimeSelector

Implement:
```typescript
export class RoutingRegimeSelector {
  select(fingerprint: TaskFingerprint): RoutingRegime {
    // Deterministic regime selection
    // See PHASE-1_MAAL_CORE.md for rules
  }
}
```

---

## STEP 9: Implement FallbackGraphValidator

Implement:
```typescript
export class FallbackGraphValidator {
  validate(edges: FallbackEdge[]): boolean {
    // Detect cycles
    // Enforce max depth ≤ 5
    // Validate failure codes
    // Return true if valid
  }
}
```

---

## STEP 10: Implement TaskFingerprinter

Implement:
```typescript
export class TaskFingerprinter {
  compute(input: unknown): TaskFingerprint {
    // Deterministic fingerprinting
    // See PHASE-1_MAAL_CORE.md for rules
  }
}
```

---

## STEP 11: Implement EventStream + BackgroundWriter

Implement ring buffer (EventStream):
```typescript
export class EventStream {
  constructor(maxSize: number) {
    this.buffer = new RingBuffer(maxSize);
  }
  
  push(event: LedgerEvent): void {
    this.buffer.push(event);  // O(1), non-blocking
  }
  
  drain(batchSize: number): LedgerEvent[] {
    return this.buffer.drain(batchSize);
  }
  
  size(): number {
    return this.buffer.size();
  }
}
```

Implement background writer (BackgroundWriter):
```typescript
export class BackgroundWriter {
  constructor(config: BackgroundWriterConfig, eventStream: EventStream) {
    this.config = config;
    this.eventStream = eventStream;
    this.timer = null;
  }
  
  start(): void {
    this.timer = setInterval(() => this.flush(), this.config.flushIntervalMs);
  }
  
  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }
  
  async flush(): Promise<void> {
    if (this.eventStream.size() > this.config.highWaterMark) {
      return;  // backpressure
    }
    
    const batch = this.eventStream.drain(this.config.batchSize);
    if (batch.length === 0) return;
    
    // Batch insert to PostgreSQL
    await this.config.connectionPool.query(
      "INSERT INTO routing_history ..."
    );
  }
}
```

---

## STEP 12: Integrate with BridgeOrchestrator + Smoke Tests

Modify: `cic-ingestion/src/orchestrator/BridgeOrchestrator.ts`

Implement `.route()` method:
```typescript
async route(input: unknown): Promise<ExecutionResult> {
  const fingerprint = this.fingerprinter.compute(input);
  const maalOutput = this.maalRouter.route(fingerprint, input);
  
  this.eventStream.push({
    id: uuid(),
    timestamp: Date.now(),
    eventType: "routing_decision",
    data: { fingerprint, maalOutput }
  });
  
  return this.modelRouter.select(input, maalOutput.constraints);
}
```

Create smoke test suite:
- `cic-os/src/core/__tests__/maal.smoke.test.ts`
- `cic-os/src/core/__tests__/ledger.integration.test.ts`

**Tests:**
- TaskFingerprinter determinism (same input → same output)
- RoutingRegimeSelector all buckets
- ConstraintEngine per-regime
- FallbackGraphValidator cycle detection
- EventStream push/drain
- BackgroundWriter flush
- BridgeOrchestrator integration
- Ledger durability

---

## STEP 13: Freeze Phase 1

Tag: `v0.1.0-maal-foundation`

All 10 files present. All interfaces implemented. All tests passing.

---

See related:
- [File Contract](PHASE-1_FILE_CONTRACT.md)
- [Testing](PHASE-1_TESTING.md)
