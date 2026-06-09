# CIC Documentation Index

**Last updated:** 2026-06-08  
**Scope:** Phase 0.9 through 2.0  
**Status:** All specifications locked

---

## Quick Navigation

### Executive
- **[ARTIFACTS_DELIVERED.md](ARTIFACTS_DELIVERED.md)** — Phase 0.9 Local Ops Pack delivery summary
- **[LOCAL_OPS_PACK_SUMMARY.md](LOCAL_OPS_PACK_SUMMARY.md)** — Ops pack overview and features

### Implementation Guides
- **[DOCKER_LOCAL_OPS_GUIDE.md](DOCKER_LOCAL_OPS_GUIDE.md)** — Complete zero-cost Docker deployment guide
- **[CLAUDE.md](CLAUDE.md)** — CIC project instructions for Claude Code

### Phase 1.0
- **[PHASE_23_COMPLETION.md](PHASE_23_COMPLETION.md)** — Phase 23 Memory Layer & Autonomy completion
- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** — Full Phase 23 implementation summary (~9,000 lines)

### Phase 1.1
- **[PHASE_1_1_ROADMAP.md](PHASE_1_1_ROADMAP.md)** — Phase 1.1 hardening & autonomy pass (3.5 weeks)
  - Governance expansion
  - CIC agent reliability
  - Observability v1.1
  - Local ops pack v1.1
  - Caveman v1.1

### Phase 2.0
- **[PHASE_2_0_ARCHITECTURE.md](PHASE_2_0_ARCHITECTURE.md)** — Phase 2.0 distributed multi-agent architecture
  - System diagram
  - Component overview (MAR, Governance, DMB, DTL)
  - Agent roster (7 core agents)
  - Data flow diagrams
  - Determinism guarantees
  - Success metrics

- **[PHASE_2_0_EVOLUTION_ENGINE.md](PHASE_2_0_EVOLUTION_ENGINE.md)** — EvolutionEngine detailed design
  - Evolution proposal model
  - Evolution decision model
  - Core EvolutionEngine class (full TypeScript)
  - Integration points with agents
  - Risk evaluation logic
  - Observability and metrics
  - Testing strategy

- **[CAVEMAN_V2_0_SPEC.md](CAVEMAN_V2_0_SPEC.md)** — Caveman v2.0 compression modes
  - RAW mode (v1 preserved)
  - SEMANTIC mode (text-aware)
  - AST mode (code-aware)
  - DIFF mode (delta-based)
  - CavemanCompressorV2 class (full TypeScript)
  - Governance integration
  - Backwards compatibility

- **[PHASE_1_0_TO_2_0_MIGRATION.md](PHASE_1_0_TO_2_0_MIGRATION.md)** — Zero-downtime migration plan
  - 8-step migration sequence
  - Backwards compatibility at each step
  - Rollback procedures
  - 2.5-week timeline
  - Risk mitigation
  - Observability during migration

### API & Component Documentation
- **[src/autonomy/AUTONOMY_API.md](src/autonomy/AUTONOMY_API.md)** — Phase 23 Autonomy API (17 endpoints)
- **[src/autonomy/AUTONOMY_LEARNER.md](src/autonomy/AUTONOMY_LEARNER.md)** — Phase 23 Autonomy Learner
- **[src/autonomy/bridges/BRIDGES.md](src/autonomy/bridges/BRIDGES.md)** — Phase 23 Bridge architecture

### Infrastructure & Testing
- **[Makefile](Makefile)** — Command center (25+ targets)
- **[docker-compose.yml](docker-compose.yml)** — Main services
- **[docker-compose.logging.yml](docker-compose.logging.yml)** — Logging stack
- **[docker-compose.monitoring.yml](docker-compose.monitoring.yml)** — Monitoring stack
- **[k3d/cluster-config.yaml](k3d/cluster-config.yaml)** — Kubernetes cluster config
- **[k3d/cic-wil-deployment.yaml](k3d/cic-wil-deployment.yaml)** — Kubernetes deployment

---

## Document Organization

### By Type

**Architectural (system design):**
- PHASE_2_0_ARCHITECTURE.md
- PHASE_2_0_EVOLUTION_ENGINE.md
- CAVEMAN_V2_0_SPEC.md

**Operational (how to run):**
- DOCKER_LOCAL_OPS_GUIDE.md
- PHASE_1_1_ROADMAP.md
- PHASE_1_0_TO_2_0_MIGRATION.md

