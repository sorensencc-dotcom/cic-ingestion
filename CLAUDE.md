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
