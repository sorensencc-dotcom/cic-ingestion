# Phase 2.0 Architecture — Distributed Multi-Agent System

**Status:** Specification locked  
**Date:** 2026-06-08  
**Release Target:** 2026-08-01

---

## Architecture Overview

Phase 2.0 transforms CIC from a local, coordinated system into a **distributed, policy-governed, self-improving multi-agent system**.

### System Diagram

```
                 ┌────────────────────────────┐
                 │        Operator / UI       │
                 └─────────────┬──────────────┘
                               │
                               ▼
                 ┌────────────────────────────┐
                 │        CIC Foreman         │
                 │  (entrypoint / coordinator)│
                 └─────────────┬──────────────┘
                               │
          ┌────────────────────┴────────────────────┐
          │                                         │
          ▼                                         ▼
┌───────────────────────┐                 ┌───────────────────────┐
│   Agent Runtime (MAR) │                 │  Governance Engine    │
│  - AgentSupervisor    │                 │  - ToolPolicy         │
│  - AgentRegistry      │                 │  - PhasePolicy        │
│  - AgentInbox/Queue   │                 │  - AgentPolicy        │
└───────────┬───────────┘                 └───────────┬───────────┘
            │                                         │
            ▼                                         ▼
  ┌───────────────────────┐                 ┌───────────────────────┐
  │   Distributed Memory  │                 │   Distributed Tools   │
  │        Bus (DMB)      │                 │       Layer (DTL)     │
  │  - MemoryTopics       │                 │  - ToolBroker         │
  │  - Subscriptions      │                 │  - ToolWorkers        │
  └───────────┬───────────┘                 └───────────┬───────────┘
              │                                         │
              ▼                                         ▼
   ┌───────────────────────┐                 ┌───────────────────────┐
   │     TorqueQuery       │                 │       Wayland         │
   │  (world-state engine) │                 │ (tool orchestration)  │
   └───────────┬───────────┘                 └───────────┬───────────┘
               │                                         │
               └──────────────┬──────────────────────────┘
                              ▼
                 ┌────────────────────────────┐
                 │    EvolutionEngine (MPEL)  │
                 │  - proposals from agents   │
                 │  - governance approval     │
                 │  - apply changes           │
                 └────────────────────────────┘
```

---

## Core Components

### 1. Agent Runtime (MAR)

**Responsibility:** Spawn, monitor, and supervise all agents.

**Key classes:**
- `AgentSupervisor` — lifecycle management (spawn, restart, terminate)
- `AgentRegistry` — registry of running agents
- `AgentInbox` — message queue per agent
- `AgentQueue` — priority queue for agent messages

**Determinism guarantees:**
- All agent spawning is deterministic (seeded PRNG)
- All agent restarts follow exponential backoff with fixed seed
- All agent timers use monotonic clock

### 2. Governance Engine

**Responsibility:** Enforce policies across tools, phases, and agents.

**Key classes:**
- `GovernanceEngine` — unified policy evaluator
- `ToolPolicy` — rules for Wayland tool execution
- `PhasePolicy` — rules for Phase 23–25 operations
- `AgentPolicy` — rules for agent spawning/resource usage

**Policy binding:**
- ToolPolicy → Wayland execution
- PhasePolicy → Memory pipeline
- AgentPolicy → Agent startup

### 3. Distributed Memory Bus (DMB)

**Responsibility:** Event-driven memory pipeline.

**Key classes:**
- `MemoryBus` — pub/sub for memory events
- `MemoryTopic` — topic per phase or data type
- `MemorySubscription` — subscription per consumer

**Topics:**
- `phase-23.normalized` — Phase 23 normalized entries
- `phase-24.structured` — Phase 24 CKOs
- `phase-25.consolidated` — Phase 25 KGPs
- `torquequery.ingestion` — TorqueQuery ingestion events
- `wayland.execution` — Wayland tool execution results

**Guarantees:**
- Messages published in order
- Subscribers receive in order
- No message loss (in-memory or persisted)

### 4. Distributed Tool Layer (DTL)

**Responsibility:** Distribute tool execution across workers.

**Key classes:**
- `ToolBroker` — distributes tool jobs to workers
- `ToolWorker` — executes tools, enforces governance
- `ToolQueue` — priority queue for tool jobs

