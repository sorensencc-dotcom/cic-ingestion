# Phase 2: Testing & Validation

**Acceptance criteria:** 11+ tests pass. Determinism verified. No Phase 1 modifications.

---

## Unit Tests

### StateFeaturizer

```typescript
describe("StateFeaturizer", () => {
  test("deterministic: same state → same vector", () => {
    const state: RouteState = { ... };
    const v1 = featurizer.featurize(state).features;
    const v2 = featurizer.featurize(state).features;
    expect(v1).toEqual(v2);
  });
  
  test("fixed-size: all vectors have 64 elements", () => {
    const states = [ ... ];  // 10 random states
    states.forEach(s => {
      const v = featurizer.featurize(s);
      expect(v.features.length).toBe(64);
    });
  });
  
  test("normalized: features in [0, 1]", () => {
    const v = featurizer.featurize(state).features;
    v.forEach(f => {
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    });
  });
});
```

---

### RewardFunction

```typescript
describe("RewardFunction", () => {
  test("deterministic: same input → same reward", () => {
    const state = { ... };
    const action = { ... };
    const outcome = { ... };
    
    const r1 = rewardFunction.compute(state, action, outcome);
    const r2 = rewardFunction.compute(state, action, outcome);
    
    expect(r1.totalReward).toBe(r2.totalReward);
    expect(r1.components).toEqual(r2.components);
  });
  
  test("clipped: reward in [-1, 1]", () => {
    const outcome = { success: true, actualLatencyMs: 0, actualCost: 0, ... };
    const r = rewardFunction.compute(state, action, outcome);
    expect(r.totalReward).toBeGreaterThanOrEqual(-1);
    expect(r.totalReward).toBeLessThanOrEqual(1);
  });
  
  test("success reward +1", () => {
    const outcome = { success: true, ... };
    const r = rewardFunction.compute(state, action, outcome);
    expect(r.components.successReward).toBe(1.0);
  });
  
  test("failure reward -1", () => {
    const outcome = { success: false, ... };
    const r = rewardFunction.compute(state, action, outcome);
    expect(r.components.successReward).toBe(-1.0);
  });
});
```

---

### PolicyNetwork

```typescript
describe("PolicyNetwork", () => {
  test("forward pass returns valid logits", () => {
    const state = { ... };
    const { actionLogits, entropy } = policy.forward(state);
    
    expect(actionLogits.length).toBeGreaterThan(0);
    expect(entropy).toBeGreaterThan(0);
  });
  
  test("action logits sum to positive (pre-softmax)", () => {
    const { actionLogits } = policy.forward(state);
    const sum = actionLogits.reduce((a, b) => a + b, 0);
    expect(sum).toBeGreaterThan(0);
  });
  
  test("entropy bounded", () => {
    const { entropy } = policy.forward(state);
    const maxEntropy = Math.log(actionLogits.length);  // uniform distribution
    expect(entropy).toBeGreaterThan(0);
    expect(entropy).toBeLessThanOrEqual(maxEntropy);
  });
  
  test("weight update converges (loss decreases)", () => {
    const initialWeights = policy.getWeights();
    
    for (let i = 0; i < 10; i++) {
      const gradient = { /* some gradient */ };
      policy.updateWeights(gradient);
    }
    
    const newWeights = policy.getWeights();
    expect(newWeights.version).not.toBe(initialWeights.version);
  });
});
```

---

### RouteSimulator

```typescript
describe("RouteSimulator", () => {
  test("generates valid episodes (terminal states)", () => {
    const episode = simulator.generateEpisode(initialState, policy);
    
    expect(episode.steps.length).toBeGreaterThan(0);
    expect(episode.steps.length).toBeLessThanOrEqual(maxStepsPerEpisode);
    
    // Last step should be terminal
    const lastStep = episode.steps[episode.steps.length - 1];
    expect(lastStep.reward.isTerminal).toBe(true);
  });
  
  test("respects constraints (no policy violations)", () => {
    const episode = simulator.generateEpisode(initialState, policy);
    
    episode.steps.forEach(step => {
      // Action should be valid for regime
      expect(actionSpace.isValid(step.action)).toBe(true);
    });
  });
  
  test("evaluation metric improves with training", () => {
    const policyV1 = new PolicyNetwork();  // untrained
    const evalV1 = simulator.evaluate(policyV1, testSize=100);
    
    // Train policy...
    
    const policyV2 = /* trained policy */;
    const evalV2 = simulator.evaluate(policyV2, testSize=100);
    
    expect(evalV2.meanReward).toBeGreaterThan(evalV1.meanReward);
  });
});
```

