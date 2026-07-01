# CIC Architecture

CIC (Core Ingestion & Computation) is a deterministic routing, learning, and execution system.  
It is composed of four major architectural layers:

1. **Phase 1 — MAAL Foundation**  
2. **Phase 2 — SPL/RL Training Harness**  
3. **Sandbox‑3 — Deterministic Execution Environment**  
4. **DevOps — Automation, Deployment, Monitoring, Alerting**

Each layer is independent, deterministic, and fully observable.

---

# 1. Phase 1 — MAAL Foundation

MAAL is the deterministic routing engine that powers CIC.

## Responsibilities

- Task fingerprinting  
- Constraint evaluation  
- Regime selection  
- Fallback graph validation  
- Ledger substrate (event stream + SQL schemas)

## Determinism Guarantees

- No nondeterministic randomness  
- No floating‑point nondeterminism  
- Fully reproducible routing decisions  
- Ledger‑backed auditability  

Docs: `docs/cic/PHASE-1_*.md`

---

# 2. Phase 2 — SPL/RL Training Harness

Phase 2 builds an offline RL system on top of Phase 1’s ledger.

## Responsibilities

- State featurization (64‑dim)  
- Action space (routing regimes)  
- Reward function (latency/cost/success)  
- Episode trajectory collection  
- Policy gradient learning  
- Simulation engine  
- Experience replay

## Determinism Guarantees

- Fixed seeds  
- Deterministic featurization  
- Deterministic simulation  
- Deterministic policy updates

Docs: `docs/cic/PHASE-2_*.md`

---

# 3. Sandbox‑3 — Deterministic Execution Environment

Sandbox‑3 is the deterministic inference and routing evaluation environment.

## Components

- Firecracker microVMs  
- Harness v3  
- ONNX runtime  
- MAAL Router v3  
- Snapshot subsystem  
- Tracing subsystem  
- Metrics subsystem

## Determinism Guarantees

- Fixed kernel + rootfs  
- SnapshotHash + fsHash + envHash  
- Deterministic ONNX runtime  
- Deterministic seeds  
- Deterministic routing regime execution

## Observability

- Syscall tracing  
- Network tracing  
- VM lifecycle tracing  
- Routing regime tracing  
- Prometheus metrics  
- Grafana dashboards

Docs: `docs/cic/SANDBOX-3_*.md`

---

# 4. DevOps — Automation, Deployment, Monitoring, Alerting

CIC’s DevOps layer provides deterministic infrastructure and operational tooling.

## Automation (Batch 12)

- Terraform infra  
- Deployment scripts  
- Rollback scripts  
- Monitoring bootstrap  
- CI pipeline

## Deployment (Batch 13)

- Firecracker nodepool  
- ONNX sidecar  
- CIC API  
- Harness v3  
- API gateway  
- Production Docker Compose

## Monitoring (Batch 14)

- Prometheus exporters  
- Firecracker + ONNX collectors  
- Grafana dashboards

## Alerting (Batch 15)

- Drift alerts  
- Reproducibility alerts  
- Firecracker node health  
- SLO incident playbooks

Docs: `docs/cic/CIC_MASTER_INDEX.md`

---

# 5. End‑to‑End Data Flow

```
Request
   ↓
CIC API
   ↓
MAAL Router (Phase 1)
   ↓
Harness v3 (Sandbox‑3)
   ↓
Firecracker VM
   ↓
ONNX Runtime
   ↓
Response
```

Every step is deterministic, observable, and reproducible.

---

# 6. Determinism Contract

CIC enforces determinism across:

- routing  
- inference  
- learning  
- deployment  
- observability

A change in any of these requires:

- updated docs  
- updated tests  
- reproducibility verification  
- determinism impact analysis

---

# 7. Summary

CIC is a fully deterministic ingestion, routing, learning, and execution system.  
This architecture document provides the high‑level overview of how all components fit together.

For detailed documentation, see:

**`docs/cic/CIC_MASTER_INDEX.md`**
