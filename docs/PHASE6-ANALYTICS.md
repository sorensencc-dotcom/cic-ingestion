# Phase 6 Analytics — Operator-Grade Governance Observability

## Overview

Phase 6 introduces **deterministic analytics primitives** built on Phase 5 lineage substrate. Five nightly metrics transform governance history into actionable signals for Phase 7 autonomous decision-making.

## Architecture

```
canary_state_history + governance_envelope + audit_log
        ↓                    ↓                     ↓
    [MetricsEngine] — computes 5 metrics per night
        ↓
[NightlyMetricsPipeline] — ingests into nightly_metrics
        ↓
    [nightly_metrics] — analytics-ready snapshots
        ↓          ↓          ↓          ↓
   Drift      Grafana   PrometheusExporter   Phase 7
```

## Nightly Metrics (5 Primitives)

### 1. Violation Rate (VR)
Violations per canary cycle, normalized.
```
VR = count(violations) / count(canary cycles)
```
- **Target**: < 0.05 (5% violation rate)
- **Spike threshold**: > 1.5x baseline → alert

### 2. Rollback Severity Index (RSI)
Weighted sum of rollback severities per day.
```
RSI = sum(low:1, medium:2, high:3)
```
- **Healthy**: 0–2
- **Alert**: > 5

### 3. Cohort Stability Score (CSS)
Inverse of metric variance within cohorts.
```
CSS = 1 / (1 + stddev(metric_deltas))
```
- **Target**: > 0.85
- **Drop threshold**: < 0.8x baseline → alert

### 4. Impact Drift (ID)
Mean deviation between expected and actual impact.
```
ID = mean(|actual - expected|)
```
- **Target**: < 0.01
- **Spike threshold**: > 1.5x baseline → alert

### 5. Governance Risk Score (GRS)
Average of proposal risk scores from governance_envelope.
```
GRS = mean(governance_envelope.risk_score)
```
- **Healthy**: < 0.40
- **Alert**: > 0.7

## Database Schemas

### governance_envelope
Canonical governance state per proposal.

```sql
CREATE TABLE governance_envelope (
  proposal_id TEXT PRIMARY KEY,
  current_version TEXT NOT NULL,
  previous_version TEXT NOT NULL,
  lineage_depth INT NOT NULL,
  last_violation JSONB,
  last_rollback JSONB,
  risk_score NUMERIC(4,3),
  hybrid_threshold NUMERIC(4,3),
  lambda_weight NUMERIC(4,3),
  updated_at TIMESTAMP
);
```

### audit_log
Append-only event log for governance + canary.

```sql
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  record_id UUID UNIQUE,
  proposal_id TEXT,
  event_type TEXT,        -- submit|validate|canary_*|violation|rollback|...
  severity TEXT,          -- low|medium|high
  category TEXT,          -- governance|canary|sandbox|config|lineage
  policy_metadata JSONB,
  details JSONB,
  occurred_at TIMESTAMP,
  ...
);
```

### nightly_metrics
Analytics snapshot, one row per day.

```sql
CREATE TABLE nightly_metrics (
  id BIGSERIAL PRIMARY KEY,
  day DATE UNIQUE,
  violation_rate NUMERIC(6,4),
  rollback_severity_index NUMERIC(6,2),
  cohort_stability_score NUMERIC(6,4),
  impact_drift NUMERIC(10,4),
  avg_risk_score NUMERIC(6,4),
  avg_threshold NUMERIC(6,4),
  avg_lambda NUMERIC(6,4),
  computed_at TIMESTAMP
);
```

## TypeScript Components

### MetricsEngine
Computes all five metrics from raw audit data.

```ts
const engine = new MetricsEngine(pool);
const metrics = await engine.computeNightlyMetrics();
```

### NightlyMetricsPipeline
Runs metrics computation nightly, upserts into nightly_metrics.

```ts
const pipeline = new NightlyMetricsPipeline(pool, engine);
await pipeline.run();
```

