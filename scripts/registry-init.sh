#!/usr/bin/env bash
# Local Docker Registry Initialization & Workflow
# Zero-cost, local-only image registry for CIC/WIL
#
# Usage:
#   ./scripts/registry-init.sh start      # Start registry
#   ./scripts/registry-init.sh stop       # Stop registry
#   ./scripts/registry-init.sh push       # Push cic-wil image
#   ./scripts/registry-init.sh pull       # Pull cic-wil image
#   ./scripts/registry-init.sh list       # List images in registry
#   ./scripts/registry-init.sh clean      # Clean up all

set -e

REGISTRY_PORT=5000
REGISTRY_URL="localhost:${REGISTRY_PORT}"
IMAGE_NAME="cic-wil"
IMAGE_TAG="latest"
REGISTRY_CONTAINER_NAME="registry"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Check if registry container is running
registry_is_running() {
  docker ps | grep -q "${REGISTRY_CONTAINER_NAME}" && return 0 || return 1
}

# Check if image exists locally
image_exists() {
  docker images | grep -q "${IMAGE_NAME}.*${IMAGE_TAG}" && return 0 || return 1
}

start_registry() {
  if registry_is_running; then
    log_warn "Registry already running on ${REGISTRY_URL}"
    return 0
  fi

  log_info "Starting Docker registry on ${REGISTRY_URL}..."
  docker run -d -p ${REGISTRY_PORT}:5000 \
    --name "${REGISTRY_CONTAINER_NAME}" \
    --restart unless-stopped \
    registry:2

  # Wait for registry to be ready
  sleep 2
  if registry_is_running; then
    log_info "Registry started successfully"
    log_info "View status: curl -s http://${REGISTRY_URL}/v2/"
  else
    log_error "Failed to start registry"
    exit 1
  fi
}

stop_registry() {
  if ! registry_is_running; then
    log_warn "Registry not running"
    return 0
  fi

  log_info "Stopping Docker registry..."
  docker stop "${REGISTRY_CONTAINER_NAME}"
  docker rm "${REGISTRY_CONTAINER_NAME}"
  log_info "Registry stopped"
}

push_image() {
  if ! registry_is_running; then
    log_error "Registry not running. Start with: ./scripts/registry-init.sh start"
    exit 1
  fi

  if ! image_exists; then
    log_error "Image ${IMAGE_NAME}:${IMAGE_TAG} not found locally"
    log_warn "Build first with: docker build -t ${IMAGE_NAME}:${IMAGE_TAG} ."
    exit 1
  fi

  log_info "Tagging image as ${REGISTRY_URL}/${IMAGE_NAME}:${IMAGE_TAG}..."
  docker tag "${IMAGE_NAME}:${IMAGE_TAG}" "${REGISTRY_URL}/${IMAGE_NAME}:${IMAGE_TAG}"

  log_info "Pushing image to registry..."
  docker push "${REGISTRY_URL}/${IMAGE_NAME}:${IMAGE_TAG}"

  log_info "Image pushed successfully"
  log_info "Pull with: docker pull ${REGISTRY_URL}/${IMAGE_NAME}:${IMAGE_TAG}"
}

pull_image() {
  if ! registry_is_running; then
    log_error "Registry not running. Start with: ./scripts/registry-init.sh start"
    exit 1
  fi

  log_info "Pulling ${REGISTRY_URL}/${IMAGE_NAME}:${IMAGE_TAG}..."
  docker pull "${REGISTRY_URL}/${IMAGE_NAME}:${IMAGE_TAG}"

  log_info "Tagging as ${IMAGE_NAME}:${IMAGE_TAG}..."
  docker tag "${REGISTRY_URL}/${IMAGE_NAME}:${IMAGE_TAG}" "${IMAGE_NAME}:${IMAGE_TAG}"

  log_info "Image pulled successfully"
}

list_images() {
  if ! registry_is_running; then
    log_error "Registry not running"
    exit 1
  fi

  log_info "Images in local registry:"
  curl -s "http://${REGISTRY_URL}/v2/_catalog" | jq .
}

clean_registry() {
  log_warn "Removing all images from registry..."
  if registry_is_running; then
    # Get all image names
    IMAGES=$(curl -s "http://${REGISTRY_URL}/v2/_catalog" | jq -r '.repositories[]')

    if [ -z "$IMAGES" ]; then
      log_warn "No images in registry"
      return 0
    fi

    for image in $IMAGES; do
      log_info "Cleaning ${image}..."
      # Note: registry:2 doesn't support direct deletion via API
      # This would require garbage collection or manual deletion
    done

    log_warn "To fully clean, restart registry: ./scripts/registry-init.sh stop && ./scripts/registry-init.sh start"
  fi
}

# Main
case "${1:-help}" in
  start)
    start_registry
    ;;
  stop)
    stop_registry
    ;;
  push)
    push_image
    ;;
  pull)
    pull_image
    ;;
  list)
    list_images
    ;;
  clean)
    clean_registry
    ;;
  help)
    echo "Local Docker Registry Workflow"
    echo ""
    echo "Usage: $0 {start|stop|push|pull|list|clean}"
    echo ""
    echo "Commands:"
    echo "  start   - Start local registry on localhost:5000"
    echo "  stop    - Stop local registry"
    echo "  push    - Push cic-wil image to registry"
    echo "  pull    - Pull cic-wil image from registry"
    echo "  list    - List images in registry"
    echo "  clean   - Clean registry images"
    ;;
  *)
    log_error "Unknown command: $1"
    exit 1
    ;;
esac
