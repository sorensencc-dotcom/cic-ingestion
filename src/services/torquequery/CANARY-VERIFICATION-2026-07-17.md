# TorqueQuery v2 (memory/drift semantic search service) — Canary Verification, 2026-07-17

Scope: this document is about `TorqueQueryV2Server.py` in this repo, the
**memory/drift semantic search service** (CIC + MAAL). It is explicitly not
about, and makes no claim regarding, the separate documentation-RAG service
that used to informally share this name in a different repo. Tier 1 decision
2026-07-17 (Option i, split and rename): this service keeps the name
"TorqueQuery"; the other was renamed "torque-query-docs". See
`docs/meta/phases/torquequery-reconciliation-charter.md` in the main
`C:/dev` repo for the full decision record. The fast-path determinism gap
this document originally reported was fixed the same day, in a separate
follow-up commit — see `TorqueQueryV2Server.py`'s module docstring and
`HARDENING-NOTES.md`.

## Why this document exists

`memory/phase-5-torquequery-v2-complete.md` (dated 2026-07-02) asserts:

> Canary Gate Decision: APPROVED. All harnesses PASS. Determinism verified
> (avg drift 0.0955 < 0.15). Latency improved 78.4%.

The on-disk report that memory record should be describing,
`C:\dev\rewrite-docs\phase-5-harness-report.json` (timestamp
`2026-07-02T16:26:23`), does **not** show that. It shows:

```json
"canaryGate": { "approved": false, "reason": "Failures: MAAL=FAIL, CIC=PASS, Drift=PASS. Investigate before canary." },
"summary": {
  "maalRouting": { "passCount": 0, "failCount": 0, "avgDriftScore": 1, "verdict": "FAIL" },
  "cicIngestion": { "docCount": 0, "topMatchCount": 0, "fastPathWins": 0, "verdict": "PASS" },
  "driftScoring": { "passCount": 0, "warnCount": 0, "failCount": 0, "verdict": "PASS" }
}
```

Every count is zero. `avgDriftScore: 1` is the harness's own "complete
drift / connection failure" fallback value (see `computeDriftScore()` in
`src/tests/harnesses/maalRoutingReplay.ts` and `Compute-DriftScore` in
`phase-5-harness-runner.ps1`: they return `1.0` when either result set is
empty). The `cicIngestion`/`driftScoring` "PASS" verdicts in that report
are **vacuous** — `docCount: 0` and `passCount/failCount: 0` mean the loop
body never ran or every call errored before pushing a result, and the
verdict expressions (`cicFastWins >= cicResults.Count * 0.6` → `0 >= 0`,
`driftFails -eq 0` → `0 -eq 0`) are trivially true over an empty set. This
is not "3/5 harnesses genuinely passed" — it's "the harness couldn't reach
or use the server, and two of the three verdict formulas degrade to `true`
on empty input." The old memory record's "APPROVED... avg drift 0.0955...
latency improved 78.4%" numbers do not appear anywhere in this report file
and are not otherwise substantiated by anything on disk that this
investigation found.

**Conclusion: do not trust the 2026-07-02 memory record's "APPROVED"
claim at face value.** It does not match the report file it should be
describing, and that report file itself documents a broken/non-representative
run, not a genuine multi-harness pass.

## What actually happens on a fresh run today (2026-07-17)

1. Started the service locally: `python TorqueQueryV2Server.py` from
   `src/services/torquequery/`, confirmed listening on `0.0.0.0:8000`.
2. Hit `/health`: `{"status":"ok","version":"2.0.0"}` (pre-hardening
   response; see below for the hardened version added in this pass).
3. Ran the actual PowerShell runner
   (`C:\dev\rewrite-docs\phase-5-harness-runner.ps1 -BaseUrl http://localhost:8000`)
   against the live local instance. Full console output:

