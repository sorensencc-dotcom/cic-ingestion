# Phase 4: Operational Runbook

**Quick reference for Phase 4 rollout stages.**

---

## Stage 1: Canary (10%)

**Duration:** 2-3 days  
**Config:** `ENABLE_IMAGE_ANALYSIS=0.1`

### Pre-Stage Checklist
- [ ] Phase 1-3 tests passing (8/8)
- [ ] cic-ingestion service running and healthy
- [ ] Vision API credentials valid (test call succeeds)
- [ ] Monitoring dashboards deployed
- [ ] Alert rules active
- [ ] On-call runbook reviewed
- [ ] Rollback playbook tested locally

### Deployment
```bash
# 1. Deploy canary config to TRM cluster
kubectl set env deployment/trm-harvester \
  ENABLE_IMAGE_ANALYSIS=0.1 \
  CIC_INGESTION_URL=http://cic-ingestion:3000

# 2. Wait for rollout (monitor pod restart)
kubectl rollout status deployment/trm-harvester

# 3. Verify health
curl http://trm-harvester:9090/health
```

### Monitoring (First 12 Hours)
- Watch error rate (should be <1%)
- Check latency p99 (should be <500ms)
- Monitor Vision API fallback ratio (should be <1% if API healthy)
- Look for any spikes in error logs

### Decision Criteria
| Metric | Pass | Fail | Action |
|--------|------|------|--------|
| Error rate | <5% | >5% for 5m | Rollback |
| Latency p99 | <500ms | >500ms for 10m | Investigate |
| Fallback ratio | <5% | >5% for 15m | Check API health |
| Uptime | 100% | <99.9% | Investigate |

### Proceed to Stage 2?
- [ ] Error rate <5% for full 2-3 days
- [ ] Latency p99 <500ms sustained
- [ ] Zero customer reports
- [ ] No cascading failures observed
- [ ] On-call sign-off

---

## Stage 2: Early Adopters (25%)

**Duration:** 3-5 days  
**Config:** `ENABLE_IMAGE_ANALYSIS=0.25`

### Deployment
```bash
kubectl set env deployment/trm-harvester \
  ENABLE_IMAGE_ANALYSIS=0.25
kubectl rollout status deployment/trm-harvester
```

### Monitoring
- Same metrics as canary
- Add: Compare latency vs. canary baseline
- Track: Any new error types appearing

### Decision Criteria
Same as canary. Proceed if:
- No regression vs. canary baseline
- SLA sustained for 3-5 days

---

## Stage 3: Majority (50%)

**Duration:** 3-5 days  
**Config:** `ENABLE_IMAGE_ANALYSIS=0.5`

### Deployment
```bash
kubectl set env deployment/trm-harvester \
  ENABLE_IMAGE_ANALYSIS=0.5
kubectl rollout status deployment/trm-harvester
```

### Monitoring
- Full production monitoring active
- Regional latency breakdown
- Per-format success rates (PNG, JPEG, GIF, WebP)
- Upstream dependency health (cic-ingestion CPU/memory)

### Decision Criteria
- SLA maintained across all regions
- No format-specific failures
- cic-ingestion not resource-constrained

---

## Stage 4: Full Rollout (100%)

**Duration:** 7 days sustained  
**Config:** `ENABLE_IMAGE_ANALYSIS=1.0` (or remove flag)

### Deployment
```bash
kubectl set env deployment/trm-harvester \
  ENABLE_IMAGE_ANALYSIS=1.0
kubectl rollout status deployment/trm-harvester
```

### Monitoring
- Establish production baseline
- 7-day trend validation
- No regressions vs. Phase 3 baseline

### Post-Rollout
- Mark old extractor as deprecated
- Archive ReverseImageSearchExtractor code
- Close Phase 4 tracking tickets
- Schedule deprecation window

---

## Troubleshooting

### High Error Rate (>5%)

**Check 1: cic-ingestion Health**
```bash
curl -s http://cic-ingestion:3000/health
```
If not 200: Restart service or check logs

**Check 2: Vision API Credentials**
```bash
# Verify GOOGLE_APPLICATION_CREDENTIALS file exists and is valid
ls -la /etc/secrets/google-vision-sa.json
```
If missing: Restore from secret store

