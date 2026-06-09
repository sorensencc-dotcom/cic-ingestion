# CIC Local Ops Pack — Complete Zero-Cost Deployment Guide

**All local. All free. All deterministic.**

This guide covers everything you need to run CIC/WIL + observability stacks locally using Docker, TheFoundry, and optional k3d Kubernetes—with zero cloud costs, zero external dependencies, and 100% reproducibility.

---

## 🚀 Quick Start (5 minutes)

### 1. Build CIC WIL
```bash
make build
```

### 2. Run Services (Compose)
```bash
make compose-up
```

Access:
- **CIC WIL:** http://localhost:8080
- **Memory Store:** localhost:5432

### 3. Add Observability (Optional)
```bash
make all-up
```

Access:
- **Grafana (Logs):** http://localhost:3000 (admin/admin)
- **Grafana (Metrics):** http://localhost:3001 (admin/admin)
- **Prometheus:** http://localhost:9090

### 4. Stop Everything
```bash
make all-down
```

---

## 📋 What's Included

### 1. **Makefile** — Command Center
All Docker + Foundry operations in one place:

- `make build` — Build using TheFoundry
- `make test` — Run tests inside container
- `make run` — Run locally with bind mounts
- `make compose-up` — Start CIC + MemoryStore
- `make compose-down` — Stop all services
- `make all-up` — Full stack (CIC + logging + monitoring)
- `make all-down` — Stop everything

**View all targets:**
```bash
make help
```

### 2. **docker-compose.yml** — Multi-Service Stack
Minimal, production-ready compose file:

```yaml
services:
  cic-wil:        # Foreman + WIL runtime
  memory-store:   # PostgreSQL database
```

Run:
```bash
docker compose up --build
```

### 3. **docker-compose.logging.yml** — Log Aggregation
Loki + Promtail + Grafana for centralized logging:

- **Loki:** Log backend (TSDB)
- **Promtail:** Log collector (Docker + Kubernetes)
- **Grafana:** Log visualization

Run:
```bash
make logging
```

**Access:** http://localhost:3000 (admin/admin)

### 4. **docker-compose.monitoring.yml** — Metrics
Prometheus + Grafana for real-time metrics:

- **Prometheus:** Metrics scraper
- **Grafana:** Dashboard + alerting

Run:
```bash
make monitoring
```

**Access:** http://localhost:3001 (admin/admin)

### 5. **k3d Kubernetes Cluster** — Production-Style
Local multi-node Kubernetes cluster with pre-built registry:

**Create:**
```bash
./scripts/k3d-setup.sh create
```

**Deploy CIC WIL:**
```bash
./scripts/k3d-setup.sh deploy
```

**View status:**
```bash
./scripts/k3d-setup.sh status
```

**Tail logs:**
```bash
./scripts/k3d-setup.sh logs
```

---

## 🏗️ Architecture

### Local Docker Compose Stack
```
┌──────────────────────────────────┐
│      CIC WIL Container           │
│  (Foreman + TheFoundry build)    │
└────────────┬─────────────────────┘
             │
    ┌────────┴────────┐
    ▼                 ▼
┌─────────┐      ┌──────────────┐
│  Loki   │      │  Prometheus  │
│ (logs)  │      │  (metrics)   │
└────┬────┘      └──────┬───────┘
     │                  │
     └────────┬─────────┘
              ▼
         ┌─────────────┐
         │   Grafana   │
         │ (dashboards)│
         └─────────────┘

┌──────────────────────────────────┐
│   Memory Store (PostgreSQL)      │
│   Data: ./data/postgres          │
└──────────────────────────────────┘
```

### k3d Kubernetes Cluster
```
┌─────────────────────────────────┐
│    k3d Cluster (cic-local)      │
│                                 │
│  ┌──────────────┐               │
│  │ cic-wil pod  │ (replicas: 2) │
│  ├──────────────┤               │
│  │ cic-wil pod  │               │
│  └──────────────┘               │
│                                 │
│  Service: cic-wil-svc (LoadBalancer)
│  HPA: auto-scale 1–3 replicas   │
└─────────────────────────────────┘

    ├─ Registry (localhost:5001)
    ├─ Loki     (logs)
    ├─ Prometheus (metrics)
    └─ Grafana  (dashboards)
```