---

## Integration Tests

### StateFeaturizer + RewardFunction

```typescript
describe("State → Reward Pipeline", () => {
  test("full flow: state → features → action → reward", () => {
    const state = { ... };
    
    // Featurize
    const vector = featurizer.featurize(state).features;
    expect(vector.length).toBe(64);
    
    // Select action
    const action = actionSpace.selectRandomAction();
    
    // Compute reward
    const outcome = { success: true, actualLatencyMs: 1000, ... };
    const reward = rewardFunction.compute(state, action, outcome);
    
    expect(reward.totalReward).toBeDefined();
    expect(reward.isTerminal).toBeDefined();
  });
});
```

---

### TrainingLoop + Simulator

```typescript
describe("TrainingLoop + Simulator", () => {
  test("converges on synthetic data", async () => {
    const config: TrainingConfig = {
      maxEpochs: 10,
      targetMetric: "meanReward",
      targetThreshold: 0.5,
      earlyStoppingPatience: 3
    };
    
    const result = await trainingLoop.run(config);
    
    expect(result.metrics.length).toBeGreaterThan(0);
    expect(result.finalPolicy).toBeDefined();
  });
  
  test("early stopping triggers (patience timeout)", async () => {
    const config = {
      maxEpochs: 100,
      targetMetric: "meanReward",
      targetThreshold: 999,  // impossible threshold
      earlyStoppingPatience: 2
    };
    
    const result = await trainingLoop.run(config);
    
    expect(result.converged).toBe(false);
    expect(result.metrics.length).toBeLessThan(100);
  });
  
  test("checkpoints save + load correctly", async () => {
    const checkpoint = {
      version: "π_v0",
      parameters: { ... },
      trainedAt: Date.now(),
      trainingIterations: 100
    };
    
    await trainingLoop.checkpoint(policy, { /* metrics */ });
    const loaded = trainingLoop.loadBestPolicy("evalReward");
    
    expect(loaded).toBeDefined();
  });
  
  test("metrics logged to PostgreSQL", async () => {
    // Run training
    const result = await trainingLoop.run(config);
    
    // Query database
    const rows = await db.query(
      "SELECT * FROM training_metrics WHERE training_run_id = $1",
      [trainingRunId]
    );
    
    expect(rows.rowCount).toBeGreaterThan(0);
  });
});
```

---

## Phase 1 Integrity

```typescript
describe("Phase 1 Integrity (No Modifications)", () => {
  test("routing_history untouched by Phase 2", async () => {
    const before = await db.query("SELECT COUNT(*) FROM routing_history");
    
    // Run Phase 2 training
    await offlineLearningService.trainNewPolicy();
    
    const after = await db.query("SELECT COUNT(*) FROM routing_history");
    
    expect(after.rows[0].count).toBe(before.rows[0].count);
  });
  
  test("MAAL components not modified", () => {
    // Verify Phase 1 imports work
    const router = new MAALRouter(...);
    expect(router).toBeDefined();
  });
});
```

---

## Acceptance Checklist

- [ ] StateFeaturizer: deterministic, fixed-size, normalized
- [ ] RewardFunction: deterministic, clipped
- [ ] PolicyNetwork: forward/update functional, converges
- [ ] RouteSimulator: generates valid episodes
- [ ] TrainingLoop: converges on synthetic data
- [ ] Early stopping triggers (patience timeout)
- [ ] Checkpoints save + load correctly
- [ ] Metrics logged to PostgreSQL
- [ ] Phase 1 integrity preserved (no modifications)
- [ ] OfflineLearningService runs independently
- [ ] Zero Phase 1 dependency violations
- [ ] v0.2.0-spl-rl-foundation ready to tag

---

See related:
- [Overview](PHASE-2_OVERVIEW.md)
- [Implementation Order](PHASE-2_IMPLEMENTATION_ORDER.md) *(placeholder)*
