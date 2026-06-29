# Phase 1: MAAL Foundation

**Version:** v0.1.0-maal-foundation  
**Status:** Implementation contract  
**Prerequisite:** None (foundation phase)

## Purpose

Phase 1 establishes the **Multi-Agent Architecture Layer (MAAL)** — a deterministic routing substrate that directs CIC tasks to models based on fingerprinting, regime selection, and constraint enforcement.

## Core Components

### 1. **Ledger Substrate** (Files 1–3)
Ring-buffered event stream + background writer. All routing decisions logged to PostgreSQL with zero-loss durability.

### 2. **MAAL Core** (Files 4–7)
- `TaskFingerprinting`: Deterministic input classification (complexity, modality, token count)
- `RoutingRegimeSelector`: Regime selection (local_only, hybrid, remote_allowed)
- `ConstraintEngine`: Budget enforcement (cost, latency, model allowlists)
- `FallbackGraphValidator`: Fallback chain validation (cycles, depth, failure codes)

### 3. **BridgeOrchestrator Integration** (File 8)
Injection point for MAALRouter. Routes all tasks through MAAL before ModelRouter.

### 4. **Smoke Test Suite** (Files 9–10)
Integration tests. Determinism verification. Ledger durability validation.

## Architecture

```
CIC Input
    │
    ▼
TaskFingerprinting (deterministic classification)
    │
    ▼
RoutingRegimeSelector (local_only | hybrid | remote_allowed)
    │
    ▼
ConstraintEngine (cost/latency/model constraints)
    │
    ▼
FallbackGraphValidator (safety checks)
    │
    ▼
MAALRouter (orchestrates above)
    │
    ├─ EventStream (ring buffer) → PostgreSQL
    │
    ▼
BridgeOrchestrator + ModelRouter (execution)
```

## Ledger Schema

4 PostgreSQL tables:
- `routing_history`: Task fingerprint + routing decision per task
- `drift_ledger`: Model performance variance tracking
- `model_performance_ledger`: Per-model success/latency/cost metrics
- `cost_ledger`: Budget utilization and overage events

## Files Delivered

```
cic-os/src/core/ledger/
  - EventStream.ts (ring buffer)
  - BackgroundWriter.ts (async flush to DB)
  - index.ts (exports)

cic-os/src/core/maal/
  - TaskFingerprint.ts
  - RoutingRegimeSelector.ts
  - ConstraintEngine.ts
  - FallbackGraphValidator.ts
  - MAALRouter.ts
  - MAALRoutingOutput.ts
  - index.ts (exports)

cic-ingestion/src/orchestrator/
  - BridgeOrchestrator.ts (modified)

postgres/ledgers/
  - routing_history.sql
  - drift_ledger.sql
  - model_performance_ledger.sql
  - cost_ledger.sql

Tests:
  - cic-os/src/core/__tests__/maal.smoke.test.ts
  - cic-os/src/core/__tests__/ledger.integration.test.ts
```

## Acceptance Criteria

- All files match file contract exactly
- Zero additional files or directories
- All interface signatures match contract
- EventStream non-blocking push, drain(batchSize) return
- BackgroundWriter timer-based flush to Postgres
- RoutingRegimeSelector deterministic
- ConstraintEngine enforces cost/latency/model lists
- FallbackGraphValidator detects cycles + max depth
- MAALRouter orchestrates all above
- BridgeOrchestrator calls MAALRouter before ModelRouter
- Smoke tests: determinism, regime selection, constraint derivation, ledger durability
- v0.1.0-maal-foundation tagged

## Next Phase

→ Phase 2: SPL/RL training harness (offline learning from MAAL ledger)

---

See related:
- [Architecture](PHASE-1_ARCHITECTURE.md)
- [File Contract](PHASE-1_FILE_CONTRACT.md)
- [Implementation Order](PHASE-1_IMPLEMENTATION_ORDER.md)
- [Testing](PHASE-1_TESTING.md)
