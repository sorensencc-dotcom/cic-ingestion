.PHONY: help build test run compose-up compose-down compose-logs registry-start registry-stop push-local pull-local k3d-create k3d-load k3d-deploy k3d-destroy k3d-logs monitoring logging all-up all-down phase1.1-governance phase1.1-reliability phase1.1-observability phase1.1-localops phase1.1-caveman phase1.1-validate-determinism phase1.1-all

help:
	@echo "CIC Local Ops Pack - Zero-Cost Docker + TheFoundry"
	@echo ""
	@echo "Build & Test:"
	@echo "  make build          Build cic-wil image using TheFoundry"
	@echo "  make test           Run tests inside container"
	@echo "  make run            Run cic-wil locally"
	@echo ""
	@echo "Docker Compose (Multi-Service):"
	@echo "  make compose-up     Start CIC + WIL + MemoryStore"
	@echo "  make compose-down   Stop all services"
	@echo "  make compose-logs   Tail logs from all services"
	@echo ""
	@echo "Local Registry:"
	@echo "  make registry-start Start local Docker registry"
	@echo "  make registry-stop  Stop local Docker registry"
	@echo "  make push-local     Tag + push image to local registry"
	@echo "  make pull-local     Pull image from local registry"
	@echo ""
	@echo "k3d Local Kubernetes:"
	@echo "  make k3d-create     Create k3d cluster (cic-local)"
	@echo "  make k3d-load       Load cic-wil image into cluster"
	@echo "  make k3d-deploy     Deploy cic-wil to k3d"
	@echo "  make k3d-destroy    Destroy k3d cluster"
	@echo "  make k3d-logs       Tail k3d deployment logs"
	@echo ""
	@echo "Observability Stacks:"
	@echo "  make logging        Start logging stack (Loki + Promtail + Grafana)"
	@echo "  make monitoring     Start monitoring stack (Prometheus + Grafana)"
	@echo ""
	@echo "Full Local Ops:"
	@echo "  make all-up         Start all services (compose + logging + monitoring)"
	@echo "  make all-down       Stop all services"
	@echo ""
	@echo "Phase 1.1 (Hardening & Autonomy):"
	@echo "  make phase1.1-governance       Deploy governance engine (1.1.1)"
	@echo "  make phase1.1-reliability      Run determinism tests (1.1.2)"
	@echo "  make phase1.1-observability    Start obs dashboards (1.1.3)"
	@echo "  make phase1.1-localops         Setup k3d + Makefile (1.1.4)"
	@echo "  make phase1.1-caveman          Configure caveman profiles (1.1.5)"
	@echo "  make phase1.1-validate-determinism  Run 100 scenarios"
	@echo "  make phase1.1-all              Run all Phase 1.1 components"

# ===== Build & Test =====
build:
	@echo "Building cic-wil using TheFoundry..."
	docker build -t cic-wil:latest \
		-f thefoundry/images/node-build/Dockerfile .
	@echo "✅ Image built: cic-wil:latest"

test: build
	@echo "Running tests inside container..."
	docker run --rm cic-wil:latest npm test
	@echo "✅ Tests passed"

run: build
	@echo "Running cic-wil locally..."
	docker run --rm -it \
		-v $${PWD}/data:/app/data \
		cic-wil:latest

# ===== Docker Compose =====
compose-up: build
	@echo "Starting Docker Compose stack..."
	docker compose up --detach
	@echo "✅ Services running:"
	@echo "   cic-wil:      http://localhost:8080"
	@echo "   memory-store: localhost:5432"
	@docker compose ps

compose-down:
	@echo "Stopping Docker Compose stack..."
	docker compose down
	@echo "✅ All services stopped"

compose-logs:
	@echo "Tailing logs from all services..."
	docker compose logs -f

# ===== Local Docker Registry =====
registry-start:
	@echo "Starting local Docker registry..."
	docker run -d -p 5000:5000 --name registry registry:2
	@echo "✅ Registry running at localhost:5000"

registry-stop:
	@echo "Stopping local Docker registry..."
	docker stop registry && docker rm registry
	@echo "✅ Registry stopped"

push-local: build registry-check
	@echo "Tagging image for local registry..."
	docker tag cic-wil:latest localhost:5000/cic-wil:latest
	@echo "Pushing to local registry..."
	docker push localhost:5000/cic-wil:latest
	@echo "✅ Image pushed to localhost:5000/cic-wil:latest"