```
=== Phase 5 Harness Runner ===
Base URL: http://localhost:8000
Start: 2026-07-17 09:35:05

[1/3] MAAL Routing Replay
  Task t-001: governance caps for tool invocation...
    Drift: 0, Match: True
  Task t-002: docs ingestion pipeline architecture...
    Drift: 0, Match: True
  Task t-003: semantic search baseline performance...
    Drift: 0, Match: True
  Task t-004: MAAL routing state machine...
    Drift: 0, Match: True
  Task t-005: canary gate promotion criteria...
    Drift: 0, Match: True

  Summary: 5/5 PASS, Avg drift: 0

[2/3] CIC Ingestion Replay
  Doc doc-001 (architecture): ... Match: True, Slow: 2062ms, Fast: 2026ms (Diff: -36ms)
  Doc doc-002 (search): ...       Match: True, Slow: 2057ms, Fast: 2035ms (Diff: -22ms)
  Doc doc-003 (routing): ...      Match: True, Slow: 2055ms, Fast: 2071ms (Diff: 16ms)
  Doc doc-004 (governance): ...   Match: True, Slow: 2059ms, Fast: 2029ms (Diff: -30ms)
  Doc doc-005 (execution): ...    Match: True, Slow: 2037ms, Fast: 2056ms (Diff: 19ms)

  Summary: 5/5 top matches, 3/5 fast wins

[3/3] Drift Scoring Harness
  Case drift-001: domestic chip optimization strategies...     [PASS] Drift: 0 (threshold: 0.1)
  Case drift-002: training throughput improvements...          [PASS] Drift: 0 (threshold: 0.15)
  Case drift-003: hardware stack alignment...                  [PASS] Drift: 0 (threshold: 0.1)
  Case drift-004: semantic routing baseline performance...     [PASS] Drift: 0 (threshold: 0.12)
  Case drift-005: governance approval workflow...              [PASS] Drift: 0 (threshold: 0.08)

  Summary: 5 PASS, 0 WARN, 0 FAIL

=== PHASE 5 VALIDATION SUMMARY ===
Canary Gate: [APPROVED]
Reason: All harnesses PASS. Phase 4 schema valid, determinism verified, latency improved.
Next: Proceed to Canary A (10%) with monitoring gates.
```

So: **with the server actually running and reachable, today's code does
produce a genuine, non-vacuous 3/3 PASS** (5/5 MAAL matches, 5/5 top
matches + 3/5 fast-path "wins" on CIC, 5/5 drift-scoring PASS). This is a
materially different, and more informative, result than the broken
2026-07-02 report. The most defensible reading of the two artifacts
together: the 2026-07-02 run failed for operational reasons (server likely
not running/reachable at the time, or a connectivity issue), not because
the search logic itself was failing; when the server is actually up, the
harness's own math produces a clean pass.

### But: two things undercut how much this "PASS" is worth

**1. This is not a search-quality result — it's a self-consistency check
on a random-number simulation.** As stated in `TorqueQueryV2Server.py`'s
own code: `compute_embedding()` is `np.random.seed(hash(text) % 2**32);
return np.random.rand(4096)`, and `fast_path_search()`/`full_search()`
score with `np.random.rand(candidate_pool)` — there is no real corpus,
vector store, or encoder. A "PASS" here demonstrates that the deterministic
math is internally consistent (same seed in, same numbers out, within one
process), not that anything resembling real search relevance is being
measured. The doc IDs (`doc-000042`, etc.) are synthetic; there is no
`corpus/` on disk backing them.

**2. The harness's "determinism" claim does not hold for the actual
production call pattern.** Verified live during this investigation:

- When the server computes its own embedding from query text (no
  `normalized_embedding` in the request — i.e. the *slow path*, and how
  the harness scripts happen to call both their "baseline" and
  "optimized" legs), results are deterministic within a single running
  process, because `hash(query)` is stable for the life of that process.
- **When a caller supplies its own `normalized_embedding`** — which is
  exactly what the real `TorqueQueryClient.ts` (`normalizeEmbedding()` +
  `executeOptimizedQuery()`) and `torqueQueryV2.ts` fast-path call pattern
  actually does — `compute_embedding()` is never invoked, so **no seeding
  happens at all** in that branch. `fast_path_search()`'s
  `np.random.rand(candidate_pool)` draws from whatever the ambient global
  NumPy RNG state happens to be. Reproduced directly against the running
  service:

  ```
  ids r1: ['doc-000037', 'doc-000020', 'doc-000045', 'doc-000015', 'doc-000003']
  ids r2: ['doc-000017', 'doc-000015', 'doc-000029', 'doc-000010', 'doc-000023']
  match: False
  ```

  (Two back-to-back identical fast-path requests, with one unrelated
  request interleaved between them, returned completely different result
  sets.) This means the "determinism verified" claim only holds for the
  code path the *test harness* happens to exercise (both legs
  server-computing their own embedding) — not for the path the real
  client library actually uses in production. This is a real design gap,
  not a hardening-fixable footnote; see the "architecture-level flag"
  section below.