**Reference (APIs, specs):**
- AUTONOMY_API.md
- AUTONOMY_LEARNER.md
- BRIDGES.md

**Infrastructure:**
- Makefile
- docker-compose.yml (3 variants)
- k3d configs

### By Phase

**Phase 0.9 (Infrastructure):**
- LOCAL_OPS_PACK_SUMMARY.md
- DOCKER_LOCAL_OPS_GUIDE.md
- ARTIFACTS_DELIVERED.md

**Phase 1.0 (Memory & Autonomy):**
- PHASE_23_COMPLETION.md
- IMPLEMENTATION_SUMMARY.md
- AUTONOMY_API.md
- AUTONOMY_LEARNER.md
- BRIDGES.md

**Phase 1.1 (Hardening):**
- PHASE_1_1_ROADMAP.md

**Phase 2.0 (Distributed Multi-Agent):**
- PHASE_2_0_ARCHITECTURE.md
- PHASE_2_0_EVOLUTION_ENGINE.md
- CAVEMAN_V2_0_SPEC.md
- PHASE_1_0_TO_2_0_MIGRATION.md

---

## Key Specifications

| Spec | Lines | Status | Purpose |
|------|-------|--------|---------|
| Phase 2.0 Architecture | 350+ | Locked | System design |
| EvolutionEngine Design | 400+ | Locked | Self-improvement |
| Caveman v2.0 | 450+ | Locked | Compression modes |
| Migration Plan | 300+ | Locked | Phase 1→2 path |
| Phase 1.1 Roadmap | 250+ | Locked | Hardening plan |
| Local Ops Guide | 500+ | Locked | Deployment |

---

## Commands Quick Reference

```bash
# Build & test
make build              # Build with TheFoundry
make test              # Run tests
make run               # Run locally

# Services
make compose-up        # Start services
make compose-down      # Stop services
make all-up           # Start everything
make all-down         # Stop everything

# Kubernetes
./scripts/k3d-setup.sh create   # Create cluster
./scripts/k3d-setup.sh deploy   # Deploy
./scripts/k3d-setup.sh destroy  # Destroy

# Registry
make registry-start     # Start local registry
make push-local        # Push image
make pull-local        # Pull image

# Observability
make logging           # Start logging stack
make monitoring        # Start monitoring stack
make compose-logs      # Tail logs

# Help
make help              # Show all targets
```

---

## Timeline

| Phase | Dates | Status |
|-------|-------|--------|
| **0.9** | 2026-06-08 | ✅ Complete |
| **1.0** | 2026-05–06 | ✅ Complete |
| **1.1** | 2026-06-22 → 07-15 | ⏳ Ready |
| **2.0** | 2026-07-15 → 08-01 | ⏳ Spec locked |

---

## Decision Log

**Phase 2.0 Architecture:**
- ✅ Distributed agents (vs. centralized)
- ✅ Message bus (vs. direct calls)
- ✅ EvolutionEngine (vs. static system)
- ✅ Caveman v2.0 (semantic + ast + diff modes)

**Phase 1.1 Focus:**
- ✅ Governance unification
- ✅ Determinism hardening
- ✅ Observability expansion
- ✅ Phase 2.0 readiness

**Zero-cost requirement:**
- ✅ All local (no cloud services)
- ✅ Docker + TheFoundry
- ✅ k3d for Kubernetes simulation
- ✅ Open-source observability (Loki, Prometheus, Grafana)

---

## Approval Sign-offs

- [ ] Architecture review
- [ ] Specification review
- [ ] Timeline approval
- [ ] Team assignments
- [ ] Go/no-go for Phase 1.1
- [ ] Go/no-go for Phase 2.0

---

## How to Use This Index

1. **Starting out?** → Read DOCKER_LOCAL_OPS_GUIDE.md
2. **System design?** → Read PHASE_2_0_ARCHITECTURE.md
3. **Want specifics?** → See links to component docs
4. **Need timeline?** → Check each phase roadmap
5. **Ready to migrate?** → Follow PHASE_1_0_TO_2_0_MIGRATION.md

---

## Related Documents in Repo

- `.claude/settings.json` — Permission allowlist
- `CLAUDE.md` — Project instructions
- `Makefile` — Command center
- `package.json` — Dependencies
- `jest.config.js` — Test config

---

**Last updated:** 2026-06-08  
**Next review:** Post Phase 1.1 (2026-07-18)  
**Maintainer:** CIC Architecture Team