**Check 3: Network Connectivity**
```bash
# From TRM pod
kubectl exec -it <trm-pod> -- \
  curl -v http://cic-ingestion:3000/api/analyze/image \
    -H "Content-Type: application/json" \
    -d '{"imageBuffer":"iVBORw0KGgo..."}'
```
If timeout/refused: Check network policy, firewall, DNS

**Check 4: Vision API Quota**
Check logs for "quota exceeded" errors. If yes:
- Increase quota in Google Cloud Console
- Or enable fallback mode temporarily

**Action if unresolved:** Rollback
```bash
kubectl set env deployment/trm-harvester \
  ENABLE_IMAGE_ANALYSIS=0.0
```

---

### High Latency (>500ms p99)

**Check 1: cic-ingestion Performance**
```bash
kubectl top pod -n cic-ingestion
```
If CPU >80% or memory >90%: Scale up or optimize

**Check 2: Network Latency**
```bash
# From TRM pod
ping -c 5 cic-ingestion
```
If >100ms: Network issue, check routing

**Check 3: Vision API Performance**
Check Vision API quota usage and per-request latency in Cloud Logging

**Action:** If sustained, consider rollback

---

### High Fallback Ratio (>5%)

**Check 1: Vision API Status**
- Check Google Cloud Console for outages
- Check service quota (may be hit)

**Check 2: Credentials**
```bash
# Verify API key is not expired
curl -s https://www.googleapis.com/oauth2/v1/tokeninfo \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)"
```

**Check 3: Service Logs**
```bash
kubectl logs -n cic-ingestion deployment/cic-ingestion | grep -i error
```

**Action:** If API is down, temporarily increase fallback allowance or rollback

---

### Service Down (503 / Connection Refused)

**Check 1: Pod Status**
```bash
kubectl get pods -n cic-ingestion
```
If not running: Check events
```bash
kubectl describe pod -n cic-ingestion <pod-name>
```

**Check 2: Service Endpoint**
```bash
kubectl get svc -n cic-ingestion
```
Verify ClusterIP is allocated

**Check 3: Restart Service**
```bash
kubectl rollout restart deployment/cic-ingestion -n cic-ingestion
kubectl rollout status deployment/cic-ingestion -n cic-ingestion
```

**Action:** If restart fails, check logs and redeploy

---

## Rollback Procedure

**Immediate (Any Stage):**
```bash
# Disable new implementation
kubectl set env deployment/trm-harvester \
  ENABLE_IMAGE_ANALYSIS=0.0

# Verify rollback
kubectl rollout status deployment/trm-harvester
curl http://trm-harvester:9090/metrics | grep image_analysis_by_implementation
```

**Diagnostic (Post-Rollback):**
```bash
# Collect logs from failed period
kubectl logs -n cic-ingestion deployment/cic-ingestion \
  --since=2h > cic-ingestion.log

kubectl logs deployment/trm-harvester \
  --since=2h > trm-harvester.log

# Archive for analysis
tar czf phase4-rollback-$(date +%s).tar.gz *.log
```

**Communication:**
- Notify on-call team: "Phase 4 Stage X rolled back: [reason]"
- Post incident details to #incidents channel
- Schedule post-mortem

---

## Stage Transition Template

**Pre-Transition Checklist:**
```
Date: ____________________
Stage: __________ → __________
Approver: ____________________

□ Error rate <5% for full duration
□ Latency p99 <500ms sustained
□ Fallback ratio <5%
□ Zero customer reports
□ Monitoring dashboards healthy
□ On-call team aware
□ Rollback tested locally
```

**Deployment Command:**
```bash
kubectl set env deployment/trm-harvester \
  ENABLE_IMAGE_ANALYSIS=[0.25|0.5|1.0]
```

**Post-Deployment:**
```bash
kubectl rollout status deployment/trm-harvester
# Monitor for 10 min before signing off
```

---

## Emergency Contacts

| Role | Escalation |
|------|-----------|
| On-call | #page-oncall-trm |
| TRM Lead | @trm-lead |
| cic-ingestion Owner | @cic-owner |
| Google Cloud Quota | google-cloud-support@company.com |

---

## See Also

- Monitoring: `docs/PHASE4-MONITORING.md`
- Rollout Strategy: `docs/PHASE4-ROLLOUT.md`
- Baseline Metrics: `PHASE3-BASELINE.json`
- Phase 3 Tests: `src/__tests__/imageAnalysis-integration.test.ts`