**Execution flow:**
1. Wayland submits tool job to ToolBroker
2. ToolBroker checks governance (ToolPolicy)
3. ToolBroker routes to available ToolWorker
4. ToolWorker executes, compresses output, publishes to DMB
5. Wayland receives result

### 5. EvolutionEngine

**Responsibility:** Collect, evaluate, and apply proposals for CIC self-improvement.

**Key responsibilities:**
- Accept proposals from agents
- Evaluate under governance
- Apply approved changes safely
- Track evolution cycles and outcomes

---

## Agent Roster

### Core Agents (7)

#### 1. Foreman
**Role:** Entrypoint, task coordinator, high-level orchestration

**Responsibilities:**
- Accept operator requests
- Coordinate task decomposition via Planner
- Assign tasks to agents
- Monitor overall progress
- Report status to operator

**Inputs:**
- Operator requests (HTTP, CLI, file)
- External triggers

**Outputs:**
- Task plans → Planner
- Status updates → UI

**Governance:**
- Must respect tool quotas
- Must respect agent resource limits

---

#### 2. Planner
**Role:** Task decomposition, execution planning, tool selection

**Responsibilities:**
- Receive goals from Foreman
- Query TorqueQuery for world state
- Decompose into steps
- Choose tools and agents
- Generate execution plans

**Inputs:**
- Goals from Foreman
- World state from TorqueQuery
- Policy from Governance

**Outputs:**
- Execution plans
- Tool calls to Wayland
- Evolution proposals (if bottlenecks detected)

**Governance:**
- Respects ToolPolicy for tool selection
- Respects PhasePolicy for memory operations
- Requests approval for risky changes

---

#### 3. Harvester
**Role:** External data ingestion, memory population

**Responsibilities:**
- Ingest external data (HTTP, files, shell, Wayland results)
- Normalize to Phase 23 format
- Structure via Phase 24
- Consolidate via Phase 25
- Publish to DMB

**Inputs:**
- External data (various sources)
- Wayland execution results

**Outputs:**
- Phase 23 normalized entries
- Phase 24 CKOs
- Phase 25 KGPs
- Events on DMB

**Governance:**
- Respects PhasePolicy for memory operations
- Rate-limited ingestion (configurable)

---

#### 4. Auditor
**Role:** Policy compliance, drift detection, anomaly detection

**Responsibilities:**
- Monitor all agents for policy violations
- Detect drift in memory state
- Detect anomalies in tool execution
- Generate alerts
- Propose policy updates

**Inputs:**
- Agent logs
- CAVEMAN_STATS
- Governance decisions
- TorqueQuery state

**Outputs:**
- Alerts
- Policy update proposals
- Evolution proposals

**Governance:**
- Can escalate violations to Governance
- Can trigger agent restarts

---

#### 5. Archivist
**Role:** Long-term memory curation, archival, pruning

**Responsibilities:**
- Curate CKOs and KGPs
- Archive old entries
- Prune redundant data
- Track retention policies
- Create snapshots

**Inputs:**
- CKOs from Phase 24
- KGPs from Phase 25
- Usage stats from TorqueQuery

**Outputs:**
- Retention decisions
- Archive snapshots
- Pruning directives

**Governance:**
- Respects retention policies
- Requests approval for large deletions

---

#### 6. Optimizer
**Role:** Performance tuning, compression tuning, resource optimization

**Responsibilities:**
- Monitor metrics and CavemanStats
- Propose compression profile changes
- Propose budget adjustments
- Identify bottlenecks
- Generate evolution proposals

**Inputs:**
- Prometheus metrics
- CavemanStats
- Budget exhaustion events
- Performance profiles

**Outputs:**
- Evolution proposals for compression, budgets, configs
- Tuning recommendations

**Governance:**
- Respects CavemanBudget limits
- Requests approval for mode changes

---

#### 7. EvolutionAgent
**Role:** Interface between agents and EvolutionEngine

**Responsibilities:**
- Collect proposals from Planner, Auditor, Optimizer
- Structurize proposals
- Submit to EvolutionEngine
- Track approval/rejection
- Report outcomes

**Inputs:**
- Proposals from other agents
- Governance decisions

**Outputs:**
- Structured evolution cycles
- Approval notifications
- Change logs

---

## Agent Communication

All agent-to-agent communication flows through the **Message Bus**:

