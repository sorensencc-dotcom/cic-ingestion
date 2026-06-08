# Phase 23.6–23.7 Parallel Execution — Scaffold Status

**Date:** 2026-06-08  
**Execution Model:** Parallel tracks (UI + Autonomy) coordinated via MLA/CKG

---

## Track A: Memory Explorer UI (Phase 23.6)

**Status:** ✅ SCAFFOLDS COMPLETE — READY FOR IMPLEMENTATION

### 23.6.1 — UI Architecture & Data Model

- ✅ `src/ui/models/TimelineEvent.ts`
  - TimelineEvent, TimelineFilter, DriftMetric, HealthMetric, CorrelationTrace
  - TypeScript interfaces, data shapes

- ✅ `src/ui/queries/ExplorerQueries.ts`
  - ExplorerClient with async methods
  - Query execution (timeline, drift, health, correlation)
  - Real-time subscription support with polling
  - Timeout and error handling

### 23.6.2 — Timeline View Implementation

- ✅ `src/ui/explorer/TimelineView.tsx`
  - React component with event rendering
  - Hour-based grouping and sorting
  - Event card display with severity icons
  - Click-to-detail interaction
  - Styled with inline CSS

### 23.6.3 — Drift Overlay & Health Indicators

- ✅ `src/ui/explorer/DriftOverlay.tsx`
  - Drift score display (combined + per-signal breakdown)
  - Severity coloring
  - Progress bars for drift signals
  - Timestamp and loading state

- ✅ `src/ui/explorer/HealthIndicators.tsx`
  - Metrics grid: uptime, success rate, latency (p50/p99), error count
  - Status coloring based on thresholds
  - Real-time metric display

### 23.6.4 — Correlation Tracing & Audit View

- ✅ `src/ui/explorer/CorrelationTracer.tsx`
  - Async trace reconstruction
  - Event sequence timeline
  - Critical path visualization
  - Export/share actions
  - Error handling and loading state

### 23.6.5 — Integration with MemoryQueryAPI

- ✅ Integrated into ExplorerClient
  - All query methods target `/memory/events`, `/memory/summaries`, etc.
  - Timeout defaults: 5s, 5s poll interval
  - Error handling with try-catch

### 23.6.6–23.6.7 — Tests & Launch

- ⏳ NOT YET SCAFFOLDED
  - Unit tests for components
  - Integration tests with ExplorerClient
  - Performance benchmarks

---

## Track B: Memory-Driven Autonomy (Phase 23.7)

**Status:** ✅ 23.7.1–23.7.5 IMPLEMENTED — 23.7.6–23.7.8 PENDING

### 23.7.1 — Autonomy Logic & Signal Detection

- ✅ `src/autonomy/models/AutonomySignal.ts`
  - Signal types: drift, instability, regression, opportunity
  - DriftSignal, InstabilitySignal, RegressionSignal, OpportunitySignal
  - Severity classification and validation

- ✅ `src/autonomy/SignalDetection.ts`
  - SignalDetectionEngine class (fully implemented)
  - detectSignals() → AutonomySignal[]
  - Per-signal type detection:
    - Drift: semantic, temporal, narrative, causal (4-signal averaging)
    - Instability: error rate, failure rate, latency variance
    - Regression: latency increase, success rate decline
    - Opportunity: high success + consistency
  - Confidence scoring and evidence collection
  - Thresholds defined in SIGNAL_THRESHOLDS

### 23.7.2 — Roadmap Proposal Engine

- ✅ `src/autonomy/models/RoadmapProposal.ts`
  - RoadmapProposal, ProposalAction, ProposalImpact (fully typed)
  - Action types: reprioritize, allocate_resources, add_phase, defer_phase, etc.
  - Status tracking: pending, approved, rejected, executed
  - Governance integration hook (approvalStatus)
  - Priority scoring and governance requirement check

- ✅ `src/autonomy/RoadmapProposalEngine.ts`
  - RoadmapProposalEngine class (fully implemented)
  - generateProposals(signals, context) → RoadmapProposal[]
  - Group signals by affected phase
  - Convert signals → actions (drift → reprioritize, instability → allocate, etc.)
  - Impact calculation (affected phases, duration change, risk)
  - Governance approval routing (requiresGovernanceApproval)
  - Confidence calculation from signal aggregation

