# Autonomy Bridges (Phase 23.7.4–23.7.5)

**Purpose:** Integrate memory-driven autonomy with APR (planner), ARPS (roadmap state), and governance (Council).

**Components:**
1. **AutonomyToPlannerBridge** — Feed signals → planner goals, constraints from approved proposals
2. **AutonomyToARPSBridge** — Log all autonomy activity as ARPS_DELTA events
3. **AutonomyGovernanceBridge** — Route proposals → Phase 24 Council voting
4. **BridgeOrchestrator** — Coordinates all three bridges in a unified flow

---

## Architecture

```
Autonomy Engine (Signals + Proposals)
            ↓
    BridgeOrchestrator
    ↙           ↓           ↖
Planner     ARPS         Governance
(APR)      (Phase 22)    (Phase 24)
```

**Flow:**

1. **Signal Detection:**
   - Autonomy → PlannerBridge (feed goals)
   - Autonomy → ARPSBridge (log signal)

2. **Proposal Generation:**
   - Autonomy → GovernanceBridge (route for approval)
   - Autonomy → ARPSBridge (log proposal)
   - Autonomy → PlannerBridge (apply constraints if approved)

3. **Governance Feedback:**
   - GovernanceBridge → ARPSBridge (log decision)
   - GovernanceBridge → PlannerBridge (apply constraints if approved)
   - Approved → Autonomy Learner (tune thresholds)

---

## AutonomyToPlannerBridge

**Purpose:** Convert autonomy signals into planner (APR) goals and apply proposal constraints.

### Signal → Goal Conversion

**Drift Signal:**
- Type: `drift_mitigation`
- Actions: review_dependencies, validate_assumptions, update_arps
- Priority: high (based on severity + confidence)

**Instability Signal:**
- Type: `stabilization`
- Actions: allocate_resources, increase_testing, monitor_metrics
- Deadline: 24 hours
- Priority: high

**Regression Signal:**
- Type: `regression_fix`
- Actions: root_cause_analysis, performance_optimization, rollback_if_needed
- Deadline: 48 hours
- Priority: high

**Opportunity Signal:**
- Type: `acceleration`
- Actions: increase_resource_allocation, parallelize_work, optimize_dependencies
- Priority: medium (opportunities are lower priority than problems)

### API Integration

**POST /apr/goals**
```json
{
  "goals": [
    {
      "id": "goal_drift_xyz",
      "type": "drift_mitigation",
      "description": "Mitigate drift in Phase 24, Phase 25",
      "priority": 85,
      "targetPhase": "Phase 24",
      "requiredActions": ["review_dependencies", "validate_assumptions"],
      "confidence": 0.85,
      "source": "autonomy",
      "relatedSignals": ["drift_abc123"]
    }
  ],
  "replan": true,
  "context": {
    "triggeredBy": "signal_detection",
    "timestamp": "2026-06-08T14:30:00Z"
  }
}
```

**Replanning Trigger:**
- ≥2 critical signals → replan
- Total goal priority ≥ threshold → replan

**POST /apr/constraints** (for approved proposals)
```json
{
  "phaseConstraints": {
    "Phase 24": {
      "type": "defer",
      "targetDate": "2026-06-15T00:00:00Z",
      "reason": "Defer Phase 24 to allow investigation of regression"
    }
  },
  "context": {
    "triggeredBy": "proposal_approval",
    "proposalId": "proposal_xyz",
    "timestamp": "2026-06-08T14:30:00Z"
  }
}
```

**Usage:**
```typescript
const bridge = new AutonomyToPlannerBridge({
  aprControlPlaneUrl: 'http://localhost:3002',
  replanThresholds: {
    criticalSignalCount: 2,
    totalPriorityScore: 150
  }
});

await bridge.feedSignalsToPlanner(signals);
await bridge.feedProposalToPlanner(approvedProposal);
```

---

## AutonomyToARPSBridge

**Purpose:** Log all autonomy activity into MLA as ARPS_DELTA events for roadmap state tracking.

### Event Types

**autonomy_proposal:** Proposal action
```json
{
  "id": "arps_proposal_xyz_Phase24_123456",
  "type": "ARPS_DELTA",
  "timestamp": "2026-06-08T14:30:00Z",
  "correlationId": "proposal_xyz",
  "summary": "autonomy_proposal: defer_phase",
  "severity": "warning",
  "metadata": {
    "deltaType": "autonomy_proposal",
    "phase": "Phase 24",
    "change": {
      "action": "defer_phase",
      "to": {
        "phase": "Phase 24",
        "action": "defer_phase",
        "newTargetDate": "2026-06-15T00:00:00Z"
      },
      "reason": "Mitigate drift in Phase 24..."
    },
    "confidence": 0.85,
    "riskLevel": "high",
    "affectedPhases": ["Phase 24", "Phase 25"],
    "triggeredBySignals": [
      { "id": "drift_abc", "type": "drift", "severity": "critical" }
    ]
  }
}
```