---

## 🛠️ Setup & Configuration

### Prerequisites

**Minimal (Docker only):**
```bash
docker --version
docker compose version
```

**For k3d:**
```bash
k3d version
kubectl version --client
```

**For local registry:**
```bash
curl --version   # for registry API calls
```

### Directory Structure
```
cic-ingestion/
├── Makefile                              # Command center
├── docker-compose.yml                    # Main stack
├── docker-compose.logging.yml            # Logging stack
├── docker-compose.monitoring.yml         # Monitoring stack
│
├── config/
│   ├── loki-config.yaml                 # Loki config
│   ├── promtail-config.yaml             # Log collection
│   ├── prometheus.yaml                  # Metrics scrape config
│   ├── grafana-datasources-logs.yaml    # Logs → Grafana
│   ├── grafana-datasources-metrics.yaml # Metrics → Grafana
│   ├── grafana-dashboards-logs.yaml     # Dashboard provisioning
│   └── grafana-dashboards-metrics.yaml  # Dashboard provisioning
│
├── dashboards/
│   └── cic-wil-overview.json            # Sample dashboard
│
├── k3d/
│   ├── cluster-config.yaml              # k3d cluster spec
│   └── cic-wil-deployment.yaml          # K8s deployment manifest
│
├── scripts/
│   ├── registry-init.sh                 # Local Docker registry
│   └── k3d-setup.sh                     # Kubernetes cluster setup
│
└── data/                                # Volume mounts (auto-created)
    ├── cic/
    ├── postgres/
    ├── prometheus/
    ├── loki/
    ├── grafana-logs/
    └── grafana-metrics/
```

---

## 📊 Workflows

### Workflow 1: Pure Docker (Simplest)

```bash
# 1. Build
make build

# 2. Run
make compose-up

# 3. Access
curl http://localhost:8080/health

# 4. Stop
make compose-down
```

### Workflow 2: With Observability

```bash
# 1. Build
make build

# 2. Start everything
make all-up

# 3. Access
# - CIC WIL:  http://localhost:8080
# - Logs:     http://localhost:3000 (admin/admin)
# - Metrics:  http://localhost:3001 (admin/admin)
# - Prometheus: http://localhost:9090

# 4. Stop
make all-down
```

### Workflow 3: Kubernetes (k3d)

```bash
# 1. Build
make build

# 2. Create cluster
./scripts/k3d-setup.sh create

# 3. Deploy
./scripts/k3d-setup.sh deploy

# 4. Check status
./scripts/k3d-setup.sh status

# 5. View logs
./scripts/k3d-setup.sh logs

# 6. Destroy
./scripts/k3d-setup.sh destroy
```

### Workflow 4: Local Registry (Push/Pull)

```bash
# 1. Start registry
make registry-start

# 2. Push image
make push-local

# 3. Pull image
make pull-local

# 4. List images
./scripts/registry-init.sh list

# 5. Stop
make registry-stop
```

### Workflow 5: CI Pipeline (Local)

```bash
# Build + test + push
docker build -t cic-wil:ci -f thefoundry/images/node-build/Dockerfile .
docker run --rm cic-wil:ci npm test
docker push cic-wil:ci
```

---

## 🔍 Observability Details

### Logging (Loki)

**What's collected:**
- Docker container logs (all services)
- CIC WIL application logs
- Kubernetes pod logs (if running on k3d)

**Access logs:**
```bash
# Via Grafana
open http://localhost:3000

# Via CLI
docker logs cic-wil
kubectl logs -n cic -l app=cic-wil
```

**Configure log scraping:** `config/promtail-config.yaml`

### Monitoring (Prometheus)

