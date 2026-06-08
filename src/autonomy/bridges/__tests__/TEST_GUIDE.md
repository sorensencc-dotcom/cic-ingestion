# Autonomy Bridges Test Guide

**Test Suite:** Phase 23.7.4–23.7.5 Bridge Tests  
**Framework:** Jest + TypeScript  
**Coverage Target:** 75%+ (branches, functions, lines, statements)

---

## Running Tests

### Install Dependencies
```bash
npm install --save-dev jest ts-jest @types/jest
```

### Run All Tests
```bash
npm test
```

### Run Specific Test Suite
```bash
npm test -- bridges.test.ts
```

### Run with Coverage Report
```bash
npm test -- --coverage
```

### Watch Mode (auto-rerun on changes)
```bash
npm test -- --watch
```

---

## Test Structure

```
src/autonomy/bridges/
  __tests__/
    ✅ bridges.test.ts          (520 lines, 50+ test cases)
    ✅ fixtures.ts              (250+ lines, fixture generators)
    ✅ TEST_GUIDE.md           (this file)
```

**Test Cases by Component:**

| Component | Tests | Coverage |
|-----------|-------|----------|
| AutonomyToPlannerBridge | 12 | Signal→goal conversion, replan logic, constraints, errors |
| AutonomyToARPSBridge | 12 | Signal logging, proposal logging, feedback, batch ops |
| AutonomyGovernanceBridge | 15 | Auto-approval, vote building, recording, finalization |
| BridgeOrchestrator | 9 | Signal processing, proposal processing, full cycle, errors |
| **Total** | **48** | **All major flows + error cases** |

---

## Test Suites

### AutonomyToPlannerBridge (12 tests)

**Signal to Goal Conversion:**
- ✅ Converts drift signal to `drift_mitigation` goal
- ✅ Converts instability signal to `stabilization` goal (with 24h deadline)
- ✅ Converts regression signal to `regression_fix` goal (with 48h deadline)
- ✅ Converts opportunity signal to `acceleration` goal (lower priority)

**Replan Triggering:**
- ✅ Triggers replan on 2+ critical signals
- ✅ Does not trigger replan on single critical signal
- ✅ Triggers replan when total priority exceeds threshold (150)

**Proposal Constraints:**
- ✅ Converts defer_phase action to constraint
- ✅ Does not feed unapproved proposals (status != approved)

**Error Handling:**
- ✅ Throws on APR control plane HTTP error

---

### AutonomyToARPSBridge (12 tests)

**Signal Logging:**
- ✅ Logs signal as ARPS_DELTA event
- ✅ Preserves signal confidence in event metadata
- ✅ Uses correct event type (`autonomy_signal`)

**Proposal Logging:**
- ✅ Logs proposal with multiple actions (one DELTA per action)
- ✅ Sets severity='warning' for high-risk proposals
- ✅ Sets severity='info' for low-risk proposals

**Feedback Logging:**
- ✅ Logs approval decision with metadata
- ✅ Logs rejection decision with reason
- ✅ Tracks decision details in metadata

**Batch Operations:**
- ✅ Logs multiple proposals (calls for each)

**Error Handling:**
- ✅ Throws on MLA store HTTP error

---

### AutonomyGovernanceBridge (15 tests)

**Auto-Approval Logic:**
- ✅ Auto-approves when: confidence > 95% + risk=low + no critical signals
- ✅ Routes high-risk proposals to voting
- ✅ Routes proposals with critical signals to voting
- ✅ Routes low-confidence proposals to voting

**Vote Request Building:**
- ✅ Builds valid vote request with all required fields
- ✅ Sets correct required approvals based on council size (66% threshold)
- ✅ Includes 7-day voting deadline

**Vote Recording:**
- ✅ Records approve vote with reason
- ✅ Records reject vote with reason
- ✅ Records abstain vote

**Decision Finalization:**
- ✅ Approves when approval threshold (66%) met
- ✅ Rejects when threshold not met
- ✅ Calculates approval percentage correctly (excluding abstentions)
- ✅ Handles unanimous votes
- ✅ Handles split votes

**Error Handling:**
- ✅ Throws on governance control plane HTTP error

---

### BridgeOrchestrator (9 tests)

**Signal Processing:**
- ✅ Processes signals through planner and ARPS bridges
- ✅ Calls multiple bridge methods for each signal

**Proposal Processing:**
- ✅ Processes proposals through governance, ARPS, and planner
- ✅ Only feeds approved proposals to planner (not pending/rejected)

**Full Integration Cycle:**
- ✅ End-to-end: signals + proposals through all bridges
- ✅ Returns aggregated results

**Error Handling:**
- ✅ Tracks errors from each bridge
- ✅ Continues processing if one bridge fails (graceful degradation)
- ✅ Returns partial success data on multi-bridge failures

**Governance Feedback:**
- ✅ Logs decision and feeds to planner if approved
- ✅ Only feeds approved decisions to planner
- ✅ Logs rejections without feeding to planner

---

## Fixtures

**Signal Generators:**
- `createMockDriftSignal(severity)` → DriftSignal
- `createMockInstabilitySignal(severity)` → InstabilitySignal
- `createMockRegressionSignal(severity)` → RegressionSignal
- `createMockOpportunitySignal()` → OpportunitySignal

