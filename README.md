# CIC Ingestion Engine

**Version:** 2.0.0-orchestrator  
**Status:** Phase 23.8 (Autonomy) + Phase 0 (Orchestrator)  
**Date:** 2026-06-11

---

## Quick Start

### Prerequisites
- Docker (TheFoundry v1.0)
- Node.js 18+ (in container)
- PostgreSQL 15+ (via docker-compose)

### Build & Run
```bash
# Start full stack (all services)
docker compose up -d

# Or use Makefile
make all-up

# Verify Orchestrator is ready
curl http://localhost:7001/reason/health
```

### Verify Services
```bash
# Orchestrator (port 7001)
curl -X POST http://localhost:7001/reason \
  -H 'content-type: application/json' \
  -d '{"action":"ingest-reasoning","timestamp":"2026-06-11T00:00:00Z","metadata":{}}'

# Memory Store (PostgreSQL, port 5432)
docker exec memory-store psql -U cic -d cic -c "SELECT COUNT(*) FROM packets;"

# Governance Engine (port 3000)
curl http://localhost:3000/health

# CIC WIL (port 5000)
curl http://localhost:5000/health
```

---

## What's Inside

### 📦 Core Services

| Service | Port | Purpose | Status |
|---------|------|---------|--------|
| **Orchestrator** | 7001 | HTTP endpoint for workflow reasoning | ✅ Complete |
| **Memory Store** | 5432 | PostgreSQL backend for signal/event storage | ✅ Complete |
| **Governance Engine** | 3000 | Council voting + approval logic | ✅ Complete |
| **CIC WIL** | 5000 | Wayland ingestion layer | ✅ Complete |
| **Prometheus** | 9090 | Metrics collection | ✅ Complete |
| **Grafana** | 3001 | Metrics dashboard | ✅ Complete |
| **Loki** | 3100 | Log aggregation | ✅ Complete |

### 📂 Codebase Structure

```
src/
├── autonomy/
│   ├── AutonomyAPIServer.ts    [Phase 23] Core autonomy engine
│   ├── SignalDetection.ts      [Phase 23] 4 signal types
│   ├── RoadmapProposalEngine.ts [Phase 23] Impact assessment
│   ├── AutonomyLearner.ts      [Phase 23] Outcome tracking + threshold tuning
│   ├── routes/
│   │   ├── signals.ts          [Phase 23] Signal API endpoints
│   │   ├── proposals.ts        [Phase 23] Proposal API endpoints
│   │   └── learner.ts          [Phase 23] Learner API endpoints
│   ├── bridges/
│   │   ├── AutonomyToPlannerBridge.ts    [Phase 23] → APR goals
│   │   ├── AutonomyToARPSBridge.ts       [Phase 23] → ARPS history
│   │   ├── AutonomyGovernanceBridge.ts   [Phase 23] → Council voting
│   │   └── BridgeOrchestrator.ts         [Phase 23] Unified coordination
│   └── models/
│       ├── AutonomySignal.ts
│       └── RoadmapProposal.ts
│
├── orchestrator/                 [Phase 0, 2026-06-11]
│   ├── index.ts                 Express HTTP server
│   └── wayland-endpoint.ts       POST /reason handler
│
├── wayland/                      [Phase 23.8]
│   ├── workflow.ts              WorkflowRunner + defs
│   ├── workflow-integration.ts   Usage examples
│   ├── wayland-adapter-registry.ts  HTTP adapter
│   ├── wayland-security-policy.ts   Security config
│   └── workflow.test.ts         Unit tests
│
├── ui/
│   ├── explorer/                [Phase 23] Memory explorer
│   │   ├── ExplorerLayout.tsx
│   │   ├── TimelineView.tsx
│   │   ├── DriftOverlay.tsx
│   │   ├── HealthIndicators.tsx
│   │   ├── FilterPanel.tsx
│   │   └── CorrelationTracer.tsx
│   ├── models/TimelineEvent.ts
│   └── queries/ExplorerQueries.ts
│
└── skills/
    ├── models/SkillGraph.ts     [Phase 24] Graph models
    └── SkillGraphStore.ts       [Phase 24] Persistent store
```

