# Phase 27: CIC Integration — Complete Implementation

## Overview

Phase 27 introduces **deterministic adapter orchestration**, **drift detection**, **SPA hydration tracking**, and **SLO violation webhooks** into the CIC ingestion pipeline.

## Architecture

### Core Components

#### 1. **AdapterIntegrationService** (`src/services/AdapterIntegrationService.ts`)
Central orchestrator for:
- Adapter lifecycle management
- Input normalization
- Output validation
- SLO tracking
- Drift detection signals
- Warm pool hydration
- TorqueQuery ingestion

#### 2. **WarmPoolManager** (`src/services/WarmPoolManager.ts`)
Pre-hydration cache for:
- Model embeddings
- OCR results
- Cached responses
- TTL-based eviction
- Hit-rate tracking

#### 3. **SLOViolationWebhook** (`src/webhooks/SLOViolationWebhook.ts`)
Structured event emission to:
- TorqueQuery (SLO violations)
- Chat-Agent (pipeline events)
- Slack (high-severity alerts)
- Teams (critical alerts)

#### 4. **VerticalDriftDetector** (`src/detectors/VerticalDriftDetector.ts`)
Detects semantic drift via:
- Null result detection
- Schema mismatches
- Confidence score drops (< 0.5)
- Per-adapter baseline tracking
- Historical trend analysis

#### 5. **SpaHydrationDetector** (`src/detectors/SpaHydrationDetector.ts`)
Detects SPA hydration failures:
- Missing metadata
- Hydration error arrays
- Adapter execution failures
- Low confidence thresholds

#### 6. **Adapters** (`src/adapters/`)
Pluggable adapter framework:
- **BaseAdapter**: Abstract class with normalize/run/validate lifecycle
- **FamilySearchAdapter**: Example implementation for FamilySearch API
- **AdapterRegistry**: Runtime adapter registration

## Usage

### 1. Register Adapters

```typescript
import { AdapterIntegrationService } from "@cic/cic-ingestion";
import { FamilySearchAdapter } from "@cic/cic-ingestion";

const service = new AdapterIntegrationService();

const fsAdapter = new FamilySearchAdapter({
  name: "familysearch",
  version: "1.0.0",
  timeout: 10000,
  retries: 3,
  apiUrl: "https://api.familysearch.org",
  apiKey: process.env.FAMILYSEARCH_API_KEY || "",
});

service.registerAdapter("familysearch", fsAdapter);
```

### 2. Execute Adapter

```typescript
const result = await service.execute("familysearch", {
  key: "PID-KWZ3-123",
  payload: {},
});

console.log({
  success: result.success,
  data: result.data,
  driftSignals: result.driftSignals,
  hydrationFailures: result.hydrationFailures,
  stats: result.stats,
});
```

### 3. Batch Execution

```typescript
const results = await service.executeBatch("familysearch", [
  { key: "PID-123" },
  { key: "PID-456" },
  { key: "PID-789" },
]);
```

### 4. Configure Webhooks

```typescript
const service = new AdapterIntegrationService(
  registry,
  warmPool,
  spaDetector,
  driftDetector,
  new SLOViolationWebhook({
    torqueQueryUrl: "http://localhost:9000",
    chatAgentUrl: "http://localhost:8000",
    slackWebhookUrl: process.env.SLACK_WEBHOOK,
    teamsWebhookUrl: process.env.TEAMS_WEBHOOK,
    timeout: 5000,
    retries: 3,
  })
);
```

## API Routes

### POST `/execute/:adapterName`
Execute single adapter.

```bash
curl -X POST http://localhost:3000/execute/familysearch \
  -H "Content-Type: application/json" \
  -d '{"key":"PID-123","payload":{}}'
```

Response:
```json
{
  "success": true,
  "data": { ... },
  "driftSignals": [],
  "hydrationFailures": [],
  "stats": {
    "executionTime": 250,
    "warmPoolHit": false,
    "hitRate": 0.0
  }
}
```

### POST `/execute/batch/:adapterName`
Execute batch of payloads.

```bash
curl -X POST http://localhost:3000/execute/batch/familysearch \
  -H "Content-Type: application/json" \
  -d '[{"key":"PID-123"},{"key":"PID-456"}]'
```

### GET `/execute/status`
Warm pool and adapter status.

```bash
curl http://localhost:3000/execute/status
```

Response:
```json
{
  "healthy": true,
  "adapters": ["familysearch"],
  "warmPool": {
    "hits": 45,
    "misses": 12,
    "evictions": 2,
    "poolSize": 47,
    "hitRate": 0.789
  }
}
```

### POST `/execute/invalidate`
Invalidate warm pool cache.

```bash
curl -X POST http://localhost:3000/execute/invalidate \
  -H "Content-Type: application/json" \
  -d '{"key":"PID-123:{}"}' # optional
```

## Testing

### Unit Tests

```bash
npm test -- adapter-integration.test.ts
npm test -- drift-detector.test.ts
npm test -- spa-detector.test.ts
```

