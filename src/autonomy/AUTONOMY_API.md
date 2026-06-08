# Autonomy API Reference (Phase 23.7.3)

**Service:** CIC Memory-Driven Autonomy  
**Base URL:** `http://localhost:3000`  
**Status:** Implementation Complete (23.7.3)

---

## Overview

The Autonomy API exposes:
- **Signal Detection** — detect drift, instability, regression, and opportunity signals
- **Proposal Generation** — convert signals into actionable roadmap proposals
- **Governance Integration** — route proposals to approval workflows
- **Trend Analysis** — query historical signals and proposals

---

## Endpoints

### Health & Info

#### `GET /health`
Server health check.

**Response (200):**
```json
{
  "status": "ok",
  "service": "autonomy-api",
  "uptime": 1234.5,
  "timestamp": "2026-06-08T14:30:00Z"
}
```

#### `GET /autonomy`
API info and endpoint catalog.

**Response (200):**
```json
{
  "service": "CIC Autonomy API",
  "version": "1.0.0",
  "phase": "23.7",
  "endpoints": {
    "signals": { ... },
    "proposals": { ... }
  }
}
```

---

## Signals

### `POST /autonomy/signals`
Detect signals from event history.

**Query Parameters:**
- `startDate` (ISO 8601, optional) — default: 7 days ago
- `endDate` (ISO 8601, optional) — default: now

**Example Request:**
```bash
curl -X POST \
  'http://localhost:3000/autonomy/signals?startDate=2026-06-01T00:00:00Z&endDate=2026-06-08T23:59:59Z'
```

**Response (200):**
```json
{
  "signals": [
    {
      "id": "drift_1717934400000",
      "type": "drift",
      "severity": "critical",
      "confidence": 0.85,
      "affectedPhases": ["Phase 24", "Phase 25"],
      "evidence": [...],
      "timestamp": "2026-06-08T14:30:00Z",
      "description": "Critical drift detected...",
      "recommendation": "Review recent changes in ARPS, APR, and CRO...",
      "driftMetrics": {
        "semantic_drift": 0.78,
        "temporal_drift": 0.65,
        "narrative_drift": 0.72,
        "causal_drift": 0.81,
        "combined_score": 0.74
      },
      "metadata": { ... }
    }
  ],
  "count": 3,
  "window": {
    "startDate": "2026-06-01T00:00:00Z",
    "endDate": "2026-06-08T23:59:59Z"
  },
  "detectedAt": "2026-06-08T14:30:00Z"
}
```

---

### `GET /autonomy/signals`
Query stored signals with filters.

**Query Parameters:**
- `type` (comma-separated) — drift, instability, regression, opportunity
- `severity` (comma-separated) — info, warning, critical
- `phase` (comma-separated) — Phase 24, Phase 25, etc.
- `minConfidence` (0.0–1.0) — filter by confidence threshold
- `limit` (1–1000, default: 100) — pagination
- `offset` (default: 0) — pagination offset

**Example Request:**
```bash
curl 'http://localhost:3000/autonomy/signals?type=drift,instability&severity=critical&limit=50'
```

**Response (200):**
```json
{
  "signals": [
    { ... },
    { ... }
  ],
  "count": 2,
  "total": 5,
  "query": {
    "type": ["drift", "instability"],
    "severity": ["critical"],
    "limit": 50,
    "offset": 0
  },
  "queriedAt": "2026-06-08T14:30:00Z"
}
```

---

### `GET /autonomy/signals/:id`
Get a specific signal by ID.

**Example Request:**
```bash
curl 'http://localhost:3000/autonomy/signals/drift_1717934400000'
```

**Response (200):**
```json
{
  "signal": {
    "id": "drift_1717934400000",
    "type": "drift",
    ...
  }
}
```

**Response (404):**
```json
{
  "error": "Signal not found: drift_1717934400000"
}
```

---

### `GET /autonomy/signals/trends/:metric`
Get signal trends over time.

**Path Parameters:**
- `metric` — metric name (e.g., `drift_count`, `avg_confidence`)

**Query Parameters:**
- `window` (hourly, daily, weekly, default: daily)
- `days` (1–365, default: 7) — historical window

**Example Request:**
```bash
curl 'http://localhost:3000/autonomy/signals/trends/drift_count?window=daily&days=30'
```

