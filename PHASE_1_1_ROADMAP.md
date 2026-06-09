# Phase 1.1 Roadmap — The Hardening & Autonomy Pass

**Status:** Locked specification  
**Date:** 2026-06-08  
**Timeline:** 2026-06-22 through 2026-07-15 (3.5 weeks)

---

## Overview

Phase 1.1 is a **surgical upgrade** focused on stability, governance, and preparation for Phase 2.0's distributed multi-agent evolution.

Goals:
- Eliminate nondeterminism
- Unify governance
- Expand observability
- Lock in Phase 2.0 readiness

---

## 1.1.1 — Governance Expansion (Phase 28.4 activation)

**Deliverables:**
- Unified `GovernanceEngine.ts`
- Policy bundles:
  - `tool-policy.json` — Wayland tool execution rules
  - `phase-policy.json` — Memory pipeline rules
  - `agent-policy.json` — Agent spawning rules
  - `caveman-policy.json` — Compression governance
- Enforcement hooks in:
  - Wayland adapters
  - Memory pipeline (Phase 23–25)
  - TorqueQuery ingestion
  - Caveman compression

**Acceptance criteria:**
- All tools respect ToolPolicy allowlist/blocklist
- All tool execution rate-limited per policy
- All memory pipeline operations logged to policy audit
- All Caveman compression modes governed
- Audit trail complete in ARPS_DELTA

**Timeline:** Days 1–8

---

## 1.1.2 — CIC Agent Reliability Pass

**Deliverables:**
- Deterministic clock wrapper (monotonic, seeded)
- Seeded PRNG (no `Math.random()`)
- Promise timeout guards (no stuck futures)
- Agent heartbeat + liveness checks
- Retry/backoff for ingestion (exponential, fixed seed)
- Deterministic replay mode:
  - Record all inputs (external data, operator requests)
  - Replay through entire pipeline
  - Diff outputs (should match byte-for-byte)

**Acceptance criteria:**
- Same input → same output (deterministic)
- Deterministic replay passes for 100 scenarios
- No stuck promises (all have timeouts)
- Agent heartbeat visible in metrics
- Retry/backoff follows fixed pattern

**Timeline:** Days 8–15

---

## 1.1.3 — Observability v1.1

**Deliverables:**
- Caveman compression dashboard
  - Compression ratio by mode
  - Budget usage
  - Governance blocks
- Memory pipeline latency dashboard
  - Phase 23 → 24 → 25 latencies
  - Ingestion failures
  - Drift detection events
- Wayland tool execution dashboard
  - Tool execution timeline
  - Success/failure rates
  - Latency distribution
- Alerts:
  - Drift spikes (> threshold)
  - Ingestion failures (rate > 1%)
  - Budget exhaustion
  - Agent downtime (> 30s)

**Acceptance criteria:**
- All 4 dashboards accessible in Grafana
- All metrics populating correctly
- All alerts firing on correct conditions
- Dashboard updates real-time (< 5s latency)

**Timeline:** Days 15–20

---

## 1.1.4 — Local Ops Pack v1.1

**Deliverables:**
- k3d multi-node cluster config (ready for Phase 2.0)
- Local registry caching layer
- Makefile targets:
  - `make cluster-reload` — restart cluster
  - `make observability-reload` — restart obs stack
  - `make cic-redeploy` — redeploy CIC (< 5s)
  - `make validate-determinism` — run replay tests
- Documentation:
  - Local cluster operations runbook
  - Troubleshooting guide
  - Determinism testing guide

**Acceptance criteria:**
- k3d cluster deploys in < 1 minute
- CIC redeploys in < 5 seconds
- All Makefile targets work
- Runbooks complete and clear

**Timeline:** Days 20–24

---

## 1.1.5 — Caveman v1.1 (Foundation for v2.0)

**Deliverables:**
- Compression profiles (v2.0 ready):
  - `raw` — v1 mode
  - `semantic` — text-aware (spec ready, not enabled)
  - `ast` — code-aware (spec ready, not enabled)
  - `diff` — delta-based (spec ready, not enabled)
