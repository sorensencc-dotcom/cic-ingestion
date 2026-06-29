# Phase 4: Lint Rules (24 Rules)

Enforce code style, immutability, and DSL compliance. Format: `P4-<CATEGORY>-<RULE_ID>`.

## Category 1: Immutability (IMMUT)

### P4-IMMUT-001: No Phase 1 File Modifications

```
PATTERN: src/core/maal/Phase1*.ts, *Ledger.ts, *Bridge*.ts
RULE: File content must match frozen checksum
SEVERITY: BLOCK
MESSAGE: Phase 1 files immutable. {file}:{line} modifies {symbol}
FIX: Revert change or increment version to v0.4.1
```

### P4-IMMUT-002: No Phase 3 File Modifications

```
PATTERN: src/core/spl/*.ts
RULE: File content must match frozen checksum
SEVERITY: BLOCK
MESSAGE: Phase 3 files immutable. {file}:{line} modifies {symbol}
FIX: Revert change or increment version to v0.4.1
```

### P4-IMMUT-003: Append-Only Tables Only

```
PATTERN: postgres/phase4/*.sql
RULE: No UPDATE/DELETE statements; only CREATE/INSERT
SEVERITY: WARN
MESSAGE: {table} uses UPDATE/DELETE. Must be append-only.
FIX: Ensure DB trigger prevents mutation.
```

---

## Category 2: Scope (SCOPE)

### P4-SCOPE-004: DSL Parser Monopoly

```
PATTERN: src/**/*.ts (exclude tests)
RULE: All Proposal creation must use ProposalParser.parse()
DETECT: new Proposal(, {type: 'regime'} outside parseDelta
SEVERITY: WARN
MESSAGE: Direct Proposal instantiation at {file}:{line}. Use ProposalParser.
FIX: Refactor to parser.parse(dslText)
```

### P4-SCOPE-005: Governance Caps Immutable

```
PATTERN: src/core/maal/governance/GovernanceCaps.ts
RULE: DEFAULT_GOVERNANCE_CAPS exported as const (not mutable)
DETECT: let DEFAULT_GOVERNANCE_CAPS, DEFAULT_GOVERNANCE_CAPS.field =
SEVERITY: WARN
MESSAGE: Caps must be immutable. Use const.
FIX: Change to const; if needing override, use factory function.
```

### P4-SCOPE-006: Global Bounds Import-Only

```
PATTERN: src/core/maal/codesign/GlobalRoutingBounds.ts
RULE: No local hardcoding; must import from Phase 1
DETECT: maxCostPerTask = [0-9], maxLatencyPerTask = [0-9]
SEVERITY: WARN
MESSAGE: Hardcoded bound at {file}:{line}. Import from Phase 1.
FIX: import GLOBAL_ROUTING_BOUNDS from Phase1MAAL
```

### P4-SCOPE-007: Canary Config Store Only

```
PATTERN: src/core/maal/canary/CanaryGrowthConfig.ts
RULE: CanaryGrowthConfigStore used for persistence (not direct writes)
DETECT: canaryGrowthConfigs\[, INSERT INTO canary_growth_configs (outside store)
SEVERITY: WARN
MESSAGE: Direct canary config mutation at {file}:{line}. Use CanaryGrowthConfigStore.
FIX: Refactor to store.append(config)
```

---

## Category 3: DSL Validation (DSL)

### P4-DSL-008: Required Fields Present

```
PATTERN: src/core/maal/codesign/ProposalParser.ts
RULE: All parse() calls check proposalId, submittedBy, deltas
DETECT: Missing !parsed.proposalId, !parsed.submittedBy, !Array.isArray(deltas)
SEVERITY: WARN
MESSAGE: Missing required field check at {file}:{line}
FIX: Add validation in parser.parse()
```

### P4-DSL-009: Forbidden Fields Blocked

```
PATTERN: All proposal code
RULE: No __internal, __maal_bypass, __phase1_direct in deltas
DETECT: /__internal|__maal_bypass|__phase1_direct/
SEVERITY: BLOCK
MESSAGE: Forbidden bypass field at {file}:{line}
FIX: Remove forbidden field; submit via DSL parser only
```

### P4-DSL-010: Delta Type Enum Exhaustive