**autonomy_signal:** Signal detection
```json
{
  "id": "arps_drift_abc123",
  "type": "ARPS_DELTA",
  "timestamp": "2026-06-08T14:30:00Z",
  "correlationId": "drift_abc123",
  "summary": "autonomy_signal: detect_drift",
  "severity": "critical",
  "metadata": {
    "deltaType": "autonomy_signal",
    "signalType": "drift",
    "severity": "critical",
    "affectedPhases": ["Phase 24", "Phase 25"],
    "confidence": 0.85,
    "evidenceCount": 5
  }
}
```

**autonomy_feedback:** Governance decision
```json
{
  "id": "arps_feedback_proposal_xyz_123456",
  "type": "ARPS_DELTA",
  "timestamp": "2026-06-08T14:35:00Z",
  "correlationId": "proposal_xyz",
  "summary": "autonomy_feedback: approved",
  "severity": "info",
  "metadata": {
    "deltaType": "autonomy_feedback",
    "decision": "approved",
    "affectedPhases": ["Phase 24", "Phase 25"]
  }
}
```

### API Integration

**POST /memory/events**
```json
{
  "id": "arps_proposal_xyz_Phase24_123456",
  "timestamp": "2026-06-08T14:30:00Z",
  "type": "ARPS_DELTA",
  "correlationId": "proposal_xyz",
  "summary": "autonomy_proposal: defer_phase",
  "severity": "warning",
  "metadata": { ... }
}
```

**Usage:**
```typescript
const bridge = new AutonomyToARPSBridge({
  memoryStoreUrl: 'http://localhost:3001'
});

await bridge.logSignalToARPS(signal);
await bridge.logProposalToARPS(proposal);
await bridge.logProposalFeedbackToARPS(proposal, 'approved', 'Council voted unanimously');
```

---

## AutonomyGovernanceBridge

**Purpose:** Route proposals to Phase 24 Council for voting, handle governance decisions.

### Governance Routing

**Auto-Approval (no vote needed):**
- Confidence > 95%
- Risk = low
- No critical signals triggering
- → Auto-approved, no council vote

**Council Vote (required):**
- High-risk proposals
- Priority > 50
- Any critical signal triggering
- → Submitted to Council, 7-day voting window

### Vote Request

**POST /governance/votes**
```json
{
  "proposalId": "proposal_Phase24_xyz",
  "title": "Roadmap Proposal: defer_phase, allocate_resources",
  "description": "Proposal generated from 2 signal(s): drift (critical), instability (warning)",
  "rationale": "Critical drift detected in Phase 24...",
  "riskLevel": "high",
  "affectedPhases": ["Phase 24", "Phase 25", "Phase 26"],
  "requiredApprovals": 2,
  "votingDeadline": "2026-06-15T14:30:00Z",
  "metadata": {
    "priority": 78,
    "confidence": 0.85,
    "durationChange": 4,
    "triggeredBySignals": [
      { "id": "drift_abc", "type": "drift", "severity": "critical" }
    ]
  }
}
```

### Individual Vote

**POST /governance/votes/{proposalId}/vote**
```json
{
  "proposalId": "proposal_Phase24_xyz",
  "voterId": "council_member_1",
  "decision": "approve",
  "reason": "Drift signal is legitimate and mitigation makes sense"
}
```

### Decision Recording

**POST /governance/decisions**
```json
{
  "proposalId": "proposal_Phase24_xyz",
  "status": "approved",
  "approvalCount": 3,
  "rejectionCount": 0,
  "abstainCount": 0,
  "decidedAt": "2026-06-10T14:30:00Z",
  "rationale": "Council vote: 3/3 in favor (100%), threshold=66%",
  "votes": [
    {
      "proposalId": "proposal_Phase24_xyz",
      "voterId": "council_member_1",
      "decision": "approve",
      "timestamp": "2026-06-09T10:00:00Z"
    }
  ]
}
```

**Usage:**
```typescript
const bridge = new AutonomyGovernanceBridge({
  governanceControlPlaneUrl: 'http://localhost:3003',
  councilSize: 5,
  approvalThreshold: 66,
  autoApproveThreshold: 0.95
});

await bridge.routeProposalToGovernance(proposal);
await bridge.recordVote('proposal_xyz', 'council_member_1', 'approve', 'Approved');
const decision = await bridge.finalizeDecision(proposal, votes);
```

---

## BridgeOrchestrator

**Purpose:** Single integration point coordinating all three bridges.

### Full Integration Cycle

