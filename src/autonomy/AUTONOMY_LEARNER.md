# Autonomy Learner (Phase 23.7.7)

**Purpose:** Feedback loop that learns from proposal outcomes to improve signal detection thresholds over time.

**Location:** `src/autonomy/AutonomyLearner.ts`

---

## Overview

The Autonomy Learner:
- Tracks proposal outcomes (success, partial, failure)
- Calculates signal accuracy (precision, recall, F1 score)
- Adjusts signal detection thresholds based on outcomes
- Decays old signals automatically
- Reports learning metrics

**Architecture:**
```
Proposal Outcome
    ↓
AutonomyLearner
  ├→ Record outcome
  ├→ Calculate accuracy (TP, FP, precision, recall)
  ├→ Adjust thresholds (if accuracy poor)
  └→ Decay old signals (>30 days)
```

---

## API Reference

### AutonomyLearner Class

#### `evaluateProposalOutcome(proposal, outcome, actualDurationChange?, reason?)`

Record and evaluate a proposal outcome, updating accuracy metrics and thresholds.

```typescript
await learner.evaluateProposalOutcome(
  proposal,
  'success',        // outcome: 'success' | 'partial' | 'failure'
  72,               // actualDurationChange (hours)
  'Mitigation worked'
);
```

**Parameters:**
- `proposal: RoadmapProposal` — the proposal being evaluated
- `outcome: ProposalOutcome` — actual outcome (success, partial, failure)
- `actualDurationChange?: number` — actual duration change in hours
- `reason?: string` — explanation of outcome

**Behavior:**
1. Records outcome in store
2. Calculates signal accuracy:
   - Success → true positive
   - Failure → false positive
   - Partial → 0.5 TP + 0.5 FP
3. Recalculates precision/recall/F1
4. Evaluates threshold adjustments:
   - Failure → increase thresholds (more conservative)
   - Success (high conf) → decrease thresholds (more lenient)

---

#### `getMetrics()`

Get overall learning metrics.

```typescript
const metrics = learner.getMetrics();
// {
//   lastUpdatedAt: "2026-06-08T14:30:00Z",
//   proposalsEvaluated: 42,
//   successRate: 85.7,
//   accuracyBySignalType: {
//     drift: { precision: 0.82, recall: 0.79, f1Score: 0.80, ... },
//     ...
//   },
//   thresholdAdjustments: 5,
//   avgConfidenceImprovement: 0.03
// }
```

---

#### `getSignalAccuracy(signalType)`

Get accuracy metrics for a specific signal type.

```typescript
const driftAccuracy = learner.getSignalAccuracy('drift');
// {
//   signalType: 'drift',
//   totalDetected: 42,
//   truePositives: 34,
//   falsePositives: 8,
//   falseNegatives: 0,
//   precision: 0.81,  // 34 / (34 + 8)
//   recall: 1.0,      // 34 / (34 + 0)
//   f1Score: 0.90
// }
```

---

#### `getAllOutcomes()`

Get all recorded proposal outcomes.

```typescript
const outcomes = learner.getAllOutcomes();
// [
//   {
//     proposalId: "proposal_xyz",
//     outcome: "success",
//     recordedAt: "2026-06-08T14:30:00Z",
//     actualDurationChange: 72,
//     reason: "Mitigation worked",
//     feedback: { ... }
//   },
//   ...
// ]
```

---

#### `getCurrentThresholds()`

Get current signal detection thresholds.

```typescript
const thresholds = learner.getCurrentThresholds();
// {
//   DRIFT_CRITICAL: 0.75,
//   DRIFT_WARNING: 0.50,
//   INSTABILITY_ERROR_RATE: 0.17,
//   REGRESSION_LATENCY_FACTOR: 2.1,
//   ...
// }
```

---

#### `getThresholdHistory()`

Get history of threshold adjustments.

