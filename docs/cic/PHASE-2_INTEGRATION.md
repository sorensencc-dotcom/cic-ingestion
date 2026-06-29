# Phase 2: Integration

## LedgerEventConsumer

Reads Phase 1 ledger, converts events → RouteState.

```typescript
export interface LedgerEventConsumer {
  // Poll ledger, convert events → states
  consumeEvents(
    since: number,        // timestamp (ms)
    limit: number         // max events per poll
  ): RouteState[];
  
  // Convert ledger outcome → RouteOutcome
  extractOutcome(event: LedgerEvent): RouteOutcome;
}
```

### Implementation

```typescript
class LedgerEventConsumer {
  constructor(private db: PgPool, private featurizer: StateFeaturizer) {}
  
  async consumeEvents(since: number, limit: number): Promise<RouteState[]> {
    // Query Phase 1 routing_history
    const result = await this.db.query(
      `SELECT * FROM routing_history
       WHERE timestamp >= $1
       ORDER BY timestamp ASC
       LIMIT $2`,
      [since, limit]
    );
    
    const states: RouteState[] = [];
    
    for (const row of result.rows) {
      const fingerprint = JSON.parse(row.task_fingerprint);
      const modelPerf = await this.getModelPerformance(row.timestamp);
      
      const state: RouteState = {
        taskFingerprint: fingerprint,
        recentModelPerformance: modelPerf,
        systemLoad: this.computeSystemLoad(row.timestamp),
        costBudgetRemaining: 0.8,  // stub
        latencyBudgetRemaining: 0.7,  // stub
        routingRegime: row.regime,
        constraints: JSON.parse(row.routing_decision).constraints,
        stateTimestamp: row.timestamp
      };
      
      states.push(state);
    }
    
    return states;
  }
  
  private async getModelPerformance(timestamp: number): Promise<{...}[]> {
    // Query model_performance_ledger
    const result = await this.db.query(
      `SELECT model_id, avg_latency_ms, avg_cost, success_rate, sample_count
       FROM model_performance_ledger
       WHERE timestamp <= $1
       ORDER BY timestamp DESC
       LIMIT 5`,
      [timestamp]
    );
    
    return result.rows.map(row => ({
      modelId: row.model_id,
      avgLatencyMs: row.avg_latency_ms,
      avgCost: row.avg_cost,
      successRate: row.success_rate,
      sampleCount: row.sample_count
    }));
  }
  
  private computeSystemLoad(timestamp: number): number {
    // Compute from event stream density
    // stub: 0.5
    return 0.5;
  }
}
```

---

## OfflineLearningService

Daemon that periodically trains on ledger data.

```typescript
export interface OfflineLearningServiceConfig {
  ledgerPollIntervalMs: number;     // e.g., 60000 (1 min)
  trainingCadenceMs: number;        // e.g., 3600000 (1 hour)
  minLedgerEventsPerTraining: number; // e.g., 1000 (batch size)
}

export interface OfflineLearningService {
  start(config: OfflineLearningServiceConfig): void;
  stop(): void;
  
  // Called periodically
  trainNewPolicy(): Promise<PolicyNetwork>;
  
  // Read current policy (immutable from Phase 1 perspective)
  getCurrentPolicy(): PolicyNetwork;
}
```

### Implementation

