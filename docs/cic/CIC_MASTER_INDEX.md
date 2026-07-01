# CIC Master Index

The CIC system is composed of four major layers:

1. **Phase 1 — MAAL Foundation**  
2. **Phase 2 — SPL/RL Training Harness**  
3. **Sandbox‑3 — Deterministic Execution Environment**  
4. **DevOps — Automation, Deployment, Monitoring, Alerting**

This document provides a unified index linking all CIC components.

---

## Phase 1 — MAAL Foundation

Core routing and determinism primitives.

- [PHASE-1_OVERVIEW](PHASE-1_OVERVIEW.md)
- [PHASE-1_ARCHITECTURE](PHASE-1_ARCHITECTURE.md)
- [PHASE-1_MAAL_CORE](PHASE-1_MAAL_CORE.md)
- [PHASE-1_LEDGER_SUBSTRATE](PHASE-1_LEDGER_SUBSTRATE.md)
- [PHASE-1_BRIDGE_ORCHESTRATOR](PHASE-1_BRIDGE_ORCHESTRATOR.md)
- [PHASE-1_FILE_CONTRACT](PHASE-1_FILE_CONTRACT.md)
- [PHASE-1_IMPLEMENTATION_ORDER](PHASE-1_IMPLEMENTATION_ORDER.md)
- [PHASE-1_TESTING](PHASE-1_TESTING.md)

---

## Phase 2 — SPL/RL Training Harness

Offline learning pipeline built on Phase 1 ledger.

- [PHASE-2_OVERVIEW](PHASE-2_OVERVIEW.md)
- [PHASE-2_ARCHITECTURE](PHASE-2_ARCHITECTURE.md)
- [PHASE-2_STATE_SPACE](PHASE-2_STATE_SPACE.md)
- [PHASE-2_ACTION_SPACE](PHASE-2_ACTION_SPACE.md)
- [PHASE-2_REWARD_FUNCTION](PHASE-2_REWARD_FUNCTION.md)
- [PHASE-2_EPISODE_TRAJECTORY](PHASE-2_EPISODE_TRAJECTORY.md)
- [PHASE-2_POLICY_LEARNER](PHASE-2_POLICY_LEARNER.md)
- [PHASE-2_SIMULATION_ENGINE](PHASE-2_SIMULATION_ENGINE.md)
- [PHASE-2_TRAINING_LOOP](PHASE-2_TRAINING_LOOP.md)
- [PHASE-2_INTEGRATION](PHASE-2_INTEGRATION.md)
- [PHASE-2_TESTING](PHASE-2_TESTING.md)

---

## Sandbox‑3 — Deterministic Execution Environment

Firecracker‑based deterministic inference and routing evaluation.

- [SANDBOX-3_OVERVIEW](SANDBOX-3_OVERVIEW.md)
- [SANDBOX-3_ARCHITECTURE](SANDBOX-3_ARCHITECTURE.md)
- [SANDBOX-3_RUNTIME](SANDBOX-3_RUNTIME.md)
- [SANDBOX-3_HARNESS_V3](SANDBOX-3_HARNESS_V3.md)
- [SANDBOX-3_FIRECRACKER](SANDBOX-3_FIRECRACKER.md)
- [SANDBOX-3_DETERMINISM](SANDBOX-3_DETERMINISM.md)
- [SANDBOX-3_TRACING](SANDBOX-3_TRACING.md)
- [SANDBOX-3_LATENCY](SANDBOX-3_LATENCY.md)
- [SANDBOX-3_REPRODUCIBILITY](SANDBOX-3_REPRODUCIBILITY.md)
- [SANDBOX-3_STABILITY_V3](SANDBOX-3_STABILITY_V3.md)
- [SANDBOX-3_ROUTING_V3](SANDBOX-3_ROUTING_V3.md)
- [SANDBOX-3_DEPLOYMENT](SANDBOX-3_DEPLOYMENT.md)
- [SANDBOX-3_MONITORING](SANDBOX-3_MONITORING.md)
- [SANDBOX-3_ALERTING](SANDBOX-3_ALERTING.md)
- [SANDBOX-3_INCIDENT_RESPONSE](SANDBOX-3_INCIDENT_RESPONSE.md)

---

## DevOps — Automation, Deployment, Monitoring, Alerting, CLI

Infrastructure, CI/CD, K8s, operational tooling, and command‑line utilities.

### Automation (Batch 12)
- `devops/automation/terraform/main.tf`
- `devops/automation/scripts/deploy.sh`
- `devops/automation/scripts/rollback.sh`
- `devops/automation/scripts/monitor.sh`
- `devops/automation/ci/pipeline.yml`

### Deployment (Batch 13)
- `devops/k8s/cic-sandbox-3.yaml`
- `devops/k8s/firecracker-nodepool.yaml`
- `devops/k8s/onnx-sidecar.yaml`
- `devops/k8s/cic-api-gateway.yaml`
- `devops/compose/docker-compose.prod.yml`

### Monitoring (Batch 14)
- `monitoring/prometheus/cic-metrics-exporter.ts`
- `monitoring/prometheus/sandbox-3-metrics.ts`
- `monitoring/collectors/firecracker-collector.ts`
- `monitoring/collectors/onnx-collector.ts`
- `monitoring/grafana/dashboards/sandbox-3.json`

### CLI Layer (Batch 11)
- `src/cli/cic-cli.ts`
- `src/cli/config-manager.ts`
- `src/cli/index.ts`

### Alerting + Incident Response (Batch 15)
- `monitoring/prometheus/alerts/sandbox-3-alerts.yml`
- `monitoring/alerts/drift-alert-engine.ts`
- `monitoring/alerts/repro-alert-engine.ts`
- `monitoring/alerts/firecracker-node-health.ts`
- `monitoring/incidents/slo-playbooks.md`

---

## Summary

CIC is now fully documented across:

- **Routing (Phase 1)**  
- **Learning (Phase 2)**  
- **Execution (Sandbox‑3)**  
- **Operations (DevOps)**

This index serves as the authoritative map of the entire CIC system.