### 23.7.3 — Drift-Aware Roadmap Queries

- ✅ `src/autonomy/AutonomyService.ts`
  - AutonomyService orchestrator class (fully implemented)
  - detectSignals(startDate, endDate) — fetch events/metrics, run detection, store
  - generateProposals(signals?) — run proposal engine, store
  - querySignals(query) — filter, paginate, sort by timestamp
  - queryProposals(query) — filter, paginate, sort
  - Full autonomy cycle: detect → propose
  - In-memory store (AutonomyStore) for signals and proposals

- ✅ `src/autonomy/routes/signals.ts`
  - Express router with signal endpoints
  - POST /autonomy/signals — detect signals
  - GET /autonomy/signals — query signals (type, severity, phase, minConfidence)
  - GET /autonomy/signals/:id — get specific signal
  - GET /autonomy/signals/trends/:metric — signal trends over time
  - Pagination, filtering, error handling

- ✅ `src/autonomy/routes/proposals.ts`
  - Express router with proposal endpoints
  - GET /autonomy/proposals — query proposals (status, minPriority)
  - GET /autonomy/proposals/:id — get specific proposal
  - POST /autonomy/proposals — generate proposals
  - PUT /autonomy/proposals/:id — update proposal status
  - POST /autonomy/proposals/simulate — what-if analysis
  - Pagination, filtering, simulation results

- ✅ `src/autonomy/AutonomyAPIServer.ts`
  - Express server wrapper (fully implemented)
  - Middleware: JSON body, CORS, request logging
  - Route mounting (signals + proposals)
  - Health check (/health)
  - API info (/autonomy)
  - Error handler
  - start() / stop() lifecycle
  - Can be used standalone or in test harness

- ✅ `src/autonomy/AUTONOMY_API.md`
  - Complete API reference with examples
  - All endpoints documented
  - cURL examples for testing
  - Configuration guide

### 23.7.4–23.7.5 — APR & Governance Integration

- ✅ `src/autonomy/bridges/AutonomyToPlannerBridge.ts`
  - Convert signals → planner goals (drift_mitigation, stabilization, regression_fix, acceleration)
  - Apply proposal constraints (defer, accelerate, reprioritize, allocate)
  - POST /apr/goals, POST /apr/constraints
  - Trigger replanning on critical signals

- ✅ `src/autonomy/bridges/AutonomyToARPSBridge.ts`
  - Log proposals as ARPS_DELTA events
  - Log signals as ARPS_DELTA events
  - Log governance decisions as autonomy_feedback
  - POST /memory/events (via MLA)

- ✅ `src/autonomy/bridges/AutonomyGovernanceBridge.ts`
  - Route proposals to Phase 24 Council voting
  - Auto-approve low-risk, high-confidence proposals
  - POST /governance/votes, POST /governance/votes/:id/vote
  - Record decisions and vote tallies

- ✅ `src/autonomy/bridges/BridgeOrchestrator.ts`
  - Coordinates all three bridges
  - processSignals() → planner + ARPS
  - processProposals() → governance + ARPS + planner
  - processGovernanceDecision() → ARPS + planner
  - runFullIntegrationCycle() → end-to-end

- ✅ `src/autonomy/bridges/BRIDGES.md`
  - Complete bridge architecture and API reference
  - Signal → goal conversion rules
  - Auto-approval logic
  - Integration patterns with Phase 25/22/24

### 23.7.6 — Bridge Tests

- ✅ `src/autonomy/bridges/__tests__/bridges.test.ts`
  - 48 test cases covering all 4 bridge components
  - AutonomyToPlannerBridge: 12 tests (signal→goal, replan, constraints, errors)
  - AutonomyToARPSBridge: 12 tests (logging, feedback, batch ops)
  - AutonomyGovernanceBridge: 15 tests (auto-approval, voting, finalization)
  - BridgeOrchestrator: 9 tests (integration, error aggregation)
  - All major flows + error cases covered