```typescript
const orchestrator = new BridgeOrchestrator({
  aprControlPlaneUrl: 'http://localhost:3002',
  memoryStoreUrl: 'http://localhost:3001',
  governanceControlPlaneUrl: 'http://localhost:3003',
  replanThresholds: {
    criticalSignalCount: 2,
    totalPriorityScore: 150
  },
  councilSize: 5,
  approvalThreshold: 66,
  autoApproveThreshold: 0.95
});

// Process detected signals
const signalResult = await orchestrator.processSignals(signals);
// Processes: signals → planner goals + ARPS logging

// Process generated proposals
const proposalResult = await orchestrator.processProposals(proposals);
// Processes: proposals → governance routing + planner constraints + ARPS logging

// Process governance feedback
await orchestrator.processGovernanceDecision(
  proposal,
  'approved',
  'Council voted unanimously'
);
// Processes: decision → ARPS logging + planner constraints

// Or run full cycle
const result = await orchestrator.runFullIntegrationCycle(signals, proposals);
```

### Result Structure

```json
{
  "signalsProcessed": 3,
  "proposalsGenerated": 2,
  "proposalsRouted": 2,
  "proposalsApproved": 1,
  "errors": [
    {
      "bridge": "governance",
      "error": "Connection timeout to governance control plane"
    }
  ],
  "timestamp": "2026-06-08T14:30:00Z"
}
```

---

## Configuration

**BridgeOrchestratorConfig:**
```typescript
{
  // Planner bridge (APR Phase 25)
  aprControlPlaneUrl: 'http://localhost:3002',
  replanThresholds: {
    criticalSignalCount: 2,
    totalPriorityScore: 150
  },

  // ARPS bridge (Phase 22)
  memoryStoreUrl: 'http://localhost:3001',

  // Governance bridge (Phase 24)
  governanceControlPlaneUrl: 'http://localhost:3003',
  councilSize: 5,                           // number of council members
  approvalThreshold: 66,                    // percentage threshold
  autoApproveThreshold: 0.95                // confidence threshold for auto-approval
}
```

---

## Integration Points

### With Phase 25 (APR)
- Receives autonomy goals → updates planner state
- Receives proposal constraints → updates phase schedule
- Trigger replanning on critical signals

### With Phase 22 (ARPS)
- Logs all signal detection as ARPS_DELTA events
- Logs all proposal changes as ARPS_DELTA events
- Logs all governance decisions as ARPS_DELTA events
- Feeds roadmap state machine with autonomy context

### With Phase 24 (Governance)
- Routes high-risk proposals to Council
- Implements auto-approval for low-risk, high-confidence proposals
- Records votes and decisions
- Feeds governance decision back to autonomy learner (Phase 23.7.6)

### With Phase 23 (Memory)
- All bridge activity logged to MLA as ARPS_DELTA events
- Events feed Phase 27 (CKG) for semantic reasoning

---

## Error Handling

**Graceful Degradation:**
- Bridge errors do NOT block autonomy operation
- Errors are logged and reported in integration result
- Failed bridge calls are retried with exponential backoff
- Missing downstream services do not crash autonomy

**Example:**
```typescript
try {
  await orchestrator.processSignals(signals);
} catch (err) {
  // Log error, continue
  console.error('Signal processing error:', err);
}

// Result still contains partial success data
console.log(result.errors); // [{ bridge: 'governance', error: '...' }]
```

---

## Testing

**Unit Test Example:**
```typescript
import { AutonomyToPlannerBridge } from './AutonomyToPlannerBridge';

test('converts drift signal to planner goal', () => {
  const bridge = new AutonomyToPlannerBridge({
    aprControlPlaneUrl: 'http://localhost:3002',
    replanThresholds: { criticalSignalCount: 2, totalPriorityScore: 150 }
  });

  const signal: AutonomySignal = {
    id: 'drift_xyz',
    type: 'drift',
    severity: 'critical',
    confidence: 0.85,
    affectedPhases: ['Phase 24'],
    // ...
  };

  const goals = bridge.convertSignalsToGoals([signal]); // private, use reflection
  expect(goals).toHaveLength(1);
  expect(goals[0].type).toBe('drift_mitigation');
});
```

---

## Deployment

**Requires:**
- APR control plane running (Phase 25) — `http://localhost:3002`
- ARPS/MemoryQueryAPI running (Phase 22) — `http://localhost:3001`
- Governance control plane running (Phase 24) — `http://localhost:3003`

**Standalone Usage:**
```typescript
import { BridgeOrchestrator } from './bridges/BridgeOrchestrator';

const orchestrator = new BridgeOrchestrator(config);

// Integrate with AutonomyAPIServer
app.post('/autonomy/signals', async (req, res) => {
  const signals = await service.detectSignals(startDate, endDate);
  const result = await orchestrator.processSignals(signals);
  res.json({ signals, bridgeResult: result });
});

app.post('/autonomy/proposals', async (req, res) => {
  const proposals = await service.generateProposals();
  const result = await orchestrator.processProposals(proposals);
  res.json({ proposals, bridgeResult: result });
});
```

---

## Next Steps

- [ ] Implement autonomy learner (Phase 23.7.6) — feedback loop
- [ ] Add WebSocket support for real-time bridge events
- [ ] Implement retry logic with exponential backoff
- [ ] Add metrics/observability (Prometheus)
- [ ] Wire governance decision feedback to threshold tuning
