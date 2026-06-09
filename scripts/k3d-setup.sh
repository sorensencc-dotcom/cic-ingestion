#!/usr/bin/env bash
# k3d Local Kubernetes Cluster Setup for CIC/WIL
# Multi-node, zero-cost, local-only Kubernetes cluster
#
# Usage:
#   ./scripts/k3d-setup.sh create      # Create cluster
#   ./scripts/k3d-setup.sh load        # Load cic-wil image
#   ./scripts/k3d-setup.sh deploy      # Deploy cic-wil
#   ./scripts/k3d-setup.sh status      # Show cluster status
#   ./scripts/k3d-setup.sh logs        # Tail pod logs
#   ./scripts/k3d-setup.sh destroy     # Destroy cluster

set -e

CLUSTER_NAME="cic-local"
IMAGE_NAME="cic-wil:latest"
REGISTRY_PORT=5001
NAMESPACE="cic"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
  echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
  echo -e "${RED}✗${NC} $1"
}

log_header() {
  echo -e "${BLUE}══ $1 ══${NC}"
}

# Check if cluster exists
cluster_exists() {
  k3d cluster list 2>/dev/null | grep -q "${CLUSTER_NAME}" && return 0 || return 1
}

# Check if kubectl is available
check_kubectl() {
  if ! command -v kubectl &>/dev/null; then
    log_error "kubectl not found. Install k3d (includes kubectl)"
    exit 1
  fi
}

# Check if k3d is available
check_k3d() {
  if ! command -v k3d &>/dev/null; then
    log_error "k3d not found"
    log_warn "Install k3d: https://k3d.io/v5.4.1/#installation"
    exit 1
  fi
}

create_cluster() {
  check_k3d
  check_kubectl

  log_header "Creating k3d cluster: ${CLUSTER_NAME}"

  if cluster_exists; then
    log_warn "Cluster already exists"
    return 0
  fi

  log_info "Creating cluster with 1 server + 2 agents..."
  k3d cluster create "${CLUSTER_NAME}" \
    --servers 1 \
    --agents 2 \
    --registry-create "k3d-registry:5001" \
    --port "8080:80@loadbalancer" \
    --port "8443:443@loadbalancer" \
    --wait

  log_info "Cluster created successfully"
  log_info "Context: k3d-${CLUSTER_NAME}"
  log_info "Registry: k3d-registry:5001"

  # Set context
  kubectl config use-context "k3d-${CLUSTER_NAME}"
  log_info "kubectl context switched to k3d-${CLUSTER_NAME}"

  # Create namespace
  log_info "Creating namespace: ${NAMESPACE}..."
  kubectl create namespace "${NAMESPACE}" || log_warn "Namespace ${NAMESPACE} already exists"

  log_info "Cluster ready!"
}

load_image() {
  check_k3d

  if ! cluster_exists; then
    log_error "Cluster not found. Create with: ./scripts/k3d-setup.sh create"
    exit 1
  fi

  log_header "Loading image into cluster"

  if ! docker images | grep -q "${IMAGE_NAME}"; then
    log_error "Image ${IMAGE_NAME} not found locally"
    log_warn "Build first with: docker build -t ${IMAGE_NAME} ."
    exit 1
  fi

  log_info "Loading ${IMAGE_NAME} into ${CLUSTER_NAME}..."
  k3d image import "${IMAGE_NAME}" -c "${CLUSTER_NAME}"

  log_info "Image loaded successfully"
}

deploy_cic_wil() {
  check_kubectl

  log_header "Deploying CIC WIL"

  if ! kubectl get namespace "${NAMESPACE}" &>/dev/null; then
    log_warn "Creating namespace ${NAMESPACE}..."
    kubectl create namespace "${NAMESPACE}"
  fi

  log_info "Applying deployment manifest..."
  kubectl apply -f k3d/cic-wil-deployment.yaml

  log_info "Waiting for deployment to be ready..."
  kubectl wait --for=condition=available --timeout=60s \
    deployment/cic-wil -n "${NAMESPACE}" || \
    log_warn "Timeout waiting for deployment (still starting)"

  log_info "Deployment created"
  log_info "Check status with: kubectl get deployment,pods -n ${NAMESPACE}"
}

show_status() {
  check_kubectl

  log_header "Cluster Status"

  if ! cluster_exists; then
    log_error "Cluster not found"
    return 1
  fi

  k3d cluster list | grep "${CLUSTER_NAME}"

  log_info "Nodes:"
  kubectl get nodes

  log_info "Deployments:"
  kubectl get deployment -n "${NAMESPACE}"

  log_info "Pods:"
  kubectl get pods -n "${NAMESPACE}"

  log_info "Services:"
  kubectl get svc -n "${NAMESPACE}"

  # Show access endpoints
  CNAME=$(kubectl get svc cic-wil-svc -n "${NAMESPACE}" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")
  if [ -n "$CNAME" ]; then
    log_info "Access: http://${CNAME}:8080"
  else
    log_info "Access: kubectl port-forward -n ${NAMESPACE} svc/cic-wil-svc 8080:8080"
  fi
}

show_logs() {
  check_kubectl

  log_header "Pod Logs (${NAMESPACE})"

  log_info "Tailing logs from cic-wil..."
  kubectl logs -f -n "${NAMESPACE}" -l app=cic-wil --all-containers=true
}

destroy_cluster() {
  check_k3d

  if ! cluster_exists; then
    log_warn "Cluster not found"
    return 0
  fi

  log_header "Destroying Cluster"
  log_warn "This will delete ALL data in the cluster"
  read -p "Are you sure? (yes/no): " -r REPLY

  if [ "$REPLY" = "yes" ]; then
    log_info "Destroying cluster ${CLUSTER_NAME}..."
    k3d cluster delete "${CLUSTER_NAME}"
    log_info "Cluster destroyed"
  else
    log_warn "Cancelled"
  fi
}

# Main
case "${1:-help}" in
  create)
    create_cluster
    ;;
  load)
    load_image
    ;;
  deploy)
    load_image
    deploy_cic_wil
    show_status
    ;;
  status)
    show_status
    ;;
  logs)
    show_logs
    ;;
  destroy)
    destroy_cluster
    ;;
  help)
    cat <<EOF
k3d Local Kubernetes Setup for CIC/WIL

Usage: $0 {create|load|deploy|status|logs|destroy}

Commands:
  create   - Create k3d cluster (cic-local)
  load     - Load cic-wil image into cluster
  deploy   - Load image + deploy cic-wil
  status   - Show cluster status
  logs     - Tail pod logs
  destroy  - Destroy cluster

Prerequisites:
  - k3d: https://k3d.io/
  - Docker: https://www.docker.com/

Examples:
  1. Create cluster:
     $ ./scripts/k3d-setup.sh create

  2. Load image:
     $ ./scripts/k3d-setup.sh load

  3. Deploy:
     $ ./scripts/k3d-setup.sh deploy

  4. Check status:
     $ ./scripts/k3d-setup.sh status

  5. View logs:
     $ ./scripts/k3d-setup.sh logs

  6. Port forward (if not using LoadBalancer):
     $ kubectl port-forward -n cic svc/cic-wil-svc 8080:8080

  7. Destroy cluster:
     $ ./scripts/k3d-setup.sh destroy
EOF
    ;;
  *)
    log_error "Unknown command: $1"
    exit 1
    ;;
esac
