# CIC Ingestion — Claude Code Instructions

## Build & Deployment

**All builds MUST use Docker** via TheFoundry (Phase 0.9).

### Build Command
```bash
docker build -t cic-ingestion:latest -f thefoundry/images/node-build/Dockerfile .
```

### Runtime Command
```bash
docker run -it --rm -v $(pwd):/app cic-ingestion:latest
```

### Why Docker-First
- ✅ Deterministic, reproducible builds (same output across all machines)
- ✅ No host npm install contamination
- ✅ Audit trail for Phase 24 Autonomous Governance
- ✅ Aligns with Phase 0.9 infrastructure
- ✅ CI/CD pipelines use the same container

### Local Development
1. All `npm install`, `npm test`, `npm run build` commands run inside the container
2. Source code is mounted read-only (`:ro`) to prevent accidental modifications
3. Use `docker exec` to attach to running container if needed

### Deployment
- Build image once in CI
- Push to registry (Docker Hub / ECR)
- Deploy container to staging/production
- Never install packages directly on host

### Reference
- **TheFoundry Spec:** `/docs/cic/phase-0-9-thefoundry.md` (in rewrite-mcp)
- **Phase 0.9 Timeline:** 2026-06-08 through 2026-06-22
- **Status:** Core images validated (Week 1 complete)

---

## Memory & Auto-Memory
- User email: sorensencc@gmail.com
- Auto-memory location: `~/.claude/projects/c--dev/memory/`
- Update memory on significant discoveries or project-level decisions
- See MEMORY.md in memory dir for all context

---

## When Asking for Builds
**Always specify:** "Use TheFoundry Docker build" or just say "build with Docker" and I'll use the command above.

---

## CIC Local Ops Pack (Phase 0.9)

**Complete zero-cost Docker deployment infrastructure** — ready to use immediately.

### Quick Access
```bash
make help              # View all targets
make build            # Build with TheFoundry
make compose-up       # Start CIC + MemoryStore
make all-up          # Full stack (CIC + logging + monitoring)
make all-down        # Stop everything
```

### What's Included
- **Makefile:** 25+ targets for all Docker + Foundry operations
- **Docker Compose:** Multi-service stack (CIC + MemoryStore)
- **Logging Stack:** Loki + Promtail + Grafana (http://localhost:3000)
- **Monitoring Stack:** Prometheus + Grafana (http://localhost:3001)
- **k3d Kubernetes:** Multi-node local cluster (optional)
- **Local Registry:** Push/pull images locally (localhost:5000)
- **Observability:** Pre-built dashboards, comprehensive logging

### Key Files
- `Makefile` — Command center
- `docker-compose.yml` — Main stack
- `docker-compose.logging.yml` — Log aggregation
- `docker-compose.monitoring.yml` — Metrics
- `k3d/` — Kubernetes manifests
- `scripts/` — k3d + registry setup
- `config/` — Loki, Prometheus, Grafana configs
- `dashboards/` — Sample Grafana dashboard
- `DOCKER_LOCAL_OPS_GUIDE.md` — Complete guide (500+ lines)

### Read This First
→ **DOCKER_LOCAL_OPS_GUIDE.md** — Full documentation

### Status
✅ **Production-ready** — All artifacts complete and tested
