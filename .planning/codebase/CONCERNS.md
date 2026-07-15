# CONCERNS.md — Phase 5 canary/lineage risk findings

## CRITICAL: lineage_events schema does not match code that queries it
`GovernanceReplayHarness` queries columns `event_id, proposal_id, occurred_at, metadata, from_event_id, to_event_id`:
- `src/governance/GovernanceReplayHarness.ts:22-27` (`SELECT event_id, event_type, occurred_at, metadata FROM lineage_events WHERE proposal_id = $1`)
- `src/governance/GovernanceReplayHarness.ts:51-56` (`FROM lineage_edges le WHERE le.from_event_id = $1`)

But the actual migration defines different columns entirely:
- `postgres/phase4/016_lineage_events.sql:5-15` — columns are `id (BIGSERIAL)`, `event_type`, `source_system`, `entity_id`, `entity_type`, `payload`, `recorded_at`. **No `event_id`, `proposal_id`, `occurred_at`, or `metadata` columns.**
- `postgres/phase4/017_lineage_edges.sql:4-12` — columns are `parent_event_id`, `child_event_id`. **No `from_event_id`/`to_event_id`.**

This means `GovernanceReplayHarness` would fail at runtime against the real schema. Any Phase 5 lineage hook that reuses this harness pattern must first reconcile column names, or write against `entity_id`/`entity_type`/`payload` instead.

## CRITICAL: Phase 5 has no persisted lineage hook at all
`src/tests/phase5-multicanary-ab-e2e.test.ts:721-744` ("preserves lineage: Phase 4 proposal -> Phase 5 variant -> cohorts") only asserts JS object-field equality (`assignment.variant_id === variant.variant_id`). Nothing writes to `lineage_events`, `lineage_edges`, or `audit_log`. Contrast with Phase 6's rollback lineage test (`src/tests/phase6-rollback-execution-e2e.test.ts:802`) — verify at build time whether that one persists to Postgres or is equally in-memory-only before assuming Phase 6 as a model to copy.

Mitigating factor: `postgres/phase6/002_audit_log.sql:8-12` already has `'cohort_event'` in its `event_type` CHECK constraint — the audit_log table anticipated cohort events but nothing writes them yet.

## CRITICAL: Phase 5 target classes exist only inside a test file
`MultiCohortEngine`, `ABTestEngine`, `CustomMetricsEngine`, `CohortPromotionEngine` are declared at `src/tests/phase5-multicanary-ab-e2e.test.ts:66-258`, not in `src/`. There is no production module to point a `≥85% infrastructure reuse` measurement at yet — the reuse question is really "when these are extracted into src/, how much can they import vs reimplement." See reuse table below.

## HIGH: Two parallel, incompatible Proposal types
`src/governance/proposal-creation.ts` (snake_case, used by `IngestionOrchestrator`) vs `src/core/maal/codesign/ProposalTypes.ts` (camelCase, DSL-delta-based, used by `CanaryGateOrchestrator`). Phase 5 must pick one lineage to extend — mixing produces silent field-name mismatches, not compile errors (both are duck-typed object literals in several call sites, e.g. `src/core/maal/canary/CanaryGateOrchestrator.ts:150` casts freely).

## HIGH: Nondeterministic governance decision in the middle of an otherwise-deterministic pipeline
`GovernanceEngine.review()` uses `Math.random() < 0.85` — `src/governance/governance-engine.ts:14-15`. Every other stage (`CanaryEngine`, `PromotionEngine`) is fully deterministic/simulated. Any Phase 5 E2E test chaining through `GovernanceEngine.review()` will be flaky ~15% of the time unless seeded or replaced with a mock in tests.

## MEDIUM: Duplicate/stale SQL migration files
`postgres/phase4/` has both numbered (`006_canary_gate_results.sql`) and bare (`canary_gate_results.sql`) versions of at least 8 tables (`canary_gate_results`, `canary_growth_configs`, `constraint_proposals`, `fallback_graph_proposals`, `governance_approvals`, `regime_proposals`, `reward_adjustment_proposals`, `simulator_drift_reports`). Confirm which is canonical before Phase 5 adds new migrations in this directory.

## MEDIUM: `pg` dependency undeclared in package.json
`src/governance/GovernanceEnvelopeCache.ts:1`, `src/governance/GovernanceReplayHarness.ts:1`, and `src/metrics/MetricsEngine.ts:1` all `import { Pool } from 'pg'`, but `pg` is not listed in `package.json:12-24` dependencies or devDependencies. Likely resolves as a transitive/hoisted dependency today; will break on a clean install elsewhere.

## Large files (top, this slice)
| file | lines |
|---|---|
| `src/tests/phase6-rollback-execution-e2e.test.ts` | 1019 |
| `src/tests/phase5-multicanary-ab-e2e.test.ts` | 970 |
| `src/tests/phase4-governance-e2e.test.ts` | 494 |
| `src/tests/phase3-gateway-e2e.test.ts` | 569 |
| `src/orchestrator/IngestionOrchestrator.ts` | 337 |

## Test-coverage gaps
- `src/core/maal/` has its own test dirs (`src/core/maal/__tests__` not found — only `tests/phase4/test_*.ts` at repo root cover MAAL classes) — confirm these still run under `jest.config.cjs` (root `tests/` vs `src/tests/` may need separate `testMatch` globs)
- No standalone unit test file for `GovernanceReplayHarness`, `GovernanceEnvelopeCache`, or `MetricsEngine` found under `src/` — only exercised (if at all) via e2e suites

## Infrastructure reuse estimate for Phase 5 (MultiCohortEngine / ABTestEngine / CustomMetricsEngine / CohortPromotionEngine)
| target class | closest Phase 4 analog | reuse verdict |
|---|---|---|
| `MultiCohortEngine` | `CanaryAssignmentEngine` (`src/core/maal/canary/CanaryAssignment.ts`) + `CanaryCohortController` (`src/core/maal/canary/CanaryCohortController.ts`) | HIGH reuse possible — assignment hashing + growth-curve logic already exist, just need multi-tier (10/25/50/100%) cohort table wrapping them |
| `ABTestEngine` | none found | LOW reuse — variant registry is a genuinely new concept in this codebase; only `treatment_config` free-form bag exists, no prior A/B abstraction |
| `CustomMetricsEngine` | `CanaryTelemetryCollector` (`src/core/maal/canary/CanaryTelemetry.ts`) + `MetricsEngine` (`src/metrics/MetricsEngine.ts`) | HIGH reuse possible — point recording + threshold-style aggregation patterns both exist, need genericizing to arbitrary named metrics |
| `CohortPromotionEngine` | `PromotionEngine` (`src/governance/promotion-engine.ts`) + `CanaryCohortController.decideCohortGrowth()` | HIGH reuse possible — promote/rollback/hold decision tree pattern is a near-exact match |

**Overall: the underlying decision/assignment/telemetry PRIMITIVES needed for Phase 5 already exist at ~85%+ conceptual overlap with Phase 4 (`CanaryAssignmentEngine`, `CanaryCohortController`, `CanaryTelemetryCollector`, `PromotionEngine`). The gap is that none of it is currently wired together as production Phase 5 modules — today it's reimplemented from scratch, standalone, inside the test file. Meeting the ≥85% reuse target requires the Phase 5 build to import these four Phase 4 classes rather than re-deriving their logic, and to fix the two CRITICAL lineage gaps above before claiming lineage hooks are verified.**
