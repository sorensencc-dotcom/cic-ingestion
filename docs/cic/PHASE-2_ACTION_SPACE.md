# Phase 2: Action Space

## RouteAction

Routing decision action.

```typescript
export type RouteActionType = 
  | "SELECT_MODEL"      // choose specific model
  | "USE_FALLBACK"      // follow fallback chain
  | "DEFER_TO_HUMAN"    // escalate for human review
  | "QUEUE_FOR_BATCH";  // queue for batch processing

export interface RouteAction {
  actionType: RouteActionType;
  modelId?: string;              // if SELECT_MODEL
  fallbackEdgeId?: string;       // if USE_FALLBACK (reference to fallback edge)
  reason?: string;               // optional explanation
}
```

### Action Types

**SELECT_MODEL:**
```typescript
{
  actionType: "SELECT_MODEL",
  modelId: "gpt-3.5",
  reason: "optimal for code_gen complexity"
}
```

**USE_FALLBACK:**
```typescript
{
  actionType: "USE_FALLBACK",
  fallbackEdgeId: "primary→fallback1",
  reason: "primary exceeded latency budget"
}
```

**DEFER_TO_HUMAN:**
```typescript
{
  actionType: "DEFER_TO_HUMAN",
  reason: "low confidence, needs expert review"
}
```

**QUEUE_FOR_BATCH:**
```typescript
{
  actionType: "QUEUE_FOR_BATCH",
  reason: "batch processing for cost reduction"
}
```

---

## ActionSpace

Enumerates valid actions per state/regime.

```typescript
export interface ActionSpace {
  enumModelIds(): string[];         // available models
  enumFallbackEdges(): string[];    // valid fallback edges
  isValid(action: RouteAction): boolean;
}
```

### Valid Actions per Regime

**local_only regime:**
- SELECT_MODEL from: ["local-gpt2", "local-mistral"]
- USE_FALLBACK from: local fallback edges only
- DEFER_TO_HUMAN: always valid
- QUEUE_FOR_BATCH: always valid

**hybrid regime:**
- SELECT_MODEL from: ["local-mistral", "gpt-3.5", "claude-sonnet"]
- USE_FALLBACK from: all fallback edges
- DEFER_TO_HUMAN: always valid
- QUEUE_FOR_BATCH: always valid

**remote_allowed regime:**
- SELECT_MODEL from: ["gpt-4", "claude-opus", "local-mistral"]
- USE_FALLBACK from: all fallback edges
- DEFER_TO_HUMAN: always valid
- QUEUE_FOR_BATCH: always valid

### Validation

```typescript
isValid(action: RouteAction): boolean {
  switch (action.actionType) {
    case "SELECT_MODEL":
      return this.enumModelIds().includes(action.modelId!);
    case "USE_FALLBACK":
      return this.enumFallbackEdges().includes(action.fallbackEdgeId!);
    case "DEFER_TO_HUMAN":
    case "QUEUE_FOR_BATCH":
      return true;
    default:
      return false;
  }
}
```

### Example

```typescript
const actionSpace = new ActionSpace(/* state, regime */);

// Valid for hybrid regime
actionSpace.isValid({
  actionType: "SELECT_MODEL",
  modelId: "gpt-3.5"
});  // true

// Invalid: gpt-4 not in hybrid allowlist
actionSpace.isValid({
  actionType: "SELECT_MODEL",
  modelId: "gpt-4"
});  // false

// Always valid
actionSpace.isValid({
  actionType: "DEFER_TO_HUMAN"
});  // true
```

---

## Action Cardinality

**Discrete action space:**
```
|A| = |models| + |fallbacks| + 2 (DEFER, QUEUE)
    = 5 + 3 + 2  (example)
    = 10 actions
```

**PolicyNetwork output:** 10-dimensional logit vector → softmax → action probability

---

## ActionSpace Factory

```typescript
export const createActionSpace = (
  regime: RoutingRegime,
  fallbackEdges: FallbackEdge[]
): ActionSpace => {
  return new ActionSpace(regime, fallbackEdges);
};
```

---

See related:
- [Architecture](PHASE-2_ARCHITECTURE.md)
- [State Space](PHASE-2_STATE_SPACE.md)
- [Policy Learner](PHASE-2_POLICY_LEARNER.md)