- Budget presets:
  - `low` — 5MB/day
  - `medium` — 10MB/day (default)
  - `high` — 20MB/day
- Stats v1.1:
  - `compression_profile` field
  - `governance_decision` field
  - v2.0 compatibility (backwards compatible)

**Acceptance criteria:**
- All profiles defined (not all enabled)
- Budget enforcement working
- Stats v1.1 in all outputs
- Caveman v2.0 spec locked (separate document)

**Timeline:** Days 24–28

---

## Phase 1.1 Success Metrics

**Go/No-go criteria:**

| Metric | Target | Status |
|--------|--------|--------|
| Deterministic replay success rate | 100% | ⏳ |
| Agent uptime (no crashes) | 99.9% | ⏳ |
| Memory pipeline latency p95 | < 100ms | ⏳ |
| Wayland tool latency p95 | < 100ms | ⏳ |
| Governance audit trail complete | 100% | ⏳ |
| Observability dashboard uptime | 100% | ⏳ |
| k3d cluster redeploy time | < 5s | ⏳ |
| All phase 1.0 tests passing | 100% | ⏳ |

**Rollout gates:**
1. Days 1–8: Governance — all policies enforced
2. Days 8–15: Reliability — deterministic replay passing
3. Days 15–20: Observability — all dashboards live
4. Days 20–24: Local ops — k3d cluster ready
5. Days 24–28: Caveman v1.1 — profiles defined

**Promotion criteria:**
- All 5 gates passed
- No regressions
- Performance stable
- Observability complete

---

## Dependents

**Phase 2.0 depends on Phase 1.1:**
- Governance rules needed for evolution proposals
- Determinism needed for replay validation
- Observability needed for agent monitoring
- Local ops needed for staging validation

**Start Phase 2.0 only after Phase 1.1 complete.**

---

## Rollback

If Phase 1.1 introduces regressions:
1. Revert to Phase 1.0 baseline
2. Disable new features (governance, profiles, dashboards)
3. Restore direct agent calls
4. Investigate root cause

**Rollback time:** < 10 minutes

---

## Team Assignments

| Component | Owner | Support |
|-----------|-------|---------|
| Governance | TBD | |
| Determinism | TBD | |
| Observability | TBD | |
| Local ops | TBD | |
| Caveman v1.1 | TBD | |

---

## Deliverables Checklist

**Governance (1.1.1):**
- [ ] GovernanceEngine.ts
- [ ] tool-policy.json schema
- [ ] phase-policy.json schema
- [ ] agent-policy.json schema
- [ ] caveman-policy.json schema
- [ ] Enforcement hooks integrated
- [ ] Audit trail complete

**Reliability (1.1.2):**
- [ ] Deterministic clock wrapper
- [ ] Seeded PRNG
- [ ] Promise timeout guards
- [ ] Agent heartbeat
- [ ] Retry/backoff logic
- [ ] Deterministic replay mode
- [ ] 100 scenarios tested

**Observability (1.1.3):**
- [ ] Caveman compression dashboard
- [ ] Memory pipeline latency dashboard
- [ ] Wayland tool execution dashboard
- [ ] Drift alerts
- [ ] Ingestion failure alerts
- [ ] Budget exhaustion alerts
- [ ] Agent downtime alerts

**Local ops (1.1.4):**
- [ ] k3d cluster config
- [ ] Local registry caching
- [ ] make cluster-reload
- [ ] make observability-reload
- [ ] make cic-redeploy
- [ ] make validate-determinism
- [ ] Runbooks

**Caveman v1.1 (1.1.5):**
- [ ] raw profile (enabled)
- [ ] semantic profile (spec only)
- [ ] ast profile (spec only)
- [ ] diff profile (spec only)
- [ ] Budget presets
- [ ] Stats v1.1
- [ ] Caveman v2.0 spec locked

---

## Status

✅ Specification locked  
⏳ Implementation: 2026-06-22 through 2026-07-15  
⏳ Validation: 2026-07-15 through 2026-07-18  

---

**Created:** 2026-06-08  
**Target completion:** 2026-07-15  
**Next phase:** Phase 2.0 (2026-07-15 through 2026-08-01)