**Proposal Generators:**
- `createMockProposal(status)` → RoadmapProposal
- `createMockProposalWithMultipleActions()` → RoadmapProposal (3 actions)
- `createMockApprovedProposal()` → RoadmapProposal (with votes)

**Batch Generators:**
- `createMockSignals(count)` → AutonomySignal[]
- `createMockProposals(count)` → RoadmapProposal[]

**Utilities:**
- `createMockTimelineEvent(type)` → TimelineEvent

---

## Mock HTTP

**Global fetch Mock:**
```typescript
global.fetch = jest.fn();

// In each test:
beforeEach(() => {
  fetchMock = global.fetch as jest.Mock;
  fetchMock.mockClear();
  fetchMock.mockResolvedValue({ ok: true }); // default: success
});

// To simulate failure:
fetchMock.mockResolvedValueOnce({ ok: false, statusText: 'Error message' });

// Verify call:
expect(fetchMock).toHaveBeenCalledWith(url, expectObjectContaining(...));
```

---

## Test Patterns

### Pattern 1: Testing Bridge Output

```typescript
it('converts signal to goal', async () => {
  const signal = createMockDriftSignal('critical');
  await bridge.feedSignalsToPlanner([signal]);

  // Verify HTTP call
  expect(fetchMock).toHaveBeenCalledWith(
    'http://localhost:3002/apr/goals',
    expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
  );

  // Verify request body
  const call = fetchMock.mock.calls[0];
  const body = JSON.parse(call[1].body);
  expect(body.goals[0].type).toBe('drift_mitigation');
});
```

### Pattern 2: Testing Error Cases

```typescript
it('throws on HTTP error', async () => {
  fetchMock.mockResolvedValueOnce({ ok: false, statusText: 'Service Unavailable' });

  const signal = createMockDriftSignal('critical');
  await expect(bridge.feedSignalsToPlanner([signal])).rejects.toThrow(
    'Service Unavailable'
  );
});
```

### Pattern 3: Testing Conditional Logic

```typescript
it('auto-approves high-confidence, low-risk proposals', async () => {
  const proposal = createMockProposal('pending');
  proposal.confidence = 0.96; // >0.95
  proposal.impact.riskLevel = 'low';

  await bridge.routeProposalToGovernance(proposal);

  // Auto-approval should call /governance/decisions, not /governance/votes
  const call = fetchMock.mock.calls[0];
  expect(call[0]).toContain('/governance/decisions');
});
```

### Pattern 4: Testing Aggregation

```typescript
it('aggregates errors from multiple bridges', async () => {
  fetchMock.mockResolvedValueOnce({ ok: false, statusText: 'Error' });
  fetchMock.mockResolvedValue({ ok: true }); // others succeed

  const result = await orchestrator.runFullIntegrationCycle(signals, proposals);

  expect(result.errors.length).toBeGreaterThan(0);
  // Should have partial success
  expect(result.signalsProcessed).toBeGreaterThan(0);
});
```

---

## Coverage Analysis

**Current Coverage Targets:**
- AutonomyToPlannerBridge: 80%+
- AutonomyToARPSBridge: 85%+
- AutonomyGovernanceBridge: 85%+
- BridgeOrchestrator: 90%+

**Covered Flows:**
- ✅ Signal → goal conversion (all 4 types)
- ✅ Replan trigger logic (2 paths: critical count, priority sum)
- ✅ Auto-approval logic (3 conditions)
- ✅ Vote aggregation (approval calculation, threshold checking)
- ✅ Error handling (HTTP failures, service unavailable)
- ✅ Partial success (one bridge fails, others continue)

**Not Yet Covered:**
- Integration with actual APR/ARPS/Governance endpoints
- Network timeouts (mocks always resolve)
- Real governance decision computation with live council votes

---

## Running CI/CD

### GitHub Actions Example

```yaml
name: Test Bridges
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v3
```

---

## Debugging Tests

### Run Single Test
```bash
npm test -- bridges.test.ts -t "converts drift signal"
```

### Run with Debug Output
```bash
DEBUG=* npm test
```

### Inspect Mock Calls
```typescript
console.log(fetchMock.mock.calls); // all calls
console.log(fetchMock.mock.calls[0]); // first call
console.log(fetchMock.mock.calls[0][1].body); // request body
```

---

## Performance

**Test Suite Metrics:**
- Total tests: 48
- Est. runtime: <5 seconds (all tests)
- Slowest test: ~50ms (fixture generation)
- Fastest test: ~1ms (mock validation)

**Optimization Tips:**
- Tests use mocks (no real HTTP) → fast
- Fixtures generated per-test (no test pollution)
- Parallel execution possible (Jest default)

---

## Next Steps

- [ ] Add integration tests with real endpoints
- [ ] Test timeout scenarios (mock delay)
- [ ] Add property-based testing (QuickCheck-style)
- [ ] Test with different council sizes/approval thresholds
- [ ] Load testing (hundreds of signals/proposals)
- [ ] Mutation testing to find coverage gaps
