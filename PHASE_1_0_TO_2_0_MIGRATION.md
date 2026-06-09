# Phase 1.0 → 2.0 Migration Plan

**Status:** Locked specification  
**Date:** 2026-06-08  
**Timeline:** 2026-07-15 through 2026-08-01 (2.5 weeks)

---

## Overview

Migration from Phase 1.0 (local, coordinated) to Phase 2.0 (distributed, self-improving) must be:

- **Zero-downtime** — CIC runs continuously
- **Reversible** — Rollback to Phase 1.0 if needed
- **Observable** — Full visibility into migration state
- **Tested** — Each step validated in staging

---

## Preconditions

Phase 1.0 must be stable with:
- ✅ Deterministic agents
- ✅ Unified governance
- ✅ Stable memory pipeline
- ✅ Caveman compression everywhere
- ✅ TorqueQuery ingestion stable
- ✅ Observability dashboards online

**Status:** Ready (all Phase 1.1 work complete)

---

## Migration Steps

### STEP 0: Freeze Phase 1.0 (Day 1)

**Action:** Create Phase 1.0 baseline snapshot

```bash
git tag -a phase-1.0-baseline -m "Phase 1.0 baseline before Phase 2.0 migration"
docker image tag cic-wil:1.0.0 cic-wil:1.0.0-baseline
```

**Outcomes:**
- Can rollback to exact Phase 1.0 state if needed
- Deterministic replay possible from baseline

---

### STEP 1: Introduce Agent Runtime (Days 1-3)

**Goal:** Migrate existing agents into MAR without changing behavior.

**Changes:**
- Add `AgentRuntime.ts`, `AgentRegistry.ts`, `AgentSupervisor.ts`
- Add `AgentMessage.ts`, `AgentInbox.ts`, `AgentQueue.ts`
- Move existing Foreman, Planner, Harvester into MAR

**Backwards compatibility:**
- Direct calls still work (wrapped in messages internally)
- Agents emit same logs/metrics
- Same output format

**Testing:**
- Unit: Agent spawn/restart/terminate
- Integration: Each agent runs through MAR
- Regression: All Phase 1.0 tests pass with MAR

**Rollback:**
- Remove MAR code
- Restore direct agent calls

---

### STEP 2: Introduce Distributed Memory Bus (Days 3-5)

**Goal:** Replace direct Phase 23→25 calls with event-driven DMB.

**Changes:**
- Add `MemoryBus.ts`, `MemoryTopic.ts`, `MemorySubscription.ts`
- Phase 23 normalizer publishes to `phase-23.normalized` topic
- Phase 24 structurer subscribes, publishes to `phase-24.structured` topic
- Phase 25 consolidator subscribes, publishes to `phase-25.consolidated` topic
- TorqueQuery, Archivist, Auditor subscribe as observers

**Backwards compatibility:**
- Phase outputs same as before
- Order preserved (FIFO per topic)
- No message loss

**Testing:**
- Unit: Pub/sub mechanics
- Integration: Full pipeline via DMB
- Regression: Same outputs as direct calls
- Load: 1,000 msg/sec throughput

**Rollback:**
- Remove DMB
- Restore direct calls

---

### STEP 3: Introduce Distributed Tool Layer (Days 5-7)

**Goal:** Distribute tool execution away from Wayland.

**Changes:**
- Add `ToolBroker.ts`, `ToolWorker.ts`, `ToolQueue.ts`
- Wayland routes tool requests to ToolBroker (not execute directly)
- ToolBroker distributes to ToolWorker pool
- ToolWorker executes, compresses, publishes results to DMB

**Backwards compatibility:**
- Tool output format same
- Governance enforcement unchanged
- Caveman compression still applied

**Testing:**
- Unit: Tool distribution/routing
- Integration: Tools execute via DTL
- Regression: Same tool outputs
- Load: 100 tool/sec throughput

**Rollback:**
- Remove DTL
- Restore direct Wayland execution

---

### STEP 4: Activate Core Agents (Days 7-10)

**Goal:** Bring online Auditor, Archivist, Optimizer agents.

**Changes:**
- Spawn Auditor agent (monitors logs, detects violations)
- Spawn Archivist agent (curates memory, archives old data)
- Spawn Optimizer agent (analyzes metrics, proposes improvements)
- Each publishes to DMB, receives from DMB

**Backwards compatibility:**
- These are new agents, no existing code changes
- Run in observation mode first (logs only, no changes)

**Testing:**
- Unit: Each agent individually
- Integration: All agents running, no conflicts
- Regression: Existing functionality unchanged

**Rollback:**
- Terminate new agents
- Remove their subscriptions from DMB

---

### STEP 5: Introduce EvolutionEngine (Days 10-13)

**Goal:** Enable agents to propose CIC improvements.

