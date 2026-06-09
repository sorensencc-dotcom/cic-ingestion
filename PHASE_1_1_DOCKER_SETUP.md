# Phase 1.1 TheFoundry Docker Setup

**Date:** 2026-06-08  
**Status:** Ready for implementation 2026-06-22  
**Purpose:** Sealed, deterministic Docker infrastructure for Phase 1.1

---

## Overview

TheFoundry is Phase 0.9's deterministic Docker build system. Phase 1.1 leverages it to:
- Lock Node.js version (20.13.0-alpine3.20)
- Pin all dependencies (npm ci --frozen-lockfile)
- Ensure reproducible builds
- Enable deterministic replay testing (Phase 1.1.2)

---

## Directory Structure

```
cic-ingestion/
├── thefoundry/
│   └── images/
│       └── node-build/
│           └── Dockerfile              # Sealed Node build image
├── docker-compose.yml                  # Phase 1.1 main stack
├── Dockerfile.governance               # Governance engine (1.1.1)
├── config/
│   ├── prometheus.yml                  # Metrics (1.1.3)
│   ├── loki-config.yml                 # Logs (1.1.3)
│   ├── promtail-config.yml             # Log shipper (1.1.3)
│   ├── grafana-datasources.yml         # Grafana setup (1.1.3)
│   └── policies/
│       ├── tool-policy.json            # Tool execution rules (1.1.1)
│       ├── phase-policy.json           # Memory pipeline rules (1.1.1)
│       ├── agent-policy.json           # Agent spawning rules (1.1.1)
│       └── caveman-policy.json         # Compression governance (1.1.1)
├── scripts/
│   └── init-db.sql                     # PostgreSQL schema (deterministic)
└── Makefile                            # Command center (25+ targets)
```

---

## Services

### Main Stack (docker-compose.yml)

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| **cic-wil** | thefoundry node-build | 8080 | Main application |
| **memory-store** | postgres:16.3 | 5432 | Phase 23+ memory |
| **governance-engine** | custom | 9095 | Phase 1.1.1 governance |
| **prometheus** | prom/prometheus:v2.54.0 | 9090 | Metrics collection |
| **loki** | grafana/loki:3.1.0 | 3100 | Log aggregation |
| **promtail** | grafana/promtail:3.1.0 | - | Log shipper |
| **grafana** | grafana/grafana:11.1.0 | 3000 | Dashboards |

### Network

Single bridge network `cic-network` connects all services.

---

## Quick Start

### 1. Build TheFoundry Image

```bash
make build
```

**What it does:**
- Builds deterministic Node image
- Uses sealed Dockerfile (pinned versions)
- Outputs: `cic-wil:latest`

### 2. Start Full Phase 1.1 Stack

```bash
make phase1.1-all
```

**What it starts:**
- CIC application (cic-wil:8080)
- Memory store (postgres:5432)
- Governance engine (governance-engine:9095)
- Observability stack (prometheus, loki, grafana)

**Services ready:**
```
cic-wil:      http://localhost:8080
memory-store: localhost:5432
Grafana:      http://localhost:3000 (admin/cic-local)
Prometheus:   http://localhost:9090
Governance:   http://localhost:9095
```

### 3. View Logs

```bash
make compose-logs
```

### 4. Stop Stack

```bash
make compose-down
```

---

## Phase 1.1 Components

### 1.1.1 Governance Engine

**File:** `Dockerfile.governance`  
**Service:** `governance-engine`  
**Port:** 9095

Enforces policies:
- Tool execution (tool-policy.json)
- Memory pipeline (phase-policy.json)
- Agent spawning (agent-policy.json)
- Caveman compression (caveman-policy.json)

**Audit trail:** `/app/data/audit.log`

**Start governance only:**
```bash
make phase1.1-governance
```

### 1.1.2 Reliability Pass

**Tests:** Deterministic replay (100 scenarios)  
**Target:** 100% match rate

Checks:
- Monotonic clock wrapper ✅
- Seeded PRNG (no Math.random) ✅
- Promise timeout guards ✅
- Agent heartbeat liveness ✅
- Retry/backoff logic ✅

**Run tests:**
```bash
make phase1.1-reliability
```

**Validate determinism:**
```bash
make phase1.1-validate-determinism
```

### 1.1.3 Observability v1.1

**Dashboards:** 4 in Grafana  
**Metrics:** Prometheus  
**Logs:** Loki  

Monitors:
- Caveman compression ratio
- Memory pipeline latency (p95 < 100ms)
- Wayland tool execution (p95 < 100ms)
- Agent uptime (99.9%)
- Governance audit trail
- Drift spikes
- Budget exhaustion
- Agent downtime

**Access:**
- Grafana: http://localhost:3000
- Prometheus: http://localhost:9090
- Loki: http://localhost:3100

**Start observability:**
```bash
make phase1.1-observability
```

### 1.1.4 Local Ops Pack v1.1

**Components:**
- k3d multi-node cluster config
- Local registry caching
- Makefile targets (25+)
- Documentation

**Quick commands:**
```bash
make k3d-create           # Create cluster
make k3d-deploy           # Deploy CIC
make compose-up           # Start local stack
make compose-logs         # Tail logs
make compose-down         # Stop stack
```

**k3d cluster:**
```bash
# Create
make k3d-create

# Deploy CIC
make k3d-deploy

# Logs
make k3d-logs

# Destroy
make k3d-destroy
```

### 1.1.5 Caveman v1.1

