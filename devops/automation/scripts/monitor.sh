#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

echo "[monitor] Deploying Prometheus, Grafana, and alert rules"

# Apply Prometheus stack (assumes manifests exist under monitoring/prometheus)
kubectl apply -f "${ROOT_DIR}/monitoring/prometheus/"
# Apply alert rules for Sandbox-3
kubectl apply -f "${ROOT_DIR}/monitoring/prometheus/alerts/sandbox-3-alerts.yml"

# Apply Grafana dashboards (assumes JSON files under monitoring/grafana/dashboards)
kubectl apply -f "${ROOT_DIR}/monitoring/grafana/dashboards/"

# Simple health check against the /metrics endpoint of cic-api
echo "[monitor] Verifying /metrics endpoint on cic-api"
kubectl run curl-metrics --rm -i --restart=Never \
  --image=curlimages/curl \
  -- bash -c "curl -sS http://cic-api:8080/metrics || echo 'Metrics endpoint unreachable'"

# Clean up the temporary pod (kubectl run with --rm already deletes)

echo "[monitor] Monitoring bootstrap completed."