**Response (200):**
```json
{
  "trends": [
    {
      "timestamp": "2026-05-09",
      "count": 2,
      "avgConfidence": 0.78
    },
    {
      "timestamp": "2026-05-10",
      "count": 1,
      "avgConfidence": 0.92
    }
  ],
  "metric": "drift_count",
  "window": "daily",
  "days": 30,
  "queriedAt": "2026-06-08T14:30:00Z"
}
```

---

## Proposals

### `POST /autonomy/proposals`
Generate proposals from signals.

**Request Body (optional):**
```json
{
  "signalIds": ["drift_1717934400000", "instability_1717934500000"]
}
```

If `signalIds` is omitted, proposals are generated from all stored signals.

**Example Request:**
```bash
curl -X POST http://localhost:3000/autonomy/proposals \
  -H 'Content-Type: application/json' \
  -d '{ "signalIds": ["drift_1717934400000"] }'
```

**Response (201):**
```json
{
  "proposals": [
    {
      "id": "proposal_Phase24_1717934400000",
      "timestamp": "2026-06-08T14:30:00Z",
      "triggeredBy": [
        {
          "id": "drift_1717934400000",
          "type": "drift",
          "severity": "critical",
          ...
        }
      ],
      "actions": [
        {
          "type": "reprioritize",
          "phase": "Phase 24",
          "description": "Reprioritize Phase 24 due to drift...",
          "estimatedDurationChange": 4
        }
      ],
      "impact": {
        "affectedPhases": ["Phase 24", "Phase 25", "Phase 26"],
        "estimatedDurationChange": 4,
        "riskLevel": "high",
        "dependencies": [],
        "rationale": "Proposal triggered by 1 signal(s) (drift) affecting Phase 24..."
      },
      "confidence": 0.85,
      "status": "pending",
      "approvalStatus": {
        "requestedAt": "2026-06-08T14:30:00Z",
        "votesRequired": 3,
        "votesReceived": 0
      },
      "metadata": { ... },
      "priority": 78
    }
  ],
  "count": 1,
  "generatedAt": "2026-06-08T14:30:00Z"
}
```

---

### `GET /autonomy/proposals`
Query stored proposals with filters.

**Query Parameters:**
- `status` (comma-separated) — pending, approved, rejected, executed
- `minPriority` (0–100) — filter by priority score
- `limit` (1–1000, default: 100) — pagination
- `offset` (default: 0) — pagination offset

**Example Request:**
```bash
curl 'http://localhost:3000/autonomy/proposals?status=pending,approved&minPriority=70'
```

**Response (200):**
```json
{
  "proposals": [
    { ... },
    { ... }
  ],
  "count": 2,
  "total": 8,
  "query": {
    "status": ["pending", "approved"],
    "minPriority": 70,
    "limit": 100,
    "offset": 0
  },
  "queriedAt": "2026-06-08T14:30:00Z"
}
```

---

### `GET /autonomy/proposals/:id`
Get a specific proposal by ID.

**Example Request:**
```bash
curl 'http://localhost:3000/autonomy/proposals/proposal_Phase24_1717934400000'
```

**Response (200):**
```json
{
  "proposal": { ... },
  "priority": 78
}
```

---

### `PUT /autonomy/proposals/:id`
Update proposal status (approve, reject, execute, etc.).

**Request Body:**
```json
{
  "status": "approved"
}
```

**Example Request:**
```bash
curl -X PUT http://localhost:3000/autonomy/proposals/proposal_Phase24_1717934400000 \
  -H 'Content-Type: application/json' \
  -d '{ "status": "approved" }'
```

**Response (200):**
```json
{
  "proposal": {
    "id": "proposal_Phase24_1717934400000",
    "status": "approved",
    "approvalStatus": {
      "requestedAt": "2026-06-08T14:30:00Z",
      "votesRequired": 3,
      "votesReceived": 3,
      "councilVotes": [
        {
          "voterId": "council_member_1",
          "decision": "approve",
          "timestamp": "2026-06-08T14:35:00Z"
        }
      ]
    },
    ...
  },
  "priority": 78,
  "updatedAt": "2026-06-08T14:35:00Z"
}
```

---

### `POST /autonomy/proposals/simulate`
Simulate proposal execution (what-if analysis).

**Request Body:**
```json
{
  "proposalId": "proposal_Phase24_1717934400000"
}
```