```
PATTERN: src/core/maal/codesign/ProposalTypes.ts
RULE: ProposalDelta.type must be 'regime' | 'constraint' | 'fallback' | 'reward' | 'simulator'
DETECT: type: string (without literal enum)
SEVERITY: WARN
MESSAGE: Non-exhaustive delta type at {file}:{line}
FIX: Use type: 'regime' | 'constraint' | ... (literal union)
```

### P4-DSL-011: Weight Bounds [0,1]

```
PATTERN: All weight/threshold fields
RULE: weight, threshold must be in [0, 1]
DETECT: weight: number where number < 0 or number > 1
SEVERITY: WARN
MESSAGE: Weight out of bounds at {file}:{line}: {value}
FIX: Clamp to [0, 1] or reject in validator
```

---

## Category 4: Validation (VALIDATION)

### P4-VALIDATION-012: Cost Ceiling Checked

```
PATTERN: src/core/maal/codesign/ProposalValidationEngineImpl.ts validateConstraintDelta
RULE: bounds.max vs GLOBAL_ROUTING_BOUNDS.maxCostPerTask
DETECT: Missing check || value > GLOBAL_ROUTING_BOUNDS.maxCostPerTask
SEVERITY: WARN
MESSAGE: Cost ceiling not enforced at {file}:{line}
FIX: Add builder.addError(...EXCEEDS_GLOBAL_COST_CEILING)
```

### P4-VALIDATION-013: Latency Ceiling Checked

```
PATTERN: src/core/maal/codesign/ProposalValidationEngineImpl.ts validateConstraintDelta
RULE: bounds.max vs GLOBAL_ROUTING_BOUNDS.maxLatencyPerTask
DETECT: Missing check || value > GLOBAL_ROUTING_BOUNDS.maxLatencyPerTask
SEVERITY: WARN
MESSAGE: Latency ceiling not enforced at {file}:{line}
FIX: Add builder.addError(...EXCEEDS_GLOBAL_LATENCY_CEILING)
```

### P4-VALIDATION-014: Reward Weight Bounds

```
PATTERN: validateRewardDelta
RULE: weight in [0, 1], threshold in [0, 1]
DETECT: Missing bounds check or improper range
SEVERITY: WARN
MESSAGE: Reward weight/threshold not validated at {file}:{line}
FIX: Add builder.addError(...OUT_OF_RANGE) for violations
```

### P4-VALIDATION-015: Simulator State Distribution Normalized

```
PATTERN: validateSimulatorDelta
RULE: stateDistribution values sum to 1.0 (±1% tolerance)
DETECT: Missing sum check || Math.abs(sum - 1.0) > 0.01
SEVERITY: WARN
MESSAGE: State distribution not normalized at {file}:{line}
FIX: Add warning or error for non-normalized distribution
```

---

## Category 5: Governance (GOVERNANCE)

### P4-GOVERNANCE-016: Structural Change Detection

```
PATTERN: GovernanceReview.ts
RULE: regime | fallback deltas → requiresManualApproval = true
DETECT: Missing check for delta.type === 'regime' or 'fallback'
SEVERITY: WARN
MESSAGE: Structural change not marked for manual approval at {file}:{line}
FIX: Add delta.type check → return {requiresManualApproval: true}
```

### P4-GOVERNANCE-017: Delta Magnitude Estimation

```
PATTERN: GovernanceReview.estimateMagnitude()
RULE: All delta types have magnitude estimate (reward: |weight - 0.5| * 2, constraint: 0.3, etc.)
DETECT: Missing case || default: return 0
SEVERITY: WARN
MESSAGE: Delta type not estimated at {file}:{line}
FIX: Add case for delta type with magnitude formula
```

### P4-GOVERNANCE-018: Caps Enforcement

```
PATTERN: GovernanceReview.checkCaps()
RULE: magnitude <= DEFAULT_GOVERNANCE_CAPS.maxDeltaMagnitude
DETECT: Missing check || !checkCaps()
SEVERITY: WARN
MESSAGE: Caps not enforced at {file}:{line}
FIX: Ensure all deltas checked against caps
```

### P4-GOVERNANCE-019: Auto-Approve Flag Respected