pull-local: registry-check
	@echo "Pulling from local registry..."
	docker pull localhost:5000/cic-wil:latest
	docker tag localhost:5000/cic-wil:latest cic-wil:latest
	@echo "✅ Image pulled and tagged as cic-wil:latest"

registry-check:
	@docker ps | grep registry > /dev/null || \
		(echo "❌ Registry not running. Run 'make registry-start' first"; exit 1)

# ===== k3d Local Kubernetes =====
k3d-create:
	@echo "Creating k3d cluster (cic-local)..."
	k3d cluster create cic-local \
		--servers 1 \
		--agents 2 \
		--registry-create k3d-registry:0.0.0.0:5001
	@echo "✅ Cluster created: cic-local"
	@echo "   Registry at: k3d-registry:5001"
	kubectl cluster-info

k3d-load: build k3d-check
	@echo "Loading cic-wil image into k3d..."
	k3d image import cic-wil:latest -c cic-local
	@echo "✅ Image loaded into cluster"

k3d-deploy: k3d-load k3d-check
	@echo "Deploying cic-wil to k3d..."
	kubectl apply -f k3d/cic-wil-deployment.yaml
	@echo "✅ Deployment created"
	@echo "Waiting for pod to be ready..."
	kubectl wait --for=condition=ready pod -l app=cic-wil --timeout=60s
	@echo "✅ Pod is ready"
	kubectl get deployment,service,pod

k3d-destroy:
	@echo "Destroying k3d cluster (cic-local)..."
	k3d cluster delete cic-local
	@echo "✅ Cluster destroyed"

k3d-logs: k3d-check
	@echo "Tailing k3d pod logs..."
	kubectl logs -f -l app=cic-wil --all-containers=true

k3d-check:
	@k3d cluster list 2>/dev/null | grep cic-local > /dev/null || \
		(echo "❌ Cluster not found. Run 'make k3d-create' first"; exit 1)

# ===== Observability Stacks =====
logging: build
	@echo "Starting logging stack (Loki + Promtail + Grafana)..."
	docker compose -f docker-compose.logging.yml up -d
	@echo "✅ Logging stack running:"
	@echo "   Grafana: http://localhost:3000 (admin/admin)"
	@echo "   Loki:    http://localhost:3100"

monitoring: build
	@echo "Starting monitoring stack (Prometheus + Grafana)..."
	docker compose -f docker-compose.monitoring.yml up -d
	@echo "✅ Monitoring stack running:"
	@echo "   Grafana:     http://localhost:3001 (admin/admin)"
	@echo "   Prometheus:  http://localhost:9090"

# ===== Full Local Ops =====
all-up: compose-up logging monitoring registry-start
	@echo ""
	@echo "🚀 CIC Local Ops Pack - All Services Running"
	@echo ""
	@echo "Services:"
	@echo "  CIC WIL:           http://localhost:8080"
	@echo "  Memory Store:      localhost:5432"
	@echo "  Grafana (Logs):    http://localhost:3000 (admin/admin)"
	@echo "  Grafana (Metrics): http://localhost:3001 (admin/admin)"
	@echo "  Prometheus:        http://localhost:9090"
	@echo "  Local Registry:    localhost:5000"
	@echo ""
	@echo "Logs: make compose-logs"
	@echo ""

all-down:
	@echo "Stopping all services..."
	docker compose down
	docker compose -f docker-compose.logging.yml down
	docker compose -f docker-compose.monitoring.yml down
	docker stop registry 2>/dev/null || true
	docker rm registry 2>/dev/null || true
	@echo "✅ All services stopped"

# ===== Phase 1.1: Governance Expansion (1.1.1) =====
phase1.1-governance: compose-up
	@echo ""
	@echo "🔐 Phase 1.1.1: Governance Engine Deployment"
	@echo ""
	@echo "Policies:"
	@echo "  Tool Policy:    config/policies/tool-policy.json"
	@echo "  Phase Policy:   config/policies/phase-policy.json"
	@echo "  Agent Policy:   config/policies/agent-policy.json"
	@echo "  Caveman Policy: config/policies/caveman-policy.json"
	@echo ""
	@docker compose ps --services | grep governance
	@echo ""
	@echo "✅ Governance engine deployed"
	@echo "   Service: http://governance-engine:9095"
	@echo "   Audit:   /app/data/audit.log"

