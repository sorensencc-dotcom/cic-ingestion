# Pattern Map — Phase 5 (Multi-Cohort Canary + A/B Testing)

Source: Phase 4 governance pipeline (`src/governance/`, `src/core/maal/canary/`, `src/core/maal/governance/`).
Target: Phase 5 components per `docs/meta/5-ijfw-plan-phase-5-multicanary.md` Wave A
(MultiCohortEngine, ABTestEngine, CustomMetricsEngine, CohortPromotionEngine) and the
existing skeleton at `src/tests/phase5-multicanary-ab-e2e.test.ts`.

| new_file | closest_analog | reason | key_shape_to_match |
|---|---|---|---|
| `src/governance/custom-metrics-engine.ts` (CustomMetricsEngine.evaluateThreshold / allMetricsPass) | `src/governance/canary-engine.ts:103-124` `CanaryEngine.determineDecision()` | same role: metrics → binary pass/fail gate before a promote/rollback decision | private fn, 3 threshold checks ANDed, returns enum |
| `src/governance/cohort-promotion-engine.ts` (CohortPromotionEngine.evaluatePromotion) | `src/governance/promotion-engine.ts:36-96` `PromotionEngine.decide()` / `evaluateMetrics()` | same role: takes a metrics-pass verdict + threshold table, emits promote/rollback/hold record | fail-fast rollback check first, then promote check, else hold |
| `src/governance/ab-test-engine.ts` (ABTestEngine.createDecisionTree) | `src/core/maal/governance/GovernanceReview.ts:41-88` `GovernanceReview.review()` | same role: chained early-return branches turning a request into an approval/rejection decision | ordered if-return chain, each branch names its reason string |
| `src/governance/multi-cohort-rollout.ts` (Wave B integration entrypoint) | `src/core/maal/canary/CanaryGateOrchestrator.ts:91-188` `CanaryGateOrchestrator.execute()` | same role: async lifecycle — assign cohort, simulate/observe window, collect telemetry, branch to decision | async execute(proposal), single mockMetrics observation block, switch on decision.action |

## Pattern Detail (as requested)

### 1. Threshold evaluation pattern — metrics → binary decision

- **Phase 4 location:** `src/governance/canary-engine.ts:96-124` (`CanaryEngine.determineDecision`) — hardcoded thresholds (`errorRate < 0.02`, `costDelta < 0.002`, `latencyP99Ms < 500`), ANDed for promote, ORed-negated for rollback, default hold. Reinforced by `src/core/maal/canary/CanaryCohortController.ts:39-100` (`decideCohortGrowth`) which separates **hard violations** (immediate rollback) from **soft violations** (pause only) — the two-tier severity split Phase 5 also needs.
- **Reuse mechanism (Phase 5):** `CustomMetricsEngine.evaluateThreshold()` (already sketched `src/tests/phase5-multicanary-ab-e2e.test.ts:147-170`) generalizes the hardcoded comparisons into an `operator` field (`>`,`<`,`>=`,`<=`,`==`,`!=`) read from a registered `CustomMetric`, so the same shape now serves arbitrary domain metrics instead of the fixed 3. `allMetricsPass()` (lines 197-210) is the direct AND-reduction analog of `determineDecision`'s all-pass check.

### 2. Decision tree pattern — proposal → governance decision (extend to variant → cohort → decision)

- **Phase 4 location:** `src/core/maal/governance/GovernanceReview.ts:41-88` (`GovernanceReview.review`) — ordered branches: validation failure → structural-change (manual approval) → caps violation → auto-approve. Simpler sibling: `src/governance/governance-engine.ts:13-26` (`GovernanceEngine.review`, single random-threshold branch) — use only as the "reason string on every branch" convention, not as the branching depth.
- **Reuse mechanism (Phase 5):** `ABTestEngine.createDecisionTree()` (`src/tests/phase5-multicanary-ab-e2e.test.ts:125-128`) extends the chain by one more hop: `proposal → variant → cohort → evaluate`. When implemented for real (currently a string stub), it should adopt `GovernanceReview`'s ordered early-return `Result<Decision, Error>` chain rather than the stub's string template — each new branch (variant lookup, cohort lookup, threshold evaluation) gets its own named reason, exactly like the structural/caps/auto-approve branches it's extending.

### 3. Async task pattern — observation window → decision event (parameterize for multi-cohort)

- **Phase 4 location:** `src/core/maal/canary/CanaryGateOrchestrator.ts:91-188` (`execute()`) — single async method: cache governance context (500ms TTL) → assign 1% cohort → "simulate observation period" (line 99, one `mockMetrics` block stands in for a real async wait) → record telemetry point → `cohortController.decideCohortGrowth()` → switch on `growthDecision.action` to emit `promoted/rolled_back/paused`. Wrapped by `src/core/maal/BridgeOrchestrator.ts:147-166` (`executeCanary`) as the `Result<T,E>`-returning async hook in the 5-step `executeFullFlow()` pipeline.
- **Reuse mechanism (Phase 5):** Parameterize the single hardcoded `cohortSize = 1` / one observation block into a loop over `MultiCohortEngine.getCohorts()` (10% → 25% → 50% → 100%, each with its own `duration_minutes` standing in for `observationWindowMs`). Each iteration: `CustomMetricsEngine.recordObservation()` (test file lines 139-145) plays the role of the telemetry-point recording step, and `CohortPromotionEngine.evaluatePromotion()` (lines 213-258) plays the role of the `switch (growthDecision.action)` block — but emits `promote_cohort` (advance to `MultiCohortEngine.getNextCohort()`) vs `promote_all` (no next cohort) vs `rollback`, instead of Phase 4's 3-way `promoted/rolled_back/paused`. Same async-per-window-then-branch skeleton, called once per cohort instead of once per proposal.

## Notes

- No `.planning/5/plan.md` exists yet; source-of-truth plan is `docs/meta/5-ijfw-plan-phase-5-multicanary.md` (Wave A/B table, 25 tests) plus charter `docs/meta/phase-5-multicanary-charter.md`.
- A full-shape skeleton for all four Wave A engines already exists inline in `src/tests/phase5-multicanary-ab-e2e.test.ts:66-258` (`MultiCohortEngine`, `ABTestEngine`, `CustomMetricsEngine`, `CohortPromotionEngine`) — builders should promote these classes out of the test file into `src/governance/*.ts` rather than re-deriving the shape.
- `PromotionEngine` in `src/governance/promotion-engine.ts` currently carries dead backward-compat branches (`evaluateMetrics` has an unreachable "Otherwise hold" comment vs `promote()` legacy method with divergent decision strings) — do not copy that duplication into `CohortPromotionEngine`; keep one decision surface.
