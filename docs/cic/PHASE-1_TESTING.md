# Phase 1: Testing & Validation

**Acceptance criteria:** All tests pass. Zero known issues. Ready for v0.1.0 tag.

---

## Test Categories

### 1. Unit Tests (Per Component)

#### TaskFingerprinter

```typescript
describe("TaskFingerprinter", () => {
  test("deterministic: same input → same fingerprint", () => {
    const input = { code: "...", schema: { ... } };
    const fp1 = fingerprinter.compute(input);
    const fp2 = fingerprinter.compute(input);
    expect(fp1).toEqual(fp2);  // fully equal, not just same object
  });
  
  test("schema signature is deterministic hash", () => {
    const fp = fingerprinter.compute(input);
    expect(fp.schemaSignature).toMatch(/^[a-f0-9]{16}$/);
  });
  
  test("complexity bucket 0–5", () => {
    // ...
  });
  
  test("token bucket 0–6", () => {
    // ...
  });
  
  test("modality text | code | image+code", () => {
    // ...
  });
});
```

---

#### RoutingRegimeSelector

```typescript
describe("RoutingRegimeSelector", () => {
  test("deterministic: same fingerprint → same regime", () => {
    const fp = { complexityBucket: 2, tokenBucket: 1, ... };
    const r1 = selector.select(fp);
    const r2 = selector.select(fp);
    expect(r1).toBe(r2);
  });
  
  test("low complexity → local_only", () => {
    const fp = { complexityBucket: 0, tokenBucket: 0, ... };
    expect(selector.select(fp)).toBe("local_only");
  });
  
  test("medium complexity → hybrid", () => {
    const fp = { complexityBucket: 2, tokenBucket: 2, ... };
    expect(selector.select(fp)).toBe("hybrid");
  });
  
  test("high complexity → remote_allowed", () => {
    const fp = { complexityBucket: 5, tokenBucket: 6, ... };
    expect(selector.select(fp)).toBe("remote_allowed");
  });
});
```

---

#### ConstraintEngine

```typescript
describe("ConstraintEngine", () => {
  test("local_only: low cost, strict latency", () => {
    const c = engine.derive("local_only");
    expect(c.maxCost).toBeLessThanOrEqual(0.02);
    expect(c.maxLatencyMs).toBeLessThanOrEqual(3000);
    expect(c.allowedModels).toContain("local-gpt2");
    expect(c.disallowedModels).toContain("gpt-4");
  });
  
  test("hybrid: medium cost, medium latency", () => {
    const c = engine.derive("hybrid");
    expect(c.maxCost).toBeGreaterThan(0.02);
    expect(c.maxCost).toBeLessThanOrEqual(0.50);
  });
  
  test("remote_allowed: high cost, loose latency", () => {
    const c = engine.derive("remote_allowed");
    expect(c.maxCost).toBeGreaterThan(0.50);
    expect(c.allowedModels).toContain("gpt-4");
  });
});
```

---

#### FallbackGraphValidator

```typescript
describe("FallbackGraphValidator", () => {
  test("rejects cycles", () => {
    const edges = [
      { from: "A", to: "B", onFailureCode: "TIMEOUT" },
      { from: "B", to: "A", onFailureCode: "TIMEOUT" }
    ];
    expect(validator.validate(edges)).toBe(false);
  });
  
  test("rejects max depth > 5", () => {
    const edges = [
      { from: "A", to: "B", ... },
      { from: "B", to: "C", ... },
      { from: "C", to: "D", ... },
      { from: "D", to: "E", ... },
      { from: "E", to: "F", ... },
      { from: "F", to: "G", ... }  // depth 7
    ];
    expect(validator.validate(edges)).toBe(false);
  });
  
  test("accepts valid chain A → B → C", () => {
    const edges = [
      { from: "A", to: "B", onFailureCode: "TIMEOUT" },
      { from: "B", to: "C", onFailureCode: "TIMEOUT" }
    ];
    expect(validator.validate(edges)).toBe(true);
  });
  
  test("rejects unknown failure codes", () => {
    const edges = [
      { from: "A", to: "B", onFailureCode: "UNKNOWN_ERROR" }
    ];
    expect(validator.validate(edges)).toBe(false);
  });
});
```

---

#### EventStream

```typescript
describe("EventStream", () => {
  test("push is non-blocking O(1)", () => {
    const stream = new EventStream(100);
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      stream.push({ id: `evt-${i}`, timestamp: Date.now(), ... });
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(10);  // < 10ms for 100 pushes
  });
  
  test("drain returns up to batchSize", () => {
    const stream = new EventStream(100);
    for (let i = 0; i < 150; i++) {
      stream.push({ id: `evt-${i}`, ... });
    }
    const batch = stream.drain(50);
    expect(batch.length).toBeLessThanOrEqual(50);
  });
  
  test("size() returns current count", () => {
    const stream = new EventStream(100);
    stream.push({ ... });
    stream.push({ ... });
    expect(stream.size()).toBe(2);
  });
  
  test("ring buffer overwrites oldest on full", () => {
    const stream = new EventStream(10);
    for (let i = 0; i < 20; i++) {
      stream.push({ id: `evt-${i}`, ... });
    }
    expect(stream.size()).toBe(10);  // not 20, capped at maxSize
  });
});
```

---

#### BackgroundWriter

