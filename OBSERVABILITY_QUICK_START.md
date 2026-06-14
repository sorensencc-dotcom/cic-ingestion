# Observability Quick Start

## Access Metrics

### Prometheus Format (Scrape Ready)
```bash
curl http://localhost:3000/metrics
```

Output: Prometheus text format. Paste into Grafana data source.

### JSON Format (Human Readable)
```bash
curl http://localhost:3000/metrics/json
```

Output: Structured JSON with all metrics.

---

## Key Metrics to Monitor

### Request Health
```
autonomy_requests_total                    # Total requests since start
autonomy_requests_by_status{code="200"}    # Success rate indicator
autonomy_requests_by_status{code="500"}    # Error rate indicator
autonomy_latency_p95_ms                    # User-facing latency
autonomy_latency_p99_ms                    # Worst-case latency
```

### Compression Efficiency
```
autonomy_caveman_compression_ratio         # % of bytes saved (40-75% typical)
autonomy_caveman_bytes_saved               # Total bytes saved (cumulative)
```

### Service Capacity
```
autonomy_active_signals                    # Memory usage indicator
autonomy_active_proposals                  # Load indicator
```

---

## Grafana Integration

### Add Data Source
1. Grafana UI → Configuration → Data Sources → New
2. Type: Prometheus
3. URL: `http://localhost:3000`
4. Click "Save & Test"

### Create Dashboard
1. Create → Dashboard → Add Panel
2. Data source: Autonomy Prometheus
3. Metrics:
   - `autonomy_requests_total`
   - `autonomy_latency_p95_ms`
   - `autonomy_caveman_compression_ratio`
   - `autonomy_active_signals`

---

## Example Queries

### Request Rate (per minute)
```promql
rate(autonomy_requests_total[1m])
```

### Error Rate
```promql
rate(autonomy_requests_by_status{code="500"}[1m])
```

### Latency Trend
```promql
autonomy_latency_p95_ms
```

### Compression Savings (bytes/minute)
```promql
rate(autonomy_caveman_bytes_saved[1m])
```

---

## Alert Examples

### High Error Rate
```yaml
alert: AutonomyHighErrorRate
expr: rate(autonomy_requests_by_status{code="500"}[5m]) > 0.05
for: 5m
annotations:
  summary: "Autonomy API error rate > 5%"
```

### High Latency
```yaml
alert: AutonomyHighLatency
expr: autonomy_latency_p99_ms > 1000
for: 5m
annotations:
  summary: "Autonomy API p99 latency > 1s"
```

### Memory Spike
```yaml
alert: AutonomySignalMemory
expr: autonomy_active_signals > 10000
for: 5m
annotations:
  summary: "Signal store > 10k items"
```

---

## Logs

All structured logs written to stdout as JSON:
```json
{"timestamp": "2026-06-13T14:30:00Z", "level": "info", "module": "api", "message": "GET /autonomy/signals", "data": {"status": 200, "duration_ms": 145}}
```

Parse with:
```bash
docker logs <container> | jq '.level, .message, .data'
```

---

## Troubleshooting

### Metrics Not Appearing
1. Check service is running: `curl http://localhost:3000/health`
2. Check metrics endpoint: `curl http://localhost:3000/metrics`
3. Verify routes are recording stats (check logs for errors)

### High Memory Usage
1. Check `autonomy_active_signals` — may need database archival
2. Check latencies array size in MetricsCollector (limited to 10k)

### Missing Compression Metrics
1. Verify Caveman compression is enabled in routes
2. Check POST /signals and POST /proposals are returning CAVEMAN_STATS

---

## Reset Metrics

Metrics reset on service restart (no persistent storage). For long-running production:
- Use Prometheus scrape history (default 15s intervals)
- Grafana retains metrics in its own database
- Caveman stats are cumulative per service instance
