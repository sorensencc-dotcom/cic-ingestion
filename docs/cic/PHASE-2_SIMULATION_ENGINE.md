# Phase 2: Simulation Engine

## RouteSimulator

Generates offline episodes from ledger data.

```typescript
export interface SimulationConfig {
  maxEpisodesPerTrajectory: number;  // e.g., 100
  maxStepsPerEpisode: number;        // e.g., 10 (prevent loops)
  warmupEpisodes: number;            // pre-training phase (e.g., 1000)
  evalFrequency: number;             // evaluate every N training episodes
}

export interface RouteSimulator {
  // Generate single episode
  generateEpisode(
    initialState: RouteState,
    policy: PolicyNetwork
  ): Episode;
  
  // Run full training simulation
  simulate(
    config: SimulationConfig
  ): {
    trajectories: Trajectory[];
    totalReward: number;
    avgRewardPerEpisode: number;
  };
  
  // Evaluate policy on test set
  evaluate(
    policy: PolicyNetwork,
    testSize: number
  ): {
    meanReward: number;
    stdReward: number;
    successRate: number;
  };
}
```

### Episode Generation

```typescript
generateEpisode(initialState: RouteState, policy: PolicyNetwork): Episode {
  const steps: Step[] = [];
  let currentState = initialState;
  let episodeReward = 0;
  let stepCount = 0;
  
  while (stepCount < this.config.maxStepsPerEpisode) {
    // 1. Policy select action
    const { actionLogits, entropy } = policy.forward(currentState);
    const action = this.actionSpace.selectActionFromLogits(actionLogits);
    
    // 2. Simulate outcome (from ledger or simulator)
    const outcome = this.simulateOutcome(currentState, action);
    
    // 3. Compute reward
    const rewardSignal = this.rewardFunction.compute(currentState, action, outcome);
    
    // 4. Generate next state
    const nextState = this.deriveNextState(currentState, action, outcome);
    
    // Accumulate
    steps.push({
      state: currentState,
      action,
      reward: rewardSignal,
      nextState
    });
    
    episodeReward += rewardSignal.totalReward;
    
    // Check termination
    if (rewardSignal.isTerminal) {
      break;
    }
    
    currentState = nextState;
    stepCount++;
  }
  
  return {
    episodeId: uuid(),
    steps,
    totalReward: episodeReward,
    isSuccess: steps[steps.length - 1]?.reward.isTerminal && steps.length < this.config.maxStepsPerEpisode,
    startTimestamp: Date.now(),
    endTimestamp: Date.now()
  };
}
```

### Outcome Simulation

Outcomes come from Phase 1 ledger (replay) or simulator:

```typescript
private simulateOutcome(state: RouteState, action: RouteAction): RouteOutcome {
  switch (action.actionType) {
    case "SELECT_MODEL": {
      // Look up historical performance for model
      const modelId = action.modelId!;
      const perfRecord = state.recentModelPerformance.find(p => p.modelId === modelId);
      
      // Simulate outcome based on historical stats
      const latency = this.sampleLatency(perfRecord!.avgLatencyMs, state.constraints.maxLatencyMs);
      const cost = this.sampleCost(perfRecord!.avgCost, state.constraints.maxCost);
      const success = Math.random() < perfRecord!.successRate;
      
      return {
        modelId,
        success,
        actualLatencyMs: latency,
        actualCost: cost,
        outputQuality: success ? 0.8 + Math.random() * 0.2 : 0.2,
        timestamp: Date.now()
      };
    }
    // ...other action types
  }
}
```

---

## ExperienceReplay

Buffer for managing episodes/trajectories.

```typescript
export interface ReplayBuffer {
  push(episode: Episode): void;
  sample(batchSize: number): Episode[];
  size(): number;
  clear(): void;
}

export interface PrioritizedReplayBuffer {
  push(episode: Episode, priority: number): void;
  sample(batchSize: number): Episode[];
  updatePriorities(
    episodeIds: string[],
    priorities: number[]
  ): void;
}
```

### Uniform Replay Buffer

```typescript
class ReplayBuffer {
  private buffer: Episode[] = [];
  private maxSize: number;
  
  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;
  }
  
  push(episode: Episode): void {
    this.buffer.push(episode);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();  // FIFO
    }
  }
  
  sample(batchSize: number): Episode[] {
    const result = [];
    for (let i = 0; i < batchSize; i++) {
      const idx = Math.floor(Math.random() * this.buffer.length);
      result.push(this.buffer[idx]);
    }
    return result;
  }
  
  size(): number {
    return this.buffer.length;
  }
  
  clear(): void {
    this.buffer = [];
  }
}
```

### Prioritized Replay Buffer (Optional)

```typescript
class PrioritizedReplayBuffer {
  private buffer: Episode[] = [];
  private priorities: Map<string, number> = new Map();
  
  push(episode: Episode, priority: number): void {
    this.buffer.push(episode);
    this.priorities.set(episode.episodeId, priority);
  }
  
  sample(batchSize: number): Episode[] {
    // Sample proportional to priority
    const totalPriority = Array.from(this.priorities.values()).reduce((a, b) => a + b, 0);
    const result = [];
    
    for (let i = 0; i < batchSize; i++) {
      let threshold = Math.random() * totalPriority;
      for (const ep of this.buffer) {
        const p = this.priorities.get(ep.episodeId) || 0;
        threshold -= p;
        if (threshold <= 0) {
          result.push(ep);
          break;
        }
      }
    }
    
    return result;
  }
  
  updatePriorities(episodeIds: string[], priorities: number[]): void {
    for (let i = 0; i < episodeIds.length; i++) {
      this.priorities.set(episodeIds[i], priorities[i]);
    }
  }
}
```

---

See related:
- [Architecture](PHASE-2_ARCHITECTURE.md)
- [Episode & Trajectory](PHASE-2_EPISODE_TRAJECTORY.md)
- [Training Loop](PHASE-2_TRAINING_LOOP.md)