**Example Request:**
```bash
curl -X POST http://localhost:3000/autonomy/proposals/simulate \
  -H 'Content-Type: application/json' \
  -d '{ "proposalId": "proposal_Phase24_1717934400000" }'
```

**Response (200):**
```json
{
  "result": {
    "proposalId": "proposal_Phase24_1717934400000",
    "simulationType": "what_if",
    "outcomes": {
      "phaseDurations": {
        "Phase 24": 104,
        "Phase 25": 108,
        "Phase 26": 106
      },
      "riskScore": 0.8,
      "estimatedCompletion": "2026-06-22T14:30:00Z",
      "criticalPath": ["Phase 24", "Phase 25", "Phase 26"]
    },
    "confidence": 0.85
  },
  "simulatedAt": "2026-06-08T14:30:00Z"
}
```

---

## Error Responses

**400 Bad Request:**
```json
{
  "error": "Invalid date format. Use ISO 8601 (YYYY-MM-DDTHH:mm:ssZ)"
}
```

**404 Not Found:**
```json
{
  "error": "Signal not found: drift_1717934400000"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to fetch events: Service Unavailable"
}
```

---

## Implementation Notes

### Signal Detection Flow
1. **POST /autonomy/signals** triggers:
   - Fetch events from MemoryQueryAPI
   - Fetch drift metrics from MemoryQueryAPI
   - Fetch health metrics from MemoryQueryAPI
   - Run SignalDetectionEngine
   - Store signals in memory
   - Return signals

2. **GET /autonomy/signals** queries stored signals with filtering

### Proposal Generation Flow
1. **POST /autonomy/proposals** triggers:
   - Get signals (provided or all stored)
   - Run RoadmapProposalEngine
   - Assess governance requirements (Phase 24)
   - Store proposals in memory
   - Return proposals

2. **PUT /autonomy/proposals/:id** updates proposal status (e.g., approve/reject)

### Storage
- **Current:** In-memory (AutonomyStore)
- **TODO:** Migrate to PostgreSQL for persistence
- **TODO:** Add Kafka topics for event streaming

---

## Testing with cURL

### Detect signals
```bash
curl -X POST 'http://localhost:3000/autonomy/signals'
```

### List all signals
```bash
curl 'http://localhost:3000/autonomy/signals?limit=100'
```

### Filter signals by type
```bash
curl 'http://localhost:3000/autonomy/signals?type=drift,regression'
```

### Generate proposals
```bash
curl -X POST http://localhost:3000/autonomy/proposals
```

### Get pending proposals
```bash
curl 'http://localhost:3000/autonomy/proposals?status=pending'
```

### Approve a proposal
```bash
curl -X PUT http://localhost:3000/autonomy/proposals/proposal_Phase24_xyz \
  -H 'Content-Type: application/json' \
  -d '{"status":"approved"}'
```

---

## Configuration

**AutonomyAPIServerConfig:**
```typescript
{
  // Required
  memoryQueryApiUrl: 'http://localhost:3001',  // MemoryQueryAPI endpoint
  roadmapContext: {
    currentPhases: [...],
    criticalPathPhases: [...],
    estimatedCompletionDate: new Date()
  },

  // Optional
  port: 3000,                                   // default: 3000
  host: 'localhost'                             // default: localhost
}
```

**Example:**
```typescript
import { startAutonomyAPIServer } from './src/autonomy/AutonomyAPIServer';

await startAutonomyAPIServer({
  memoryQueryApiUrl: 'http://localhost:3001',
  roadmapContext: {
    currentPhases: [
      {
        name: 'Phase 24',
        status: 'in_progress',
        estimatedDuration: 100,
        dependencies: ['Phase 23'],
        estimatedStartDate: new Date(),
        estimatedEndDate: new Date(Date.now() + 100 * 3600000)
      }
    ],
    criticalPathPhases: ['Phase 24', 'Phase 25', 'Phase 26'],
    estimatedCompletionDate: new Date(Date.now() + 500 * 3600000)
  },
  port: 3000,
  host: 'localhost'
});
```

---

## Next Steps

- [ ] Connect to real MemoryQueryAPI endpoint
- [ ] Implement database persistence (PostgreSQL)
- [ ] Add authentication/authorization
- [ ] Wire governance approval routing (Phase 24)
- [ ] Add WebSocket support for real-time updates
- [ ] Integrate with APR/ARPS bridges