```
PATTERN: GovernanceReview.review()
RULE: If autoApproveMinorDeltas=true && minor && within caps → approved=true
DETECT: Missing caps.autoApproveMinorDeltas check
SEVERITY: WARN
MESSAGE: Auto-approval flag not respected at {file}:{line}
FIX: Add check: if (this.caps.autoApproveMinorDeltas)
```

---

## Category 6: Canary (CANARY)

### P4-CANARY-020: Cohort Cap Enforced

```
PATTERN: CanaryCohortController.decideCohortGrowth()
RULE: newSize <= config.cohortCapPercent
DETECT: newSize > cohortCapPercent
SEVERITY: WARN
MESSAGE: Cohort exceeds cap at {file}:{line}: {newSize} > {cap}
FIX: Add Math.min(newSize, config.cohortCapPercent)
```

### P4-CANARY-021: Hard Violation Detection

```
PATTERN: decideCohortGrowth
RULE: success_rate < minSuccessRate || drift_score > maxDriftScore → rollback_hard
DETECT: Missing checks
SEVERITY: WARN
MESSAGE: Hard violation not detected at {file}:{line}
FIX: Add checks for success_rate and drift_score
```

### P4-CANARY-022: Soft Violation Pause (No Rollback)

```
PATTERN: decideCohortGrowth
RULE: costDelta || latencyDelta → pause (not rollback)
DETECT: soft violations trigger rollback_hard
SEVERITY: WARN
MESSAGE: Soft violation incorrectly triggers rollback at {file}:{line}
FIX: Soft violations should return action: 'pause'
```

### P4-CANARY-023: Rollback Idempotency

```
PATTERN: CanaryGateOrchestrator.rollback()
RULE: Retry up to maxRollbackRetries (3) before escalate
DETECT: Missing retry loop || retryCount > maxRollbackRetries
SEVERITY: WARN
MESSAGE: Rollback not idempotent at {file}:{line}
FIX: Add retry state machine (ROLLBACK_RETRY → ROLLBACK_ESCALATE)
```

### P4-CANARY-024: Telemetry Logged

```
PATTERN: CanaryTelemetryCollector.recordPoint()
RULE: Every proposal execution logs CanaryTelemetryPoint
DETECT: Missing recordPoint() call in execute()
SEVERITY: WARN
MESSAGE: Telemetry not logged at {file}:{line}
FIX: Call this.telemetryCollector.recordPoint({...})
```

---

## Enforcement

### ESLint Custom Plugin

```javascript
// eslint-plugin-phase4.js
module.exports = {
  rules: {
    'immut-phase1': require('./rules/P4-IMMUT-001'),
    'immut-phase3': require('./rules/P4-IMMUT-002'),
    'dsl-parser-monopoly': require('./rules/P4-SCOPE-004'),
    'forbidden-fields': require('./rules/P4-DSL-009'),
    'cost-ceiling': require('./rules/P4-VALIDATION-012'),
    'latency-ceiling': require('./rules/P4-VALIDATION-013'),
    'structural-approval': require('./rules/P4-GOVERNANCE-016'),
    'cohort-cap-enforced': require('./rules/P4-CANARY-020'),
    'hard-violation-detect': require('./rules/P4-CANARY-021'),
    'telemetry-logged': require('./rules/P4-CANARY-024'),
  }
};
```

### ESLintConfig

```json
{
  "extends": ["eslint:recommended", "plugin:typescript-eslint/recommended"],
  "plugins": ["phase4"],
  "rules": {
    "phase4/immut-phase1": "error",
    "phase4/immut-phase3": "error",
    "phase4/dsl-parser-monopoly": "warn",
    "phase4/forbidden-fields": "error",
    "phase4/cost-ceiling": "warn",
    "phase4/latency-ceiling": "warn",
    "phase4/structural-approval": "warn",
    "phase4/cohort-cap-enforced": "warn",
    "phase4/hard-violation-detect": "warn",
    "phase4/telemetry-logged": "warn"
  }
}
```

---

## Summary

- 24 rules across 6 categories
- 4 BLOCK-severity (immutability, forbidden fields)
- 20 WARN-severity (style, completeness)
- Enforced via pre-commit + CI pipeline
- All rules documented with DETECT pattern, FIX recommendation
