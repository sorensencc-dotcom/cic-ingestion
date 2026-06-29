# Phase 4: CI Gate Rules (10 Rules)

Enforce quality gates before merge. All rules non-negotiable for production.

## Rule 1: Phase 1 MAAL Immutability (Locked)

```
CODE: P4-IMMUT-001
TRIGGER: Any file in src/core/maal/Phase1MAAL.ts, RoutingLedger.ts, PostgresLedger.ts, BridgeOrchestrator.ts
GATE: SHA256 checksum must match v0.1.0-maal-foundation
FAIL: Block merge. Requires revert + exemption PR.
PASS: Checksums verified at commit time.
```

## Rule 2: Phase 3 SPL Integration Immutability (Locked)

```
CODE: P4-IMMUT-002
TRIGGER: Any file in src/core/spl/{Shadow,Suggestion,Cohort,ABTest,Promo,Rollback}Service.ts
GATE: SHA256 checksum must match v0.3.0-spl-integration-foundation
FAIL: Block merge. Requires revert + exemption PR.
PASS: Checksums verified at commit time.
```

## Rule 3: DSL Enforcement (All Proposals Via Parser)

```
CODE: P4-SCOPE-003
TRIGGER: Commits adding/modifying proposal handling code
GATE: All proposals must be parsed via ProposalParser.parse()
VERIFY: Grep for (new Proposal\(|\.proposalId = ) outside parser
FAIL: Block merge. Use ProposalParser.
PASS: No direct Proposal instantiation found.
```

## Rule 4: Global Bounds Source Immutable

```
CODE: P4-DSL-004
TRIGGER: Any change to src/core/maal/codesign/GlobalRoutingBounds.ts
GATE: maxCostPerTask, maxLatencyPerTask must reference Phase 1 only
VERIFY: Grep for hardcoded values or calculations
FAIL: Block merge. Bounds must be imported from Phase 1.
PASS: All bounds immutable references to Phase 1.
```

## Rule 5: Validation Ceiling Enforcement

```
CODE: P4-VALIDATION-005
TRIGGER: Any delta creation or constraint proposal
GATE: Cost < 0.10, Latency < 5000ms (GLOBAL_ROUTING_BOUNDS)
VERIFY: Test suite must include test_validation_engine.ts with cost/latency ceiling tests
FAIL: Block merge. Ceiling violations must fail validation.
PASS: All ceiling tests PASS.
```

## Rule 6: Canary Telemetry Requirement

```
CODE: P4-GOVERNANCE-006
TRIGGER: Any canary execution path
GATE: Every proposal execution must log CanaryTelemetryPoint
VERIFY: CanaryTelemetryCollector.recordPoint() must be called
VERIFY: canary_gate_results table populated
FAIL: Block merge. Telemetry required for rollback decisions.
PASS: All telemetry logged to DB.
```

## Rule 7: Governance Approvals Integrity

```
CODE: P4-GOVERNANCE-007
TRIGGER: Any proposal approval/rejection decision
GATE: governance_approvals table must have entry with TTL
VERIFY: Structural changes (regime/fallback) require requiresManualApproval=true
VERIFY: Minor changes (reward/constraint/simulator) auto-approve if within caps
FAIL: Block merge. Approval logic violated.
PASS: All governance decisions properly categorized.
```

## Rule 8: Cohort Cap Enforcement

```
CODE: P4-CANARY-008
TRIGGER: Canary growth decision
GATE: cohortSize must never exceed config.cohortCapPercent
VERIFY: Test must verify cap enforcement
FAIL: Block merge. Cohort cap violation detected.
PASS: CanaryCohortController enforces cap.
```

## Rule 9: Simulator/Reward Gating

```
CODE: P4-CANARY-009
TRIGGER: Any simulator or reward delta
GATE: Delta must pass ProposalValidationEngineImpl.validateSimulatorDelta or validateRewardDelta
VERIFY: Weight bounds [0,1], state distribution normalized [±1%], threshold bounds
FAIL: Block merge. Delta validation failed.
PASS: All deltas within bounds.
```

## Rule 10: Test Suite Pass Requirement

```
CODE: P4-CANARY-010
TRIGGER: All Phase 4 commits
GATE: All tests in tests/phase4/*.ts must PASS
VERIFY: npm test -- tests/phase4/ must return exit 0
FAIL: Block merge. Tests failing.
PASS: All 28+ contracts PASS (DSL, validation, governance, canary, promotion, immutability, integration).
```

---

## Enforcement Mechanism

### Pre-commit Hook

```bash
#!/bin/bash
set -e

# Rule 1-2: Verify immutability checksums
npm run verify:immutability

# Rule 3-4: Lint for DSL enforcement
npm run lint:phase4 -- --rule P4-SCOPE-003 --rule P4-DSL-004

# Rule 5-10: Run test suite
npm test -- tests/phase4/

echo "✓ All CI gate rules PASSED"
```

### CI Pipeline (.github/workflows)

```yaml
name: Phase 4 CI Gate

on: [pull_request]

jobs:
  gates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run verify:immutability
      - run: npm run lint:phase4
      - run: npm test -- tests/phase4/ -- --coverage
```

---

## Exemption Process

Immutability rule violations (Rules 1-2) require:
1. PR explanation
2. Security team sign-off
3. Documented rationale in commit message
4. New immutability checkpoint created (v0.4.0-patch)

All other violations block merge unconditionally.
