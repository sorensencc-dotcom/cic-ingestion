# Deterministic Agentic Orchestration with Learned Routing

## ORNITH → MAAL → SPL Integration Architecture

**Version:** 1.0  
**Status:** Formal Specification (Ready for Implementation Review)  
**Date:** 2026-06-26  
**Repo Focus:** SPL learning loop, BridgeOrchestrator integration, pipeline execution

**See also:** [cic-os/ORNITH_MAAL_SPL_ARCHITECTURE.md](https://github.com/sorensencc-dotcom/cic-os/blob/claude/ornith-cic-maal-mapping-wr9724/ORNITH_MAAL_SPL_ARCHITECTURE.md) for MAAL routing plane, governance, and ledger details.

---

## 1. Executive Summary

This document specifies a 5-layer architecture that fuses:

- **Ornith's self-scaffolding RL training loop** (learned routing policies)
- **MAAL's deterministic routing plane** (local-first, cost-aware, safety-aware)
- **CIC's multi-agent execution substrate** (deterministic, auditable, evidence-sealed)

The result is a **self-improving, trust-bounded orchestration system** that learns better routing policies without sacrificing determinism or safety.

---

## 2. Formal Learning Loop

```
S_t → A_t → V_t → X_t → R_t → U_t

Where:
- S_t = SPLState (fingerprint + context + history + audit)
- A_t = Scaffold (routing plan: agents, models, fallbacks, tools, evidence)
- V_t = MAAL validation (hard safety: acyclicity, tool surface, model whitelist, cost/latency bounds)
- X_t = CIC execution (deterministic multi-agent pipeline)
- R_t = Reward (correctness + efficiency - drift - fallback_overuse)
- U_t = SPLPolicy update (GRPO, staleness-weighted, governance-gated)
```

Key properties:
1. Safety-preserving: No policy update without audit + no trust-boundary violation
2. Deterministic substrate: All execution replayable and auditable
3. Adaptive routing: SPL learns better routing over time

---

## 3. 5-Layer Architecture

### Layer 0: Trust & Governance (cic-os/services/cic-governance)

**Components:**
- `GovernanceEvolutionLoop.ts` (existing, Phase 24.2)
- `AuditAgent.ts` (existing)
- `PolicyRegistry.ts` (new)
- `LedgerService.ts` (new)

**Ledgers (PostgreSQL):**
- `routing_history` — all routing decisions + outcomes
- `drift_ledger` — audit drift signals
- `model_performance_ledger` — per-model performance by task_class
- `cost_ledger` — routing-aware cost tracking
- `audit_log` (existing)

---

### Layer 1: Deterministic Execution (cic-ingestion)

**Components:**
- `BridgeOrchestrator.ts` (existing)
- `SkillGraph.ts` (existing)
- `MAQLIntegration.ts` (new)
- `SPLIntegration.ts` (new)
- Pipeline: INGEST → ENRICH → ORCHESTRATE → SYNTHESIZE → AUDIT

---

### Layer 2: Routing Plane (MAAL)

**Location:** `cic-os/src/core/maal/` (new)

**Components:**
- `TaskFingerprinting.ts` — deterministic task hashing
- `RoutingRegimeSelector.ts` — regime selection (local-only, hybrid, remote-allowed)
- `ConstraintEngine.ts` — cost, latency, safety, locality bounds
- `FallbackGraphValidator.ts` — acyclicity validation
- `index.ts` — MAAL interface

**Responsibilities:**
- Deterministically fingerprint every task
- Decide routing regime + constraints
- Validate all scaffold elements
- Emit metadata to ledgers

---

### Layer 3: Learned Scaffolds (SPL)

**Location:** `cic-ingestion/src/spl/` (new)

**Components:**
- `types.ts` — SPLState, Scaffold, RoutingMetadata, PolicyDiff
- `ScaffoldProposalLayer.ts` — proposal logic
- `SPLPolicy.ts` — RL policy (transformer-based)
- `ReplayBuffer.ts` — PostgreSQL integration
- `RewardComputation.ts` — reward function
- `SPLTrainingLoop.ts` — GRPO training

**Responsibilities:**
- Propose routing scaffolds (advisory, not authoritative)
- Learn from MAAL rejections (fast feedback)
- Learn from CIC audit outcomes (slow feedback)
- Emit PolicyDiff to governance
- Hard-masked action space (safe-by-construction)

---

### Layer 4: Execution Units

**Components:**
- LLMs (local 1-3B, remote)
- MCP tools
- Agents (INGEST, ENRICH, SYNTHESIZE, AUDIT)

---

## 4. Reward Function

```
R_t = α·C_t + β·E_t + γ·A_t - δ·D_t - ε·F_t

Where:
- C_t = correctness_score * evidence_integrity
- E_t = 1 - normalize(cost) - normalize(latency)
- A_t = (accepted_actions - overridden) / total_actions
- D_t = drift_score
- F_t = fallback_count / total_steps

Default weights:
- α = 0.4 (correctness)
- β = 0.3 (efficiency)
- γ = 0.15 (MAAL alignment)
- δ = 0.1 (drift penalty)
- ε = 0.05 (fallback penalty)

Hard safety:
- If trust_boundary_violation: R_t = -1.0
- If evidence_integrity < 0.5: reject sample
```

---

## 5. Implementation Phasing

### Phase 1: MAAL Core (2 weeks)
- TaskFingerprinting, RoutingRegimeSelector, ConstraintEngine, FallbackGraphValidator
- Integrate into BridgeOrchestrator
- Create ledger tables
- **Deliverable:** Deterministic routing logged and reproducible

### Phase 2: SPL Infrastructure (3 weeks)
- ReplayBuffer, RewardComputation, SPLPolicy skeleton, SPLTrainingLoop
- Wire to PostgreSQL ledgers
- **Deliverable:** SPL trains offline from logs; no live updates

### Phase 3: SPL Integration (3 weeks)
- ScaffoldProposalLayer, SPLIntegration.ts
- Modify GovernanceEvolutionLoop to accept PolicyDiff
- **Deliverable:** SPL proposes; MAAL validates; governance approves

### Phase 4: Optimization (2 weeks)
- Tune reward weights per task_class
- Add Qdrant for similarity search (optional)
- Build dashboards

---

## 6. Differentiators

1. **Deterministic + Learned:** Most systems are either pure LLM agents (no determinism) or static pipelines (no learning). This has both.

2. **Trust-Bounded Learning:** Policies can't learn from corrupted/unsafe runs; governance gates all updates.

3. **Routing-Centric:** The "smart" part is MAAL+SPL, not just model choice.

4. **Evidence-Aware Scaffolds:** evidence_path_plan ties routing to evidence flows (rare, powerful).

5. **Formally Specified:** Can express in MDP/RL terms, systems terms, and safety terms.

---

## 7. File Checklist

### New (cic-os)
- `src/core/maal/TaskFingerprinting.ts`
- `src/core/maal/RoutingRegimeSelector.ts`
- `src/core/maal/ConstraintEngine.ts`
- `src/core/maal/FallbackGraphValidator.ts`
- `src/core/maal/index.ts`
- `services/cic-governance/src/services/PolicyRegistry.ts`
- `services/cic-governance/src/services/LedgerService.ts`

### New (cic-ingestion)
- `src/spl/types.ts`
- `src/spl/ScaffoldProposalLayer.ts`
- `src/spl/SPLPolicy.ts`
- `src/spl/ReplayBuffer.ts`
- `src/spl/RewardComputation.ts`
- `src/spl/SPLTrainingLoop.ts`
- `src/autonomy/bridges/MAQLIntegration.ts`
- `src/autonomy/bridges/SPLIntegration.ts`

### Modified (cic-os)
- `services/cic-governance/src/services/GovernanceEvolutionLoop.ts`
- `scripts/init-db.sql`

### Modified (cic-ingestion)
- `src/autonomy/bridges/BridgeOrchestrator.ts`

---

**End of Specification**
