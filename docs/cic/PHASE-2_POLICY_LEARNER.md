# Phase 2: Policy Learner

## PolicyNetwork

Neural network π_θ: state → action distribution.

```typescript
export interface PolicyNetworkWeights {
  version: string;            // π_v0, π_v1, π_v2, ...
  parameters: Record<string, unknown>;  // serialized weights (e.g., ArrayBuffer)
  trainedAt: number;          // timestamp
  trainingIterations: number; // how many gradient steps
}

export interface PolicyNetwork {
  // Forward pass: state → action logits + entropy
  forward(state: RouteState): {
    actionLogits: number[];    // K-dimensional logits (K = action space size)
    entropy: number;           // Shannon entropy of distribution
  };
  
  // Update weights via gradient
  updateWeights(gradient: Record<string, unknown>): void;
  
  // Get current weights
  getWeights(): PolicyNetworkWeights;
  
  // Load weights from checkpoint
  loadWeights(weights: PolicyNetworkWeights): void;
}
```

### Architecture (Conceptual)

```
Input: StateVector (64 dims)
  ↓
Dense layer (64 → 128, ReLU)
  ↓
Batch norm
  ↓
Dense layer (128 → 64, ReLU)
  ↓
Output layer (64 → K, linear)
  ↓
Softmax → action probability π(a|s)
  ↓
Entropy: H = -Σ π(a) log π(a)
```

### Forward Pass

```typescript
forward(state: RouteState): { actionLogits: number[], entropy: number } {
  const features = this.featurizer.featurize(state).features;
  
  // Layer 1: 64 → 128
  let h1 = this.dense1.forward(features);
  h1 = relu(h1);
  h1 = this.batchNorm.forward(h1);
  
  // Layer 2: 128 → 64
  let h2 = this.dense2.forward(h1);
  h2 = relu(h2);
  
  // Output: 64 → K
  const logits = this.outputLayer.forward(h2);
  
  // Softmax
  const probs = softmax(logits);
  
  // Entropy
  const entropy = -probs.reduce((sum, p) => sum + p * Math.log(p), 0);
  
  return { actionLogits: logits, entropy };
}
```

### Entropy Calculation

```
π(a|s) = softmax(logits)
entropy = -Σ π(a) * log(π(a))

Example (3-action space):
logits: [2.0, 1.0, 0.0]
π: [0.66, 0.24, 0.09]
entropy ≈ 0.87 (high entropy = more exploration)

logits: [10.0, -10.0, -10.0]
π: [0.99, 0.005, 0.005]
entropy ≈ 0.03 (low entropy = exploitation)
```

---

## PolicyGradientLearner

Trains PolicyNetwork via policy gradient.

```typescript
export interface PolicyGradientConfig {
  learningRate: number;
  discountFactor: number;        // γ (0.99)
  entropyCoefficient: number;    // balance exploration (0.01)
  batchSize: number;             // trajectories per train step
  gradientClipNorm?: number;     // prevent exploding gradients (5.0)
}

export interface PolicyGradientLearner {
  // Train on batch of trajectories
  train(
    trajectories: Trajectory[],
    config: PolicyGradientConfig
  ): {
    loss: number;
    entropy: number;
    gradientNorm: number;
  };
  
  // Infer best action (greedy or ε-greedy)
  selectAction(
    state: RouteState,
    epsilon?: number  // exploration rate (0.1)
  ): RouteAction;
}
```

### Training Algorithm (Simplified Policy Gradient)

```
for trajectory in trajectories:
  cumulativeReward = 0
  advantages = []
  
  for step (reversed):
    cumulativeReward = step.reward + γ * cumulativeReward
    advantages.append(cumulativeReward - baseline(step.state))
  
  for step, advantage in zip(steps, advantages):
    logits, entropy = policy.forward(step.state)
    π = softmax(logits)
    
    // Policy gradient loss
    logProb = log(π[step.action])
    policyLoss = -logProb * advantage
    
    // Entropy regularization (encourage exploration)
    entropyLoss = -entropy * entropyCoeff
    
    totalLoss = policyLoss + entropyLoss
    
    gradient = ∇ totalLoss
    
    if gradientClipNorm:
      gradient = clip(gradient, -gradientClipNorm, +gradientClipNorm)
    
    weights -= learningRate * gradient
```

### Training Example

```typescript
const learner = new PolicyGradientLearner(policyNetwork);

const result = learner.train([trajectory1, trajectory2, trajectory3], {
  learningRate: 0.001,
  discountFactor: 0.99,
  entropyCoefficient: 0.01,
  batchSize: 3,
  gradientClipNorm: 5.0
});

console.log(result);
// {
//   loss: 0.45,
//   entropy: 0.82,
//   gradientNorm: 2.3
// }
```

### Action Selection

**Greedy (exploitation):**
```typescript
selectAction(state): RouteAction {
  const { actionLogits, entropy } = this.policyNetwork.forward(state);
  const bestActionIdx = argmax(actionLogits);
  return this.actionSpace.actions[bestActionIdx];
}
```

**ε-greedy (exploration):**
```typescript
selectAction(state, epsilon = 0.1): RouteAction {
  if (Math.random() < epsilon) {
    // Random action
    const randomIdx = Math.floor(Math.random() * this.actionSpace.size());
    return this.actionSpace.actions[randomIdx];
  } else {
    // Greedy action
    const { actionLogits } = this.policyNetwork.forward(state);
    const bestActionIdx = argmax(actionLogits);
    return this.actionSpace.actions[bestActionIdx];
  }
}
```

---

See related:
- [Architecture](PHASE-2_ARCHITECTURE.md)
- [Action Space](PHASE-2_ACTION_SPACE.md)
- [Training Loop](PHASE-2_TRAINING_LOOP.md)