```typescript
class OfflineLearningService {
  private ledgerConsumer: LedgerEventConsumer;
  private trainingLoop: TrainingLoop;
  private currentPolicy: PolicyNetwork;
  
  private pollTimer: NodeJS.Timer | null = null;
  private trainingTimer: NodeJS.Timer | null = null;
  private lastTrainingTimestamp: number = Date.now();
  
  constructor(
    private db: PgPool,
    private config: OfflineLearningServiceConfig
  ) {
    this.ledgerConsumer = new LedgerEventConsumer(db, new StateFeaturizer());
    this.trainingLoop = new TrainingLoop(...);
    this.currentPolicy = new PolicyNetwork();  // initialize with random weights
  }
  
  start(config: OfflineLearningServiceConfig): void {
    this.config = config;
    
    // Poll ledger for new events
    this.pollTimer = setInterval(() => {
      this.pollLedger();
    }, config.ledgerPollIntervalMs);
    
    // Train periodically
    this.trainingTimer = setInterval(() => {
      this.trainNewPolicy();
    }, config.trainingCadenceMs);
  }
  
  stop(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.trainingTimer) clearInterval(this.trainingTimer);
  }
  
  private async pollLedger(): Promise<void> {
    const events = await this.ledgerConsumer.consumeEvents(
      this.lastTrainingTimestamp,
      this.config.minLedgerEventsPerTraining
    );
    
    if (events.length >= this.config.minLedgerEventsPerTraining) {
      console.log(`Ledger has ${events.length} new events. Triggering training.`);
      await this.trainNewPolicy();
    }
  }
  
  async trainNewPolicy(): Promise<PolicyNetwork> {
    console.log("Starting offline training...");
    
    const trainingRunId = uuid();
    
    // Record training start
    await this.db.query(
      `INSERT INTO training_runs (training_run_id, policy_version, config, start_timestamp, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [trainingRunId, `π_v${Date.now()}`, JSON.stringify(this.config), Date.now(), 'running']
    );
    
    try {
      // Pull ledger data
      const events = await this.ledgerConsumer.consumeEvents(
        this.lastTrainingTimestamp,
        10000
      );
      
      // Simulate episodes
      const episodes = events.map((state, i) => 
        this.simulateEpisode(state, this.currentPolicy)
      );
      
      // Train
      const result = await this.trainingLoop.run({
        maxEpochs: 50,
        targetMetric: "meanReward",
        targetThreshold: 0.7,
        earlyStoppingPatience: 5
      });
      
      // Update current policy
      this.currentPolicy = result.finalPolicy;
      this.lastTrainingTimestamp = Date.now();
      
      // Record success
      await this.db.query(
        `UPDATE training_runs SET status = $1, end_timestamp = $2 WHERE training_run_id = $3`,
        ['completed', Date.now(), trainingRunId]
      );
      
      console.log("Training completed. Policy updated.");
      return result.finalPolicy;
    } catch (error) {
      console.error("Training failed:", error);
      
      await this.db.query(
        `UPDATE training_runs SET status = $1, end_timestamp = $2 WHERE training_run_id = $3`,
        ['failed', Date.now(), trainingRunId]
      );
      
      throw error;
    }
  }
  
  getCurrentPolicy(): PolicyNetwork {
    return this.currentPolicy;
  }
  
  private simulateEpisode(state: RouteState, policy: PolicyNetwork): Episode {
    // Delegate to RouteSimulator
    return this.simulator.generateEpisode(state, policy);
  }
}
```

## Usage

```typescript
const service = new OfflineLearningService(pgPool, {});

service.start({
  ledgerPollIntervalMs: 60000,      // poll ledger every 1 min
  trainingCadenceMs: 3600000,       // train every 1 hour
  minLedgerEventsPerTraining: 1000  // need 1k events
});

// Service runs independently
// getCurrentPolicy() available to Phase 3 for shadow mode
const policy = service.getCurrentPolicy();

// Later: stop
service.stop();
```

---

## No Phase 1 Dependency

**Critical invariant:**
- Phase 2 reads Phase 1 ledger tables (read-only)
- Phase 2 writes to separate tables (training_runs, policy_checkpoints, etc.)
- Phase 2 never modifies Phase 1 components or ledgers

This ensures zero impact on live CIC routing while training offline.

---

See related:
- [Overview](PHASE-2_OVERVIEW.md)
- [Training Loop](PHASE-2_TRAINING_LOOP.md)
- [Phase 3: Integration](PHASE-3_INTEGRATION_CONTRACT.md)