### 🔧 Build Configuration

- **TheFoundry Docker build** (Phase 0.9): Deterministic, reproducible builds
- **Makefile**: 25+ targets (build, compose, logging, monitoring)
- **docker-compose.yml**: Multi-service stack
- **package.json**: npm scripts for local dev

---

## Documentation

| Document | Scope | Lines |
|----------|-------|-------|
| [WAYLAND_ORCHESTRATOR_INTEGRATION.md](./WAYLAND_ORCHESTRATOR_INTEGRATION.md) | Workflow → Orchestrator wiring | 300 |
| [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) | Phase 23 completion report | 350 |
| [PHASE_23_COMPLETION.md](./PHASE_23_COMPLETION.md) | Phase 23 spec + fulfillment | 280 |
| [DOCKER_LOCAL_OPS_GUIDE.md](./DOCKER_LOCAL_OPS_GUIDE.md) | Complete Docker + k3d guide | 500+ |
| [src/autonomy/AUTONOMY_API.md](./src/autonomy/AUTONOMY_API.md) | API endpoint reference | 350 |
| [src/autonomy/AUTONOMY_LEARNER.md](./src/autonomy/AUTONOMY_LEARNER.md) | Learner system | 280 |
| [src/autonomy/bridges/BRIDGES.md](./src/autonomy/bridges/BRIDGES.md) | Bridge orchestration | 400 |

---

## Phases Completed

### ✅ Phase 23 — Autonomy Stack (Complete)
- **Signal Detection**: 4 types (drift, instability, regression, opportunity)
- **Proposal Generation**: Impact assessment, priority scoring
- **Bridge Orchestration**: APR, ARPS, Governance integration
- **Learner**: Outcome tracking, threshold tuning, decay
- **Memory Explorer UI**: Timeline, drift, health dashboards

**Metrics:**
- 5,500+ lines production code
- 1,500+ lines tests (76 tests)
- 2,000+ lines documentation
- Coverage: 75%+

**Status:** Ready for Phase 24–27

---

### ✅ Phase 0 — Orchestrator (Complete)
- **Wayland Integration**: Workflow → HTTP endpoint
- **Service Stack**: Docker Compose with 7 services
- **HTTP Endpoint**: POST /reason for reasoning tasks
- **Adapter Registry**: HTTP, shell, file, model adapters
- **Error Handling**: Retry logic, timeouts, JSON parsing

**Metrics:**
- WorkflowRunner: 120 lines, fully tested
- WaylandOrchestratorEndpoint: 160 lines
- HTTP Adapter: Real implementation (not stub)
- Docker integration: 3 files modified

**Status:** Tested & working (port 7001)

---

### ⏳ Phase 24 — Skill Graph (In Progress)
- SkillGraph.ts: Models for nodes/edges
- SkillGraphStore.ts: Persistent versioned store
- Next: Harvester, synthesizer, API, UI

---

## Key Features

### Autonomy Engine (Phase 23)
- Self-aware signal detection from real metrics
- Automatic roadmap proposal generation
- Multi-bridge integration (APR, ARPS, Governance)
- Outcome-based learning with threshold tuning

### Orchestrator (Phase 0, 2026-06-11)
- HTTP endpoint for external workflow invocation
- Declarative workflow definitions (JSON/TS)
- Multi-adapter support (HTTP, shell, file, model)
- Retry logic with exponential backoff (capped 10s)
- Fine-grained security policy per step

### Memory System (Phase 23.2–23.5)
- PostgreSQL-backed event store
- Query API with 7 methods
- Retention & distillation with 70–95% compression
- Signals feed autonomy engine

### Observability
- Loki log aggregation + Promtail
- Prometheus metrics collection
- Grafana dashboards (logs + metrics)
- Full audit trail via ARPS

---

## Testing

### Run All Tests
```bash
npm test
```

### Run Specific Suite
```bash
npm test -- autonomy/bridges/__tests__/bridges.test.ts
npm test -- autonomy/__tests__/learner.test.ts
npm test -- wayland/workflow.test.ts
```

### Coverage Report
```bash
npm test -- --coverage
```

**Current Coverage:**
- Branch: 75%+
- Function: 75%+
- Line: 75%+
- Statement: 75%+

