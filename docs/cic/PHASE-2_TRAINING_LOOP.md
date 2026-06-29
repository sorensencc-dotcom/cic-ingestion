# Phase 2: Training Loop

## TrainingLoop

Orchestrates offline training with early stopping.

```typescript
export interface TrainingConfig {
  maxEpochs: number;
  targetMetric: "meanReward" | "successRate" | "costEfficiency";
  targetThreshold: number;
  earlyStoppingPatience: number; // stop if no improvement X epochs
}

export interface TrainingMetrics {
  epoch: number;
  trainingLoss: number;      // policy loss
  trainingReward: number;    // mean reward on training batch
  evalReward: number;        // mean reward on test set
  evalSuccessRate: number;   // success rate on test set
  policyVersion: string;     // π_v1, π_v2, etc.
  timestamp: number;
}

export interface TrainingLoop {
  // Main training harness
  run(
    config: TrainingConfig
  ): {
    finalPolicy: PolicyNetwork;
    metrics: TrainingMetrics[];
    converged: boolean;
  };
  
  // Checkpoint policy
  checkpoint(policy: PolicyNetwork, metrics: TrainingMetrics): void;
  
  // Load best policy from checkpoints
  loadBestPolicy(targetMetric: string): PolicyNetwork;
}
```

## Training Algorithm

```
epoch = 0
bestMetric = -∞
noImprovementCount = 0

while epoch < maxEpochs:
  // Training phase
  batch = replayBuffer.sample(batchSize)
  trainResult = policyLearner.train(batch, config)
  trainMetrics = {
    epoch,
    trainingLoss: trainResult.loss,
    trainingReward: mean(batch.rewards),
    ...
  }
  
  // Evaluation phase (every evalFrequency epochs)
  if epoch % evalFrequency == 0:
    evalResult = simulator.evaluate(policy, testSize=1000)
    trainMetrics.evalReward = evalResult.meanReward
    trainMetrics.evalSuccessRate = evalResult.successRate
    
    // Early stopping
    metric = trainMetrics[targetMetric]
    if metric >= targetThreshold:
      return { finalPolicy, metrics, converged: true }
    
    if metric > bestMetric:
      bestMetric = metric
      noImprovementCount = 0
      checkpoint(policy, trainMetrics)  // save best
    else:
      noImprovementCount++
    
    if noImprovementCount >= earlyStoppingPatience:
      return { finalPolicy, metrics, converged: false }
  
  metrics.append(trainMetrics)
  epoch++

return { finalPolicy, metrics, converged: false }
```

## Example Configuration

```typescript
const config: TrainingConfig = {
  maxEpochs: 100,
  targetMetric: "meanReward",
  targetThreshold: 0.7,  // stop when mean reward ≥ 0.7
  earlyStoppingPatience: 10  // stop if no improvement for 10 epochs
};

const trainingLoop = new TrainingLoop(
  policyNetwork,
  policyLearner,
  simulator,
  replayBuffer
);

const result = trainingLoop.run(config);

console.log(result);
// {
//   finalPolicy: PolicyNetwork,
//   metrics: [ {epoch, trainingLoss, evalReward, ...}, ... ],
//   converged: true
// }
```

## Checkpointing

```typescript
checkpoint(policy: PolicyNetwork, metrics: TrainingMetrics): void {
  const weights = policy.getWeights();
  
  // Save to database
  await db.query(
    `INSERT INTO policy_checkpoints 
     (policy_version, epoch, weights, metrics) 
     VALUES ($1, $2, $3, $4)`,
    [
      `π_v${metrics.epoch}`,
      metrics.epoch,
      Buffer.from(JSON.stringify(weights.parameters)),
      JSON.stringify({
        loss: metrics.trainingLoss,
        evalReward: metrics.evalReward,
        successRate: metrics.evalSuccessRate
      })
    ]
  );
  
  // Also log to training_metrics table
  await db.query(
    `INSERT INTO training_metrics 
     (training_run_id, epoch, training_loss, eval_reward, eval_success_rate) 
     VALUES ($1, $2, $3, $4, $5)`,
    [this.trainingRunId, metrics.epoch, metrics.trainingLoss, ...]
  );
}
```

## Loading Best Policy

```typescript
loadBestPolicy(targetMetric: string = "evalReward"): PolicyNetwork {
  const result = await db.query(
    `SELECT policy_version, weights FROM policy_checkpoints
     WHERE epoch = (
       SELECT epoch FROM training_metrics
       WHERE training_run_id = $1
       ORDER BY ${targetMetric} DESC
       LIMIT 1
     )`,
    [this.trainingRunId]
  );
  
  const row = result.rows[0];
  const weights = JSON.parse(row.weights);
  
  const policy = new PolicyNetwork();
  policy.loadWeights(weights);
  return policy;
}
```

---

## Training Metrics Schema

PostgreSQL table:

```sql
CREATE TABLE training_metrics (
  id SERIAL PRIMARY KEY,
  training_run_id TEXT NOT NULL,
  epoch INT NOT NULL,
  training_loss FLOAT NOT NULL,
  training_reward FLOAT NOT NULL,
  eval_reward FLOAT NOT NULL,
  eval_success_rate FLOAT NOT NULL,
  gradient_norm FLOAT,
  entropy FLOAT,
  timestamp BIGINT NOT NULL,
  FOREIGN KEY (training_run_id) REFERENCES training_runs(training_run_id)
);
```

---

See related:
- [Architecture](PHASE-2_ARCHITECTURE.md)
- [Policy Learner](PHASE-2_POLICY_LEARNER.md)
- [Simulation Engine](PHASE-2_SIMULATION_ENGINE.md)
- [Integration](PHASE-2_INTEGRATION.md)