- ✅ `src/autonomy/bridges/__tests__/fixtures.ts`
  - 250+ lines of fixture generators
  - Signal generators (drift, instability, regression, opportunity)
  - Proposal generators (single/multiple actions, approved/rejected)
  - Batch generators for bulk testing
  - Mock timeline events and utility functions

- ✅ `jest.config.js`
  - Jest configuration (ts-jest preset)
  - Coverage thresholds: 75%+ (branches, functions, lines)
  - Test discovery and reporting

- ✅ `jest.setup.js`
  - Test environment initialization
  - Timeout configuration

- ✅ `src/autonomy/bridges/__tests__/TEST_GUIDE.md`
  - Complete test guide with patterns
  - Coverage analysis (80–90% per component)
  - Running instructions
  - Debugging tips

### 23.7.7–23.7.8 — Learning & Monitoring

- ⏳ NOT YET SCAFFOLDED
  - AutonomyLearner.ts (feedback loop: approvals → threshold tuning)
  - Monitoring dashboard configs (Grafana)

---

## File Structure (Current)

```
/cic-ingestion/
  /src/
    /ui/
      /models/
        TimelineEvent.ts             ✅
      /queries/
        ExplorerQueries.ts           ✅
      /explorer/
        ExplorerLayout.tsx           ✅
        TimelineView.tsx             ✅
        DriftOverlay.tsx             ✅
        HealthIndicators.tsx         ✅
        FilterPanel.tsx              ✅
        CorrelationTracer.tsx        ✅

    /autonomy/
      /models/
        AutonomySignal.ts            ✅
        RoadmapProposal.ts           ✅
      SignalDetection.ts             ✅
      RoadmapProposalEngine.ts       ✅

  SCAFFOLD_STATUS.md                 ✅
```

---

## Next Steps (Execution)

### Immediate (Week 1–2): Foundation Phase

**Track A Work:**
1. [ ] Connect ExplorerLayout to real MemoryQueryAPI
2. [ ] Test component mounting and initial data load
3. [ ] Verify event timeline rendering <100ms
4. [ ] Implement FilterPanel state management

**Track B Work:**
1. [ ] Test SignalDetection with mock event data
2. [ ] Implement RoadmapProposalEngine with sample signals
3. [ ] Verify proposal generation latency <500ms
4. [ ] Test signal severity classification

**Sync:**
- Both track APIs should be callable with mock data
- Event shapes verified to match TimelineEvent interface
- Component tree building without errors

### Phase 2 (Week 3–4): Feature Development

**Track A:**
- [ ] Full drift overlay integration
- [ ] Health indicator real-time updates
- [ ] Correlation trace reconstruction
- [ ] Component unit tests

**Track B:**
- [ ] API endpoint implementation
- [ ] APR/ARPS/Governance bridges
- [ ] Autonomy learning loop
- [ ] Engine integration tests

**Sync:**
- Autonomy signals flow to Explorer UI via MLA
- Proposals display in UI audit view
- Test end-to-end: signal → proposal → UI

### Phase 3 (Week 5): Integration & Launch

**Both:**
- [ ] Deploy to staging
- [ ] Full E2E test
- [ ] Monitoring setup
- [ ] Documentation

---

## Success Criteria (Current)

- ✅ All scaffolds written and type-correct
- ✅ Component tree structure clear
- ⏳ Tests runnable (requires test harness setup)
- ⏳ All APIs connected (requires MemoryQueryAPI endpoint)
- ⏳ E2E flow working: events → signals → proposals → UI

---

## Questions for Next Turn

1. Where is MemoryQueryAPI deployed? (URL for ExplorerClient)
2. What test framework? (Jest, Vitest, other?)
3. Should we scaffold tests now or move to implementation?
4. Any real event data to test with, or use mocks?

---

## Coordination Notes

**Via MLA:** Track B writes AutonomySignal events → Track A displays in timeline  
**Via CKG (Phase 27):** Both feed entities/relations → synthesized reasoning  
**Via Governance (Phase 24):** High-risk proposals → Council voting → feedback loop
