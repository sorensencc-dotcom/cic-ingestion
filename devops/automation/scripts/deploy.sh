#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
AUTOMATION_DIR="${ROOT_DIR}/devops/automation"
TERRAFORM_DIR="${AUTOMATION_DIR}/terraform"

echo "[deploy] Root dir: ${ROOT_DIR}"

echo "[deploy] Step 1: Terraform init + apply"
terraform -chdir="${TERRAFORM_DIR}" init -input=false
terraform -chdir="${TERRAFORM_DIR}" apply -auto-approve

echo "[deploy] Step 2: Build Docker images"
# Adjust paths if your source dirs differ
docker build -t cic-api:latest "${ROOT_DIR}/src/cic"
 docker build -t cic-harness:latest "${ROOT_DIR}/src/harness"

# TODO: replace with your own registry URL
REGISTRY="your-registry.example.com/cic"

echo "[deploy] Step 3: Tag + push images"
docker tag cic-api:latest "${REGISTRY}/cic-api:latest"
 docker tag cic-harness:latest "${REGISTRY}/cic-harness:latest"

docker push "${REGISTRY}/cic-api:latest"
 docker push "${REGISTRY}/cic-harness:latest"

echo "[deploy] Step 4: Apply Kubernetes manifests"
kubectl apply -f "${ROOT_DIR}/devops/k8s/cic-sandbox-3.yaml"
 kubectl apply -f "${ROOT_DIR}/devops/k8s/firecracker-nodepool.yaml"
 kubectl apply -f "${ROOT_DIR}/devops/k8s/onnx-sidecar.yaml"
 kubectl apply -f "${ROOT_DIR}/devops/k8s/cic-api-gateway.yaml"

echo "[deploy] Step 5: Basic health check"
kubectl rollout status deployment/cic-api --timeout=120s
 kubectl rollout status deployment/cic-harness --timeout=120s

echo "[deploy] Completed Batch 12 deployment."
