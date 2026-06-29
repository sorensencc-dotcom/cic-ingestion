# Phase 2: Reward Function

## RewardSignal

Encapsulates reward components and total reward.

```typescript
export interface RewardComponents {
  latencyReward: number;     // -Δms / 1000
  costReward: number;        // -cost * scale
  successReward: number;     // +1 if success, -1 if failure
  constraintPenalty: number; // -1 if violated, 0 if satisfied
}

export interface RewardSignal {
  totalReward: number;       // weighted sum of components
  components: RewardComponents;
  isTerminal: boolean;       // episode ends (success/hard failure)
}
```

## RouteOutcome

Actual outcome of action.

```typescript
export interface RouteOutcome {
  modelId: string;           // which model executed
  success: boolean;          // completed successfully?
  actualLatencyMs: number;   // wall-clock time
  actualCost: number;        // actual cost incurred
  outputQuality?: number;    // 0–1, from model evaluation (optional)
  timestamp: number;         // when outcome occurred
}
```

---

## RewardFunction

Computes reward signal from (state, action, outcome).

### Interface

```typescript
export interface RewardFunction {
  compute(
    state: RouteState,
    action: RouteAction,
    outcome: RouteOutcome
  ): RewardSignal;
}
```

### Calibration

**Component weights:**
```
totalReward = 
  latencyReward * 0.30 +      // 30% latency
  costReward * 0.20 +         // 20% cost
  successReward * 0.40 +      // 40% success
  constraintPenalty * 0.10;   // 10% constraints

Final: clip to [-1, +1]
```

### Component Computation

**latencyReward:**
```typescript
const budgetMs = state.constraints.maxLatencyMs;
const overshoot = Math.max(0, outcome.actualLatencyMs - budgetMs);
const latencyReward = -Math.min(overshoot / 1000, 1.0);
// Budget: 5000ms
// Actual: 5500ms
// overshoot: 500ms
// latencyReward: -0.5
```

**costReward:**
```typescript
const budgetCost = state.constraints.maxCost;
const overshoot = Math.max(0, outcome.actualCost - budgetCost);
const costReward = -Math.min(overshoot / budgetCost, 1.0);
// Budget: $0.10
// Actual: $0.15
// overshoot: $0.05
// costReward: -0.5
```

**successReward:**
```typescript
const successReward = outcome.success ? 1.0 : -1.0;
```

**constraintPenalty:**
```typescript
const exceeded = 
  (outcome.actualLatencyMs > state.constraints.maxLatencyMs) ||
  (outcome.actualCost > state.constraints.maxCost);
const constraintPenalty = exceeded ? -1.0 : 0.0;
```

### Example

**Scenario 1: Success within budget**
```
State:
  constraints.maxLatencyMs: 5000
  constraints.maxCost: 0.10

Outcome:
  success: true
  actualLatencyMs: 3000
  actualCost: 0.05

Computation:
  latencyReward: -max(0, 3000-5000)/1000 = 0
  costReward: -max(0, 0.05-0.10)/0.10 = 0
  successReward: 1.0
  constraintPenalty: 0.0
  
  totalReward = 0*0.3 + 0*0.2 + 1.0*0.4 + 0*0.1 = 0.4
```

**Scenario 2: Success with latency overshoot**
```
Outcome:
  success: true
  actualLatencyMs: 6000
  actualCost: 0.08

Computation:
  latencyReward: -min(1000/1000, 1.0) = -1.0
  costReward: -max(0, 0.08-0.10)/0.10 = 0
  successReward: 1.0
  constraintPenalty: -1.0 (exceeded latency budget)
  
  totalReward = -1.0*0.3 + 0*0.2 + 1.0*0.4 + (-1.0)*0.1 = 0.0
```

**Scenario 3: Failure**
```
Outcome:
  success: false
  actualLatencyMs: 10000
  actualCost: 0.01

Computation:
  latencyReward: -min((10000-5000)/1000, 1.0) = -1.0
  costReward: 0
  successReward: -1.0
  constraintPenalty: -1.0
  
  totalReward = -1.0*0.3 + 0*0.2 + (-1.0)*0.4 + (-1.0)*0.1 = -0.8
```

### Terminal States

Episode terminates if:
- `outcome.success == true` (success terminal)
- `outcome.actualLatencyMs > max(constraint, 30s)` (hard timeout)
- `outcome.actualCost > max(constraint, 100x)` (hard cost limit)

```typescript
const isTerminal = outcome.success || 
  outcome.actualLatencyMs > 30000 || 
  outcome.actualCost > 1.0;
```

---

## Determinism Guarantee

**Same (state, action, outcome) → Same RewardSignal always.**

- No randomness in computation
- No timestamps (use provided outcome timestamp)
- No external I/O

---

## RewardFunction Factory

```typescript
export const createRewardFunction = (): RewardFunction => {
  return new RewardFunction();
};
```

---

See related:
- [Architecture](PHASE-2_ARCHITECTURE.md)
- [State Space](PHASE-2_STATE_SPACE.md)
- [Episode & Trajectory](PHASE-2_EPISODE_TRAJECTORY.md)
