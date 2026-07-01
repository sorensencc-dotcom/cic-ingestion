# CIC Operations Handbook

This document describes how to operate CIC in production, including deployment, rollback, monitoring, alerting, and incident response. CIC is a deterministic system, and production operations must preserve determinism, reproducibility, and routing correctness.

---

# 1. Operational Principles

CIC production operations follow five core principles:

1. **Determinism First**  
   Every deployment must preserve deterministic routing, deterministic inference, and deterministic reproducibility.
2. **Observability Everywhere**  
   Every component emits metrics, traces, logs, and health signals.
3. **Rollback Safety**  
   Every deployment must be reversible within minutes.
4. **Reproducibility Enforcement**  
   snapshotHash, fsHash, and envHash must match across environments.
5. **SLO‑Driven Operations**  
   Latency, drift, reproducibility, and stability SLOs govern all decisions.

---

# 2. Deployment

CIC deployments use:

- Terraform (infra)
- K8s manifests (Sandbox‑3)
- Docker images (CIC API, Harness v3)
- Firecracker nodepool (VM hosts)
- ONNX sidecar (model runtime)

## Deployment Command

```
bash devops/automation/scripts/deploy.sh
```

This performs:

1. Terraform init + apply  
2. Docker build + push  
3. K8s apply  
4. Health checks  
5. Metrics bootstrap

## Deployment Checklist

Before deploying:

- All tests pass
- Reproducibility tests pass
- Drift score stable
- Firecracker nodepool healthy
- ONNX runtime unchanged
- Routing regimes unchanged

---

# 3. Rollback

Rollbacks must be deterministic and fast.

## Rollback Command

```
bash devops/automation/scripts/rollback.sh <previous-tag>
```

Rollback restores:

- Previous CIC API image
- Previous Harness v3 image
- Previous routing regime
- Previous K8s manifests
- Optional snapshot restore

## Rollback Triggers

Rollback immediately if:

- Drift spike
- Reproducibility failure
- Firecracker boot regression
- ONNX inference latency regression
- Routing regime instability

---

# 4. Monitoring

CIC uses Prometheus + Grafana.

## Key Metrics

### Routing
- `cic_api_latency_ms`
- `cic_drift_score`

### Reproducibility
- `sandbox3_reproducibility_score`
- `snapshotHash`
- `fsHash`

### Firecracker
- `sandbox3_firecracker_boot_ms`
- `sandbox3_snapshot_errors_total`

### ONNX
- `sandbox3_onnx_inference_ms`

## Dashboard

```
monitoring/grafana/dashboards/sandbox-3.json
```

---

# 5. Alerting

Alerts are defined in:

```
monitoring/prometheus/alerts/sandbox-3-alerts.yml
```

## Critical Alerts

- **DriftSpike**
- **ReproLow**
- **SnapshotMismatch**
- **FirecrackerBootSlow**
- **VsockErrorSpike**
- **NodeUnhealthy**

## Alert Engines

- `drift-alert-engine.ts`
- `repro-alert-engine.ts`
- `firecracker-node-health.ts`

Alerts notify:

- Slack
- PagerDuty

---

# 6. Incident Response

CIC incidents fall into four categories:

## 1. Drift Incidents

Symptoms:
- Drift score > 0.75
- Drift trend > 0.15

Actions:
1. Inspect drift embeddings
2. Validate preprocessing seed path
3. Check scoring pipeline
4. Quarantine model if needed

---

## 2. Reproducibility Incidents

Symptoms:
- snapshotHash mismatch
- fsHash mismatch
- envHash mismatch

Actions:
1. Run reproducibility verifier
2. Inspect snapshot + rootfs
3. Validate ONNX runtime version
4. Rollback if mismatch persists

---

## 3. Firecracker Incidents

Symptoms:
- Boot > 500ms
- KVM unavailable
- vsock errors

Actions:
1. Drain node
2. Quarantine node
3. Redeploy DaemonSet
4. Validate KVM + vsock

---

## 4. Routing Incidents

Symptoms:
- Regime instability
- Latency regression
- Constraint engine failures

Actions:
1. Inspect regimeTrace
2. Validate constraint engine
3. Check fallback graph
4. Rollback routing changes

---

# 7. SLO Enforcement

CIC enforces four SLOs:

### Latency SLO
- p95 < 40ms
- p99 < 60ms

### Drift SLO
- drift < 0.75
- drift trend < 0.15

### Reproducibility SLO
- score > 0.7

### Stability SLO
- stability > 0.9

Violations trigger:

- Alerts
- Incident response
- Rollback
- Postmortem

---

# 8. Postmortems

Every incident requires a deterministic postmortem:

- What changed
- Why it changed
- Determinism impact
- Reproducibility impact
- Routing impact
- SLO impact
- Fixes
- Preventative measures

---

# 9. Summary

CIC operations revolve around:

- deterministic deployments
- deterministic rollbacks
- deterministic monitoring
- deterministic alerting
- deterministic incident response

This handbook provides the operational foundation for running CIC safely in production.

For full documentation, see:

**`docs/cic/CIC_MASTER_INDEX.md`**
