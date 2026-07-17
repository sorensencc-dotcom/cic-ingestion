# TorqueQuery v2 (memory/drift semantic search service) — Hardening Notes, 2026-07-17

Scope: `TorqueQueryV2Server.py` and its adapters in this repo. This service
is **the memory/drift semantic search service** (CIC + MAAL) — explicitly
not the documentation-RAG service also informally called "TorqueQuery" in
a different repo.

## What changed

1. **Ground-truth verification** — see `CANARY-VERIFICATION-2026-07-17.md`
   in this directory. Ran the service locally and re-ran the real
   `phase-5-harness-runner.ps1` against it. Found: (a) the 2026-07-02
   memory record's "APPROVED, avg drift 0.0955, latency +78.4%" claim does
   not match the on-disk report it should describe, and that report is
   itself a broken/zero-count run, not a genuine pass; (b) a fresh run
   today, with the server actually reachable, does produce a genuine 3/3
   PASS; (c) but the harness's "determinism" is validated on a code path
   (both legs computing their own embedding server-side) that is different
   from the real production fast-path call pattern
   (`TorqueQueryClient.ts`/`torqueQueryV2.ts`), which supplies its own
   embedding — and that path is demonstrably **not** deterministic across
   repeated calls once other requests interleave, because
   `compute_embedding()` (the only RNG-seeding point) is never invoked when
   a client-supplied embedding is present.

2. **`GET /health` hardened** (`TorqueQueryV2Server.py`) — now returns:
   - `service` / `service_description`: identifies this as the
     memory/drift semantic search service, explicitly distinct from the
     doc-RAG service in the other repo. No "the TorqueQuery" claim.
   - `dependency_checks`: cheap, honest, in-process checks (numpy usable,
     pydantic schema constructible) — no network/filesystem calls, nothing
     faked.
   - `backing_store: "simulated"` — stated plainly rather than omitted or
     spoofed as `"connected"`. There is no real corpus or vector index
     behind this service today.
   - `embedding_backend: "simulated-deterministic-hash-seed"` — names what
     `compute_embedding()` actually is (a placeholder), not a claim of a
     real encoder.
   - `determinism.hash_seed_pinned` + `determinism.note` — surfaces the two
     determinism caveats found during verification: (i) `hash()`
     randomization means slow-path determinism is per-process, not stable
     across restarts unless `PYTHONHASHSEED` is pinned; (ii) fast-path with
     a client-supplied embedding is not seeded by the query at all and is
     not deterministic under concurrent/interleaved traffic.

3. **`test_torque_query_v2.py`** (new, pytest + FastAPI `TestClient`, 11
   tests, all passing against the current code):
   - Health contract: honest `backing_store`, no fake connectivity claims,
     service correctly self-identifies vs. the doc-RAG service.
   - Slow-path determinism within a single process (repeat query → same
     top result), matching the drift-scoring harness's actual reliance.
   - Drift-score computation mirroring `Compute-DriftScore` /
     `computeDriftScore()` (top-result match, score-diff on match, 0.5 on
     mismatch) for the harness's fixed query set, staying under each
     case's threshold.
   - `fast_path_used` parametrized against the real 3-condition eligibility
     expression in `search()` (`fast_path AND normalized_embedding is not
     None AND skip_mmr is True`) — 5 cases covering every combination.
   - **A test that documents the fast-path-with-client-embedding
     determinism gap explicitly** (asserts today's actual, non-ideal
     behavior, with a docstring saying so and instructions to update the
     test — not silently pass over — if the underlying seeding bug is ever
     fixed).
   - `batch-search` swallowing individual failures, documented as current
     behavior (a future fix to surface per-item errors would be a
     deliberate, visible change).
   - One test's docstring explicitly frames this suite as testing
     memory/drift-search behavior, distinct from the doc-RAG service.

4. **`src/adapters/torqueQueryV2Shadow.ts`** (new) — opt-in shadow
   comparison adapter, gated by `TORQUEQUERY_SHADOW_ENABLED` (unset/false
   by default). When enabled, `shadowCompare()` fires a parallel search
   call using the same request payload as a real call site's own
   `torqueQueryV2Search()` call, and logs a JSON comparison (top-result
   agreement, latency delta, fast-path-used agreement) via an injectable
   logger. It never throws into the caller's real response path and never
   modifies `torqueQueryV2.ts` — verified via grep that the only current
   callers of `torqueQueryV2Search`/`torqueQueryV2Health` are the Phase 5
   harness files (`maalRoutingReplay.ts`, `driftScoringHarness.ts`), and
   neither was touched.

## Why (the short version)

The prior memory record's canary approval could not be trusted at face
value — it didn't match its own supporting artifact. Rather than
re-approving or re-asserting either the old memory claim or the old
broken report, this pass re-established what's actually true today (a
process-scoped, math-only "pass" with a real determinism gap in the
production call path), made `/health` say that honestly instead of
nothing, added tests that pin down both the good behavior (slow-path
in-process determinism) and the bad (fast-path-with-embedding
non-determinism) so neither regresses silently, and added a fully
reversible way to compare fast/slow-path behavior in a live deployment
without touching any existing caller.

## What this pass explicitly did NOT do

- Did not implement a real corpus, vector store, or encoder. The
  placeholder-vs-real-corpus gap is architectural, not a hardening task —
  flagged here and in CANARY-VERIFICATION-2026-07-17.md as something that
  needs a real design decision, not a patch.
- Did not fix the fast-path/client-embedding seeding gap in `search()`
  itself. Fixing it would change production search behavior, which is
  outside "make what exists today verifiably solid" — it's called out,
  tested, and left for a deliberate follow-up decision.
- Did not rename anything, touch governance docs, or claim this is "the"
  TorqueQuery anywhere.
- Did not modify `TorqueQueryClient.ts` or any existing call site of
  `torqueQueryV2.ts`.
- Did not resolve the live port-8000 collision with the unrelated
  `uvicorn src.main:app` process discovered during verification — flagged,
  not touched.

**Tier 1 decision APPROVED 2026-07-17** (Option i, split and rename): this
service keeps the name "TorqueQuery"; the documentation-RAG service was
renamed "torque-query-docs". See
docs/meta/phases/torquequery-reconciliation-charter.md in the main c:\dev
repo for the full decision record. The fast-path determinism bug documented
above was fixed the same day, in a separate follow-up commit — see
TorqueQueryV2Server.py's module docstring.
