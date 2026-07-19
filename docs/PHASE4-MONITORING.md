# Phase 4: Monitoring & Alerts

**Objective:** Track health metrics for each rollout stage.

---

## Key Metrics

### Success Rate
```prometheus
rate(image_analysis_success_total[5m]) / rate(image_analysis_requests_total[5m])
```
- **Canary target:** >99%
- **Alert:** <95% for 5 min

### Latency (p99)
```prometheus
histogram_quantile(0.99, rate(image_analysis_latency_ms_bucket[5m]))
```
- **Canary target:** <500ms
- **Alert:** >500ms for 10 min

### Vision API Fallback Ratio
```prometheus
rate(image_analysis_fallback_total[5m]) / rate(image_analysis_requests_total[5m])
```
- **Canary target:** <5%
- **Alert:** >5% for 15 min (indicates API unavailability)

### Error Breakdown
```prometheus
rate(image_analysis_errors_total{error_type=~".*"}[5m])
```
- **Types to track:**
  - `http_4xx` — client errors (bad image format, size)
  - `http_5xx` — server errors (Vision API down)
  - `timeout` — request timeout
  - `network_error` — connection refused, DNS failure
  - `parse_error` — response parsing failed

### Traffic Distribution
```prometheus
rate(image_analysis_by_implementation{implementation="new"}[5m]) / rate(image_analysis_requests_total[5m])
```
- Shows actual % of traffic going to new implementation vs. legacy

---

## Stage-Specific Dashboards

### Canary (10%)
**URL:** `/grafana/d/canary-phase4`

**Panels:**
1. Success rate (target: >99%)
2. Latency p99 (target: <500ms)
3. Error rate by type
4. Vision API fallback ratio
5. Traffic split (10% new, 90% legacy)
6. Errors over time (detect spikes)

**SLA window:** 2-3 days
**Rollback trigger:** Error rate >5% for 5 min

---

### Early Adopters (25%)
**URL:** `/grafana/d/earlyacceptors-phase4`

**Panels:**
- Same as canary
- Add: User feedback sentiment (if integrated)
- Add: Comparison vs. canary baseline

**SLA window:** 3-5 days
**Rollback trigger:** Regression vs. canary

---

### Majority (50%)
**URL:** `/grafana/d/majority-phase4`

**Panels:**
- All previous
- Add: Per-region latency
- Add: Per-image-format success rates
- Add: Upstream dependency health (cic-ingestion)

**SLA window:** 3-5 days
**Rollback trigger:** Sustained SLA violation

---

### Full Rollout (100%)
**URL:** `/grafana/d/fullrollout-phase4`

**Panels:**
- Production baseline
- 7-day trend lines
- Comparison to pre-rollout baseline

**Sustain window:** 7 days
**Success criteria:** No regressions

---

## Alert Rules

### Alert 1: High Error Rate
```yaml
alert: ImageAnalysisHighErrorRate
expr: |
  (1 - (rate(image_analysis_success_total[5m]) / 
        rate(image_analysis_requests_total[5m]))) > 0.05
for: 5m
annotations:
  summary: "Image analysis error rate > 5% (Stage: {{ $labels.stage }})"
  runbook: "docs/PHASE4-RUNBOOK.md#high-error-rate"
```

### Alert 2: High Latency
```yaml
alert: ImageAnalysisHighLatency
expr: |
  histogram_quantile(0.99, rate(image_analysis_latency_ms_bucket[5m])) > 500
for: 10m
annotations:
  summary: "Image analysis p99 latency > 500ms"
  runbook: "docs/PHASE4-RUNBOOK.md#high-latency"
```

### Alert 3: High Fallback Ratio
```yaml
alert: ImageAnalysisHighFallbackRatio
expr: |
  (rate(image_analysis_fallback_total[5m]) / 
   rate(image_analysis_requests_total[5m])) > 0.05
for: 15m
annotations:
  summary: "Vision API fallback ratio > 5% (API likely unavailable)"
  runbook: "docs/PHASE4-RUNBOOK.md#high-fallback-ratio"
```

### Alert 4: cic-ingestion Service Down
```yaml
alert: CicIngestionServiceDown
expr: |
  up{job="cic-ingestion"} == 0
for: 2m
annotations:
  summary: "cic-ingestion service unreachable"
  runbook: "docs/PHASE4-RUNBOOK.md#service-down"
```

---

## Logging Integration

### Application Logs
Each request should log:
```json
{
  "timestamp": "2026-07-19T12:34:56Z",
  "request_id": "uuid",
  "stage": "canary",
  "implementation": "new",
  "image_format": "png",
  "image_size_bytes": 1024,
  "latency_ms": 45,
  "vision_api_used": true,
  "success": true,
  "error": null
}
```

### Rollout Markers
Log stage transitions:
```json
{
  "event": "phase4_stage_transition",
  "from_stage": "canary",
  "to_stage": "early_adopters",
  "timestamp": "2026-07-22T00:00:00Z",
  "enable_image_analysis": 0.25
}
```

---

## Health Checks

### cic-ingestion Service
```bash
curl -s http://cic-ingestion:3000/health | jq .
```
Expected:
```json
{
  "status": "ok",
  "service": "cic-imageanalysis-test",
  "uptime": 12345.67,
  "timestamp": "2026-07-19T12:34:56Z"
}
```

### Vision API Connectivity
```bash
curl -X POST http://cic-ingestion:3000/api/analyze/image \
  -H "Content-Type: application/json" \
  -d '{"imageBuffer":"iVBORw0KGgo..."}'
```
Expected: 200 (or 400 if image invalid, never 503)

---

## Rollback Decision Tree

```
Error rate > 5%?
  YES → Rollback immediately (ENABLE_IMAGE_ANALYSIS=0.0)
  NO  → Check latency p99
    Latency > 500ms for 10 min?
      YES → Rollback (infrastructure issue)
      NO  → Check fallback ratio
        Fallback > 5% for 15 min?
          YES → Investigate Vision API, consider rollback
          NO  → Continue to next stage
```

---

## References

- Phase 4 Rollout: `docs/PHASE4-ROLLOUT.md`
- Phase 4 Runbook: `docs/PHASE4-RUNBOOK.md`
- Baseline Metrics: `PHASE3-BASELINE.json`
