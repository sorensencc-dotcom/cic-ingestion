# ENTRY-POINTS.md — Phase 5 target classes + surrounding infra

## Phase 5 target classes (current location — ALL test-file-local, no CLI/server entry)
| class | current file | citation | production module? |
|---|---|---|---|
| `MultiCohortEngine` | `src/tests/phase5-multicanary-ab-e2e.test.ts` | `:66-108` | NO — must be extracted to e.g. `src/governance/multi-cohort-engine.ts` |
| `ABTestEngine` | `src/tests/phase5-multicanary-ab-e2e.test.ts` | `:110-129` | NO — extract to `src/governance/ab-test-engine.ts` |
| `CustomMetricsEngine` | `src/tests/phase5-multicanary-ab-e2e.test.ts` | `:131-211` | NO — extract to `src/governance/custom-metrics-engine.ts` (or fold into `src/metrics/MetricsEngine.ts`) |
| `CohortPromotionEngine` | `src/tests/phase5-multicanary-ab-e2e.test.ts` | `:213-258` | NO — extract to `src/governance/cohort-promotion-engine.ts`, should import `PromotionRecord` from `src/governance/promotion-engine.ts:8-13` rather than redefine `CohortDecision` from scratch |

## Phase 4 infra these should reuse (existing production modules)
| module | file | reusable capability |
|---|---|---|
| `ProposalCreation` | `src/governance/proposal-creation.ts:36-74` | Phase 3 AuditRecord -> Proposal, UUID generation, lineage preservation pattern |
| `CanaryAssignmentEngine` | `src/core/maal/canary/CanaryAssignment.ts:13-41` | deterministic hash-based cohort assignment — directly analogous to `MultiCohortEngine.assignCohort()` |
| `CanaryCohortController` | `src/core/maal/canary/CanaryCohortController.ts:24-136` | grow/pause/rollback decision logic — directly analogous to `CohortPromotionEngine.evaluatePromotion()` |
| `CanaryTelemetryCollector` | `src/core/maal/canary/CanaryTelemetry.ts:36-54` | point-in-time metric recording — directly analogous to `CustomMetricsEngine.recordObservation()` |
| `PromotionEngine` | `src/governance/promotion-engine.ts:29-151` | threshold-based promote/rollback/hold decision, `phase_next` field already models Phase 4->5 handoff |
| `GovernanceLog` | `src/governance/governance-log.ts:42-146` | append-only, immutable, O(1) lookup pattern — template for a `CohortLog` |
| `MetricsEngine` | `src/metrics/MetricsEngine.ts:30-141` | nightly SQL aggregation pattern over `audit_log` — `computeCohortStabilityScore()` (line 89) already reads `canary_state_history.metadata->>'cohort_id'`, meaning cohort_id is already a first-class concept in Postgres |
| `audit_log` table | `postgres/phase6/002_audit_log.sql:8-12` | `event_type` enum ALREADY includes `'cohort_event'` — Phase 5 can write into this table without a migration |

## Test entry points
| command | config | covers |
|---|---|---|
| `npm test` | `package.json:9` (`npx jest`), config `jest.config.cjs:1` | all `*.test.ts` |
| Phase 5 E2E suite | `src/tests/phase5-multicanary-ab-e2e.test.ts` (970 lines) | full rollout pipeline: cohort allocation -> variant tracking -> metrics -> promotion -> Phase 4->5 integration -> lineage -> batch rollout |
| Phase 4 E2E suite | `src/tests/phase4-governance-e2e.test.ts` (494 lines) | includes the Phase 3->4 lineage test at `:428-453` that Phase 5's lineage test (`:721-744`) mirrors |
| Legacy Phase 4 unit tests | `tests/phase4/test_canary_execution.ts`, `test_promotion.ts`, `test_governance.ts`, `test_immutability.ts`, `test_integration.ts`, `test_dsl_validity.ts`, `test_validation_engine.ts` | MAAL-tree specific, separate from `src/tests/`  |

## Build/dev commands
- Build: `npm run build` -> `tsc --project tsconfig.json` — `package.json:8`
- Start (compiled): `npm start` -> `node dist/index.js` — `package.json:10`
- No dedicated "dev" watch script defined in `package.json`

## No MCP server / CLI binary found in this slice
- `bin/` directory exists at repo root but is unrelated to Phase 3-5 governance (not explored further per scope)