---

## API Reference

### Orchestrator Endpoints

**Health Check:**
```
GET /reason/health
→ { status: 'ok', service: 'orchestrator', timestamp: ... }
```

**Workflow Reasoning:**
```
POST /reason
→ { status, requestId, action, result, processingTimeMs }
```

### Autonomy Endpoints (Port 3000)

**Signals (4 endpoints)**
- `GET /autonomy/signals/detect` — Detect current signals
- `GET /autonomy/signals/query` — Query signal history
- `GET /autonomy/signals/trends` — Signal trend analysis
- `GET /autonomy/signals/:id` — Signal detail

**Proposals (5 endpoints)**
- `GET /autonomy/proposals/query` — Query proposals
- `POST /autonomy/proposals/generate` — Generate new proposals
- `PATCH /autonomy/proposals/:id` — Update proposal
- `POST /autonomy/proposals/simulate` — Simulation
- `GET /autonomy/proposals/:id` — Detail

**Learner (6 endpoints)**
- `GET /autonomy/learner/metrics` — Accuracy metrics
- `GET /autonomy/learner/thresholds` — Current thresholds
- `POST /autonomy/learner/feedback` — Record outcome
- `GET /autonomy/learner/decay` — Archive status
- `GET /autonomy/learner/summary` — Summary stats

**Info (2 endpoints)**
- `GET /autonomy/health` — Service health
- `GET /autonomy/catalog` — API catalog

---

## Deployment

### Local Docker
```bash
docker compose up -d
```

### Kubernetes (Future)
- k3d manifests ready in `k3d/`
- Phase 0.9 TheFoundry images compatible

### Production Checklist
- [ ] Real ingest service integration
- [ ] LLM reasoning engine
- [ ] Persistent job queue (Bull/RabbitMQ)
- [ ] Rate limiting
- [ ] Production logger (Winston/Pino)
- [ ] OpenTelemetry instrumentation
- [ ] SSL/TLS termination
- [ ] Request authentication

---

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| /reason latency | <100ms | ~17ms ✅ |
| Signal detection | <1s | <500ms ✅ |
| Proposal generation | <2s | <800ms ✅ |
| Learner feedback | <100ms | <50ms ✅ |
| Test suite | <15s | <10s ✅ |

---

## Troubleshooting

### Orchestrator Not Responding
```bash
# Check container is running
docker ps | grep orchestrator

# View logs
docker logs orchestrator

# Test endpoint directly
curl -i http://localhost:7001/reason/health
```

### Memory Store Connection Error
```bash
# Verify PostgreSQL is up
docker exec memory-store psql -U cic -c "SELECT 1"

# Check environment variables
docker exec orchestrator env | grep MEMORY_STORE
```

### Workflow Execution Failing
```bash
# Check Docker Compose service dependencies
docker compose logs orchestrator | tail -100

# Verify adapters are registered
npm test -- wayland/workflow.test.ts
```

---

## Contributing

### Code Style
- ESM modules only (import/export)
- TypeScript with strict mode
- .js extensions in relative imports
- Caveman-mode comments (why, not what)

### Adding a New Adapter
1. Implement in `src/wayland/wayland-adapter-registry.ts`
2. Add to `createDefaultRegistry()` function
3. Write tests in `src/wayland/workflow.test.ts`
4. Document in `WAYLAND_ORCHESTRATOR_INTEGRATION.md`

### Adding a New Workflow
1. Define in `src/wayland/workflow.ts`
2. Export as `export const newWorkflow = { ... }`
3. Add integration example in `src/wayland/workflow-integration.ts`
4. Test: `npm test`

---

## License

MIT

---

## Quick Links

- [Orchestrator Integration](./WAYLAND_ORCHESTRATOR_INTEGRATION.md) — How workflows wire to HTTP endpoint
- [Phase 23 Summary](./IMPLEMENTATION_SUMMARY.md) — Autonomy stack completion
- [Docker Ops Guide](./DOCKER_LOCAL_OPS_GUIDE.md) — Full local development setup
- [CIC Master Roadmap](../CIC_MASTER_ROADMAP.md) — All phases 0–56