**Profiles:**
- `raw` — Enabled (v1 mode)
- `semantic` — Spec-ready (Phase 2.0)
- `ast` — Spec-ready (Phase 2.0)
- `diff` — Spec-ready (Phase 2.0)

**Budget Presets:**
- `low` — 5 MB/day
- `medium` — 10 MB/day (default)
- `high` — 20 MB/day

**Config:** `config/policies/caveman-policy.json`

**Check profiles:**
```bash
make phase1.1-caveman
```

---

## Policies

### Tool Policy (tool-policy.json)

Tool execution rules for Wayland adapters:

```json
{
  "allowlist": ["read_file", "write_file", "execute_script", ...],
  "blocklist": ["delete_file", "drop_database", ...],
  "rate_limits": {...},
  "timeout_ms": 30000
}
```

**Enforced by:** governance-engine  
**Audit log:** `/app/data/audit.log`

### Phase Policy (phase-policy.json)

Memory pipeline and autonomy rules:

```json
{
  "phase_23_memory": {...},
  "phase_24_governance": {...},
  "phase_25_knowledge_graph": {...},
  "determinism": {...}
}
```

### Agent Policy (agent-policy.json)

Agent spawning and lifecycle:

```json
{
  "approved_agent_types": [...],
  "max_concurrent_agents": 10,
  "heartbeat_interval_ms": 30000,
  "lifecycle": {...}
}
```

### Caveman Policy (caveman-policy.json)

Compression governance:

```json
{
  "compression_modes": {...},
  "budget_presets": {...},
  "enforcement": {...}
}
```

---

## Database Schema

**File:** `scripts/init-db.sql`

**Tables:**
- `memories` — Phase 23 memory store
- `governance_decisions` — Phase 24 governance
- `graph_vertices` / `graph_edges` — Phase 25 knowledge graph
- `audit_log` — Phase 1.1 audit trail
- `determinism_log` — Phase 1.1 determinism testing
- `metrics` — Phase 1.1 observability

**Auto-created:** On container startup

---

## Environment Variables

**cic-wil service:**
```
NODE_ENV=development
MEMORY_STORE_HOST=memory-store
MEMORY_STORE_PORT=5432
MEMORY_STORE_DB=cic
MEMORY_STORE_USER=cic
MEMORY_STORE_PASSWORD=cic-local
GOVERNANCE_ENGINE=true
AUTONOMY_ENABLED=true
OBSERVABILITY_ENABLED=true
```

**governance-engine service:**
```
NODE_ENV=development
GOVERNANCE_PORT=9095
POLICY_DIR=/app/config/policies
AUDIT_LOG_PATH=/app/data/audit.log
```

---

## Networking

**Bridge network:** `cic-network`

Service discovery:
- `cic-wil:8080` — CIC application
- `memory-store:5432` — PostgreSQL
- `governance-engine:9095` — Governance API
- `prometheus:9090` — Metrics
- `loki:3100` — Logs
- `grafana:3000` — Dashboards

---

## Data Persistence

**Volumes:**
- `memory-store-data` — PostgreSQL data
- `prometheus-data` — Metrics history
- `loki-data` — Log storage
- `grafana-data` — Dashboards and config

**Mounted paths:**
- `./src:/app/src:ro` — Source code (read-only)
- `./data:/app/data` — Application data
- `./config/policies:/app/config/policies:ro` — Policies (read-only)

---

## Determinism Testing (1.1.2)

### Replay Mode

Same input → same output (byte-for-byte)

**Record phase:**
1. Record external data (DB state, operator requests)
2. Record internal RNG seed (42)
3. Record clock snapshots

**Replay phase:**
1. Initialize clock to recorded seed
2. Initialize PRNG to recorded seed
3. Feed recorded inputs
4. Diff outputs

**Target:** 100 scenarios, 100% match

---

## Troubleshooting

### Service won't start

```bash
# Check logs
make compose-logs

# Check health
docker compose ps
```

### Database connection error

```bash
# Wait for postgres to be ready
docker compose ps memory-store

# Check logs
docker compose logs memory-store
```

### Port already in use

Change port in `docker-compose.yml`:
```yaml
ports:
  - "8081:8080"  # Use 8081 instead of 8080
```

### Memory limits

Increase Docker Desktop limits:
- Settings → Resources → Memory
- Recommended: 4GB+ for full stack

---

## Performance Notes

### Build Time
- Full build (TheFoundry): ~2-3 minutes
- Cached build: < 30 seconds

### Service Startup
- CIC app: ~30 seconds
- Full stack: ~2 minutes
- k3d cluster: ~1 minute

### Storage
- cic-wil image: ~800MB
- All images + volumes: ~2GB

---

## Next Steps

1. **Implement Phase 1.1 (2026-06-22):**
   - Complete governance rules
   - Determinism hardening
   - Full observability

2. **Validate Phase 1.1 (2026-07-15):**
   - All tests passing
   - All dashboards live
   - All metrics correct

3. **Promote to Phase 2.0 (2026-07-15):**
   - Distributed multi-agent architecture
   - EvolutionEngine integration
   - Caveman v2.0 modes

---

## References

- [PHASE_1_1_ROADMAP.md](PHASE_1_1_ROADMAP.md) — Full specification
- [PHASE_2_0_ARCHITECTURE.md](PHASE_2_0_ARCHITECTURE.md) — Next phase
- [DOCKER_LOCAL_OPS_GUIDE.md](DOCKER_LOCAL_OPS_GUIDE.md) — Ops details
- [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) — All docs

---

**Created:** 2026-06-08  
**Target deployment:** 2026-06-22  
**Status:** Ready for implementation
