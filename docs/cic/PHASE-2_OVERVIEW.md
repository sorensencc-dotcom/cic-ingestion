# Phase 2: SPL/RL Training Harness

**Version:** v0.2.0-spl-rl-foundation  
**Status:** Implementation contract  
**Prerequisite:** Phase 1 (MAAL foundation v0.1.0) frozen and operational

## Purpose

Phase 2 establishes an **offline learning harness** that trains a policy network (π_θ) using supervised policy learning (SPL) + reinforcement learning (RL) on ledger data from Phase 1.

**Critical:** Phase 2 does NOT modify Phase 1. It consumes ledger events, trains offline, and produces policy checkpoints.

## Architecture

```
Phase 1 (MAAL)
    │
    ├─ Emits LedgerEvent[] to routing_history, model_performance_ledger
    │
    └─ EventStream/BackgroundWriter → PostgreSQL
            │
            ▼
Phase 2 (SPL/RL Harness)
    │
    ├─ LedgerEventConsumer (read ledger, convert → RouteState)
    ├─ StateFeaturizer (encode state → fixed-size vector)
    ├─ RewardFunction (compute reward signal)
    ├─ PolicyNetwork (π_θ, forward/update)
    ├─ PolicyGradientLearner (train on trajectories)
    ├─ RouteSimulator (generate episodes offline)
    ├─ ExperienceReplay (buffer management)
    └─ TrainingLoop (orchestrate training)
            │
            ├─ Writes to PostgreSQL:
            │   ├─ training_runs
            │   ├─ training_metrics
            │   ├─ policy_checkpoints (BYTEA weights)
            │   └─ evaluation_results
            │
            └─ Produces PolicyNetwork checkpoint
                    │
                    ▼
            Phase 3 (Canary Gate)
```

## Core Components

### 1. **State Space** (Files 1–2)
- `RouteState`: Full task state + performance history
- `StateFeaturizer`: Deterministic vector encoding

### 2. **Action Space** (File 3)
- `RouteAction`: SELECT_MODEL, USE_FALLBACK, DEFER_TO_HUMAN, QUEUE_FOR_BATCH
- `ActionSpace`: Model/fallback enumeration

### 3. **Reward Function** (Files 4–5)
- `RewardSignal`: Latency + cost + success + constraint penalties
- `RewardFunction`: Compute signal from (state, action, outcome)

### 4. **Episode & Trajectory** (Files 6–7)
- `Episode`: Sequence of (state, action, reward, nextState)
- `Trajectory`: Multiple episodes + cumulative reward
- `TrajectoryCollector`: Manage collections

### 5. **Policy Learner** (Files 8–9)
- `PolicyNetwork`: Forward pass (state → action logits), weight update
- `PolicyGradientLearner`: Train on trajectories, select actions

### 6. **Simulation Engine** (Files 10–11)
- `RouteSimulator`: Generate episodes offline from ledger
- `ExperienceReplay`: Buffer + sampling

### 7. **Training Loop** (Files 12–13)
- `TrainingLoop`: Orchestrate training, checkpoint, early stopping
- `TrainingMetrics`: Collect epoch-level telemetry

### 8. **Integration** (Files 14–15)
- `LedgerEventConsumer`: Read Phase 1 ledger → RouteState
- `OfflineLearningService`: Daemon that periodically trains

## Key Invariants

- **No Phase 1 modification:** Phase 2 reads ledger, doesn't write to it
- **Offline only:** No impact on live routing during training
- **Deterministic:** StateFeaturizer + RewardFunction are deterministic
- **Reproducible:** Same ledger → same policy (given same random seed)
- **Isolated:** Phase 2 runs in separate process/container, no shared state with CIC

## Files Delivered

```
cic-os/src/learning/
  state/
    - RouteState.ts
    - StateFeaturizer.ts
  action/
    - RouteAction.ts
    - ActionSpace.ts
  reward/
    - RewardSignal.ts
    - RouteOutcome.ts
    - RewardFunction.ts
  episode/
    - Episode.ts
    - Trajectory.ts
    - TrajectoryCollector.ts
  policy/
    - PolicyNetwork.ts
    - PolicyGradientLearner.ts
  simulator/
    - RouteSimulator.ts
    - ExperienceReplay.ts
  training/
    - TrainingLoop.ts
    - TrainingMetrics.ts

cic-ingestion/src/learning/
  - LedgerEventConsumer.ts
  - OfflineLearningService.ts

postgres/ledgers/
  - training_runs.sql
  - training_metrics.sql
  - policy_checkpoints.sql
  - evaluation_results.sql

Tests:
  - cic-os/src/learning/__tests__/state-featurizer.test.ts
  - cic-os/src/learning/__tests__/reward-function.test.ts
  - cic-os/src/learning/__tests__/policy-network.test.ts
  - cic-os/src/learning/__tests__/simulator.test.ts
  - cic-os/src/learning/__tests__/training-loop.test.ts
```

## Acceptance Criteria

- All files match Phase 2 contract exactly
- Zero additional files or directories
- All interface signatures match contract
- StateFeaturizer produces fixed-size vectors (deterministic)
- RewardFunction deterministic (same input → same reward)
- PolicyNetwork forward/update functional
- RouteSimulator generates valid episodes
- ExperienceReplay manages buffer correctly
- TrainingLoop implements early stopping
- Training telemetry written to PostgreSQL
- Zero Phase 1 modifications
- OfflineLearningService runs independently
- v0.2.0-spl-rl-foundation tagged

## Next Phase

→ Phase 3: SPL integration (shadow mode → A/B testing → governance-gated promotion)

---

See related:
- [Architecture](PHASE-2_ARCHITECTURE.md)
- [State Space](PHASE-2_STATE_SPACE.md)
- [Action Space](PHASE-2_ACTION_SPACE.md)
- [Reward Function](PHASE-2_REWARD_FUNCTION.md)
- [Episode & Trajectory](PHASE-2_EPISODE_TRAJECTORY.md)
- [Policy Learner](PHASE-2_POLICY_LEARNER.md)
- [Simulation Engine](PHASE-2_SIMULATION_ENGINE.md)
- [Training Loop](PHASE-2_TRAINING_LOOP.md)
- [Integration](PHASE-2_INTEGRATION.md)
- [Testing](PHASE-2_TESTING.md)