**3. `hash()` randomization means even the slow-path determinism is
per-process, not per-deployment.** `PYTHONHASHSEED` is unset in this
environment (confirmed: `hash('test')` returned a different value on two
separate `python -c` invocations). So the embeddings — and therefore all
downstream scores — silently reshuffle on every server restart unless
`PYTHONHASHSEED` is pinned. A canary/rollout process that assumes stable
scores across deploys would be wrong to assume that today.

**4. Latency: the harness's own numbers do not show anything like a 78%
improvement.** Per-call latency in this run was ~2000–2070ms for both
slow and fast paths (see CIC Ingestion Replay above), with fast-path
sometimes *slower* than slow-path (docs 003, 005). The ~2000ms figure
itself is suspicious for a local, no-I/O random-number computation over
HTTP — almost certainly `Invoke-WebRequest`/connection-negotiation
overhead in the PowerShell runner rather than service-side cost, but
either way, nothing here supports "latency improved 78.4%." That number is
unsubstantiated by any artifact this investigation found.

## Bottom line

- The **2026-07-02 report is not usable evidence of a canary pass** — it's
  a broken/zero-count run, most likely an operational failure to reach the
  server, not a genuine multi-harness verdict.
- **A fresh run today, with the server actually reachable, does produce a
  genuine (non-vacuous) 3/3 PASS** under the harness's own math — but that
  math is validating a random-number simulation's internal consistency,
  not real search behavior, and validates a code path (slow-path-vs-slow-path,
  both server-computing embeddings) that differs from what the real
  fast-path client integration (`TorqueQueryClient.ts`) actually calls.
- **The "determinism verified" claim is false for the real production
  call pattern.** Fast-path with a client-supplied embedding is not
  deterministic across repeated calls once other traffic interleaves —
  demonstrated live, reproduced in
  `src/services/torquequery/test_torque_query_v2.py::test_fast_path_with_client_supplied_embedding_is_not_seeded_by_query`.
  This is flagged as an architecture-level gap, not something this
  hardening pass silently patched (see HARDENING-NOTES.md).
- The "avg drift 0.0955" and "latency improved 78.4%" figures in the old
  memory record are not reproduced or substantiated by any artifact found
  during this investigation.

## Environment notes

- Python 3.12.2; `fastapi` 0.137.0, `pydantic` 2.13.4, `numpy` 2.4.5,
  `httpx` 0.28.1, `uvicorn` 0.47.0, `pytest` 9.1.0 — all already importable
  in the ambient environment; no venv/install was needed. No
  `requirements.txt` existed for this service before this pass (still none
  added, since the deps were already satisfied globally and the brief's
  four deliverables didn't call for one — flagged here as a known gap
  rather than silently left unmentioned).
- `pwsh` 7.6.1 was available, so `phase-5-harness-runner.ps1` was run
  directly rather than reimplemented.
- **Live port-8000 collision observed during this investigation**: partway
  through this work, an unrelated process
  (`python -m uvicorn src.main:app --host 127.0.0.1 --port 8000`, a
  different FastAPI app entirely — its `/health` reports
  `{"status":"initializing","version":"0.1.0-alpha", "models": {...}}`,
  clearly not this service) started listening on `127.0.0.1:8000` on this
  machine, while this service's own instance was bound to `0.0.0.0:8000`.
  On Windows, a same-port listener bound to a specific address
  (`127.0.0.1`) took precedence over the wildcard (`0.0.0.0`) bind for
  requests to `localhost`/`127.0.0.1`, silently redirecting `/health`
  checks to the wrong service. This is a live, reproduced instance of
  exactly the multi-"TorqueQuery"-service collision risk described in the
  governance background for this work — worth surfacing to whoever owns
  the pending Tier 1 naming decision, since it's not just a naming
  problem, it's an operational one (two same-named-in-spirit services can
  silently shadow each other on the same port on a dev machine). This
  investigation avoided killing the unrelated process and instead verified
  the hardened `/health` on an alternate port (`127.0.0.1:8010`).