```typescript
describe("BackgroundWriter", () => {
  test("start() begins timer", async () => {
    const writer = new BackgroundWriter(config, eventStream);
    expect(writer.timer).toBeNull();
    writer.start();
    expect(writer.timer).not.toBeNull();
    writer.stop();
  });
  
  test("flush() drains EventStream to DB", async () => {
    const writer = new BackgroundWriter(config, eventStream);
    eventStream.push({ id: "evt-1", ... });
    await writer.flush();
    expect(eventStream.size()).toBe(0);
  });
  
  test("respects backpressure (highWaterMark)", async () => {
    const config = { highWaterMark: 5, ... };
    const writer = new BackgroundWriter(config, eventStream);
    for (let i = 0; i < 100; i++) {
      eventStream.push({ id: `evt-${i}`, ... });
    }
    await writer.flush();  // should skip due to highWaterMark
    expect(eventStream.size()).toBe(100);  // unchanged
  });
});
```

---

### 2. Integration Tests

#### Fingerprinting + Regime + Constraints

```typescript
describe("MAAL Pipeline", () => {
  test("full flow: fingerprint → regime → constraints", () => {
    const input = { code: "...", schema: { ... } };
    const fp = fingerprinter.compute(input);
    const regime = regimeSelector.select(fp);
    const constraints = constraintEngine.derive(regime);
    
    // Verify chain consistency
    expect(fp).toBeDefined();
    expect(regime).toBeDefined();
    expect(constraints).toBeDefined();
    expect(["local_only", "hybrid", "remote_allowed"]).toContain(regime);
  });
});
```

---

#### MAALRouter Orchestration

```typescript
describe("MAALRouter", () => {
  test("route() orchestrates all components", () => {
    const maalRouter = new MAALRouter(
      fingerprinter,
      regimeSelector,
      constraintEngine,
      fallbackValidator
    );
    const output = maalRouter.route(fp, input);
    
    expect(output.regime).toBeDefined();
    expect(output.constraints).toBeDefined();
    expect(output.constraints.allowedModels.length).toBeGreaterThan(0);
  });
});
```

---

#### EventStream → BackgroundWriter → PostgreSQL

```typescript
describe("Ledger Durability", () => {
  test("event push → stream → writer → DB", async () => {
    const eventStream = new EventStream(100);
    const writer = new BackgroundWriter(config, eventStream);
    
    eventStream.push({
      id: uuid(),
      timestamp: Date.now(),
      eventType: "routing_decision",
      data: { ... }
    });
    
    await writer.flush();
    
    const result = await db.query(
      "SELECT * FROM routing_history WHERE id = $1",
      [/* ... */]
    );
    expect(result.rows.length).toBe(1);
  });
});
```

---

#### BridgeOrchestrator Integration

```typescript
describe("BridgeOrchestrator + MAAL", () => {
  test("route() calls MAALRouter before ModelRouter", async () => {
    const orchestrator = new BridgeOrchestrator({
      maalRouter,
      eventStream,
      backgroundWriter,
      modelRouter
    });
    
    const result = await orchestrator.route(input);
    
    // Verify MAAL event logged
    expect(eventStream.size()).toBeGreaterThan(0);
    
    // Verify execution completed
    expect(result).toBeDefined();
  });
});
```

---

### 3. Smoke Test Suite

**File:** `cic-os/src/core/__tests__/maal.smoke.test.ts`

```typescript
describe("Phase 1 Smoke Tests", () => {
  // Unit + integration above
  // Smoke tests focus on system-wide determinism + stability
  
  test("100 identical inputs → 100 identical fingerprints", () => {
    const input = { ... };
    const fps = Array(100).fill(null).map(() => 
      fingerprinter.compute(input)
    );
    fps.forEach(fp => expect(fp).toEqual(fps[0]));
  });
  
  test("stress: 10k events through EventStream", () => {
    const stream = new EventStream(10000);
    for (let i = 0; i < 10000; i++) {
      stream.push({ id: `evt-${i}`, ... });
    }
    expect(stream.size()).toBe(10000);
    
    const batch = stream.drain(1000);
    expect(batch.length).toBe(1000);
  });
  
  test("ledger: 100 events persist through full cycle", async () => {
    for (let i = 0; i < 100; i++) {
      const fp = fingerprinter.compute(input);
      const output = maalRouter.route(fp, input);
      eventStream.push({
        id: `evt-${i}`,
        timestamp: Date.now(),
        eventType: "routing_decision",
        data: { fp, output }
      });
    }
    
    await backgroundWriter.flush();
    
    const result = await db.query(
      "SELECT COUNT(*) FROM routing_history"
    );
    expect(parseInt(result.rows[0].count)).toBe(100);
  });
});
```

---

## Test Execution

```bash
npm test -- --testMatch="**/__tests__/**/*.test.ts"
```

**Coverage target:** ≥90% for Phase 1 core components.

---

## Acceptance Criteria Checklist

- [ ] All unit tests pass (TaskFingerprinter, RegimeSelector, etc.)
- [ ] All integration tests pass (fingerprinting → constraints)
- [ ] All smoke tests pass (determinism, stress, durability)
- [ ] No console warnings or errors
- [ ] EventStream + BackgroundWriter reliable under load
- [ ] PostgreSQL ledger tables populated
- [ ] BridgeOrchestrator integration verified
- [ ] Code coverage ≥90%
- [ ] All files match Phase 1 File Contract exactly
- [ ] v0.1.0-maal-foundation ready to tag

---

See related:
- [Overview](PHASE-1_OVERVIEW.md)
- [Implementation Order](PHASE-1_IMPLEMENTATION_ORDER.md)
