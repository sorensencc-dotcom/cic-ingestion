# Sandbox-3 SLO Incident Playbooks

## DriftHigh Alert (drift_score > 0.75)

**Severity:** Warning  
**Duration:** 5m sustained  
**Detection:** Model output divergence exceeds 75% threshold

### Mitigation
1. Check ExecutionHistory.getMetrics(modelId) for affected models
2. Review ONNX preprocessing seed stability (onnx-drift.test.ts patterns)
3. If reproducibility < 0.9, escalate to ReproducibilityLow playbook
4. Run deterministic replay on seed N-1 to isolate regression
5. If drift from external model change, rollback to N-1 ONNX checkpoint

### Resolution Checks
- [ ] Drift score < 0.30
- [ ] Reproducibility > 0.95 on 3x test runs
- [ ] PromQL: `cic_drift_score < 0.30` sustains > 5m

---

## DriftSpike Alert (rate(drift_score[2m]) > 0.15)

**Severity:** Critical  
**Duration:** 2m sustained  
**Detection:** Drift change rate exceeds 0.15/min

### Mitigation
1. **Immediate:** Page on-call ML engineer (PagerDuty trigger auto-fires)
2. Check deployment timeline. If <10m old, initiate fast-path rollback
3. Query codeflow-analyzer for recent model updates in source repo
4. If external data source changed, pause ingestion + verify source
5. Run harness-v3 with --trace flag on N-1 seed vs current to delta
6. If no root cause, disable affected model tag in MAAL routing (tier escalation to S3)

### Resolution Checks
- [ ] Drift change rate < 0.05/min for 10m
- [ ] Reproducibility score trending up
- [ ] ModelScoringV3.computeTrustScore() >= 60

---

## ReproducibilityLow Alert (repro_score < 0.7)

**Severity:** Critical  
**Duration:** 10m sustained  
**Detection:** Deterministic execution degraded, repro score < 70%

### Mitigation
1. **Immediate:** Page on-call ops engineer
2. SSH to Firecracker host, check /var/firecracker/kernel + /var/firecracker/rootfs hashes
3. If mismatch, redeploy kernel/rootfs from S3 snapshot store
4. Run firecracker-exec.test.ts deterministic boot test on affected VM
5. Check jailer config: memory lock, CPU pinning, seccomp rules
6. If syscall trace divergence, review tracing.test.ts eBPF hook logs
7. If unfixable, drain VM pool + scale ASG (new instances provision fresh)

### Resolution Checks
- [ ] Reproducibility score > 0.95
- [ ] SnapshotHash & FilesystemHash both OK (repro-alert-engine checks pass)
- [ ] Firecracker boot time < 200ms

---

## FirecrackerBootSlow Alert (boot_time > 500ms)

**Severity:** Warning  
**Duration:** 5m sustained  
**Detection:** VM startup exceeds 500ms SLO

### Mitigation
1. Check EC2 instance CPU credits (if burst instance, may be throttled)
2. Query CloudWatch: EBS read latency, network I/O
3. Run `du -sh /var/firecracker/rootfs` — if > 5GB, resize/optimize
4. Verify kernel parameters: `noinitrd`, `noapic` for latency
5. If ASG near max capacity, scale up to provision fresh hosts
6. If persistent, file ticket to move c5.large → c6i.xlarge compute tier

### Resolution Checks
- [ ] Boot time sustains < 300ms for 10m
- [ ] EC2 CPU utilization < 70%
- [ ] No storage I/O bottlenecks (CloudWatch)

---

## SnapshotFailure Alert (snapshot_errors_total increase > 0 in [5m])

**Severity:** Critical  
**Duration:** Immediate  
**Detection:** Snapshot restore failures detected

### Mitigation
1. **Immediate:** Page on-call ops engineer
2. Check S3 bucket permissions + snapshot object integrity (ETag)
3. Run `firecracker --snapshot-path <path>` restore test locally
4. If S3 object corrupted, restore from backup snapshot (prior N-1 tag)
5. If jailer permissions issue, check /var/firecracker ownership (should be `firecracker:firecracker`)
6. Pause snapshot-dependent workflows until root cause confirmed
7. Run ExecutionHarnessV3 with fresh VM (no snapshot restore) as fallback

### Resolution Checks
- [ ] No snapshot errors in last 10m window
- [ ] S3 snapshot object passes integrity check
- [ ] Restore test succeeds 3x in a row
- [ ] Snapshot metrics export confirms zero errors

---

## Escalation Path

| Alert | On-Call Role | Response Time | Escalate If |
|-------|--------------|---------------|-------------|
| DriftHigh | ML Engineer | 15m | Not resolved in 30m |
| DriftSpike | ML Engineer | 5m (PagerDuty) | Not mitigated in 10m |
| ReproducibilityLow | Ops Engineer | 5m (PagerDuty) | Not resolved in 15m |
| FirecrackerBootSlow | Infra Engineer | 20m | Not resolved in 30m |
| SnapshotFailure | Ops Engineer | 5m (PagerDuty) | Not resolved in 10m |

**Level 2 Escalation:** Contact platform SRE on-call if L1 cannot resolve in escalation window.

---

## Post-Incident

1. Update MAAL routing thresholds if alert tuning needed
2. Add regression test to prevent recurrence
3. Document root cause in incident log
4. Review SLO budget impact on monthly report
