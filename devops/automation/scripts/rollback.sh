#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

# Optional argument: previous tag or image version (default "previous")
PREVIOUS_TAG="${1:-previous}"

REGISTRY="your-registry.example.com/cic"

echo "[rollback] Using previous tag: ${PREVIOUS_TAG}"

echo "[rollback] Step 1: Update deployments to previous image tag"
kubectl set image deployment/cic-api cic-api="${REGISTRY}/cic-api:${PREVIOUS_TAG}"
kubectl set image deployment/cic-harness cic-harness="${REGISTRY}/cic-harness:${PREVIOUS_TAG}"

echo "[rollback] Step 2: Wait for rollout to complete"
kubectl rollout status deployment/cic-api --timeout=120s
kubectl rollout status deployment/cic-harness --timeout=120s

echo "[rollback] Step 3: (Optional) revert infra state"
# Placeholder for infra rollback – uncomment if needed
# terraform -chdir="${ROOT_DIR}/devops/automation/terraform" apply -refresh-only

echo "[rollback] Rollback completed."