```typescript
const history = learner.getThresholdHistory();
// [
//   {
//     metric: "DRIFT_CRITICAL",
//     oldValue: 0.75,
//     newValue: 0.77,
//     reason: "Proposal proposal_xyz failed; increased drift threshold",
//     timestamp: "2026-06-08T14:30:00Z"
//   },
//   ...
// ]
```

---

#### `decayOldSignals(maxAgeDays?)`

Decay (archive) signals older than specified days. Default: 30 days.

```typescript
const decayedCount = await learner.decayOldSignals(30);
// Returns: number of decayed outcomes
```

**Behavior:**
- Counts outcomes older than `maxAgeDays`
- In production: archives to long-term storage, removes from active memory
- Returns count of decayed items

---

#### `reset()`

Clear all learner state and restore default thresholds. **For testing only.**

```typescript
learner.reset();
```

---

## Accuracy Metrics

### Precision
```
Precision = TP / (TP + FP)
```
- Measures: "Of the signals we raised, how many were correct?"
- High precision = fewer false alarms
- Range: 0.0–1.0

### Recall
```
Recall = TP / (TP + FN)
```
- Measures: "Of the problems that actually occurred, how many did we detect?"
- High recall = fewer missed problems
- Range: 0.0–1.0

### F1 Score
```
F1 = 2 * (Precision * Recall) / (Precision + Recall)
```
- Harmonic mean of precision and recall
- Balances both metrics
- Range: 0.0–1.0

---

## Threshold Adjustment Rules

### On Proposal Failure
Increase thresholds (become more conservative):
```
DRIFT_CRITICAL:           += 0.05
INSTABILITY_ERROR_RATE:   += 0.02
REGRESSION_LATENCY_FACTOR: += 0.2
```

**Rationale:** Signal was raised but proposal failed → threshold was too lenient

### On Proposal Success (high confidence)
Decrease thresholds (become more lenient) if confidence > 90%:
```
DRIFT_CRITICAL:           -= 0.02
INSTABILITY_ERROR_RATE:   -= 0.01
```

**Rationale:** Signal worked well and was high confidence → threshold was too strict

### Bounds
All thresholds are bounded:
```
0.5 ≤ DRIFT_CRITICAL ≤ 0.95
0.1 ≤ INSTABILITY_ERROR_RATE ≤ 0.3
1.5 ≤ REGRESSION_LATENCY_FACTOR ≤ 3.0
```

---

## REST API Endpoints

### `GET /autonomy/learner/metrics`
Get overall learning metrics.

**Response:**
```json
{
  "metrics": {
    "lastUpdatedAt": "2026-06-08T14:30:00Z",
    "proposalsEvaluated": 42,
    "successRate": 85.7,
    "accuracyBySignalType": { ... },
    "thresholdAdjustments": 5,
    "avgConfidenceImprovement": 0.03
  },
  "queriedAt": "2026-06-08T14:30:00Z"
}
```

---

### `GET /autonomy/learner/thresholds`
Get current thresholds and adjustment history.

**Response:**
```json
{
  "thresholds": {
    "DRIFT_CRITICAL": 0.77,
    "INSTABILITY_ERROR_RATE": 0.17,
    ...
  },
  "history": [
    {
      "metric": "DRIFT_CRITICAL",
      "oldValue": 0.75,
      "newValue": 0.77,
      "reason": "...",
      "timestamp": "2026-06-08T14:30:00Z"
    }
  ],
  "adjustmentCount": 5,
  "queriedAt": "2026-06-08T14:30:00Z"
}
```

---

### `GET /autonomy/learner/accuracy/:signalType`
Get accuracy metrics for a specific signal type.

**Parameters:**
- `signalType` — drift, instability, regression, opportunity

**Response (200):**
```json
{
  "accuracy": {
    "signalType": "drift",
    "totalDetected": 42,
    "truePositives": 34,
    "falsePositives": 8,
    "falseNegatives": 0,
    "precision": 0.81,
    "recall": 1.0,
    "f1Score": 0.90
  },
  "queriedAt": "2026-06-08T14:30:00Z"
}
```

