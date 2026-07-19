# Phase 4: Feature Flag Rollout

**Objective:** Gradual rollout of real-vision ImageAnalyzer to TRM harvester (10% → 25% → 50% → 100%).

**Timeline:** 1-2 weeks

**Prerequisites:** Phase 1-3 complete + baseline metrics captured.

---

## Rollout Strategy

### Stage 1: Canary (10%)
- **Duration:** 2-3 days
- **Config:** Feature flag `ENABLE_IMAGE_ANALYSIS=0.1`
- **Monitoring:** Error rate, latency p99, Vision API success ratio
- **Alert thresholds:**
  - Error rate > 5% → rollback
  - Latency p99 > 500ms → investigate
  - Fallback ratio > 5% → page oncall
- **Decision:** Proceed if no blockers

### Stage 2: Early Adopters (25%)
- **Duration:** 3-5 days
- **Config:** `ENABLE_IMAGE_ANALYSIS=0.25`
- **Monitoring:** Same metrics + user feedback channels
- **Acceptance:** No regression vs. canary

### Stage 3: Majority (50%)
- **Duration:** 3-5 days
- **Config:** `ENABLE_IMAGE_ANALYSIS=0.5`
- **Monitoring:** Full observability dashboard
- **Acceptance:** Sustained SLA compliance

### Stage 4: Full Rollout (100%)
- **Duration:** Final validation
- **Config:** `ENABLE_IMAGE_ANALYSIS=1.0` (or remove flag)
- **Monitoring:** Production baseline established
- **Final step:** Mark old ReverseImageSearchExtractor as deprecated

---

## Feature Flag Implementation

### TRM Harvester Integration

**File:** `src/ingestion/imageExtract/index.ts`

```typescript
import { randomUUID } from 'crypto';

const ENABLE_IMAGE_ANALYSIS = parseFloat(process.env.ENABLE_IMAGE_ANALYSIS || '0.0');

export async function extractImage(filePath: string): Promise<ExtractionResult> {
  // Feature flag: route to new or old implementation
  const shouldUseNewImplementation = Math.random() < ENABLE_IMAGE_ANALYSIS;

  if (shouldUseNewImplementation) {
    // New: HTTP client to cic-ingestion Vision API
    const buffer = fs.readFileSync(filePath);
    const analyzer = new ImageAnalyzer(
      process.env.CIC_INGESTION_URL || 'http://localhost:3000',
      5000,
      3
    );
    return analyzer.extract(buffer);
  } else {
    // Old: vendored ReverseImageSearchExtractor (fallback)
    // Keep for emergency rollback
  }
}
```

### Observability

**Metrics to track per stage:**
- `image_analysis.enabled_ratio` — % of requests using new implementation
- `image_analysis.success_rate` — % of successful extractions
- `image_analysis.latency_p99` — percentile latency
- `image_analysis.fallback_ratio` — Vision API unavailable fallback rate
- `image_analysis.error_rate_by_type` — network errors, timeouts, etc.

**Dashboards:**
- Canary dashboard (stage-specific)
- Production rollout dashboard (all stages)

---

## Rollback Plan

**Automatic rollback triggers:**
1. Error rate exceeds 5% for 5 min → `ENABLE_IMAGE_ANALYSIS=0`
2. Latency p99 exceeds 500ms for 10 min → scale down to previous stage
3. Vision API fallback ratio exceeds 5% for 15 min → investigate + possible rollback

**Manual rollback:**
```bash
# Immediate disable
export ENABLE_IMAGE_ANALYSIS=0.0
# Restart TRM harvester services
```

**Recovery steps:**
1. Check cic-ingestion service health (http://SERVICE_URL/health)
2. Verify API credentials (VISION_API_KEY, GOOGLE_APPLICATION_CREDENTIALS)
3. Check network connectivity (retry logic should absorb transient errors)
4. Review logs for specific failure modes

---

## Testing Per Stage

### Canary (Stage 1)
- Run 100-200 images through harvester
- Validate latency <500ms p99
- Verify error rate <5%
- Check Vision API usage metrics

### Early Adopters (Stage 2)
- Increase to 500-1000 images
- Monitor for any edge cases (unusual image formats, sizes)
- Gather user feedback

### Majority (Stage 3)
- Production load (2000+ images/day estimated)
- Full observability active
- On-call runbook tested

### Full Rollout (Stage 4)
- All requests use new implementation
- Monitor for 7 days
- No regression vs. baseline

---

## Success Criteria

- [x] Phase 1 service running with mock fallback
- [x] Phase 2 client wired into TRM harvester
- [x] Phase 3 integration tests passing
- [ ] Canary stage completes without errors (Stage 1)
- [ ] Early adopters feedback positive (Stage 2)
- [ ] Majority rollout stable (Stage 3)
- [ ] Full rollout sustained for 7 days (Stage 4)
- [ ] Old ReverseImageSearchExtractor deprecated

---

## Environment Setup

### Stage 1 Canary
```bash
export ENABLE_IMAGE_ANALYSIS=0.1
export CIC_INGESTION_URL=http://cic-ingestion:3000
export VISION_API_KEY=<prod-key>
export GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/google-vision.json

npm start  # TRM harvester with 10% new implementation
```

### Monitoring
```bash
# Check metrics
curl http://harvester-metrics:9090/metrics | grep image_analysis

# Check health
curl http://cic-ingestion:3000/health
```

---

## Handoff Checklist

Before each stage transition:
- [ ] Error rate <5% for past 24 hours
- [ ] Latency p99 <500ms sustained
- [ ] Zero rollback events
- [ ] No customer-facing issues reported
- [ ] Logs reviewed for anomalies
- [ ] On-call notified of stage change
- [ ] Monitoring dashboards updated

---

## Deprecation Plan (Post-Rollout)

After 100% rollout + 30-day stable period:

1. Mark `ReverseImageSearchExtractor` as deprecated
2. Remove from active code paths
3. Archive in `src/legacy/` for reference
4. Update TRM harvester docs
5. Close old Vision API integration tickets

**Timeline:** 60 days post-full-rollout

---

## References

- Phase 1: Service scaffold (`docs/PHASE3-INTEGRATION.md`)
- Phase 2: Client integration (`src/ingestion/imageExtract/index.ts`)
- Phase 3: Baseline metrics (`PHASE3-BASELINE.json`)
- Observability: `src/services/imageAnalysis/observability.ts`
