# Contributing to CIC

Welcome to CIC — the deterministic ingestion, routing, learning, and execution system for Rewrite Labs.  
This guide explains how to develop safely inside CIC without breaking determinism, reproducibility, or routing guarantees.

---

# 1. Repository Structure

CIC is organized into four major domains:

```
docs/cic/          # Phase 1, Phase 2, Sandbox‑3, DevOps docs
src/               # CIC API, MAAL, Harness v3, Sandbox‑3 runtime
devops/            # Automation, deployment, K8s, CI/CD
monitoring/        # Prometheus, Grafana, collectors, alerts
tests/             # Unit + integration tests
```

Before contributing, skim:

- `docs/cic/CIC_MASTER_INDEX.md`
- `README.md`

These give the full system map.

---

# 2. Development Environment

## Requirements

- Node.js 20+
- Docker Desktop or containerd
- Terraform 1.5+
- kubectl
- Firecracker‑capable host (for Sandbox‑3 local testing)
- GitHub Actions (CI)

## Install dependencies

```
npm install
```

## Run tests

```
npm test
```

---

# 3. Determinism Rules (Critical)

CIC enforces strict determinism across:

- MAAL routing
- Sandbox‑3 execution
- ONNX inference
- SPL/RL training

### You must NOT:

- introduce nondeterministic randomness
- change ONNX runtime versions without approval
- modify Firecracker kernel/rootfs without version bump
- alter routing regime logic without updating Phase 1 docs
- break snapshotHash or fsHash reproducibility

### You must:

- use fixed seeds
- use deterministic algorithms
- update docs when changing routing or harness behavior
- run reproducibility tests before merging

---

# 4. Coding Standards

All CIC code follows Rewrite Labs operator‑grade standards:

- deterministic, side‑effect‑controlled functions
- explicit error handling
- structured JSON logs
- no silent failures
- no hidden global state
- no implicit randomness
- no floating‑point nondeterminism in routing logic

### File headers

Every file must include:

```
/*
  filename: <name>
  version: <semver>
  updated: <date>
*/
```

---

# 5. Branching Model

CIC uses a simple, deterministic branching model:

- `main` — stable, deployable
- `dev` — active development
- `feature/*` — new features
- `fix/*` — bug fixes
- `docs/*` — documentation updates

All merges into `main` require:

- passing CI
- passing reproducibility tests
- updated docs (Phase 1, Phase 2, Sandbox‑3, DevOps)

---

# 6. Testing

CIC requires tests at three levels:

## Unit tests

Located in:

```
tests/maal/
tests/routing/
tests/sandbox-3/
tests/harness/
```

Run:

```
npm test
```

## Integration tests

Sandbox‑3 integration tests require:

- Firecracker host
- ONNX sidecar
- CIC API
- Harness v3

## Reproducibility tests

Before merging:

```
npm run repro-check
```

This verifies:

- snapshotHash
- fsHash
- envHash
- deterministic seeds
- routing regime consistency

---

# 7. Commit Rules

Every commit must:

- be deterministic
- include updated docs if behavior changed
- include updated tests if logic changed
- avoid introducing nondeterministic dependencies

Commit message format:

```
<type>: <description>

Details:
- What changed
- Why it changed
- Determinism impact
- Docs updated (yes/no)
```

Types:

- `feat:`
- `fix:`
- `docs:`
- `refactor:`
- `test:`
- `devops:`

---

# 8. Pull Requests

Every PR must include:

- description of change
- determinism impact analysis
- reproducibility test results
- updated docs (if applicable)
- updated CI pipeline (if applicable)

PRs that break determinism are rejected.

---

# 9. Sandbox‑3 Development Rules

Sandbox‑3 is extremely sensitive.  
When modifying:

- Firecracker configs
- Harness v3
- ONNX runtime
- routing regime execution
- snapshot restore logic

You must:

1. update Sandbox‑3 docs
2. run reproducibility tests
3. run latency tests
4. run stability tests
5. update monitoring dashboards if metrics change

---

# 10. DevOps Contributions

When modifying:

- Terraform
- K8s manifests
- CI pipeline
- monitoring stack
- alert rules

You must:

- validate Terraform
- validate K8s manifests
- update CI pipeline
- update monitoring dashboards
- update alert rules
- update DevOps docs

---

# 11. Incident Response

If your change affects:

- drift score
- reproducibility score
- Firecracker boot time
- ONNX inference latency
- routing regime selection

You must update:

- `monitoring/prometheus/alerts/`
- `monitoring/incidents/slo-playbooks.md`

---

# 12. Summary

CIC is a deterministic system.  
Every contribution must preserve:

- determinism
- reproducibility
- routing correctness
- stability
- observability

If in doubt, update the docs and run reproducibility tests.

Welcome to CIC.