**Response (404):**
```json
{
  "error": "No accuracy data found for signal type: drift"
}
```

---

### `POST /autonomy/learner/feedback`
Record proposal outcome and update learner.

**Body:**
```json
{
  "proposalId": "proposal_xyz",
  "outcome": "success",           // required: success, partial, failure
  "actualDurationChange": 72,     // optional: hours
  "reason": "Mitigation worked"   // optional: explanation
}
```

**Response (201):**
```json
{
  "metrics": { ... },
  "feedbackRecordedAt": "2026-06-08T14:30:00Z"
}
```

---

### `POST /autonomy/learner/decay`
Decay (archive) old signals.

**Body:**
```json
{
  "maxAgeDays": 30  // optional, default: 30
}
```

**Response:**
```json
{
  "decayedCount": 12,
  "maxAgeDays": 30,
  "completedAt": "2026-06-08T14:30:00Z"
}
```

---

### `GET /autonomy/learner/outcomes`
Get all recorded proposal outcomes (paginated).

**Query Parameters:**
- `limit` (default: 100, max: 1000)
- `offset` (default: 0)

**Response:**
```json
{
  "outcomes": [ ... ],
  "count": 42,
  "total": 100,
  "limit": 100,
  "offset": 0,
  "queriedAt": "2026-06-08T14:30:00Z"
}
```

---

### `GET /autonomy/learner/summary`
Quick summary of learning state.

**Response:**
```json
{
  "summary": {
    "metrics": {
      "proposalsEvaluated": 42,
      "successRate": 85.7,
      "avgConfidenceImprovement": 0.03
    },
    "thresholds": {
      "current": { ... },
      "adjustmentCount": 5,
      "lastAdjustment": { ... }
    },
    "signalAccuracy": { ... }
  },
  "queriedAt": "2026-06-08T14:30:00Z"
}
```

---

## Integration Example

```typescript
import { AutonomyService } from './autonomy/AutonomyService';
import { AutonomyLearner } from './autonomy/AutonomyLearner';
import { BridgeOrchestrator } from './autonomy/bridges/BridgeOrchestrator';

const service = new AutonomyService(config);
const learner = new AutonomyLearner();
const orchestrator = new BridgeOrchestrator(bridgeConfig);

// Detect signals → generate proposals
const { signals, proposals } = await service.runFullCycle(startDate, endDate);

// Route through bridges
await orchestrator.runFullIntegrationCycle(signals, proposals);

// Later, record proposal outcome (from governance feedback)
const proposal = proposals[0];
await learner.evaluateProposalOutcome(
  proposal,
  'success',
  actualDurationChange,
  'Approved by council and executed successfully'
);

// Check learner metrics
const metrics = learner.getMetrics();
console.log(`Success rate: ${metrics.successRate}%`);
console.log(`Thresholds adjusted: ${metrics.thresholdAdjustments} times`);
```

---

## Testing

```bash
npm test -- learner.test.ts
```

**Test Coverage:**
- Outcome recording (success, partial, failure)
- Accuracy calculation (precision, recall, F1)
- Threshold adjustment (increase on failure, decrease on success)
- Bounds checking (thresholds stay within safe range)
- State management (record, retrieve, reset)
- Decay (signal aging)

---

## Performance

**Metrics:**
- Outcome evaluation: <5ms
- Accuracy calculation: <1ms
- Threshold adjustment: <2ms
- Decay (1000 outcomes): <50ms

---

## Next Steps

- [ ] Integrate with governance feedback loop
- [ ] Add historical trend analysis (confidence improvement over time)
- [ ] Implement adaptive learning rate (faster early, slower later)
- [ ] Add anomaly detection for threshold divergence
- [ ] Persist learning state to database
- [ ] Add feedback from external sources (APR, CRO validation)
