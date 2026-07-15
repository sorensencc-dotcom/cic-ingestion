# ARCHITECTURE.md — Phase 3→4→5 Data Flow Trace

## Top-level layout (governance/canary slice only)
```
src/
  orchestrator/IngestionOrchestrator.ts   Phase 3: emits AuditRecord (stage 5 of pipeline)
  governance/                             Phase 4 (flat, "Wave B" implementation)
    proposal-creation.ts                    AuditRecord -> Proposal
    proposal-validator.ts                   Proposal validation
    governance-engine.ts                    approve/reject (Math.random!)
    canary-engine.ts                        CanaryResult (promote/rollback/hold)
    promotion-engine.ts                     PromotionRecord (phase_next: 4|5)
    governance-log.ts                       GovernanceLog (append-only, in-memory Map)
    GovernanceEnvelopeCache.ts               Postgres-backed envelope + lineage_depth
    GovernanceReplayHarness.ts               replay lineage_events / lineage_edges (SCHEMA MISMATCH — see CONCERNS.md)
  core/maal/                               Phase 4 (nested, "MAAL" implementation — PARALLEL to src/governance/*)
    codesign/{Proposal,ProposalTypes,ProposalParser,ProposalValidationEngine*}.ts
    canary/{CanaryAssignment,CanaryCohortController,CanaryGrowthConfig,CanaryGateOrchestrator,CanaryTelemetry}.ts
    governance/{GovernanceCaps,GovernanceDecisions,GovernanceReview}.ts
    support/{Phase4Types,Result,ValidationResult,ImmutabilityGuard}.ts
  metrics/MetricsEngine.ts                 Postgres nightly metrics (violation_rate, cohort_stability_score, ...)
  tests/
    phase3-gateway-e2e.test.ts             Phase 3 boundary tests
    phase4-governance-e2e.test.ts          Phase 3->4 lineage test (line 428)
    phase5-multicanary-ab-e2e.test.ts      Phase 5 engines defined INLINE here (not in src/ as prod code)
    phase6-rollback-execution-e2e.test.ts  Phase 6 rollback lineage
postgres/
  phase4/016_lineage_events.sql, 017_lineage_edges.sql   unified lineage graph (cols: id, event_type, source_system, entity_id, entity_type, payload, recorded_at)
  phase6/002_audit_log.sql                 hash-chained audit_log; event_type enum ALREADY includes 'cohort_event' (line 11)
```

## THE DATA FLOW TRACE (Phase 3 audit record -> Phase 4 proposal -> Phase 5 variant -> Phase 5 cohort)

| step | producer | shape | consumer | citation |
|---|---|---|---|---|
| 1. Audit record | `IngestionOrchestrator._orchestratePipeline()` stage 5 | `AuditRecord {profile, lane, orchestration_cost, entry_id, created_at}` | `ProposalCreation.fromAuditRecord()` | `src/orchestrator/IngestionOrchestrator.ts:142-150`, type def `src/governance/proposal-creation.ts:7-13` |
| 2. Proposal (governance flavor) | `ProposalCreation.fromAuditRecord()` | `Proposal {proposal_id (uuid), source_entry_id, profile, lane, orchestration_cost, created_at, version}` | `ProposalValidator.validate()`, `GovernanceEngine.review()`, `CanaryEngine.execute()`, `PromotionEngine.decide()` | `src/governance/proposal-creation.ts:44-54`, `src/governance/proposal-validator.ts:1-9` |
| 2b. Proposal (MAAL flavor, PARALLEL type) | `ProposalBuilder` / DSL parser | `Proposal {proposalId, submittedBy, deltas[], rationale, submittedAt, targetRegime?}` — **different shape, different field casing (camelCase vs snake_case) than governance Proposal** | `ProposalValidationEngine`, `CanaryGateOrchestrator.execute()` | `src/core/maal/codesign/ProposalTypes.ts:67-74`, `src/core/maal/canary/CanaryGateOrchestrator.ts:91` |
| 3. Promotion decision | `PromotionEngine.decide()` | `PromotionRecord {proposal_id, decision: promote\|rollback\|hold, phase_next: 4\|5, recorded_at}` | Phase 5 cohort assignment (manual glue in test only) | `src/governance/promotion-engine.ts:36-46` |
| 4. Phase 5 variant | `ABTestEngine.registerVariant()` — **test-file-local class, no src/ production module** | `ABVariant {variant_id, name, description, treatment_config}` | `MultiCohortEngine.assignCohort()` | `src/tests/phase5-multicanary-ab-e2e.test.ts:110-129` (class), `:721-744` (lineage test) |
| 5. Phase 5 cohort assignment | `MultiCohortEngine.assignCohort()` — **test-file-local class** | `CohortAssignment {proposal_id, variant_id, cohort_id, cohort_size, assigned_at}` | `CustomMetricsEngine.recordObservation()`, `CohortPromotionEngine.evaluatePromotion()` | `src/tests/phase5-multicanary-ab-e2e.test.ts:66-107` |
| 6. Cohort decision | `CohortPromotionEngine.evaluatePromotion()` — **test-file-local class** | `CohortDecision {proposal_id, variant_id, current_cohort, next_cohort?, decision, reason, recommendation}` | (no downstream consumer — pipeline ends in test assertions) | `src/tests/phase5-multicanary-ab-e2e.test.ts:213-257` |