**What's scraped:**
- CIC WIL metrics (http://localhost:8080/metrics)
- Docker stats
- Node metrics (if exporter running)
- Kubernetes metrics (if k3d running)

**Access metrics:**
```bash
# Via Grafana
open http://localhost:3001

# Via Prometheus UI
open http://localhost:9090

# Via CLI
curl http://localhost:9090/api/v1/query?query=up
```

**Add custom metrics:** Update `config/prometheus.yaml`

### Grafana Dashboards

**Pre-built dashboards:**
- `dashboards/cic-wil-overview.json` — Request rate, latency, errors, memory

**Create new dashboards:**
1. Open Grafana (http://localhost:3000 or :3001)
2. Create → Dashboard
3. Add panels (queries from Loki or Prometheus)
4. Save and export as JSON to `dashboards/`

---

## 🔧 Troubleshooting

### Port Conflicts

If ports are already in use:

```bash
# Find process using port 8080
lsof -i :8080

# Change port in docker-compose.yml
# ports:
#   - "9000:8080"  # host:container
```

### Volume Permissions

If you get permission errors on `./data/`:

```bash
# Fix permissions
chmod -R 755 data/

# Or, run with --user flag
docker run --user 0:0 -v $PWD/data:/data cic-wil:latest
```

### Registry Connection Issues

```bash
# Test registry
curl http://localhost:5000/v2/_catalog

# Restart registry
make registry-stop
make registry-start
```

### k3d Cluster Issues

```bash
# Delete and recreate
k3d cluster delete cic-local
./scripts/k3d-setup.sh create

# Check node status
kubectl get nodes
kubectl describe node
```

---

## 📈 Performance Notes

| Component | Memory | CPU | Storage |
|-----------|--------|-----|---------|
| CIC WIL | 256-512M | 100-500m | 1GB |
| PostgreSQL | 128-256M | 50-200m | dynamic |
| Loki | 128-256M | 50-100m | 1-5GB |
| Prometheus | 128-256M | 50-100m | 1-5GB |
| Grafana | 64-128M | 50-100m | 100MB |
| **Total** | **~1.5GB** | **~1500m** | **5-15GB** |

For k3d cluster:
- Requires Docker Desktop with 4GB+ memory
- 2-3GB available for cluster workloads
- ~5-10GB disk for container images + volumes

---

## 🚢 Next Steps

### 1. Wire Track A UI
Connect React components to real AutonomyAPI endpoints

```bash
# Start API server
npm run start:api

# Run UI in dev mode
npm run dev:ui
```

### 2. Deploy to Staging
Once validated locally, push to staging environment

```bash
# Build and push
docker build -t cic-wil:v1.0.0 .
docker push registry.example.com/cic-wil:v1.0.0
```

### 3. Integrate with CI/CD
Add GitHub Actions workflow (free tier)

See: `.github/workflows/cic-ci.yml` (coming next)

### 4. Add Custom Dashboards
Create Grafana dashboards for your metrics

`dashboards/custom-*.json`

---

## 📚 References

- **TheFoundry:** `/docs/cic/phase-0-9-thefoundry.md`
- **Docker Compose:** https://docs.docker.com/compose/
- **Loki:** https://grafana.com/docs/loki/
- **Prometheus:** https://prometheus.io/docs/
- **Grafana:** https://grafana.com/docs/grafana/
- **k3d:** https://k3d.io/
- **Kubernetes:** https://kubernetes.io/docs/

---

## ✅ Checklist

### First Time Setup
- [ ] Clone repo
- [ ] Run `make build`
- [ ] Run `make compose-up`
- [ ] Verify http://localhost:8080

### With Observability
- [ ] Run `make all-up`
- [ ] Access Grafana (http://localhost:3000)
- [ ] Import sample dashboard
- [ ] Generate some traffic
- [ ] View logs and metrics

### Kubernetes (Optional)
- [ ] Install k3d + kubectl
- [ ] Run `./scripts/k3d-setup.sh create`
- [ ] Run `./scripts/k3d-setup.sh deploy`
- [ ] Verify `kubectl get pods -n cic`

### Production-Ready
- [ ] All tests passing (`npm test`)
- [ ] Observability stack running
- [ ] Dashboards populated with metrics
- [ ] Alert rules configured (Prometheus)
- [ ] Backup strategy for persistent data

---

## 📞 Support

For issues or questions:
1. Check logs: `docker compose logs` or `kubectl logs`
2. Review configs in `config/`
3. Test components individually
4. Rebuild with `make clean build`

---

**Zero-cost, fully reproducible, fully local.**

Now go build something great! 🚀