### PrometheusExporter
Exposes metrics at `/metrics` for Prometheus scraping.

```ts
const exporter = new PrometheusExporter(pool, 9100);
exporter.start();
```

### DriftDetectorEngine
Detects metric spikes using 7-day baseline comparison.

```ts
const detector = new DriftDetectorEngine(pool);
const alerts = await detector.evaluate();
```

### GovernanceEnvelopeCache
In-memory cache + DB loader for governance state.

```ts
const cache = new GovernanceEnvelopeCache(pool);
const env = await cache.loadEnvelope(proposalId);
```

### GovernanceReplayHarness
Reconstructs proposal timelines from lineage events.

```ts
const harness = new GovernanceReplayHarness(pool);
const replay = await harness.replayProposal(proposalId);
```

## Scheduling

### Nightly Job (2 AM UTC)
```bash
systemctl enable phase6-metrics.timer
systemctl start phase6-metrics.timer
```

Runs via systemd timer or cron:
```
0 2 * * * /opt/cic-ingestion/run-phase6-metrics.sh
```

## Monitoring

### Prometheus Metrics (port 9100)
```
maal_violation_rate
maal_rollback_severity_index
maal_cohort_stability_score
maal_impact_drift
maal_governance_risk_score
maal_governance_threshold
maal_governance_lambda
```

### Drift Alerts
Automatically emitted when:
- Impact drift > 1.5x baseline
- Violation rate > 1.5x baseline
- Cohort stability < 0.8x baseline
- Risk score > 1.3x baseline

## Integration with Phase 7

Phase 7 (Autonomous Governance) consumes Phase 6 metrics:

1. **Proposal Readiness** — uses VR + RSI to decide promotion
2. **Risk Scoring** — uses GRS + CSS to compute adaptive thresholds
3. **Adaptive Learning** — uses ID + CSS to tune cohort selection
4. **Rollback Decision** — uses RSI + VR to trigger auto-rollback

## E2E Testing

```bash
npm test -- phase6-e2e.test.ts
```

Validates:
- ✅ All five metrics compute
- ✅ Nightly pipeline idempotent
- ✅ Prometheus exporter healthy
- ✅ Drift detector accurate
- ✅ Governance cache consistent
- ✅ Replay harness reconstructs timelines

## File Tree

```
postgres/phase6/
├── 001_governance_envelope.sql
├── 002_audit_log.sql
├── 003_nightly_metrics.sql
└── 004_governance_envelope_triggers.sql

src/
├── metrics/
│   ├── MetricsEngine.ts
│   ├── NightlyMetricsPipeline.ts
│   ├── PrometheusExporter.ts
│   └── phase6-cron-setup.sh
├── drift/
│   └── DriftDetectorEngine.ts (updated)
└── governance/
    ├── GovernanceEnvelopeCache.ts
    └── GovernanceReplayHarness.ts

tests/
└── phase6-e2e.test.ts
```

## Success Criteria

Phase 6 is complete when:

- ✅ All five metrics compute deterministically
- ✅ Nightly pipeline runs without error
- ✅ Metrics persist in nightly_metrics table
- ✅ Prometheus exporter exposes all metrics
- ✅ Drift detector emits alerts accurately
- ✅ Governance envelope cache stays consistent
- ✅ Replay harness reconstructs timelines
- ✅ All E2E tests pass
- ✅ Cron job scheduled and running

## Next Steps (Phase 7)

Phase 7 (Autonomous Governance) builds on Phase 6:

1. **Adaptive Promotion Logic** — uses VR + RSI + PRI
2. **Auto-Rollback Decision** — uses RSI + VR thresholds
3. **Long-Memory Learning** — uses GRS + CSS history
4. **Threshold Tuning** — adaptive T and λ from metrics drift
5. **Cohort Optimization** — uses CSS + ID to select stable cohorts

---

**Status**: Phase 6 foundation ready to ship.  
**Owner**: CIC Governance  
**Last Updated**: 2026-06-29