```
Agent A ──→ Message ──→ MailBox B ──→ Agent B processes
```

**Message types:**
- `task` — task assignment
- `query` — request for data
- `result` — task result
- `proposal` — evolution proposal
- `alert` — alert/notification

**Guarantees:**
- Messages delivered in order
- No message loss
- Timeouts for stuck messages

---

## Data Flow

### Memory Pipeline (DMB)

```
External Data
    ↓
Harvester (normalize → Phase 23)
    ↓
Phase 23 normalized entries → DMB (phase-23.normalized)
    ↓
Phase 24 structuring → CKOs
    ↓
Phase 24 CKOs → DMB (phase-24.structured)
    ↓
Phase 25 consolidation → KGPs
    ↓
Phase 25 KGPs → DMB (phase-25.consolidated)
    ↓
TorqueQuery (subscriber)
    ↓
TorqueQuery ingests, builds graph
    ↓
Archivist (subscriber) → retention decisions
```

### Tool Execution (DTL)

```
Wayland
    ↓
ToolBroker (check governance)
    ↓
ToolWorker (execute)
    ↓
Output → Caveman (compress)
    ↓
Compressed output → DMB (wayland.execution)
    ↓
Harvester (subscriber) → ingests as external data
    ↓
Back to memory pipeline
```

### Evolution Cycle (EvolutionEngine)

```
Agent (Planner/Auditor/Optimizer)
    ↓
Submits proposal
    ↓
EvolutionEngine
    ↓
Check governance
    ↓
If approved:
  - Apply change
  - Log to ARPS
  - Notify agent
Else:
  - Reject
  - Log reason
  - Notify agent
```

---

## Determinism & Reproducibility

**Deterministic sources:**
- Seeded PRNG for agent IDs, message IDs
- Monotonic clock for all timestamps
- Ordered message queues (no async races)
- Frozen dependencies (all Docker images pinned)

**Replay mode:**
- Record all inputs (external data, operator requests)
- Replay through entire system
- Diff outputs for regression detection

**Guarantees:**
- Same inputs → Same outputs
- Bit-for-bit reproducible across machines
- Verifiable by hash

---

## Observability

**Logging:**
- Each agent emits structured logs
- Loki ingests via Promtail
- Full-text search in Grafana

**Metrics:**
- Agent uptime/downtime
- Message latency (p50, p95, p99)
- Tool execution time
- Memory ingestion rate
- TorqueQuery query latency
- Caveman compression stats

**Dashboards:**
- Agent health (uptime, restart count)
- Message bus throughput
- Tool execution timeline
- Memory pipeline latency
- TorqueQuery ingestion health
- Evolution cycle status

---

## Governance Integration

**ToolPolicy:** Controls which tools can be executed
- Tool allowlist/blocklist
- Per-tool quotas (max concurrent, daily limit)
- Resource limits (CPU, memory, timeout)

**PhasePolicy:** Controls memory pipeline
- Phase 23 rate limits
- Phase 24/25 approval requirements
- Drift thresholds

**AgentPolicy:** Controls agent spawning
- Which agents can spawn
- Resource limits per agent
- Restart policies

**EvolutionPolicy:** Controls self-improvement
- Allowed proposal types
- Risk assessment rules
- Approval thresholds

---

## Success Metrics

**Phase 2.0 is successful when:**

1. All 7 core agents running stably
2. Message bus throughput > 1,000 msg/sec
3. Tool execution latency p95 < 100ms
4. Memory ingestion rate > 1,000 entries/sec
5. TorqueQuery query latency p95 < 50ms
6. Zero message loss
7. Agent restart < 1/day per agent
8. Caveman compression ratio > 2x
9. Observability dashboard real-time updates
10. Evolution cycles run successfully (proposals → approval → apply)

---

## Migration Path (from Phase 1.0)

See: `PHASE_1_0_TO_2_0_MIGRATION.md`

---

## Next Steps

1. Lock EvolutionEngine concrete design ✓
2. Lock Caveman v2.0 spec ✓
3. Implement Phase 1.1 (governance + reliability)
4. Implement Phase 2.0 core (MAR + DMB + DTL)
5. Integrate all agents
6. Test determinism and reproducibility
7. Release Phase 2.0

---

**Created:** 2026-06-08  
**Status:** Locked specification  
**Next review:** Post Phase 1.1
