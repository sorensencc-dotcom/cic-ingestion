# Phase 2: Episode & Trajectory

## Episode

Single episode: sequence of (state, action, reward, nextState) tuples.

```typescript
export interface Step {
  state: RouteState;          // initial state
  action: RouteAction;        // selected action
  reward: RewardSignal;       // immediate reward
  nextState: RouteState;      // resulting state
}

export interface Episode {
  episodeId: string;          // unique identifier
  steps: Step[];              // sequence of steps
  totalReward: number;        // cumulative reward across episode
  isSuccess: boolean;         // episode terminal with success?
  startTimestamp: number;     // episode start time
  endTimestamp: number;       // episode end time
}
```

### Example Episode

```typescript
const episode: Episode = {
  episodeId: "ep-001",
  steps: [
    {
      state: routeState1,
      action: { actionType: "SELECT_MODEL", modelId: "gpt-3.5" },
      reward: { totalReward: 0.2, components: {...}, isTerminal: false },
      nextState: routeState2
    },
    {
      state: routeState2,
      action: { actionType: "USE_FALLBACK", fallbackEdgeId: "..." },
      reward: { totalReward: 0.1, components: {...}, isTerminal: false },
      nextState: routeState3
    },
    {
      state: routeState3,
      action: { actionType: "SELECT_MODEL", modelId: "claude-sonnet" },
      reward: { totalReward: 0.4, components: {...}, isTerminal: true },
      nextState: routeState4
    }
  ],
  totalReward: 0.2 + 0.1 + 0.4,  // 0.7
  isSuccess: true,
  startTimestamp: 1234567890,
  endTimestamp: 1234567895
};
```

### Episode Length

- **Min:** 1 step (immediate success)
- **Max:** configurable (e.g., 10 steps per episode to prevent infinite loops)

---

## EpisodeBuffer

In-memory buffer of episodes.

```typescript
export interface EpisodeBuffer {
  append(episode: Episode): void;        // add episode
  sample(batchSize: number): Episode[];  // random sample
  size(): number;                        // current count
}
```

### Implementation

Ring buffer (FIFO) with max capacity:

```typescript
class EpisodeBuffer {
  private buffer: Episode[] = [];
  private maxSize: number;
  
  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }
  
  append(episode: Episode): void {
    this.buffer.push(episode);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();  // remove oldest
    }
  }
  
  sample(batchSize: number): Episode[] {
    const indices = [];
    for (let i = 0; i < batchSize; i++) {
      indices.push(Math.floor(Math.random() * this.buffer.length));
    }
    return indices.map(i => this.buffer[i]);
  }
  
  size(): number {
    return this.buffer.length;
  }
}
```

---

## Trajectory

Collection of related episodes (e.g., from single policy rollout).

```typescript
export interface Trajectory {
  trajectoryId: string;       // unique identifier
  episodes: Episode[];        // episodes in this trajectory
  cumulativeReward: number;   // sum of all episode totalRewards
  policyVersion: string;      // which policy (π_v1, π_v2, etc.)
}
```

### Example

```typescript
const trajectory: Trajectory = {
  trajectoryId: "traj-001",
  episodes: [episode1, episode2, episode3],  // 3 episodes
  cumulativeReward: episode1.totalReward + episode2.totalReward + episode3.totalReward,
  policyVersion: "π_v1"
};
```

---

## TrajectoryCollector

Manages trajectory lifecycle.

```typescript
export interface TrajectoryCollector {
  startTrajectory(): string;                                // returns trajectoryId
  appendEpisode(trajectoryId: string, episode: Episode): void;
  finalize(trajectoryId: string): Trajectory;              // seal trajectory
}
```

### Usage

```typescript
const collector = new TrajectoryCollector();

const trajId = collector.startTrajectory();
collector.appendEpisode(trajId, episode1);
collector.appendEpisode(trajId, episode2);
collector.appendEpisode(trajId, episode3);

const trajectory = collector.finalize(trajId);
// trajectory is now immutable
```

### Implementation

```typescript
class TrajectoryCollector {
  private trajectories: Map<string, { episodes: Episode[], sealed: boolean }> = new Map();
  
  startTrajectory(): string {
    const trajId = uuid();
    this.trajectories.set(trajId, { episodes: [], sealed: false });
    return trajId;
  }
  
  appendEpisode(trajId: string, episode: Episode): void {
    const traj = this.trajectories.get(trajId);
    if (!traj || traj.sealed) {
      throw new Error(`Trajectory ${trajId} sealed or not found`);
    }
    traj.episodes.push(episode);
  }
  
  finalize(trajId: string): Trajectory {
    const traj = this.trajectories.get(trajId);
    if (!traj) {
      throw new Error(`Trajectory ${trajId} not found`);
    }
    traj.sealed = true;
    
    return {
      trajectoryId: trajId,
      episodes: traj.episodes,
      cumulativeReward: traj.episodes.reduce((sum, ep) => sum + ep.totalReward, 0),
      policyVersion: "π_v1"  // extracted from episode metadata
    };
  }
}
```

---

See related:
- [Architecture](PHASE-2_ARCHITECTURE.md)
- [Reward Function](PHASE-2_REWARD_FUNCTION.md)
- [Simulation Engine](PHASE-2_SIMULATION_ENGINE.md)
- [Training Loop](PHASE-2_TRAINING_LOOP.md)