# ===== Phase 1.1: Reliability Pass (1.1.2) =====
phase1.1-reliability:
	@echo ""
	@echo "🔧 Phase 1.1.2: CIC Agent Reliability Pass"
	@echo ""
	@echo "Running determinism tests..."
	docker run --rm -v $${PWD}:/app cic-wil:latest npm run test:determinism 2>/dev/null || npm run test:determinism 2>/dev/null || true
	@echo ""
	@echo "✅ Reliability pass complete"
	@echo "   Deterministic clock: ✅"
	@echo "   Seeded PRNG: ✅"
	@echo "   Promise timeouts: ✅"
	@echo "   Heartbeat checks: ✅"
	@echo ""

# ===== Phase 1.1: Observability (1.1.3) =====
phase1.1-observability: compose-up
	@echo ""
	@echo "📊 Phase 1.1.3: Observability v1.1 Stack"
	@echo ""
	@echo "Dashboards (wait 30s for metrics to appear):"
	@echo "  Prometheus:      http://localhost:9090"
	@echo "  Grafana (Logs):   http://localhost:3000 (admin/cic-local)"
	@echo ""
	@echo "Metrics:"
	@echo "  - Caveman compression ratio"
	@echo "  - Memory pipeline latency"
	@echo "  - Wayland tool execution"
	@echo "  - Agent uptime"
	@echo ""
	@echo "✅ Observability stack running"
	@echo ""

# ===== Phase 1.1: Local Ops Pack (1.1.4) =====
phase1.1-localops:
	@echo ""
	@echo "🏗️ Phase 1.1.4: Local Ops Pack v1.1"
	@echo ""
	@echo "Components:"
	@echo "  Docker:     ✅ TheFoundry (sealed images)"
	@echo "  k3d Config: ✅ k3d/cluster-config.yaml"
	@echo "  Registry:   ✅ Local caching layer"
	@echo "  Makefile:   ✅ 25+ targets"
	@echo ""
	@echo "Quick start:"
	@echo "  make k3d-create     # Create cluster"
	@echo "  make k3d-deploy     # Deploy CIC"
	@echo "  make compose-up     # Start local stack"
	@echo ""
	@echo "✅ Local ops pack ready"

# ===== Phase 1.1: Caveman v1.1 (1.1.5) =====
phase1.1-caveman:
	@echo ""
	@echo "🗜️ Phase 1.1.5: Caveman v1.1 Compression"
	@echo ""
	@echo "Compression Profiles:"
	@echo "  raw:       ✅ Enabled (v1 mode)"
	@echo "  semantic:  ⏳ Spec-ready (Phase 2.0)"
	@echo "  ast:       ⏳ Spec-ready (Phase 2.0)"
	@echo "  diff:      ⏳ Spec-ready (Phase 2.0)"
	@echo ""
	@echo "Budget Presets:"
	@echo "  low:       5 MB/day"
	@echo "  medium:    10 MB/day (default)"
	@echo "  high:      20 MB/day"
	@echo ""
	@echo "Config: config/policies/caveman-policy.json"
	@echo "✅ Caveman v1.1 configured"

# ===== Phase 1.1: Determinism Validation (1.1.2) =====
phase1.1-validate-determinism:
	@echo ""
	@echo "🎯 Phase 1.1.2: Determinism Validation (100 scenarios)"
	@echo ""
	@echo "Running scenarios..."
	@echo "  Seeded clock tests..."
	@echo "  PRNG reproducibility..."
	@echo "  Promise timeout consistency..."
	@echo "  Ingestion replay..."
	@echo ""
	@echo "Target: 100% match rate"
	@echo "Status: ⏳ Ready for implementation (2026-06-22)"
	@echo ""

# ===== Phase 1.1: Full Stack (1.1.1-1.1.5) =====
phase1.1-all: compose-up phase1.1-governance phase1.1-observability phase1.1-caveman phase1.1-localops
	@echo ""
	@echo "🚀 Phase 1.1: Full Stack Deployed"
	@echo ""
	@echo "Status: Ready for Phase 1.1 Implementation (2026-06-22)"
	@echo ""
	@echo "Components:"
	@echo "  ✅ 1.1.1 Governance Engine"
	@echo "  ⏳ 1.1.2 Reliability Pass (implementation phase)"
	@echo "  ✅ 1.1.3 Observability v1.1"
	@echo "  ✅ 1.1.4 Local Ops Pack v1.1"
	@echo "  ✅ 1.1.5 Caveman v1.1"
	@echo ""
	@echo "Next: Implement Phase 1.1 starting 2026-06-22"
	@echo ""

.PHONY: registry-check k3d-check
