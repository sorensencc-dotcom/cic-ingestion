.PHONY: help build test run compose-up compose-down compose-logs registry-start registry-stop push-local pull-local k3d-create k3d-load k3d-deploy k3d-destroy k3d-logs monitoring logging all-up all-down

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

.PHONY: registry-check k3d-check
