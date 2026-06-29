# Phase 2: State Space

## RouteState

Complete representation of task + environment context.

```typescript
export interface RouteState {
  // From Phase 1 TaskFingerprint
  taskFingerprint: TaskFingerprint;
  
  // From ledger (historical performance)
  recentModelPerformance: {
    modelId: string;
    avgLatencyMs: number;
    avgCost: number;
    successRate: number;
    sampleCount: number;
  }[];
  
  // Derived system metrics
  systemLoad: number;              // 0–1 (event stream density)
  costBudgetRemaining: number;     // 0–1 (budget utilization)
  latencyBudgetRemaining: number;  // 0–1 (SLO headroom)
  
  // From Phase 1 MAALRouter
  routingRegime: RoutingRegime;
  constraints: RoutingConstraints;
  
  // Metadata
  stateTimestamp: number;
}
```

## StateFeaturizer

Converts RouteState → fixed-size feature vector.

### Interface

```typescript
export interface StateVector {
  features: number[];        // fixed length (e.g., 64 elements)
  featureNames: string[];    // for debugging/interpretability
}

export interface StateFeaturizer {
  featurize(state: RouteState): StateVector;
  stateSpaceDim(): number;   // 64 (or configurable)
}
```

### Feature Encoding

**Fixed-size vector (64 dims):**

```
[0–4]:    TaskFingerprint (5 dims)
  - taskClass hash (0–1)
  - complexityBucket / 5 (normalized)
  - modality encoding (one-hot, 3 dims)

[5–14]:   RecentModelPerformance (10 dims for 2 top models)
  - model_0 avgLatencyMs / 10000
  - model_0 avgCost / 1.0
  - model_0 successRate
  - model_0 sampleCount / 1000
  - model_1 [same 4]

[15–17]:  System Metrics (3 dims)
  - systemLoad (0–1)
  - costBudgetRemaining (0–1)
  - latencyBudgetRemaining (0–1)

[18–19]:  RoutingRegime (2 dims, one-hot)
  - local_only: [1, 0, 0]
  - hybrid: [0, 1, 0]
  - remote_allowed: [0, 0, 1]

[20–39]:  ConstraintEngine (20 dims)
  - allowedModels count / 10
  - disallowedModels count / 10
  - maxCost / 1.0
  - maxLatencyMs / 10000
  - [padding for extensibility]

[40–63]:  Padding/Reserved (24 dims)
```

**Total:** 64 dims (tunable)

### Determinism Guarantee

**Same RouteState → Same StateVector always.**

- No randomness in feature encoding
- No timestamps (use external clock)
- No external I/O (pure computation)

### Normalization

All features normalized to [0, 1]:

```typescript
featurize(state: RouteState): StateVector {
  const features: number[] = [];
  
  // [0–4] TaskFingerprint
  features.push(hashTaskClass(state.taskFingerprint.taskClass) % 1.0);
  features.push(state.taskFingerprint.complexityBucket / 5);
  features.push(...oneHotModality(state.taskFingerprint.modality));
  
  // [5–14] RecentModelPerformance
  const topModels = state.recentModelPerformance.slice(0, 2);
  for (const model of topModels) {
    features.push(Math.min(model.avgLatencyMs / 10000, 1.0));
    features.push(Math.min(model.avgCost / 1.0, 1.0));
    features.push(model.successRate);  // already 0–1
    features.push(Math.min(model.sampleCount / 1000, 1.0));
  }
  // Pad if < 2 models
  while (features.length < 15) {
    features.push(0);
  }
  
  // [15–17] System Metrics
  features.push(state.systemLoad);
  features.push(state.costBudgetRemaining);
  features.push(state.latencyBudgetRemaining);
  
  // [18–20] RoutingRegime (one-hot)
  const regimeOneHot = {
    "local_only": [1, 0, 0],
    "hybrid": [0, 1, 0],
    "remote_allowed": [0, 0, 1]
  }[state.routingRegime];
  features.push(...regimeOneHot);
  
  // [21–40] ConstraintEngine
  features.push(Math.min(state.constraints.allowedModels.length / 10, 1.0));
  features.push(Math.min(state.constraints.disallowedModels.length / 10, 1.0));
  features.push(Math.min(state.constraints.maxCost / 1.0, 1.0));
  features.push(Math.min(state.constraints.maxLatencyMs / 10000, 1.0));
  // Pad to 20 dims
  while (features.length < 41) {
    features.push(0);
  }
  
  // [41–63] Padding
  while (features.length < 64) {
    features.push(0);
  }
  
  return {
    features: features.slice(0, 64),
    featureNames: [
      "taskClass_hash", "complexity_norm", "modality_text", "modality_code", "modality_image",
      "model0_latency", "model0_cost", "model0_success", "model0_samples",
      "model1_latency", "model1_cost", "model1_success", "model1_samples",
      "systemLoad", "costBudgetRemaining", "latencyBudgetRemaining",
      "regime_local", "regime_hybrid", "regime_remote",
      "allowedCount", "disallowCount", "maxCost", "maxLatency",
      // ... 41 more names for padding
    ]
  };
}
```

### Example

```typescript
const state: RouteState = {
  taskFingerprint: {
    taskClass: "code_gen",
    complexityBucket: 2,
    modality: "code",
    schemaSignature: "abc123...",
    tokenBucket: 3
  },
  recentModelPerformance: [
    { modelId: "gpt-3.5", avgLatencyMs: 500, avgCost: 0.01, successRate: 0.95, sampleCount: 100 },
    { modelId: "claude-sonnet", avgLatencyMs: 800, avgCost: 0.02, successRate: 0.98, sampleCount: 50 }
  ],
  systemLoad: 0.6,
  costBudgetRemaining: 0.8,
  latencyBudgetRemaining: 0.7,
  routingRegime: "hybrid",
  constraints: { maxCost: 0.10, maxLatencyMs: 5000, allowedModels: [...], disallowedModels: [...] },
  stateTimestamp: 1234567890
};

const vec = featurizer.featurize(state);
// vec.features = [0.123, 0.4, 1, 0, 0, 0.05, 0.01, 0.95, 0.1, ..., 0]
// vec.features.length == 64
```

---

## StateFeaturizer Factory

```typescript
export const createStateFeaturizer = (): StateFeaturizer => {
  return new StateFeaturizer();
};
```

---

See related:
- [Architecture](PHASE-2_ARCHITECTURE.md)
- [Action Space](PHASE-2_ACTION_SPACE.md)
- [Reward Function](PHASE-2_REWARD_FUNCTION.md)
