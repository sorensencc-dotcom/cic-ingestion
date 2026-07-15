# CONVENTIONS.md — governance/canary slice

## File naming
- Governance flat modules: `<noun>-<role>.ts` — `proposal-creation.ts`, `proposal-validator.ts`, `canary-engine.ts`, `promotion-engine.ts`, `governance-log.ts`
- MAAL nested modules: `PascalCase.ts` per class — `CanaryCohortController.ts`, `CanaryGateOrchestrator.ts`, `ProposalValidationEngineImpl.ts`
- E2E tests: `phase<N>-<slice>-e2e.test.ts` — `phase3-gateway-e2e.test.ts`, `phase4-governance-e2e.test.ts`, `phase5-multicanary-ab-e2e.test.ts`, `phase6-rollback-execution-e2e.test.ts` — all live in `src/tests/`
- Legacy numbered SQL: `postgres/phase4/NNN_<table>.sql` (e.g. `016_lineage_events.sql`) plus duplicate un-numbered copies of the same table name (`postgres/phase4/canary_gate_results.sql` alongside `006_canary_gate_results.sql`) — pick the numbered file as canonical, the bare one looks stale.

## Type naming
- snake_case field names in `src/governance/*` types (`proposal_id`, `orchestration_cost`, `created_at`) — matches Postgres column convention
- camelCase field names in `src/core/maal/*` types (`proposalId`, `submittedBy`, `submittedAt`) — matches idiomatic TS convention
- **These two conventions coexist and do not interop without a mapping layer** — any Phase 5 code touching both trees needs an explicit adapter, not a cast.

## Interfaces vs classes
- Data shape = `interface` (e.g. `Proposal`, `CanaryResult`, `PromotionRecord`, `CohortConfig`)
- Behavior = `class` with a single dominant public method (`.execute()`, `.decide()`, `.review()`, `.validate()`, `.evaluatePromotion()`)
- `@deprecated` JSDoc tag used to mark superseded interfaces still kept for backward compat — `src/governance/canary-engine.ts:20` (`CanaryMetrics`), `src/governance/promotion-engine.ts:18` (`PromotionDecision`)

## Error handling pattern
- `Result<T, E>` discriminated union (`Ok`/`Err` classes) used in MAAL tree — `src/core/maal/support/Result.ts`, consumed at `src/core/maal/canary/CanaryGateOrchestrator.ts:91,171,183`
- Flat governance tree uses plain return values + `errors: string[]` arrays instead of `Result<>` — `src/governance/proposal-validator.ts:11-15` (`ValidationResult`). No shared error convention across the two trees.
- try/catch with typed error code objects (`{code, message}`) — `src/core/maal/canary/CanaryGateOrchestrator.ts:182-187,235-248`

## Comment style
- File-header JSDoc block explaining phase + responsibility — every governance/canary file opens with `/** Phase 4: ... */` — e.g. `src/core/maal/canary/CanaryCohortController.ts:1-4`
- Inline `// TODO:` markers for unimplemented persistence hooks — `src/core/maal/canary/CanaryGateOrchestrator.ts:220,224,228` (rollback logging not yet wired to Postgres)

## Determinism
- Test-oriented classes hardcode deterministic simulated values (`simulateErrorRate()` always returns `0.01`) — `src/governance/canary-engine.ts:73-76`
- **Exception: `GovernanceEngine.review()` uses `Math.random()` for the approve/reject decision** — `src/governance/governance-engine.ts:14-15` — inconsistent with the rest of the deterministic-canary convention; will make Phase 5 E2E tests that chain through it flaky unless seeded or mocked.