**Key architectural fact: Phase 5's four target classes (`MultiCohortEngine`, `ABTestEngine`, `CustomMetricsEngine`, `CohortPromotionEngine`) exist ONLY as classes declared inside `src/tests/phase5-multicanary-ab-e2e.test.ts:66-258`. There is no `src/phase5/` or equivalent production module. Building Phase 5 for real means extracting these four classes out of the test file into production modules, importing the real Phase 4 types (`src/governance/proposal-creation.ts` `Proposal`, `src/governance/promotion-engine.ts` `PromotionRecord`) instead of the test's local re-declarations.**

## Layer responsibilities
| layer | dir | owns | depends_on |
|---|---|---|---|
| Ingestion (Phase 3) | `src/orchestrator/`, `src/ingestion/` | AuditRecord emission | none (upstream boundary) |
| Governance (Phase 4, flat) | `src/governance/` | Proposal validation/approval/canary/promotion, in-memory `GovernanceLog` | `pg` (envelope cache, replay harness only) |
| Governance (Phase 4, MAAL) | `src/core/maal/` | DSL proposal parsing, canary cohort growth curves, rollback state machine | `src/core/maal/support/Result.ts` |
| Metrics | `src/metrics/MetricsEngine.ts` | nightly aggregate SQL over `audit_log`, `canary_state_history`, `governance_envelope` | `pg` |
| Lineage/audit persistence | `postgres/phase4/016-017*.sql`, `postgres/phase6/002_audit_log.sql` | append-only immutable tables | Postgres triggers (`*_immutable()`) |
| Phase 5 (target) | **none yet** — only `src/tests/phase5-multicanary-ab-e2e.test.ts` | cohort/variant/metrics/promotion engines | should depend on `src/governance/*` types, not redeclare them |

## Module boundaries — what crosses, what doesn't
- `src/governance/*` and `src/core/maal/*` are TWO INDEPENDENT Phase 4 implementations with incompatible `Proposal` shapes (snake_case vs camelCase). Neither imports the other. `src/core/maal/BridgeOrchestrator.ts` is the only file referencing both trees — worth checking before Phase 5 picks an integration side.
- Postgres access is confined to classes taking `Pool` in their constructor (`GovernanceEnvelopeCache`, `GovernanceReplayHarness`, `MetricsEngine`) — everything else (`GovernanceLog`, `CanaryEngine`, `PromotionEngine`, `GovernanceEngine`) is pure in-memory/no persistence.
- **No Phase 5 code currently writes to `lineage_events`, `lineage_edges`, or `audit_log`** — all Phase 5 lineage is asserted via JS object identity in test assertions only (`expect(assignment.variant_id).toBe(variant.variant_id)` etc.), not via a persisted audit trail.

## Cross-cutting concerns
- Logging: `log()` helper — `src/orchestrator/IngestionOrchestrator.ts:151` (also `src/lib/log.ts`, `src/utils/logger.ts` — two logger modules)
- Validation: `ProposalValidator.validate()` (governance flavor) — `src/governance/proposal-validator.ts:18`; `ProposalValidationEngine` (MAAL flavor) — `src/core/maal/codesign/ProposalValidationEngine.ts`
- Immutability: `Object.freeze()` in `GovernanceLog.record()` — `src/governance/governance-log.ts:52-56`; Postgres-level via `*_immutable()` trigger functions — `postgres/phase6/002_audit_log.sql:33-43`
- Caching: 500ms TTL governance-context cache — `src/core/maal/canary/CanaryGateOrchestrator.ts:56-57`
