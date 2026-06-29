# Phase 1: BridgeOrchestrator Integration

## Overview

BridgeOrchestrator integrates MAALRouter as a **precursor** to ModelRouter. All tasks routed through MAAL before ModelRouter makes final selection.

**Critical invariant:** MAAL provides **guidance**, not override. ModelRouter retains veto power (Phase 3 introduces governance-gated override).

## Modified BridgeOrchestrator Interface

```typescript
export interface MAARLRouterDependency {
  maalRouter: MAALRouter;
}

export interface BridgeOrchestrator extends MAARLRouterDependency {
  route(
    input: unknown
  ): Promise<ExecutionResult> {
    // 1. Fingerprint
    const fingerprint = TaskFingerprinting.compute(input);
    
    // 2. MAAL route
    const maalOutput = this.maalRouter.route(fingerprint, input);
    
    // 3. Emit ledger event
    this.eventStream.push({
      id: uuid(),
      timestamp: Date.now(),
      eventType: "routing_decision",
      data: { fingerprint, maalOutput }
    });
    
    // 4. Pass constraints to ModelRouter
    const execution = await this.modelRouter.select(
      input,
      maalOutput.constraints  // ModelRouter sees constraints
    );
    
    return execution;
  }
}
```

## Integration Points

### 1. MAALRouter Injection

```typescript
const maalRouter = new MAALRouter(
  new TaskFingerprinter(),
  new RoutingRegimeSelector(),
  new ConstraintEngine(),
  new FallbackGraphValidator()
);

const eventStream = new EventStream(10000);
const backgroundWriter = new BackgroundWriter({
  connectionPool: pg_pool,
  flushIntervalMs: 5000
});

const orchestrator = new BridgeOrchestrator({
  maalRouter,
  eventStream,
  backgroundWriter,
  modelRouter: existingModelRouter
});

backgroundWriter.start();
```

### 2. Route Sequence

```
Input
  │
  ├─ TaskFingerprinting.compute() → TaskFingerprint
  │
  ├─ MAALRouter.route(fingerprint, input) → MAALRoutingOutput
  │   ├─ RoutingRegimeSelector.select()
  │   ├─ ConstraintEngine.derive()
  │   └─ FallbackGraphValidator.validate()
  │
  ├─ EventStream.push(routingEvent) → in-memory buffer
  │
  ├─ ModelRouter.select(input, constraints) → Model selection
  │   (ModelRouter sees MAAL constraints but makes final choice)
  │
  └─ Execution
```

### 3. Constraint Passing

ModelRouter receives constraints from MAAL:

```typescript
interface ModelRouterInput {
  input: unknown;
  constraints: RoutingConstraints;  // from MAAL
}

// ModelRouter can:
// ✓ Choose model from constraints.allowedModels
// ✓ Respect constraints.maxCost, maxLatencyMs
// ✗ Violate constraints (phase 3 adds override with governance approval)
```

## Phase 1 Scope

**Modified:** `cic-ingestion/src/orchestrator/BridgeOrchestrator.ts`

- Add `maalRouter` as constructor dependency
- Add `eventStream` and `backgroundWriter` as dependencies
- Add `.route()` method that calls MAALRouter before ModelRouter
- No other changes to BridgeOrchestrator

**Not modified:**
- ModelRouter implementation
- Execution pipeline
- Error handling (except for MAAL-specific errors)

## Error Handling

### MAAL-Specific Errors

```typescript
class MAALRoutingError extends Error {
  constructor(reason: string) {
    super(`MAAL routing error: ${reason}`);
  }
}

// Cases:
// 1. Invalid fallback graph → throw MAALRoutingError
// 2. No allowed models in constraints → throw MAALRoutingError
// 3. EventStream full (shouldn't happen) → log warning, continue
// 4. BackgroundWriter flush error → log error, continue (async)
```

### Graceful Degradation

If MAAL fails:
- Log error
- Pass empty constraints to ModelRouter
- ModelRouter uses defaults
- Continue execution

## Testing Integration

### Unit Tests

```typescript
test("BridgeOrchestrator calls MAALRouter before ModelRouter");
test("EventStream receives routing event");
test("BackgroundWriter flushes batch to DB");
test("Constraints passed to ModelRouter");
test("Error in MAAL doesn't block execution");
```

### Integration Tests

```typescript
test("Full flow: fingerprint → regime → constraints → execution");
test("Ledger durability: events survive process restart");
test("Backpressure: high EventStream size pauses BackgroundWriter");
```

---

## Phase 2 Interaction

Phase 2 does NOT modify BridgeOrchestrator.

Instead, Phase 2:
- Consumes ledger events from `routing_history`
- Trains offline policy
- Produces `PolicyNetwork` checkpoint

Phase 3 then:
- Injects SPL policy into BridgeOrchestrator (shadow mode)
- Later enables SPL influence with governance approval

---

See related:
- [Architecture](PHASE-1_ARCHITECTURE.md)
- [MAAL Core](PHASE-1_MAAL_CORE.md)
- [Ledger Substrate](PHASE-1_LEDGER_SUBSTRATE.md)
- [Phase 3: Integration](PHASE-3_INTEGRATION_CONTRACT.md)