### Integration Test

```bash
npm test -- --testPathPattern="tests/" --coverage
```

### Manual Test (FamilySearch)

```bash
# 1. Start server
npm run dev

# 2. Execute adapter
curl -X POST http://localhost:3000/execute/familysearch \
  -d '{"key":"KWZ3-123"}' \
  -H "Content-Type: application/json"

# 3. Check warm pool hit
curl -X POST http://localhost:3000/execute/familysearch \
  -d '{"key":"KWZ3-123"}' \
  -H "Content-Type: application/json"

# 4. View metrics
curl http://localhost:3000/metrics
```

## Detector Behavior

### VerticalDriftDetector

Signals:
- `NULL_RESULT` (CRITICAL): Adapter returned null
- `SCHEMA_MISMATCH` (MEDIUM): Confidence dropped > 30% from baseline
- `CONFIDENCE_DROP` (CRITICAL/HIGH): Score < 0.5
- `TIMEOUT` (HIGH): Adapter execution failed
- `RETRY_EXHAUSTION` (HIGH): Max retries exceeded

### SpaHydrationDetector

Failures:
- `null result` (HIGH): No output
- `missing hydration metadata` (MEDIUM): No hydration field
- `hydration errors detected` (HIGH): Errors array non-empty
- `adapter execution failed` (HIGH): success=false
- `low confidence score` (MEDIUM): score < 0.3

## Environment Variables

```bash
# FamilySearch API
FAMILYSEARCH_API_URL=https://api.familysearch.org
FAMILYSEARCH_API_KEY=<api_key>

# Webhooks
SLACK_WEBHOOK=https://hooks.slack.com/services/...
TEAMS_WEBHOOK=https://outlook.webhook.office.com/...

# Services
TORQUE_QUERY_URL=http://torque-query:9000
CHAT_AGENT_URL=http://chat-agent:8000

# Server
PORT=3000
NODE_ENV=production
```

## File Structure

```
cic-ingestion/
├── src/
│   ├── adapters/
│   │   ├── AdapterRegistry.ts
│   │   ├── BaseAdapter.ts
│   │   └── familysearch/
│   │       ├── FamilySearchAdapter.ts
│   │       └── schema.ts
│   ├── detectors/
│   │   ├── SpaHydrationDetector.ts
│   │   └── VerticalDriftDetector.ts
│   ├── services/
│   │   ├── AdapterIntegrationService.ts
│   │   └── WarmPoolManager.ts
│   ├── webhooks/
│   │   └── SLOViolationWebhook.ts
│   ├── routes/
│   │   └── execute.ts
│   ├── tests/
│   │   ├── adapter-integration.test.ts
│   │   ├── drift-detector.test.ts
│   │   └── spa-detector.test.ts
│   └── index.ts
└── PHASE_27_README.md
```

## Migration Path

### From Phase 26 (TorqueQuery)

1. Import `AdapterIntegrationService` in your TorqueQuery ingestion handler
2. Register adapters at startup
3. Replace direct adapter calls with `service.execute()`
4. Subscribe to drift/hydration webhooks
5. Monitor SLO metrics in Prometheus

### Chat-Agent Integration

```typescript
// In chat-agent/routes/pipeline.ts
import { AdapterIntegrationService } from "@cic/cic-ingestion";

const adapterService = new AdapterIntegrationService();

router.post("/pipeline/person/:pid", async (req, res) => {
  const result = await adapterService.execute("familysearch", {
    key: req.params.pid,
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  res.json({
    person: result.data,
    quality: result.stats,
  });
});
```

## Performance Characteristics

| Metric | Target | Notes |
|--------|--------|-------|
| Warm Pool Hit Rate | > 80% | Scales with cache TTL |
| Execution Time (cached) | < 50ms | Database lookup + validation |
| Execution Time (fresh) | < 5s | Includes adapter latency |
| Memory (1K entries) | < 50MB | Depends on entry size |
| Cache Eviction | TTL=1h or LRU | Configurable |

## Monitoring

### Prometheus Metrics (to be added)

- `adapter_execution_duration_ms`
- `adapter_success_total`
- `adapter_failure_total`
- `warm_pool_hits_total`
- `warm_pool_misses_total`
- `drift_signals_total`
- `hydration_failures_total`

### SLO Violation Events

Events emitted to `/slo/violation` endpoint:

```json
{
  "type": "VERTICAL_DRIFT",
  "adapter": "familysearch",
  "severity": "MEDIUM",
  "timestamp": 1719172800000,
  "details": { ... }
}
```

## Next Steps

1. ✅ Core adapters + detectors + webhooks (Phase 27.1)
2. 🔲 Prometheus metrics integration (Phase 27.2)
3. 🔲 Multi-tenancy support (Phase 27.3)
4. 🔲 Streaming results (Phase 27.4)
5. 🔲 Distributed tracing (Phase 27.5)