**Changes:**
- Add `EvolutionEngine.ts`
- Agents can submit proposals via `evolutionEngine.submitProposal()`
- Governance evaluates proposals
- EvolutionEngine applies approved changes

**Backwards compatibility:**
- Proposals are optional (agents can run without proposing)
- Applied changes are non-breaking configs (not code)

**Testing:**
- Unit: Proposal submission, evaluation, application
- Integration: Agents submit → Governance approves → Changes applied
- Regression: No changes yet (proposals in evaluation mode)

**Rollback:**
- Disable EvolutionEngine
- Agents can still run (just no evolution)

---

### STEP 6: Activate Evolution Cycle (Days 13-15)

**Goal:** Enable self-improvement loop.

**Actions:**
- Auditor starts detecting drift and proposing fixes
- Optimizer starts detecting inefficiencies and proposing tuning
- Planner starts proposing tool chain improvements
- EvolutionEngine applies low-risk changes (configs, policies)

**Monitoring:**
- Dashboard: Evolution cycles timeline
- Alerts: Proposal approval rate, change failures
- Logs: Each evolution cycle logged

**Rollback:**
- Disable proposal submission (agents revert to Phase 1.0 mode)

---

### STEP 7: Validation & Soak (Days 15-17)

**Goal:** Validate Phase 2.0 stability under realistic load.

**Actions:**
1. Run Phase 1.0 test suite (regression)
2. Run Phase 2.0 integration tests
3. Run 24-hour soak test
4. Monitor all metrics
5. Check rollback procedure

**Success criteria:**
- All tests pass
- Zero crashes
- Memory stable
- Metrics normal
- Rollback successful

**Rollback:** If any failure
- Revert to Phase 1.0 baseline
- Investigate root cause
- Fix and retry

---

### STEP 8: Promote to Production (Days 17-18)

**Action:** Tag Phase 2.0 release

```bash
git tag -a phase-2.0-ga -m "Phase 2.0 General Availability"
docker image tag cic-wil:2.0.0 cic-wil:2.0.0-ga
```

**Announcement:**
- Internal release notes
- Operator runbook
- Team training

---

## Rollback Procedure

**At any point during migration:**

1. Stop Phase 2.0 agents (Auditor, Archivist, Optimizer, EvolutionAgent)
2. Disable EvolutionEngine (stop proposal evaluation)
3. Disable DMB (restore direct calls)
4. Disable DTL (restore direct Wayland execution)
5. Disable MAR (restore direct agent spawning)
6. Revert to Phase 1.0 baseline (git checkout, docker image pull)

**Total rollback time:** < 5 minutes

**Data recovery:**
- All Phase 1.0 state preserved
- Memory pipeline unchanged
- TorqueQuery can reindex from ARPS

---

## Timeline

| Week | Days | Milestone | Status |
|------|------|-----------|--------|
| 1 | 1-3 | Freeze Phase 1.0, implement MAR | ⏳ |
| 1 | 3-5 | Implement DMB | ⏳ |
| 1 | 5-7 | Implement DTL | ⏳ |
| 2 | 7-10 | Activate core agents | ⏳ |
| 2 | 10-13 | Implement EvolutionEngine | ⏳ |
| 2 | 13-15 | Activate evolution cycles | ⏳ |
| 2 | 15-17 | Validation & soak test | ⏳ |
| 2.5 | 17-18 | Promote to production | ⏳ |

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Message loss | In-memory + disk persistence |
| Agent crash | Supervisor restarts (exponential backoff) |
| Evolution gone wrong | Governance blocks high-risk changes |
| Performance regression | Staged rollout, monitoring at each step |
| Data corruption | ARPS event log as source of truth |

---

## Observability During Migration

**Dashboards:**
- Agent health (uptime, restart count)
- Message bus throughput
- Tool execution latency
- Memory pipeline latency
- TorqueQuery query latency
- Evolution cycle status

**Alerts:**
- Agent downtime > 30s
- Message bus latency p99 > 100ms
- Tool execution failure rate > 1%
- Memory ingestion failure rate > 1%
- Evolution proposal failure rate > 10%

**Logs:**
- Every agent state change
- Every message published
- Every tool execution
- Every evolution cycle

---

## Post-Migration

**Phase 2.0 is stable when:**
1. All 7 core agents running
2. Zero agent crashes (< 1 restart/day)
3. Message bus throughput > 1,000 msg/sec
4. Tool execution latency p95 < 100ms
5. Memory ingestion rate > 1,000 entries/sec
6. Evolution cycles running (proposals → approval → apply)
7. Observability complete and accurate

---

## Approval

- [ ] Operator sign-off
- [ ] Architecture review (MAR, DMB, DTL)
- [ ] Security review (governance enforcement)
- [ ] Performance review (benchmarks)
- [ ] Observability review (dashboards, alerts)

---

**Created:** 2026-06-08  
**Approval date:** TBD  
**Migration start:** TBD  
**Target completion:** 2026-08-01
