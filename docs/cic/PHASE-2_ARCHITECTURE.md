# Phase 2: SPL/RL Architecture

## System Design

Phase 2 implements an offline learning pipeline that:
1. Reads Phase 1 ledger events (routing decisions + outcomes)
2. Converts events to training states
3. Trains policy network via SPL/RL
4. Stores checkpoints + metrics

All components are **stateless** and **deterministic**. Same ledger → same policy.

## Data Flow

```
PostgreSQL (Phase 1 ledger)
  ├─ routing_history
  ├─ model_performance_ledger
  └─ drift_ledger
        │
        ▼
LedgerEventConsumer (read, convert, normalize)
        │
        ├─ RouteState (features from ledger)
        ├─ RouteOutcome (model performance)
        │
        ▼
StateFeaturizer (deterministic vector encoding)
        │
        ├─ normalized feature vector (fixed-size)
        │
        ▼
RewardFunction (compute signal)
        │
        ├─ latency reward
        ├─ cost reward
        ├─ success reward
        ├─ constraint penalty
        │
        ▼
Episode (step: state → action → reward → nextState)
        │
        ├─ Episode[]
        │
        ▼
ExperienceReplay (buffer + sampling)
        │
        ├─ prioritized/uniform samples
        │
        ▼
PolicyGradientLearner (train on batch)
        │
        ├─ PolicyNetwork.forward(state) → logits
        ├─ Compute loss (cross-entropy, policy gradient)
        ├─ PolicyNetwork.updateWeights(gradient)
        │
        ▼
TrainingLoop (orchestrate epochs)
        │
        ├─ train(trajectories)
        ├─ evaluate(test set)
        ├─ checkpoint(policy, metrics)
        ├─ early stopping
        │
        ▼
PostgreSQL (Phase 2 telemetry)
  ├─ training_runs
  ├─ training_metrics
  ├─ policy_checkpoints (BYTEA)
  └─ evaluation_results
```

## State Space

**RouteState:** Task context + performance history

```typescript
interface RouteState {
  // From Phase 1 fingerprint
  taskFingerprint: TaskFingerprint;
  
  // From ledger (historical)
  recentModelPerformance: {
    modelId: string;
    avgLatencyMs: number;
    avgCost: number;
    successRate: number;
    sampleCount: number;
  }[];
  
  // Derived features
  systemLoad: number;              // 0–1
  costBudgetRemaining: number;     // 0–1
  latencyBudgetRemaining: number;  // 0–1
  
  // From Phase 1
  routingRegime: RoutingRegime;
  constraints: RoutingConstraints;
  
  // Metadata
  stateTimestamp: number;
}
```

**StateFeaturizer:** Converts state → fixed-size vector

```typescript
interface StateVector {
  features: number[];        // fixed length (e.g., 64)
  featureNames: string[];    // for debugging
}

// All features normalized to [0, 1]
// Deterministic: same state → same vector (no randomness)
```

## Action Space

**RouteAction:** Routing decision

```typescript
type RouteActionType = 
  | "SELECT_MODEL"      // choose specific model
  | "USE_FALLBACK"      // fallback chain
  | "DEFER_TO_HUMAN"    // escalate
  | "QUEUE_FOR_BATCH";  // batch processing

interface RouteAction {
  actionType: RouteActionType;
  modelId?: string;
  fallbackEdgeId?: string;
  reason?: string;
}
```

**ActionSpace:** Enumerate valid actions per state

```typescript
interface ActionSpace {
  enumModelIds(): string[];        // available models
  enumFallbackEdges(): string[];   // valid fallbacks
  isValid(action: RouteAction): boolean;
}
```

## Reward Function

**RewardSignal:** Calibrated reward components

```typescript
interface RewardComponents {
  latencyReward: number;     // -Δms / 1000 (lower latency = higher reward)
  costReward: number;        // -cost * scale (lower cost = higher reward)
  successReward: number;     // +1 success, -1 failure
  constraintPenalty: number; // -1 if violated, 0 if satisfied
}

interface RewardSignal {
  totalReward: number;       // weighted sum of components
  components: RewardComponents;
  isTerminal: boolean;       // episode ends
}
```

**Calibration:**
```
totalReward = 
  latencyReward * 0.3 +      // 30% weight on latency
  costReward * 0.2 +         // 20% weight on cost
  successReward * 0.4 +      // 40% weight on success
  constraintPenalty * 0.1;   // 10% weight on constraints

// Clipped to [-1, +1]
```

## Policy Network

**PolicyNetwork:** π_θ (state → action distribution)

```typescript
interface PolicyNetwork {
  forward(state: RouteState): {
    actionLogits: number[];  // softmax(logits) → probability
    entropy: number;         // info-theoretic entropy
  };
  
  updateWeights(gradient: Record<string, unknown>): void;
  
  getWeights(): PolicyNetworkWeights;
  loadWeights(weights: PolicyNetworkWeights): void;
}
```

**Architecture (conceptual):**
```
Input: StateVector (64 dims)
  ↓
Dense layer (64 → 128, ReLU)
  ↓
Dense layer (128 → 64, ReLU)
  ↓
Output: action logits (K dims, K = # actions)
  ↓
Softmax → action probability distribution
```

## Training Loop

**TrainingConfig:**
```typescript
interface TrainingConfig {
  maxEpochs: number;                    // max training iterations
  targetMetric: "meanReward" | "successRate" | "costEfficiency";
  targetThreshold: number;              // stop if metric ≥ threshold
  earlyStoppingPatience: number;        // stop if no improvement X epochs
}
```

**Loop:**
```
for epoch in 1..maxEpochs:
  // Training phase
  trajectories = sample(replayBuffer, batchSize)
  trainLoss, entropy, gradNorm = policyLearner.train(trajectories, config)
  
  // Evaluation phase (every K epochs)
  if epoch % evalFrequency == 0:
    evalReward, successRate, stdReward = simulator.evaluate(policy, testSize)
    metrics = { epoch, trainLoss, trainReward, evalReward, successRate, ... }
    checkpoint(policy, metrics)
    
    // Early stopping
    if evalReward >= targetThreshold:
      break  // converged
    if (epoch - lastImprovement) >= earlyStoppingPatience:
      break  // no improvement for patience epochs
  
  lastImprovement = epoch
```

## No Phase 1 Dependency

Phase 2 reads Phase 1 ledger **read-only**. Never writes. Zero impact on MAAL.

```
Phase 1: routing_history, model_performance_ledger (read-only)
Phase 2: training_runs, training_metrics, policy_checkpoints, evaluation_results (write-only)
```

---

See related:
- [Overview](PHASE-2_OVERVIEW.md)
- [State Space](PHASE-2_STATE_SPACE.md)
- [Action Space](PHASE-2_ACTION_SPACE.md)
- [Reward Function](PHASE-2_REWARD_FUNCTION.md)
- [Policy Learner](PHASE-2_POLICY_LEARNER.md)
- [Training Loop](PHASE-2_TRAINING_LOOP.md)
