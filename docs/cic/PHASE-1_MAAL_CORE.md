# Phase 1: MAAL Core Components

## TaskFingerprinting

Deterministic classification of input tasks.

### Interface

```typescript
export interface TaskFingerprint {
  taskClass: string;              // enum: "code_gen", "summarize", "image_analysis", etc.
  complexityBucket: 0 | 1 | 2 | 3 | 4 | 5;  // 0=trivial, 5=complex
  modality: "text" | "code" | "image+code"; // input type
  schemaSignature: string;        // SHA-256(input schema)
  tokenBucket: 0 | 1 | 2 | 3 | 4 | 5 | 6;  // 0=<100, 6=>8192 tokens
}

export interface TaskFingerprinter {
  compute(input: unknown): TaskFingerprint;
}
```

### Classification Rules

- **taskClass**: Derived from input schema type. Deterministic mapping.
- **complexityBucket**: Based on schema depth, conditional branches, array cardinality.
- **modality**: "text" if JSON/string, "code" if contains code blocks, "image+code" if both.
- **schemaSignature**: `SHA-256(JSON.stringify(schema)).substring(0, 16)` (deterministic, no randomness).
- **tokenBucket**: Estimated token count (deterministic heuristic).

### Example

Input: `{ "code": "function add(a, b) { return a + b; }", "language": "js" }`

Output:
```typescript
{
  taskClass: "code_generation",
  complexityBucket: 1,
  modality: "code",
  schemaSignature: "a1b2c3d4e5f6g7h8",
  tokenBucket: 1  // ~50 tokens
}
```

---

## RoutingRegimeSelector

Deterministic regime selection based on fingerprint.

### Interface

```typescript
export type RoutingRegime = "local_only" | "hybrid" | "remote_allowed";

export interface RoutingRegimeSelector {
  select(input: unknown): RoutingRegime;
}
```

### Selection Logic

Rules (deterministic, no randomness):

- **local_only**: 
  - `complexityBucket < 2` AND `tokenBucket < 2` (simple, fast tasks)
  - OR `taskClass` in local-only list

- **hybrid**:
  - `complexityBucket 2-4` AND `tokenBucket 2-4` (medium tasks)
  - Use local if available, remote if needed

- **remote_allowed**:
  - `complexityBucket > 4` OR `tokenBucket > 4` (complex, long tasks)
  - Requires remote capacity (no local execution)

### Example

```typescript
select(fingerprint) {
  if (fingerprint.complexityBucket < 2 && fingerprint.tokenBucket < 2) {
    return "local_only";
  }
  if (fingerprint.complexityBucket <= 4) {
    return "hybrid";
  }
  return "remote_allowed";
}
```

---

## ConstraintEngine

Per-regime budget and allowlist enforcement.

### Interface

```typescript
export interface RoutingConstraints {
  maxCost: number;           // dollar ceiling
  maxLatencyMs: number;      // millisecond ceiling
  allowedModels: string[];   // whitelist
  disallowedModels: string[]; // blacklist
}

export interface ConstraintEngine {
  derive(regime: RoutingRegime): RoutingConstraints;
}
```

### Constraint Rules

**local_only regime:**
```typescript
{
  maxCost: 0.01,              // $0.01 max (local is cheap)
  maxLatencyMs: 2000,         // 2s strict deadline
  allowedModels: ["local-gpt2", "local-mistral"],
  disallowedModels: ["gpt-4", "claude-opus"]
}
```

**hybrid regime:**
```typescript
{
  maxCost: 0.10,              // $0.10 max
  maxLatencyMs: 5000,         // 5s soft deadline
  allowedModels: ["local-mistral", "gpt-3.5", "claude-sonnet"],
  disallowedModels: []
}
```

**remote_allowed regime:**
```typescript
{
  maxCost: 1.00,              // $1.00 max
  maxLatencyMs: 10000,        // 10s soft deadline
  allowedModels: ["gpt-4", "claude-opus", "local-mistral"],
  disallowedModels: []
}
```

---

## FallbackGraphValidator

Validates fallback chain safety.

### Interface

```typescript
export interface FallbackEdge {
  from: string;              // model A
  to: string;                // model B (fallback)
  onFailureCode: string;     // "TIMEOUT", "OUT_OF_BUDGET", etc.
}

export interface FallbackGraphValidator {
  validate(edges: FallbackEdge[]): boolean;
}
```

### Validation Rules

1. **No cycles:** A → B → A is invalid
2. **Max depth ≤ 5 hops:** Prevent infinite chains
3. **Only known failure codes:**
   - "TIMEOUT"
   - "OUT_OF_BUDGET"
   - "RATE_LIMITED"
   - "SERVICE_UNAVAILABLE"
4. **Terminal models:** Each path must end in a fallback with no further edges

### Example

Valid:
```
primary (gpt-4) --TIMEOUT--> fallback1 (claude-sonnet) --TIMEOUT--> fallback2 (local-mistral)
```

Invalid:
```
A --TIMEOUT--> B --TIMEOUT--> A  # cycle!
```

```
primary --TIMEOUT--> fallback --TIMEOUT--> another --... (6 hops)  # exceeds max depth
```

---

## MAALRouter

Orchestrates all above components.

### Interface

```typescript
export interface MAALRoutingOutput {
  regime: RoutingRegime;
  constraints: RoutingConstraints;
  selectedModel?: string;        // recommended primary model (stub in phase 1)
}

export interface MAALRouter {
  route(
    fingerprint: TaskFingerprint,
    input: unknown
  ): MAALRoutingOutput;
}
```

### Orchestration

```typescript
route(fingerprint, input) {
  const regime = this.regimeSelector.select(fingerprint);
  const constraints = this.constraintEngine.derive(regime);
  const fallbackIsValid = this.fallbackValidator.validate(fallbackEdges);
  
  if (!fallbackIsValid) {
    throw new Error("Invalid fallback graph");
  }
  
  return {
    regime,
    constraints,
    selectedModel: constraints.allowedModels[0]  // phase 1: stub
  };
}
```

### Determinism Guarantee

- **Same fingerprint** → **same regime**
- **Same regime** → **same constraints**
- **Same constraints** → **same model selection** (deterministic tiebreak)

No randomness. No external I/O. Pure computation.

---

See related:
- [Architecture](PHASE-1_ARCHITECTURE.md)
- [Ledger Substrate](PHASE-1_LEDGER_SUBSTRATE.md)
- [File Contract](PHASE-1_FILE_CONTRACT.md)
