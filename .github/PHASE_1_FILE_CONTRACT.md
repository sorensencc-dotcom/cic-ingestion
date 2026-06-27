# Phase 1 File Contract (Immutable)

All Phase 1 PRs must create ONLY these files. No others. No exceptions.

## Ledger Substrate

```
cic-os/src/core/ledger/
  EventStream.ts
  BackgroundWriter.ts
  LedgerEvent.ts
```

## MAAL Core

```
cic-os/src/core/maal/
  TaskFingerprint.ts
  RoutingRegimeSelector.ts
  ConstraintEngine.ts
  FallbackGraphValidator.ts
  MAALRouter.ts
  MAALRoutingOutput.ts
```

## BridgeOrchestrator Integration

```
cic-ingestion/src/orchestrator/
  BridgeOrchestrator.ts   (Phase 1 interfaces only)
```

## PostgreSQL Ledger Schemas

```
postgres/ledgers/
  routing_history.sql
  drift_ledger.sql
  model_performance_ledger.sql
  cost_ledger.sql
```

---

## Signatures by Component

### TaskFingerprint.ts
```typescript
export interface TaskFingerprint {
  taskClass: string;
  complexityBucket: 0 | 1 | 2 | 3 | 4 | 5;
  modality: "text" | "code" | "image+code";
  schemaSignature: string;
  tokenBucket: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}
```

### RoutingRegimeSelector.ts
```typescript
export type RoutingRegime = "local_only" | "hybrid" | "remote_allowed";

export interface RoutingRegimeSelector {
  select(input: unknown): RoutingRegime;
}
```

### ConstraintEngine.ts
```typescript
export interface RoutingConstraints {
  maxCost: number;
  maxLatencyMs: number;
  allowedModels: string[];
  disallowedModels: string[];
}

export interface ConstraintEngine {
  derive(input: unknown): RoutingConstraints;
}
```

### FallbackGraphValidator.ts
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

### MAALRouter.ts
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

### BridgeOrchestrator.ts (Phase 1 only)
```typescript
// Add only these Phase 1 integration interfaces
export interface MAARLRouterDependency {
  maalRouter: MAALRouter;
}
```

---

## Validation Rules

- No additional files beyond the 14 listed
- No nested directories beyond those shown
- All TypeScript files contain interfaces/types only
- All SQL files contain CREATE TABLE only
- No SPL, training, or Phase 2/3 keywords
- All method signatures match the contract exactly

End Phase 1 File Contract.
